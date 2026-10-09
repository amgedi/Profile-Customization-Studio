import type { Editor } from "../editor.js";

export function CollapsedRightStrip({ editor }: { editor: Editor }) {
  return (
    <div className="panel-collapsed-strip right">
      <button className="panel-collapse-btn" title="Expand inspector" aria-label="Expand inspector"
        onClick={() => editor.setRightCollapsed(false)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transform: "rotate(-90deg)" }}>
          <path d="m18 15-6-6-6 6" />
        </svg>
      </button>
    </div>
  );
}
