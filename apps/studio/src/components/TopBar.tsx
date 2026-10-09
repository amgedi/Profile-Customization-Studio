import { PCSLogo } from "./PCSLogo.js";
import { ProTools } from "./ProTools.js";
import { useEffect, useState, type ReactNode } from "react";
import { Undo2, Redo2, Download, Minus, Square, Copy, X, Search, Settings, Play, Pause, Save } from "lucide-react";
import type { Editor } from "../editor.js";
import { APP_VERSION } from "../version.js";
function WindowControls() {
  const [maximized, setMaximized] = useState(false);
  const native = "__TAURI_INTERNALS__" in window;
  useEffect(() => {
    if (!native) return;
    let dispose: (() => void) | undefined, alive = true;
    void import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
      const w = getCurrentWindow(); setMaximized(await w.isMaximized());
      const off = await w.onResized(async () => { if (alive) setMaximized(await w.isMaximized()); });
      if (alive) dispose = off; else off();
    });
    return () => { alive = false; dispose?.(); };
  }, [native]);
  const act = (method: "minimize" | "toggleMaximize" | "close") => void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => getCurrentWindow()[method]());
  return native ? <div className="studio-window-controls">
    <button aria-label="Minimize" onClick={() => act("minimize")}><Minus size={14}/></button>
    <button aria-label={maximized ? "Restore" : "Maximize"} onClick={() => act("toggleMaximize")}>{maximized ? <Copy size={12}/> : <Square size={12}/>}</button>
    <button aria-label="Close" onClick={() => act("close")}><X size={15}/></button>
  </div> : null;
}
export function TopBar({ editor, menuBar, onOpenPalette, onOpenSettings, onGoHome, onToggleExperience, experience, home }: {
  editor: Editor & { doOpen(): void; doSave(): void; doExport(): void };
  home?: boolean; onNew: () => void; menuBar?: ReactNode; onOpenPalette?: () => void; quick?: boolean;
  experience?: "quick" | "advanced"; onToggleExperience?: () => void; onOpenSettings?: () => void; onGoHome?: () => void;
}) {
  return <header className="studio-chrome">
    <div className="studio-title-row">
      <button className="studio-mark" aria-label="Go to Home" onClick={onGoHome}><PCSLogo decorative /></button>
      {menuBar}<ProTools editor={editor}/>
      <div className="studio-drag" data-tauri-drag-region onDoubleClick={() => {
        if ("__TAURI_INTERNALS__" in window) void import("@tauri-apps/api/window").then(({getCurrentWindow}) => getCurrentWindow().toggleMaximize());
      }}><span data-tauri-drag-region>Profile Customization Studio <small data-tauri-drag-region>{APP_VERSION}</small></span></div>
      <button className="studio-search-field" aria-label="Command palette" title="Search everything · Ctrl+K" onClick={onOpenPalette}><Search size={16}/><span>Search tools, scenes & effects</span><kbd>Ctrl K</kbd></button>
      <button className="studio-icon" aria-label="Settings" onClick={onOpenSettings}><Settings size={16}/></button>
      <WindowControls/>
    </div>
    {!home && <div className="studio-document-row">

      <div className="studio-breadcrumb" title={editor.project.name + " / Main Banner"}><strong>{editor.project.name}</strong><span>/</span><span>{editor.mode === "profile" ? "Profile" : "Master design"}</span></div>
      <span className="studio-save-state" data-state={editor.saveState} role="status"><i/>{editor.saveState === "saved" ? "Saved" : "Unsaved"}</span>
      <div className="studio-mode-tabs" role="tablist" aria-label="Workspace mode">
        {(["design", "animate", "profile", "preview"] as const).map(m => <button key={m} role="tab" aria-selected={editor.mode === m} onClick={() => editor.setMode(m)}>{m === "design" ? "Design" : m === "animate" ? "Motion" : m === "profile" ? "Profile" : "Preview"}</button>)}
      </div>
      <div className="studio-document-actions">
        <button className="btn studio-playback" aria-label={editor.playing ? 'Pause animation' : 'Play animation'} title="Play / pause · Space" aria-pressed={editor.playing} onClick={()=>editor.setPlaying(!editor.playing)}>{editor.playing?<Pause size={15}/>:<Play size={15}/>}<span>{editor.playing?'Pause':'Play'}</span></button>
        <button className="studio-icon" aria-label="Undo" disabled={!editor.store.canUndo()} onClick={editor.undo}><Undo2 size={16}/></button>
        <button className="studio-icon" aria-label="Redo" disabled={!editor.store.canRedo()} onClick={editor.redo}><Redo2 size={16}/></button>
        <button className="studio-icon" aria-label="Save project" title="Save · Ctrl+S" onClick={() => editor.doSave()}><Save size={16}/></button>
        <button className="btn" onClick={onToggleExperience}>{experience === "advanced" ? "Simple controls" : "Full controls"}</button>
        <button data-tour="export" className="btn primary" onClick={() => editor.doExport()}><Download size={14}/> Export</button>
      </div>
    </div>}
  </header>;
}
