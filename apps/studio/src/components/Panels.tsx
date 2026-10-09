import { SupportPanel } from "./SupportPanel.js";
import { APP_VERSION } from "../version.js";
import { checkCompatibility } from "../github/readme.js";
import { buildExportPackage } from "../github/export.js";
import type { Editor } from "../editor.js";
export function CompatibilityDialog({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const files = buildExportPackage({ project: editor.project, lightDark: true, includeWorkflow: true, animatedContribution: true });
  const checks = checkCompatibility(files);
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Compatibility inspector">
        <h2>GitHub Compatibility Inspector</h2>
        <p className="dialog-sub">Export package preview — checks what GitHub supports.</p>
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
          <button className="btn primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export function TutorialDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" style={{ width: 560 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Tutorial">
        <h2>Publishing your profile on GitHub</h2>
        <p className="dialog-sub">A short, plain-language guide. No Git knowledge required.</p>
        <ol className="tutorial-list">
          <li><strong>What is a profile README?</strong> GitHub shows the README of a repository named exactly like your username on your profile page. Create a public repo named after your username.</li>
          <li><strong>Where do banner files go?</strong> Copy the exported <code>assets/</code> folder and <code>README.md</code> into that repository.</li>
          <li><strong>Relative paths.</strong> The generated README references <code>assets/…</code> — that works because the files sit next to the README in the same repository.</li>
          <li><strong>Light / dark.</strong> If you exported both variants, the README uses <code>&lt;picture&gt;</code> markup and GitHub picks the right one automatically.</li>
          <li><strong>Contribution animation.</strong> The animated SVG plays right inside the README image. The optional GitHub Action keeps it fresh — inspect <code>.github/workflows/profile-assets.yml</code> before enabling.</li>
          <li><strong>Nothing is uploaded by the Studio.</strong> You push the files yourself with your normal Git workflow.</li>
        </ol>
        <div className="dialog-actions">
          <button className="btn primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}

export function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="About">
        <h2>Profile Customization Studio</h2>
        <p className="dialog-sub">{APP_VERSION} · BannerSpec 0.3 · Make your profile yours.</p>
        <p style={{ color: "var(--pcs-text-secondary)", lineHeight: 1.6 }}>
          A local design workstation for GitHub profile and repository visuals.
          Scenes are stored in the open, versioned <strong>BannerSpec 0.3</strong> format.
          Everything runs and exports locally — nothing is published for you.
        </p>
        <SupportPanel/>
        <div className="dialog-actions">
          <button className="btn primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
