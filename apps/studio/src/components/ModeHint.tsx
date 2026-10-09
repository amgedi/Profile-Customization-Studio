import { useEffect, useState } from "react";
import type { WorkspaceMode } from "../editor.js";

const HINTS: Record<WorkspaceMode, string> = {
  design: "Change colors, text, backgrounds and visual style.",
  animate: "Make elements move, appear, glow or loop.",
  profile: "Choose a platform, preview your identity, and edit the current banner.",
  preview: "See how it will look before publishing.",
};

const KEY = "pcs-mode-hints-done";

/**
 * First-time per-workspace explanation. Small popover, not a tutorial modal.
 * "Don't show again" persists.
 */
export function ModeHint({ mode }: { mode: WorkspaceMode }) {
  const [visible, setVisible] = useState(false);
  const [dismissedAll, setDismissedAll] = useState(() => localStorage.getItem(KEY) === "1");

  useEffect(() => {
    if (dismissedAll) return;
    const seen = JSON.parse(localStorage.getItem("pcs-mode-hints") ?? "{}") as Record<string, boolean>;
    if (!seen[mode]) setVisible(true);
  }, [mode, dismissedAll]);

  const dismiss = (forever: boolean) => {
    setVisible(false);
    if (forever) {
      localStorage.setItem(KEY, "1");
      setDismissedAll(true);
      return;
    }
    const seen = JSON.parse(localStorage.getItem("pcs-mode-hints") ?? "{}") as Record<string, boolean>;
    seen[mode] = true;
    localStorage.setItem("pcs-mode-hints", JSON.stringify(seen));
  };

  if (!visible || dismissedAll) return null;
  return (
    <div className="mode-hint" role="status">
      <span className="mode-hint-text">{HINTS[mode]}</span>
      <button className="btn" onClick={() => dismiss(false)}>Got it</button>
      <button className="btn ghost" onClick={() => dismiss(true)}>Don't show these again</button>
    </div>
  );
}
