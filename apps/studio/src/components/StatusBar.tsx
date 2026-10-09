import type { Editor } from "../editor.js";
import { BANNERSPEC_VERSION } from "../version.js";

export function StatusBar({ editor, status }: { editor: Editor; status: string }) {
  return (
    <footer className="statusbar">
      <span>{status}</span>
      <span className="spacer" />
      <span className="meta">{editor.doc.canvas.width}×{editor.doc.canvas.height} · {editor.doc.layers.length} layers</span>
      {editor.hasErrors.length
        ? <span className="status-errors">{editor.hasErrors.length} issue(s)</span>
        : <span className="status-ok">BannerSpec {BANNERSPEC_VERSION} ✓</span>}
    </footer>
  );
}
