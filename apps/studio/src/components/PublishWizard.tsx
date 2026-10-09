import { useEffect, useMemo, useState } from "react";
import { Check, Copy, FolderOpen, ExternalLink, AlertTriangle } from "lucide-react";
import { buildExportPackage, ensureProjectDefaults, collectPhotoData } from "../github/export.js";
import { checkCompatibility, SETUP_GUIDE } from "../github/readme.js";
import { generateWorkflowYaml } from "../github/readme.js";
import { exportPackage } from "../io.js";
import { isTauri } from "../tauri.js";
import {
  connectionState, connect as ghConnect, storeToken, deleteToken, publishFiles,
  type ConnectionState, type PublishFileStatus,
} from "../github/connection.js";
import type { Editor } from "../editor.js";

type Target = "github-profile" | "github-repo" | "download" | "custom";

const TARGETS: Array<{ id: Target; name: string; blurb: string }> = [
  { id: "github-profile", name: "GitHub Profile", blurb: "Banner + README + stats + contribution game" },
  { id: "github-repo", name: "GitHub Repository", blurb: "Banner + social preview image" },
  { id: "download", name: "Download Files", blurb: "Just the images and README" },
  { id: "custom", name: "Custom Platform", blurb: "Any site that accepts images" },
];

const PUBLISHABLE = (files: Record<string, string>) =>
  Object.keys(files).filter((f) => f !== "SETUP.md");

/**
 * Publish & Export wizard (R100-103).
 * Step 1 target → Step 2 preview → Step 3 compatibility →
 * Step 4 method (manual checklist, or connected direct publish with
 * explicit confirm — never a silent overwrite) → Step 5 finish.
 */
export function PublishWizard({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [target, setTarget] = useState<Target>("github-profile");
  const [exportResult, setExportResult] = useState<{ dir: string; preserved: string[] } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const project = useMemo(() => ensureProjectDefaults(editor.currentProject()), [editor.project, editor.doc]);
  const [photoData, setPhotoData] = useState<Record<string, string>>({});
  useEffect(() => { void collectPhotoData(project).then(setPhotoData); }, [project]);
  const files = useMemo(() => buildExportPackage({
    project, lightDark: true, includeWorkflow: target === "github-profile", animatedContribution: true, photoData,
  }), [project, target, photoData]);
  const checks = useMemo(() => checkCompatibility(files), [files]);
  const username = project.readme?.username ?? "yourname";

  // ---- direct GitHub publish (R101) --------------------------------------
  const [conn, setConn] = useState<ConnectionState>({ state: "unavailable" });
  const [tokenInput, setTokenInput] = useState("");
  const [connBusy, setConnBusy] = useState(false);
  const [connError, setConnError] = useState<string | null>(null);
  const [repoFull, setRepoFull] = useState(`${username}/${username}`);
  const [review, setReview] = useState<null | Array<{ path: string; existed: boolean; error?: string }>>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [results, setResults] = useState<PublishFileStatus[] | null>(null);

  useEffect(() => { void connectionState().then(setConn); }, []);
  useEffect(() => { setRepoFull(`${username}/${username}`); }, [username]);

  const doConnect = async () => {
    setConnBusy(true); setConnError(null);
    const check = await ghConnect(tokenInput.trim());
    if (!check.ok) {
      setConnError(check.error ?? "Could not connect.");
      setConnBusy(false);
      return;
    }
    const stored = await storeToken(tokenInput.trim());
    setTokenInput("");
    setConn(stored && isTauri()
      ? { state: "connected", login: check.login! }
      : { state: "unavailable" });
    if (!stored) setConnError("Connected, but this environment cannot store credentials securely.");
    setConnBusy(false);
  };

  const doDisconnect = async () => {
    await deleteToken();
    setConn({ state: isTauri() ? "disconnected" : "unavailable" });
    setReview(null); setResults(null);
  };

  const reviewChanges = async () => {
    setConnError(null);
    const token = await import("../github/connection.js").then((m) => m.getToken());
    if (!token) { setConnError("Not connected."); return; }
    const [owner, repo] = repoFull.split("/");
    if (!owner || !repo) { setConnError("Repository must look like owner/name."); return; }
    const paths = PUBLISHABLE(files);
    const checked: Array<{ path: string; existed: boolean; error?: string }> = [];
    for (const p of paths) {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${p.split("/").map(encodeURIComponent).join("/")}?ref=main`,
          { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } },
        );
        checked.push({ path: p, existed: res.ok });
      } catch (e) {
        checked.push({ path: p, existed: false, error: (e as Error).message });
      }
    }
    setReview(checked);
  };

  const doDirectPublish = async () => {
    const [owner, repo] = repoFull.split("/");
    if (!owner || !repo) { setConnError("Repository must look like owner/name."); return; }
    setPublishing("Starting…");
    const res = await publishFiles({
      owner, repo, branch: "main",
      files: Object.fromEntries(PUBLISHABLE(files).map((p) => [p, files[p] ?? ""])),
      onProgress: (path, i, total) => setPublishing(`Uploading ${path} (${i + 1}/${total})`),
    });
    setPublishing(null);
    setResults(res);
    if (res.every((r) => r.ok)) {
      editor.setSaveState(editor.saveState);
      setStep(4);
    }
  };

  const copy = async (label: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(null), 1500); } catch { /* noop */ }
  };

  const openFolder = async (dir: string) => {
    if (!isTauri()) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_path", { path: dir });
    } catch { /* noop */ }
  };

  const doExport = async () => {
    const res = await exportPackage(files);
    if (res) {
      setExportResult({ dir: res.dir, preserved: res.preserved });
      setStep(4);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog publish-wizard" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Publish and export">
        <div className="publish-steps">
          {["Where", "Preview", "Will it work?", "Publish", "Done"].map((s, i) => (
            <span key={s} className={"publish-step" + (i === step ? " active" : i < step ? " done" : "")}>{s}</span>
          ))}
        </div>

        {step === 0 && (
          <>
            <h2>Where do you want this?</h2>
            <div className="template-grid">
              {TARGETS.map((t) => (
                <button key={t.id} className={"template-card" + (target === t.id ? " selected" : "")} onClick={() => setTarget(t.id)}>
                  <span className="t-name">{t.name}</span>
                  <span className="t-dim">{t.blurb}</span>
                </button>
              ))}
            </div>
            <div className="dialog-actions">
              <button className="btn ghost" onClick={onClose}>Cancel</button>
              <button className="btn primary" onClick={() => setStep(1)}>Next</button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2>Preview</h2>
            <p className="dialog-sub">What will be generated.</p>
            <div className="publish-files">
              {Object.keys(files).filter((f) => f !== "SETUP.md").map((f) => (
                <div key={f} className="publish-file"><Check size={12} /> {f}</div>
              ))}
            </div>
            <div className="dialog-actions">
              <button className="btn ghost" onClick={() => setStep(0)}>Back</button>
              <button className="btn primary" onClick={() => setStep(2)}>Next</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2>Will this work on GitHub?</h2>
            <div className="compat-list">
              {checks.map((c) => (
                <div key={c.label} className="compat-row">
                  <span className={`compat-dot ${c.status}`} />
                  <span className="compat-label">{c.label}</span>
                  <span className="compat-detail">{c.detail}</span>
                </div>
              ))}
            </div>
            <div className="dialog-actions">
              <button className="btn ghost" onClick={() => setStep(1)}>Back</button>
              <button className="btn primary" onClick={() => setStep(3)}>Next</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2>Put it on GitHub</h2>
            {review === null ? (
              <>
                <div className="publish-methods">
                  <div className="publish-method">
                    <h3>Manual (no account needed)</h3>
                    <ol className="publish-checklist">
                      <li>On GitHub, create a public repository named <code>{username}/{username}</code></li>
                      <li>Export the package below and copy its files into that repository</li>
                      <li>Paste the README (kept separately if one already exists)</li>
                      <li>Commit — your profile updates</li>
                    </ol>
                    <div className="publish-actions">
                      <button className="btn primary" onClick={() => void doExport()}><FolderOpen size={13} /> Export package…</button>
                      <button className="btn" onClick={() => void copy("readme", files["README.md"] ?? "")}>
                        {copied === "readme" ? <Check size={13} /> : <Copy size={13} />} Copy README
                      </button>
                      <button className="btn" onClick={() => void copy("workflow", files[".github/workflows/profile-assets.yml"] ?? generateWorkflowYaml())}>
                        {copied === "workflow" ? <Check size={13} /> : <Copy size={13} />} Copy Action
                      </button>
                      <button className="btn" onClick={() => window.open(`https://github.com/new`, "_blank")}>
                        <ExternalLink size={13} /> Open GitHub
                      </button>
                    </div>
                  </div>
                  <div className="publish-method">
                    <h3>Connect GitHub (direct publish)</h3>
                    {conn.state === "unavailable" && (
                      <p className="paint-hint">Direct publishing needs the desktop app (for secure credential storage). Use the manual steps — they work everywhere.</p>
                    )}
                    {conn.state === "disconnected" && (
                      <>
                        <p className="paint-hint">Paste a GitHub personal access token (fine-grained, Contents: read/write on your profile repo). It is stored in your OS credential store — never in project files.</p>
                        <div className="publish-actions">
                          <input className="field-input" type="password" placeholder="github_pat_…" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} aria-label="GitHub token" style={{ width: 220 }} />
                          <button className="btn primary" disabled={!tokenInput.trim() || connBusy} onClick={() => void doConnect()}>{connBusy ? "Checking…" : "Connect"}</button>
                        </div>
                      </>
                    )}
                    {conn.state === "connected" && (
                      <>
                        <p className="paint-hint">Connected as <strong>{conn.login}</strong>. <button className="btn ghost" onClick={() => void doDisconnect()}>Disconnect</button></p>
                        <div className="publish-actions">
                          <input className="field-input" value={repoFull} onChange={(e) => setRepoFull(e.target.value)} aria-label="Repository (owner/name)" style={{ width: 200 }} />
                          <button className="btn" onClick={() => void reviewChanges()}>Review changes…</button>
                        </div>
                      </>
                    )}
                    {connError && (
                      <p className="paint-hint" style={{ color: "var(--pcs-warning)" }}><AlertTriangle size={12} /> {connError}</p>
                    )}
                  </div>
                </div>
                <div className="dialog-actions">
                  <button className="btn ghost" onClick={() => setStep(2)}>Back</button>
                </div>
              </>
            ) : (
              <>
                <h3>Review changes to <code>{repoFull}</code> (main)</h3>
                <p className="dialog-sub">Files marked <strong>update</strong> already exist and will be <strong>overwritten</strong>. Nothing is uploaded until you confirm.</p>
                <div className="publish-files">
                  {review.map((r) => (
                    <div key={r.path} className="publish-file">
                      {r.existed ? <AlertTriangle size={12} /> : <Check size={12} />} {r.path} — {r.error ? `could not check (${r.error})` : r.existed ? "update (existing file will be replaced)" : "create (new file)"}
                    </div>
                  ))}
                </div>
                {publishing && <p className="paint-hint">{publishing}</p>}
                {results && results.some((r) => !r.ok) && (
                  <div className="publish-files">
                    {results.filter((r) => !r.ok).map((r) => (
                      <div key={r.path} className="publish-file" style={{ color: "var(--pcs-warning)" }}>
                        <AlertTriangle size={12} /> {r.path}: {r.error}
                      </div>
                    ))}
                  </div>
                )}
                <div className="dialog-actions">
                  <button className="btn ghost" onClick={() => { setReview(null); setResults(null); }}>Back</button>
                  <button className="btn primary" disabled={!!publishing} onClick={() => void doDirectPublish()}>
                    {publishing ? "Publishing…" : "Confirm & publish"}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <h2>Your design is ready 🎉</h2>
            {results && results.every((r) => r.ok) && (
              <p className="dialog-sub">
                Published {results.filter((r) => r.ok).length} file(s) to <strong>{repoFull}</strong>. Your profile page will update in a moment.
                {results[0]?.commitUrl && <> <a href={results[0]!.commitUrl} target="_blank" rel="noreferrer">View the commit</a>.</>}
              </p>
            )}
            {exportResult && (
              <p className="dialog-sub">
                {exportResult.preserved.length > 0
                  ? `Exported to ${exportResult.dir}. Existing files were preserved (new copies saved as .pcs-new / README.pcs.md).`
                  : `Exported to ${exportResult.dir}.`}
              </p>
            )}
            <div className="publish-actions" style={{ marginBottom: 10 }}>
              {exportResult?.dir && <button className="btn" onClick={() => void openFolder(exportResult.dir)}><FolderOpen size={13} /> Open folder</button>}
              <button className="btn" onClick={() => { setStep(3); setReview(null); setResults(null); }}>Show manual steps</button>
              <button className="btn" onClick={() => void copy("setup", files["SETUP.md"] ?? "")}>
                {copied === "setup" ? <Check size={13} /> : <Copy size={13} />} Copy setup guide
              </button>
            </div>
            <p className="dialog-sub">Want a step-by-step? Open SETUP.md in the export folder — it walks through publishing in plain language.</p>
            <div className="dialog-actions">
              <button className="btn ghost" onClick={onClose}>Close</button>
              <button className="btn primary" onClick={onClose}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

void SETUP_GUIDE;
