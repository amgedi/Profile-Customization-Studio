/**
 * GitHub connection + direct publish (R91, R101).
 * - Token lives ONLY in the OS secure credential store via Tauri keyring
 *   commands (Windows Credential Manager). Never project JSON, localStorage
 *   or logs. In a plain browser shell the connection is unavailable.
 * - Publish uses the official Contents API: existing files are detected and
 *   the user must explicitly confirm before anything is overwritten.
 */
import { isTauri } from "../tauri.js";

const ACCOUNT = "github-token";

export type ConnectionState =
  | { state: "unavailable" }
  | { state: "disconnected" }
  | { state: "connected"; login: string };

export async function getToken(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<string | null>("secure_get_secret", { account: ACCOUNT });
  } catch {
    return null;
  }
}

export async function storeToken(token: string): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("secure_set_secret", { account: ACCOUNT, secret: token });
    return true;
  } catch {
    return false;
  }
}

export async function deleteToken(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("secure_delete_secret", { account: ACCOUNT });
    return true;
  } catch {
    return false;
  }
}

/** Validate a token against /user and remember the login. */
export async function connect(token: string): Promise<{ ok: boolean; login?: string; error?: string }> {
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    });
    if (!res.ok) {
      return { ok: false, error: res.status === 401 ? "Token was rejected by GitHub (401)." : `GitHub returned ${res.status}.` };
    }
    const user = (await res.json()) as { login: string };
    return { ok: true, login: user.login };
  } catch (e) {
    return { ok: false, error: `Could not reach GitHub: ${(e as Error).message}` };
  }
}

export async function connectionState(): Promise<ConnectionState> {
  if (!isTauri()) return { state: "unavailable" };
  const token = await getToken();
  if (!token) return { state: "disconnected" };
  const r = await connect(token);
  return r.ok ? { state: "connected", login: r.login! } : { state: "disconnected" };
}

export interface PublishFileStatus {
  path: string;
  action: "create" | "update";
  existed: boolean;
  ok: boolean;
  error?: string;
  commitUrl?: string;
}

/** Push files to a repo branch via the Contents API. Each file that already
 *  exists is updated (its sha is fetched first) — the caller must have shown
 *  and had the user confirm this list beforehand (no silent overwrite). */
export async function publishFiles(opts: {
  owner: string;
  repo: string;
  branch?: string;
  files: Record<string, string>;
  onProgress?: (path: string, index: number, total: number) => void;
}): Promise<PublishFileStatus[]> {
  const token = await getToken();
  if (!token) throw new Error("Not connected to GitHub.");
  const branch = opts.branch || "main";
  const out: PublishFileStatus[] = [];
  const entries = Object.entries(opts.files);
  for (let i = 0; i < entries.length; i++) {
    const [path, content] = entries[i]!;
    opts.onProgress?.(path, i, entries.length);
    try {
      // Existing file?
      let sha: string | undefined;
      const head = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(opts.owner)}/${encodeURIComponent(opts.repo)}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } },
      );
      if (head.ok) {
        const body = (await head.json()) as { sha?: string };
        sha = body.sha;
      }
      const res = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(opts.owner)}/${encodeURIComponent(opts.repo)}/contents/${encodePath(path)}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
          body: JSON.stringify({
            message: sha ? `Update ${path} (Profile Customization Studio)` : `Add ${path} (Profile Customization Studio)`,
            content: btoa(unescape(encodeURIComponent(content))),
            branch,
            ...(sha ? { sha } : {}),
          }),
        },
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        out.push({ path, action: sha ? "update" : "create", existed: !!sha, ok: false, error: `GitHub returned ${res.status}${detail ? ` — ${detail.slice(0, 140)}` : ""}` });
      } else {
        const body = (await res.json()) as { commit?: { html_url?: string } };
        out.push({ path, action: sha ? "update" : "create", existed: !!sha, ok: true, commitUrl: body.commit?.html_url });
      }
    } catch (e) {
      out.push({ path, action: "create", existed: false, ok: false, error: (e as Error).message });
    }
  }
  return out;
}

function encodePath(p: string): string {
  return p.split("/").map(encodeURIComponent).join("/");
}
