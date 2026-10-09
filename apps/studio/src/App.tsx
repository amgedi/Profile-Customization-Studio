import { PCSLogo } from "./components/PCSLogo.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { renderSvg } from "@pcs/scene-core";
import { migrateDocument } from "@pcs/bannerspec";
import { useEditor, type Experience } from "./editor.js";
import { exportPackage, exportSvg, importImage, loadRecents, parseProjectText, pickOpenProject, readProjectFile, recordRecent, writeProject, type RecentEntry } from "./io.js";
import { newProject, type PCSProject } from "./project.js";
import { commandForEvent } from "./shortcuts.js";
import { buildCommands, type StudioActions } from "./commands.js";
import { OverlayHost } from "./components/OverlayHost.js";
import { TutorialWelcome } from "./components/TutorialWelcome.js";
import { SupportPanel } from "./components/SupportPanel.js";
import { needsTutorial, rememberTutorial, type TutorialStatus } from "./onboarding.js";
import { DiscoveryPanel, type DiscoverySection } from "./components/DiscoveryPanel.js";
import { TopBar } from "./components/TopBar.js";
import { MenuBars } from "./components/MenuBars.js";
import { Inspector, CollapsedRightStrip } from "./components/Inspector.js";
import { CanvasWorkspace } from "./components/CanvasWorkspace.js";
import { StatusBar } from "./components/StatusBar.js";
import { sequenceScenes, sceneGroup } from "./sequence.js";
import { ContextMenu, type MenuItem } from "./components/ContextMenu.js";
import { CommandPalette } from "./components/CommandPalette.js";
import { NewProjectDialog, TEMPLATES } from "./components/NewProjectDialog.js";
import { AboutDialog, CompatibilityDialog, TutorialDialog } from "./components/Panels.js";
import { AnimateWorkspace } from "./components/AnimateWorkspace.js";
import { PlatformWorkspace } from "./components/PlatformWorkspace.js";
import { PublishWizard } from "./components/PublishWizard.js";
import { ExportStudio } from "./components/ExportStudio.js";
import { GuideMe } from "./components/GuideMe.js";
import { SettingsDialog, applyPrefs, type AppPrefs } from "./components/SettingsDialog.js";
import { DEFAULT_PREFS, loadValidatedPrefs, persistPrefs, setSafeMode, isSafeMode, safeModePrefs } from "./prefs.js";
import { LayersTree } from "./components/QuickPanels.js";
import { SceneBrowser } from "./components/SceneGallery.js";
import { ModeHint } from "./components/ModeHint.js";
import { APP_VERSION } from "./version.js";
import { recentIds, type PresetKind } from "./presetStore.js";
import { EFFECT_PRESETS } from "./effects.js";
import { SCENE_LIBRARY, type SceneEntry } from "./sceneLibrary.js";
import { SpotlightTour, type TourStep } from "./components/SpotlightTour.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { Toasts, notify } from "./components/Toasts.js";
import { CursorGlow } from "./components/CursorGlow.js";
import { TooltipHost } from "./components/TooltipHost.js";
import { loadJSON, saveJSON, removeJSON } from "./storage.js";
import { insertLocalImage } from "./imageImport.js";
import { previewLayer } from "./layerTree.js";

/** Custom close confirmation: Save / Don't Save / Cancel — all three work,
 *  Cancel keeps the app open. Shown once per close request, never loops. */
function ClosePrompt({ projectName, onChoice }: { projectName: string; onChoice: (c: "save" | "discard" | "cancel") => void }) {
  return (
    <div className="dialog-overlay" style={{ zIndex: "var(--z-confirm)" }} role="dialog" aria-label="Save changes before continuing">
      <div className="dialog" style={{ width: 400 }} onClick={(e) => e.stopPropagation()}>
        <h2>Save changes to “{projectName}”?</h2>
        <p className="dialog-sub">
          Save this project before continuing, or discard the current changes.
        </p>
        <div className="dialog-actions">
          <button className="btn" onClick={() => onChoice("cancel")}>Cancel</button>
          <button className="btn" onClick={() => onChoice("discard")}>Don’t Save</button>
          <button className="btn primary" onClick={() => onChoice("save")}>Save</button>
        </div>
      </div>
    </div>
  );
}

const DRAFT_KEY = "pcs-draft";
const DRAFT_TS_KEY = "pcs-draft-ts";

export default function App() {
  const editor = useEditor();
  const [status, setStatus] = useState("Ready");
  const [showHome, setShowHome] = useState(true);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [showExportStudio, setShowExportStudio] = useState(false);
  const [showGuideMe, setShowGuideMe] = useState(false);
  useEffect(()=>{if(showGuideMe)setShowHome(false);},[showGuideMe]);
  const [showSettings, setShowSettings] = useState(false);
  const [prefs, setPrefs] = useState<AppPrefs>(DEFAULT_PREFS);
  // Boot sequence (R6): validated prefs → sanitized window/layout state →
  // overlays explicitly closed (they are state-local, never persisted) →
  // shell mounts → draft restore → only then effects/ambience.
  const [bootReady, setBootReady] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      let safe = false;
      try {
        if ("__TAURI_INTERNALS__" in window) {
          const { invoke } = await import("@tauri-apps/api/core");
          const info = await invoke<{ safeMode: boolean; version: string; projectPath?: string }>("startup_info");
          safe = !!info.safeMode;
          if (info.projectPath) {
            try {
              const { readProjectFile } = await import("./io.js");
              const { parseProject } = await import("./project.js");
              const { project } = parseProject(await readProjectFile(info.projectPath));
              const { doc } = migrateDocument(project.bannerSpec);
              if (alive) { editor.loadProject({ ...project, bannerSpec: doc }, info.projectPath); setShowHome(false); }
            } catch (error) { if (alive) setStatus(`Could not open the requested project: ${String(error)}`); }
          }
        }
      } catch { /* non-native or command missing — continue normally */ }
      if (!alive) return;
      setSafeMode(safe);
      // Session-level safe mode (error-boundary "Open Safe Mode" reload).
      try { if (sessionStorage.getItem("pcs-safe-ui") === "1") setSafeMode(true); } catch { /* ignore */ }
      try {
        const result = await loadValidatedPrefs();
        if (!alive) return;
        setPrefs(safe ? safeModePrefs(result.prefs) : result.prefs);
        editor.setExperience(result.prefs.defaultExperience);
      } catch {
        if (alive) setPrefs(safe ? safeModePrefs(DEFAULT_PREFS) : DEFAULT_PREFS);
      }
      if (alive) setBootReady(true);
      // Heartbeat for the launcher's crash-loop detection (best effort).
      if ("__TAURI_INTERNALS__" in window) {
        try {
          const { saveJSON } = await import("./storage.js");
          void saveJSON("startup-ok", { ts: Date.now(), safeMode: safe, version: APP_VERSION });
        } catch { /* ignore */ }
      }
    })();
    return () => { alive = false; };
  }, []);
  useEffect(() => { if (bootReady) { applyPrefs(prefs); void persistPrefs(prefs); } }, [prefs, bootReady]);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: light)'); const apply = () => applyPrefs(prefs);
    media.addEventListener('change', apply);return () => media.removeEventListener('change', apply);
  }, [prefs]);
  useEffect(() => { document.documentElement.dataset.cardmotion = prefs.cardHoverAnimation ? 'on' : 'off'; }, [prefs.cardHoverAnimation]);
  const [draftAvailable, setDraftAvailable] = useState<PCSProject | null>(null);
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [designTab, setDesignTab] = useState<"scene" | "layers" | "background" | "ambience">("scene");
  const [cleanPreview, setCleanPreview] = useState(false);
  const [showPreviewLayers, setShowPreviewLayers] = useState(false);
  // Pending native close request awaiting the user's Save/Don't Save/Cancel choice.
  const [closePrompt, setClosePrompt] = useState<null | { projectName: string }>(null);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [discoverySection, setDiscoverySection] = useState<DiscoverySection>("elements");
  const tourReturn = useRef<{home:boolean;mode:typeof editor.mode;left:boolean;right:boolean;focus:boolean;selected:string|null;section:DiscoverySection;playing:boolean;target:string;document:string;selectedIds:string[]}|null>(null);
  useEffect(()=>{if(!bootReady)return;let alive=true;void needsTutorial().then(needed=>{if(alive && needed && !isSafeMode())setShowWelcome(true);});return()=>{alive=false;};},[bootReady]);
  const startTour = () => {
    tourReturn.current={home:showHome,mode:editor.mode,left:editor.leftCollapsed,right:editor.rightCollapsed,focus:editor.focusMode,selected:editor.selectedId,section:discoverySection,playing:editor.playing,target:editor.exportTargetId,document:JSON.stringify(editor.currentProject()),selectedIds:[...editor.selectedIds]};
    setShowWelcome(false);setShowSettings(false);setShowGuideMe(false);editor.setDialog(null);setShowExportStudio(false);setShowPublish(false);setTourStep(0);
  };
  const endTour = (status:TutorialStatus) => {
    setShowWelcome(false);setTourStep(null);void rememberTutorial(status).then(ok=>{if(!ok)notify("warning", "Tutorial preference could not be saved.");});
    const previous=tourReturn.current;
    if(previous){setShowHome(previous.home && previous.document===JSON.stringify(editor.currentProject()));editor.setMode(previous.mode);editor.setLeftCollapsed(previous.left);editor.setRightCollapsed(previous.right);editor.setFocusMode(previous.focus);editor.setSelectedId(previous.selected);editor.setSelectedIds(previous.selectedIds);setDiscoverySection(previous.section);editor.setPlaying(previous.playing);editor.setExportTargetId(previous.target);tourReturn.current=null;}
  };
  const closeGuard = useRef<((proceed: boolean) => void) | null>(null);
  // Overlay-state mirror for the shortcut router (mounted once, reads latest).
  const paletteOpenRef = useRef(false); paletteOpenRef.current = paletteOpen;
  const showSettingsRef = useRef(false); showSettingsRef.current = showSettings;
  const ctxMenuRef = useRef<{ x: number; y: number; items: MenuItem[] } | null>(null); ctxMenuRef.current = ctxMenu;
  const closePromptRef = useRef<null | { projectName: string }>(null); closePromptRef.current = closePrompt;
  const tourStepRef = useRef<number | null>(null); tourStepRef.current = tourStep;
  const showPublishRef = useRef(false); showPublishRef.current = showPublish;
  const showExportRef = useRef(false); showExportRef.current = showExportStudio;

  useEffect(() => { applyPrefs(prefs); }, [prefs]);
  // Live experience (Quick/Advanced) is mirrored to the DOM for CSS-level control theming.
  useEffect(() => { document.documentElement.dataset.experience = editor.experience; }, [editor.experience]);

  // Small-window mode: inspector becomes a drawer (collapse at narrow widths).
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1100px)");
    const on = () => { if (mq.matches) editor.setRightCollapsed(true); };
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { void loadRecents().then(setRecents); }, [showHome]);

  // Draft recovery on first load.
  useEffect(() => {
    const pick = (ls: { project: PCSProject; ts: number } | null, ad: { project: PCSProject; ts: number } | null) => {
      const newer = !ad ? ls : !ls ? ad : ad.ts >= ls.ts ? ad : ls;
      if (newer) setDraftAvailable(newer.project);
    };
    let lsDraft: { project: PCSProject; ts: number } | null = null;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) lsDraft = JSON.parse(raw);
    } catch { /* ignore */ }
    void loadJSON<{ project: PCSProject; ts: number }>("draft").then((ad) => pick(lsDraft, ad));
  }, []);

  // Debounced draft autosave (debounced, only after real document changes).
  const { doc, project, saveState } = editor;
  useEffect(() => {
    if (saveState !== "unsaved" || showHome || tourStep !== null) return;
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ project: { ...project, bannerSpec: editor.store.getDocument() }, ts: Date.now() }));
        localStorage.setItem(DRAFT_TS_KEY, String(Date.now()));
        void saveJSON("draft", { project: { ...project, bannerSpec: editor.store.getDocument() }, ts: Date.now() });
        setStatus((s) => (s === "Ready" ? "Draft saved" : s));
      } catch { /* storage full — non-fatal */ }
    }, prefs.autosaveInterval);
    return () => window.clearTimeout(t);
  }, [doc, project, saveState, editor.store, showHome, prefs.autosaveInterval, tourStep]);

  // Native close handling. Rules:
  //  - saved project, no document changes  → close immediately
  //  - new/unsaved project                 → draft recovery covers it; close
  //  - saved project with document changes → ONE custom confirmation with
  //    working Save / Don't Save / Cancel buttons. Never loops.
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let unlisten: (() => void) | undefined;
    (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      unlisten = await win.onCloseRequested(async (event) => {
        if (showHome) return;
        if (tourStepRef.current !== null && tourReturn.current?.home && tourReturn.current.document===JSON.stringify(editor.currentProject())) return;
        if (editor.saveState !== "unsaved") return; // clean — close
        // Flush the draft so the work is recoverable no matter what the user picks.
        try {
          localStorage.setItem(DRAFT_KEY, JSON.stringify({ project: { ...editor.project, bannerSpec: editor.store.getDocument() }, ts: Date.now() }));
          localStorage.setItem(DRAFT_TS_KEY, String(Date.now()));
          void saveJSON("draft", { project: { ...editor.project, bannerSpec: editor.store.getDocument() }, ts: Date.now() });
        } catch { /* storage full — closing is still safe */ }
        // Saved project with changes: show the custom prompt, defer the close.
        event.preventDefault();
        setClosePrompt({ projectName: editor.project.name });
        closeGuard.current = (proceed: boolean) => {
          closeGuard.current = null;
          if (proceed) win.destroy();
        };
      });
    })();
    return () => unlisten?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.saveState, editor.projectPath, editor.project, editor.store, showHome]);

  const closeChoice = async (choice: "save" | "discard" | "cancel") => {
    setClosePrompt(null);
    if (choice === "cancel") { closeGuard.current?.(false); return; }
    if (choice === "save") {
      const saved = await doSave();
      if (!saved) return; // user cancelled the save dialog — stay open
    }
    closeGuard.current?.(true);
  };

  // ---- project actions ---------------------------------------------------
  const goHome = () => {
    // A navigation-only tutorial must not replace an existing Home recovery draft.
    const unchangedTour=tourStepRef.current !== null && tourReturn.current?.home && tourReturn.current.document===JSON.stringify(editor.currentProject());
    if(!unchangedTour) try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ project: { ...editor.project, bannerSpec: editor.store.getDocument() }, ts: Date.now() }));
      localStorage.setItem(DRAFT_TS_KEY, String(Date.now()));
    } catch { /* ignore */ }
    if (editor.project.name !== "Untitled Project" || editor.doc.layers.length > 0) {
      void recordRecent(editor.project.name, editor.projectPath);
    }
    setShowHome(true);
    editor.setMode("design");
  };

  const doNew = () => editor.setDialog("new");
  const replaceProject = (perform: () => void) => {
    if (editor.saveState === "unsaved" && (editor.store.canUndo() || editor.projectPath)) {
      setClosePrompt({ projectName: editor.project.name });
      closeGuard.current = proceed => { closeGuard.current = null; if (proceed) perform(); };
    } else perform();
  };
  const createProject = (name: string, tpl: (typeof TEMPLATES)[number], sceneId?: string) => {
    editor.setDialog(null);
    replaceProject(() => {
    const p = newProject(name);
    p.settings={target:tpl.id==='github-profile'?'github-profile-readme':tpl.id==='github-repo'?'github-repo-social':'custom-target'};
    p.bannerSpec.canvas.width = tpl.width;
    p.bannerSpec.canvas.height = tpl.height;
    editor.loadProject(p);
    editor.setMode("design");
    if (sceneId) applyScene(sceneId, tpl);
    setShowHome(false);
    editor.setDialog(null);
    setStatus(`New project created (${tpl.width}×${tpl.height})`);
    });
  };

  const applyScene = (sceneOrId: SceneEntry | string, tpl?: (typeof TEMPLATES)[number]) => {
    const scene = typeof sceneOrId === "string" ? SCENE_LIBRARY.find((s) => s.id === sceneOrId) : sceneOrId;
    if (!scene) return;
    const W = tpl?.width ?? editor.doc.canvas.width;
    const H = tpl?.height ?? editor.doc.canvas.height;
    const doc = scene.make(W, H);
    const scenes=sequenceScenes(editor.doc);
    const activeScene=scenes.find(s=>editor.time>=(s.params.start??0)&&editor.time<(s.params.start??0)+(s.params.duration??8));
    if(activeScene&&!tpl){
      const replacement=sceneGroup(doc,scene.name);
      editor.store.replaceDocument({...editor.doc,layers:editor.doc.layers.map(l=>l.id===activeScene.id?{...activeScene,name:scene.name,children:replacement.children}:l)},`Apply scene: ${scene.name}`);
    } else if (editor.doc.layers.length > 0) {
      editor.store.replaceDocument(doc, `Apply scene: ${scene.name}`);
    } else {
      editor.store.replaceDocument(doc, "Apply scene");
    }
    editor.setSaveState("unsaved");
    setShowHome(false);
    editor.setMode("design");
    setStatus(`Applied scene: ${scene.name} (Ctrl+Z restores the previous layout)`);
    notify("info", `Scene applied — ${scene.name}`, "Ctrl+Z restores the previous layout");
  };

  const doOpen = async () => {
    setStatus("Opening project…");
    const p = await pickOpenProject();
    if (p) {
      const path = (p as typeof p & { __path?: string }).__path;
      try {
        const { doc: migrated, from, to } = migrateDocument(p.bannerSpec);
        replaceProject(() => {
          editor.loadProject({ ...p, bannerSpec: migrated }, path);
          setShowHome(false);
          setStatus(from !== to ? `Migrated scene ${from} → ${to}` : `Opened ${p.name}`);
          if (path) void recordRecent(p.name, path);
        });
      } catch (e) {
        alert(`Project migration failed: ${(e as Error).message}`);
      }
    } else {
      setStatus("Open cancelled");
    }
  };

  const recoverDraft = () => {
    if (!draftAvailable) return;
    try {
      const { doc: migrated } = migrateDocument(draftAvailable.bannerSpec);
      editor.loadProject({ ...draftAvailable, bannerSpec: migrated });
      setShowHome(false);
      setDraftAvailable(null);
      localStorage.removeItem(DRAFT_KEY);
      void removeJSON("draft");
      setStatus("Recovered your unsaved draft");
    } catch (e) {
      alert(`Could not recover draft: ${(e as Error).message}`);
    }
  };

  const doSave = async (saveAs = false): Promise<boolean> => {
    const snapshot = editor.currentProject();
    const path = await writeProject(snapshot, saveAs ? undefined : editor.projectPath);
    if (path) {
      editor.markSaved(path === "browser-download" ? undefined : path, snapshot);
      localStorage.removeItem(DRAFT_KEY);
      void removeJSON("draft");
      setStatus(path === "browser-download" ? "Project downloaded (.pcsproj)" : `Saved to ${path}`);
      notify("success", "Saved", path === "browser-download" ? "Project downloaded (.pcsproj)" : path);
      void recordRecent(editor.project.name, path === "browser-download" ? undefined : path);
      return true;
    }
    setStatus("Save cancelled");
    return false;
  };

  const doExportSvg = async () => {
    // R100 — the top action never instantly saves a file: it opens the
    // Export Studio where targets, conversion and format are configured.
    setShowExportStudio(true);
  };

  const insertImage = async () => {
    const img = await importImage();
    if (!img) return;
    if (img.bytes > 2_000_000) {
      const ok = window.confirm(`"${img.name}" is ${Math.round(img.bytes / 1024)} KB and will be embedded into the project file. Continue?`);
      if (!ok) return;
    }
    const imgEl = new Image();
    imgEl.onload = () => {
      const maxW = Math.min(480, editor.doc.canvas.width * 0.6);
      const scale = Math.min(1, maxW / imgEl.width);
      editor.addImage({ src: img.dataUrl, name: img.name, width: Math.round(imgEl.width * scale), height: Math.round(imgEl.height * scale), x: 40, y: 40 });
    };
    imgEl.src = img.dataUrl;
  };

  const actions: StudioActions = useMemo(() => ({
    newProject: doNew,
    openProject: () => void runOp("open", doOpen),
    saveProject: () => void runOp("save", doSave),
    saveProjectAs: () => void runOp("save", () => doSave(true)),
    openGuide: () => setShowGuideMe(true),
    startTour,
    exportSvg: () => void runOp("export", doExportSvg),
    exportPackage: () => setShowExportStudio(true),
    openTimeline: () => editor.setMode("animate"),
    openReadme: () => editor.setMode("profile"),
    openContribution: () => editor.setMode("profile"),
    openStats: () => editor.setMode("profile"),
    openTutorial: () => editor.setDialog("tutorial"),
    openCompatibility: () => editor.setDialog("compatibility"),
    showAbout: () => editor.setDialog("about"),
    insertImage: () => void insertImage(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [editor]);

  // ---- action locks (R32): async ops cannot run concurrently with themselves.
  const runningOps = useRef<Set<string>>(new Set());
  const runOp = useMemo(() => {
    return async (name: string, fn: () => Promise<unknown>) => {
      if (runningOps.current.has(name)) return; // already running — idempotent no-op
      runningOps.current.add(name);
      try { await fn(); } catch (error) { const message = error instanceof Error ? error.message : String(error); setStatus(`${name} failed: ${message}`); notify("error", `Could not ${name}`, message); } finally { runningOps.current.delete(name); }
    };
  }, []);

  // ---- keyboard: ONE ShortcutRouter (R34) ----------------------------------
  // A single stable window listener dispatches through a ref to the latest
  // scope state. No recursive DOM event dispatch, no document.execCommand,
  // no keydown+keyup double triggers, and key-repeat is ignored for commands
  // where holding a chord must not execute hundreds of times (R35).
  const shortcutState = useRef({ editor, doSave, doOpen, doNew, runOp, actions });
  shortcutState.current = { editor, doSave, doOpen, doNew, runOp, actions };
  const importDroppedImages = (files: FileList | null) => {
    const images = [...(files ?? [])].filter(file => file.type.startsWith("image/"));
    if (!images.length) return;
    setShowHome(false); editor.setMode("design");
    void runOp("import image", async () => { for (const file of images) await insertLocalImage(file, shortcutState.current.editor); });
  };
  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      if ((event.target as HTMLElement)?.closest('input,textarea,[contenteditable="true"],[aria-modal="true"]')) return;
      const files = event.clipboardData?.files;
      if (files?.length) { event.preventDefault(); importDroppedImages(files); }
    };
    window.addEventListener("paste", paste);
    return () => window.removeEventListener("paste", paste);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { editor, doSave, doOpen, doNew, runOp, actions } = shortcutState.current;
      const mod = e.ctrlKey || e.metaKey;
      const el = document.activeElement;
      const typing = !!(el && (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || (el as HTMLElement).isContentEditable));
      const key = e.key.toLowerCase();

      // Modal scope takes precedence: only palette toggle and Escape pass.
      const modalOpen = !!document.querySelector('[aria-modal="true"]') || paletteOpenRef.current || showSettingsRef.current || ctxMenuRef.current !== null ||
        closePromptRef.current !== null || editor.dialog !== null || tourStepRef.current !== null ||
        showPublishRef.current || showExportRef.current;
      if (modalOpen) {
        if (e.key === "Escape") { setPaletteOpen(false); setCtxMenu(null); }
        return;
      }
      if (mod && key === "k") { e.preventDefault(); setPaletteOpen((v) => !v); return; }
      if (typing) return; // text scope: native editing owns every other chord

      // Key-repeat guard: one execution per physical press for these commands.
      if (e.repeat && (mod || ["delete", "backspace"].includes(key))) return;

      const command = commandForEvent(e, buildCommands(actions));
      if (command) {
        e.preventDefault(); const context = {editor, actions};
        if (!e.repeat && command.enabled(context)) command.run(context);
        return;
      }
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key) && editor.selectedId) {
        e.preventDefault();
        const amount = e.shiftKey ? 10 : 1;
        const ids = editor.selectedIds.length ? editor.selectedIds : [editor.selectedId];
        for (const id of ids) {
          const layer = editor.store.layerById(id);
          if (layer && "x" in layer && "y" in layer) editor.updateLayer(id, { x: layer.x + (e.key === "ArrowLeft" ? -amount : e.key === "ArrowRight" ? amount : 0), y: layer.y + (e.key === "ArrowUp" ? -amount : e.key === "ArrowDown" ? amount : 0) });
        }
        return;
      }
      if (e.key === "Escape") { editor.setFocusMode(false); setCleanPreview(false); return; }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (editor.selectedIds.length > 0) {
          e.preventDefault();
          for (const id of editor.selectedIds) editor.removeLayer(id);
          editor.clearMultiSelect();
        } else if (editor.selectedId) {
          e.preventDefault(); editor.removeLayer(editor.selectedId);
        }
        return;
      }

    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // Router is mounted exactly once; state arrives via refs below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- context menu (R21) — target-aware: text / object / layer / canvas ----
  const arrangeItems = (): MenuItem[] => {
    const id = editor.selectedId;
    return [
      { label: "Bring Forward", run: () => id && editor.reorderLayerTo(id, "forward") },
      { label: "Bring to Front", run: () => id && editor.reorderLayerTo(id, "front") },
      { label: "Send Backward", run: () => id && editor.reorderLayerTo(id, "backward") },
      { label: "Send to Back", run: () => id && editor.reorderLayerTo(id, "back") },
    ];
  };

  const openContextMenu = (e: React.MouseEvent, onLayer: boolean) => {
    e.preventDefault();
    const el = e.target as HTMLElement;
    const hasSel = editor.selectedId !== null;

    // TEXT scope: right-click inside editable text keeps clipboard verbs.
    if (el.closest("[contenteditable='true'], input, textarea")) {
      setCtxMenu({ x: e.clientX, y: e.clientY, items: [
        { label: "Cut", shortcut: "Ctrl+X", run: () => document.execCommand("cut") },
        { label: "Copy", shortcut: "Ctrl+C", run: () => document.execCommand("copy") },
        { label: "Paste", shortcut: "Ctrl+V", run: () => document.execCommand("paste") },
        { label: "Select All", shortcut: "Ctrl+A", separatorBefore: true, run: () => document.execCommand("selectAll") },
      ] });
      return;
    }

    if(el.closest('.timeline,.animate-transport')){
      setCtxMenu({x:e.clientX,y:e.clientY,items:[{label:editor.playing?'Pause':'Play',run:()=>editor.setPlaying(!editor.playing)},{label:'Restart from beginning',run:()=>{editor.setPlaying(false);editor.setTime(0);}},{label:'Motion settings',run:()=>editor.setMode('animate')}]});return;
    }
    const presetCard=el.closest<HTMLElement>('.scene-card-lg,.preset-card');
    if(presetCard){setCtxMenu({x:e.clientX,y:e.clientY,items:[{label:'Apply this preset',run:()=>presetCard.querySelector<HTMLButtonElement>('.scene-use-btn,.card-add-btn')?.click()},{label:'Toggle favorite',run:()=>presetCard.querySelector<HTMLButtonElement>('.fav-btn:not(.card-add-btn)')?.click()}]});return;}
    if(el.closest('.export-preview,.export-settings')){setCtxMenu({x:e.clientX,y:e.clientY,items:[{label:'Return to design',run:()=>{setShowExportStudio(false);editor.setMode('design');}},{label:'Open motion workspace',run:()=>{setShowExportStudio(false);editor.setMode('animate');}}]});return;}
    // LAYER scope (rows in the layers tree — NOT canvas objects, which also
    // carry data-layer-id but live outside .layer-item).
    const layerRow = el.closest<HTMLElement>(".layer-item[data-layer-id]");
    if (layerRow) {
      const id = layerRow.dataset.layerId!;
      const layer = editor.doc.layers.find((l) => l.id === id);
      setCtxMenu({ x: e.clientX, y: e.clientY, items: [
        { label: "Rename…", run: () => { const n = window.prompt("Name", layer?.name ?? ""); if (n) editor.updateLayer(id, { name: n }); } },
        { label: "Duplicate", run: () => { editor.setSelectedId(id); editor.duplicateSelected(); } },
        { label: "Delete", danger: true, run: () => editor.removeLayer(id) },
        { label: layer?.locked ? "Unlock" : "Lock", separatorBefore: true, run: () => editor.updateLayer(id, { locked: !layer?.locked } as never) },
        { label: layer?.visible === false ? "Show" : "Hide", run: () => editor.updateLayer(id, { visible: layer?.visible === false } as never) },
        { label: "Bring Forward", separatorBefore: true, run: () => editor.reorderLayerTo(id, "forward") },
        { label: "Bring to Front", run: () => editor.reorderLayerTo(id, "front") },
        { label: "Send Backward", run: () => editor.reorderLayerTo(id, "backward") },
        { label: "Send to Back", run: () => editor.reorderLayerTo(id, "back") },
      ] });
      return;
    }

    if (onLayer && hasSel) {
      const sel = editor.selected;
      const isText = sel?.type === "text";
      setCtxMenu({ x: e.clientX, y: e.clientY, items: [
        { label: "Cut", shortcut: "Ctrl+X", run: editor.cutSelected },
        { label: "Copy", shortcut: "Ctrl+C", run: editor.copySelected },
        { label: "Paste", shortcut: "Ctrl+V", run: () => editor.paste() },
        { label: "Duplicate", shortcut: "Ctrl+D", separatorBefore: true, run: editor.duplicateSelected },
        { label: "Delete", shortcut: "Del", danger: true, run: () => editor.removeLayer(editor.selectedId!) },
        { label: "Group Selection", disabled: editor.selectedIds.length < 2, separatorBefore: true, run: () => editor.groupSelected?.() },
        { label: sel?.locked ? "Unlock" : "Lock", run: () => editor.selectedId && editor.updateLayer(editor.selectedId, { locked: !sel?.locked } as never) },
        ...(isText ? [{ label: "Rename…", run: () => { const n = window.prompt("Name", editor.selected?.name ?? ""); if (n && editor.selectedId) editor.updateLayer(editor.selectedId, { name: n }); } }] : []),
        ...arrangeItems().map((m, i) => ({ ...m, separatorBefore: i === 0 })),
        { label: "Effects…", separatorBefore: true, run: () => editor.setMode("design") },
        { label: "Animations…", run: () => editor.setMode("animate") },
      ] });
      return;
    }

    // EMPTY CANVAS scope.
    setCtxMenu({ x: e.clientX, y: e.clientY, items: [
      { label: "Paste", shortcut: "Ctrl+V", disabled: editor.pasteCount() === 0, run: () => editor.paste() },
      { label: "Add Text", separatorBefore: true, run: () => editor.addText() },
      { label: "Add Rectangle", run: () => editor.addRect() },
      { label: "Add Image…", run: () => void insertImage() },
      { label: "Fit Canvas", separatorBefore: true, run: () => editor.requestFit() },
      { label: "Zoom 100%", run: () => editor.setZoom(1) },
      { label: editor.showSafeArea ? "Hide Safe Area" : "Show Safe Area", separatorBefore: true, run: () => editor.setShowSafeArea(!editor.showSafeArea) },
    ] });
  };

  useEffect(() => {
    const noDefault = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (!el.closest("input, textarea")) e.preventDefault();
    };
    document.addEventListener("contextmenu", noDefault);
    return () => document.removeEventListener("contextmenu", noDefault);
  }, []);

  // The existing spotlight tour follows real controls without creating history.
  const tourSteps: TourStep[] = [
    {selector:'.home-actions',title:'Open or create',body:'Open Project brings back a saved PCS file. Create New starts a blank design. Guide Me offers task guidance and opens the controls you need. Use a single click or Enter.'},
    {selector:'[data-tour="import-image"]',title:'Import your media',body:'Choose Import image to browse for your own artwork. You can also drop supported images onto the canvas. Imports add a layer; they do not replace your saved source file.',mode:'design',section:'elements'},
    {selector:'.scene-gallery',title:'Choose and apply a preset',body:'Browse Scenes. Click a scene to apply it, confirming replacement when you have existing artwork. Details shows more information and a Use Scene button. Browsing and hovering do not add layers or undo history; applying a scene changes your design.',mode:'design',section:'scenes'},
    {selector:'.studio-library-body',title:'Change the banner background directly',body:'Background gives you colours, gradients and banner shape controls. Change these directly here. To replace a photo, import a new image from Elements and arrange it in Layers. Profile also has a visible Change / edit banner button.',mode:'design',section:'background'},
    {selector:'.side-panel.right',title:'Fonts and text',body:'Use Elements → Add text, or select an existing text layer. In the inspector, Text & Font edits the content, size, family and colour. Click the content field to type; double-clicking the canvas is optional. If there is no text yet, use Add text first.',mode:'design',section:'elements',text:true},
    {selector:'.layer-list',title:'Arrange your layers',body:'Select a layer with a click or Enter. Use its eye and lock buttons to hide or protect it. Drag top-level rows to reorder; F2 renames. Expand groups with the arrow to reach their children. Undo reverses your edits.',mode:'design',section:'layers'},
    {selector:'.studio-library-body',title:'Effects',body:'Choose the selected layer or whole scene in Apply effects to. Preview a card, then use Add to commit it. Select the layer to tune its effect stack in the inspector. Changes happen only when you apply or edit.',mode:'design',section:'effects'},
    {selector:'.animate-workspace',title:'Motion',body:'Motion has presets, duration and tracks. Select a layer and explicitly add motion, then use Play / Pause and the timeline to inspect it. Full controls exposes keyframes. Reduced motion keeps interface previews still without removing export options.',mode:'animate'},
    {selector:'.platform-workspace',title:'Profile and GitHub sections',body:'Choose a platform at the top. For GitHub, enter your public username and refresh only when you want online data. Add and arrange sections such as About, tech stack and repositories. Use Change / edit banner to return to Design.',mode:'profile'},
    {selector:'[data-guide="add-button"]',title:'Add a button',body:'Use the visible + Button control. Its label, destination, colour and alignment controls open immediately.',mode:'profile'},
    {selector:'[data-guide="add-icon"]',title:'Add an icon',body:'Use + Icon and choose a graphic from the searchable icon grid. Set its size, colour and label in the section controls.',mode:'profile'},
    {selector:'.preview-workspace',title:'Preview before sharing',body:'Preview shows your composition. Toggle safe areas to inspect crops; actual platform placement may differ. Profile previews and Export Studio show target adaptations. Use Change / edit banner to return to editing.',mode:'preview'},
    {selector:'[data-tour="export"]',title:'Save and export',body:'Save project keeps editable layers in a PCS file. Export opens Export Studio: choose a target and format, check cropping and capability notices, then save. A GitHub profile package includes README and assets for you to upload. PCS never publishes automatically.',mode:'design',section:'elements'},
  ];
  useEffect(() => {
    if (tourStep === null) return;
    const step=tourSteps[tourStep];if(!step)return;
    setShowHome(!step.mode);
    editor.setPlaying(false);editor.setFocusMode(false);editor.setLeftCollapsed(false);editor.setRightCollapsed(false);
    if(step.mode)editor.setMode(step.mode);
    if(step.section)setDiscoverySection(step.section);
    if(step.mode==='profile')editor.setExportTargetId('github-profile-readme');
    if(step.text){
      const findText=(layers:typeof editor.doc.layers):string|null=>{for(const layer of layers){if(layer.type==='text')return layer.id;if(layer.type==='group'){const id=findText(layer.children);if(id)return id;}}return null;};
      editor.setSelectedId(findText(editor.doc.layers));
    }
  }, [tourStep]);

  useEffect(() => {
    if (!editor.playing) return;
    let raf=0, last=performance.now(); const duration=editor.doc.animation?.duration??8;
    const tick=(now:number)=>{const dt=Math.min(.1,(now-last)/1000);last=now;editor.setTime(t=>{const next=t+dt*editor.playbackRate;if(next>=duration){if(editor.doc.animation?.loop ?? prefs.loopPreview)return next%duration;editor.setPlaying(false);return duration;}return next;});raf=requestAnimationFrame(tick);};
    raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);
  },[editor.playing,editor.playbackRate,editor.doc.animation?.duration,editor.doc.animation?.loop,prefs.loopPreview]);
  const quick = editor.experience === "quick";
  const reducedMotion = prefs.reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const timeArg = {time: editor.time};
  const effectPreview = editor.previewEffect;
  const displayDoc = effectPreview ? { ...editor.doc, layers: previewLayer(editor.doc.layers, effectPreview.layerId, l => ({ ...l, effects: [...(l.effects ?? []), effectPreview.effect] })) } : editor.doc;
  const svg = renderSvg(displayDoc, { editable: editor.mode !== "preview", animate: false, ...timeArg });
  const editorWithActions = { ...editor, doOpen: () => void runOp("open", doOpen), doSave: () => void runOp("save", doSave), doExport: () => setShowExportStudio(true) };
  const resetLayout = () => { editor.setLeftWidth(232); editor.setRightWidth(288); editor.setLeftCollapsed(false); editor.setRightCollapsed(false); };

  // ---- home ----------------------------------------------------------------
  if (showHome) {
    const lastProject = recents[0];
    const openRecent = (path: string) => {
      void (async () => {
        try {
          const text = await readProjectFile(path);
          const parsed = parseProjectText(text);
          const { doc: migrated } = migrateDocument(parsed.project.bannerSpec);
          replaceProject(() => { editor.loadProject({ ...parsed.project, bannerSpec: migrated }, path); setShowHome(false); });
        } catch {
          setStatus("Could not open that project file.");
        }
      })();
    };
    const quickStart: Array<{ title: string; line: string; tpl: (typeof TEMPLATES)[number]; sceneId?: string }> = [
      { title: "GitHub Profile", line: "A banner for the page visitors see first", tpl: TEMPLATES[0]!, sceneId: "photo-rainy-city-night" },
      { title: "Repository README", line: "A banner for a project's front page", tpl: TEMPLATES[1]!, sceneId: "glass-aurora" },
      { title: "Banner Only", line: "One wide banner, export and done", tpl: TEMPLATES[2]!, sceneId: "lofi-rain-city-night" },
      { title: "Custom Canvas", line: "Pick your own size", tpl: TEMPLATES[3]! },
    ];
    // Mixed "Recently used" strip: scenes + presets the user touched.
    const usedKinds: PresetKind[] = ["scene", "effect", "palette", "gradient", "ambience", "animation"];
    const recentItems = usedKinds.flatMap((k) => recentIds(k).slice(0, 3).map((id) => ({ kind: k, id }))).slice(0, 6);

    return (
      <div className="app-shell">
        <TopBar home editor={editorWithActions} onNew={doNew} menuBar={<MenuBars editor={editor} actions={actions} quick={quick} />} onGoHome={goHome}
          onOpenPalette={() => setPaletteOpen(true)} quick={quick} experience={editor.experience}
          onToggleExperience={() => editor.setExperience((editor.experience === "quick" ? "advanced" : "quick") as Experience)}
          onOpenSettings={() => setShowSettings(true)} />
        <main className="home home-v2">
          <header className="home-hero">
            <PCSLogo boxed className="home-mark" />
            <div>
              <h1>Make your profile yours.</h1>
              <p>
                Design once. Adapt everywhere. Your identity, across every platform.
                <span className="version-chip">{APP_VERSION}</span>
              </p>
            </div>
          </header>
          <div className="home-actions">
            <button className="btn primary lg" onClick={() => setShowGuideMe(true)}>✨ Guide Me — choose a task</button>
            <button className="btn lg" onClick={doNew}>Create New</button>
            <button className="btn lg" onClick={() => void doOpen()}>Open Project…</button>
            {lastProject && <button className="btn ghost lg" onClick={() => openRecent(lastProject.path)}>Continue “{lastProject.name}”</button>}

          </div>
          {draftAvailable && (
            <div className="recover-banner">
              <span><strong>Unsaved work found.</strong> Restore changes from your previous session.</span>
              <button className="btn primary" onClick={recoverDraft}>Restore draft</button>
              <button className="btn ghost" onClick={() => { setDraftAvailable(null); localStorage.removeItem(DRAFT_KEY); void removeJSON("draft"); }}>Discard</button>
            </div>
          )}
          <section className="home-section">
            <h2>Quick Start</h2>
            <div className="home-quick-grid">
              {quickStart.map((q) => (
                <button key={q.title} className="quick-tile" onClick={() => createProject(q.tpl.name, q.tpl, q.sceneId)}>
                  <strong>{q.title}</strong>
                  <span>{q.line}</span>
                </button>
              ))}
            </div>
          </section>
          {recents.length > 0 && (
            <section className="home-section">
              <h2>Recent Projects</h2>
              <div className="home-grid">
                {recents.slice(0, 4).map((r) => (
                  <button key={r.path} className="home-tile" title={r.path} onClick={() => openRecent(r.path)}>
                    <span className="tile-name">{r.name}</span>
                    <span className="tile-dim">{new Date(r.lastOpened).toLocaleDateString()}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
          {recentItems.length > 0 && (
            <section className="home-section">
              <h2>Recently Used</h2>
              <div className="chip-row">
                {recentItems.map((r, i) => (
                  <span key={`${r.kind}-${r.id}-${i}`} className="chip">{(r.kind === "effect" ? EFFECT_PRESETS.find(p=>p.id===r.id)?.name : r.kind === "scene" ? SCENE_LIBRARY.find(p=>p.id===r.id)?.name : undefined) ?? r.id.replace(/-/g," ")}</span>
                ))}
              </div>
            </section>
          )}
          <section className="home-section home-gallery">
            <h2>Discover a Style</h2>
            <ErrorBoundary label="Scene gallery">
              <SceneBrowser editor={editor} onApply={(scene) => createProject(scene.name, TEMPLATES[0]!, scene.id)} />
            </ErrorBoundary>
          </section>
          <SupportPanel/>
        </main>
        <StatusBar editor={editor} status={status} />
        {bootReady && <CursorGlow mode={prefs.cursorGlow} reducedMotion={prefs.reducedMotion} />}
        <OverlayHost>
        {paletteOpen && <CommandPalette editor={editor} actions={actions} onClose={() => setPaletteOpen(false)} />}
        {editor.dialog === "new" && <NewProjectDialog onClose={() => editor.setDialog(null)} onCreate={(name, tpl) => createProject(name, tpl)} />}
        {editor.dialog === "tutorial" && <TutorialDialog onClose={() => editor.setDialog(null)} />}
        {editor.dialog === "about" && <AboutDialog onClose={() => editor.setDialog(null)} />}
        {showSettings && <SettingsDialog prefs={prefs} onChange={setPrefs} onResetLayout={resetLayout} onTutorial={startTour} onClose={() => setShowSettings(false)} />}
        {showExportStudio && (
          <ExportStudio editor={editor} onClose={() => setShowExportStudio(false)} onOpenPublishWizard={() => { setShowExportStudio(false); setShowPublish(true); }} />
        )}
        {showPublish && <PublishWizard editor={editor} onClose={() => setShowPublish(false)} />}
        {showGuideMe && (
          <GuideMe onNavigate={(mode,section)=>{setShowHome(false);editor.setMode(mode);editor.setLeftCollapsed(false);if(section)setDiscoverySection(section);}}
            editor={editor}
            onClose={() => setShowGuideMe(false)}
            onCustomizeMore={() => { setShowGuideMe(false); setShowHome(false); editor.setMode("design"); }}
            onSetGithubUsername={(u) => setPrefs((p) => ({ ...p, githubUsername: u }))}
            onFinish={() => { setShowGuideMe(false); setShowHome(false); setShowExportStudio(true); }}
          />
        )}
        {showWelcome && <TutorialWelcome onStart={startTour} onSkip={()=>endTour("skipped")}/>}
        <Toasts />
        <TooltipHost delay={prefs.tooltipDelay} />
        {closePrompt && <ClosePrompt projectName={closePrompt.projectName} onChoice={(c) => void closeChoice(c)} />}
        {tourStep !== null && <SpotlightTour steps={tourSteps} step={tourStep} onStep={setTourStep} onDone={endTour} />}
      </OverlayHost>
      </div>
    );
  }

  // ---- workspaces ------------------------------------------------------------
  return (
    <div className="app-shell">
      <TopBar
        editor={editorWithActions}
        onNew={doNew}
        menuBar={<MenuBars editor={editor} actions={actions} quick={quick} />}
        onGoHome={goHome}
        onOpenPalette={() => setPaletteOpen(true)}
        quick={quick}
        experience={editor.experience}
        onToggleExperience={() => editor.setExperience((editor.experience === "quick" ? "advanced" : "quick") as Experience)}
        onOpenSettings={() => setShowSettings(true)}
      />

      <main key={editor.mode} className={"workspace view-anim ws-" + editor.mode} style={{ flexDirection: "column" }}
        onDragOver={e => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
        onDrop={e => { if (e.dataTransfer.files.length) { e.preventDefault(); importDroppedImages(e.dataTransfer.files); } }}
        onContextMenu={(e) => openContextMenu(e, editor.selectedId !== null)}>
        {tourStep===null && <ModeHint mode={editor.mode} />}
        {editor.mode === "preview" ? (
          <ErrorBoundary label="Preview" onHome={goHome}>
          <div className={"preview-workspace" + (cleanPreview ? " clean" : "")}>
            <div className="preview-banner-actions"><button className="btn" onClick={()=>editor.setMode('design')}>Change / edit banner</button><button className="btn" onClick={()=>setShowExportStudio(true)}>Check platform & export</button></div><CanvasWorkspace editor={editor} prefs={prefs} svgOverride={renderSvg(editor.doc, { animate: false, editable: false, time: editor.time })} />
            {!cleanPreview && (
              <div className="preview-toolbar">
                <span className="paint-hint">This is what visitors will see (animated loop).</span>
                <span className="spacer" />
                <button className="btn" onClick={() => setShowPreviewLayers(!showPreviewLayers)}>{showPreviewLayers ? "Hide outline" : "Outline"}</button>
                <button className="btn" onClick={() => editor.setShowSafeArea(!editor.showSafeArea)}>{editor.showSafeArea ? "Hide safe area" : "Show safe area"}</button>
                <button className="btn" onClick={() => setCleanPreview(true)}>Hide controls</button>
                <button className="btn primary" onClick={() => setShowPublish(true)}>Publish & Export</button>
              </div>
            )}
            {showPreviewLayers && !cleanPreview && (
              <aside className="preview-layers" aria-label="Outline">
                <LayersTree editor={editor} quick />
              </aside>
            )}
            {cleanPreview && (
              <button className="btn preview-exit" onClick={() => setCleanPreview(false)}>Show controls (Esc)</button>
            )}
          </div>
          </ErrorBoundary>
        ) : editor.mode === "profile" ? (
          <ErrorBoundary label="Profile builder" onHome={goHome}>
            <PlatformWorkspace editor={editor} />
          </ErrorBoundary>
        ) : editor.mode === "animate" ? (
          <ErrorBoundary label="Animate" onHome={goHome}>
            <AnimateWorkspace editor={editor} />
          </ErrorBoundary>
        ) : (
          <div style={{ display: "flex", flex: "1 1 auto", minHeight: 0, width: "100%" }}>
            {!editor.focusMode && <DiscoveryPanel editor={editor} section={discoverySection} onSection={setDiscoverySection} onScene={applyScene} onImage={() => void insertImage()} onExport={() => setShowExportStudio(true)} />}
            <div className="canvas-host" style={{ flex: "1 1 auto", display: "flex", minHeight: 0, minWidth: 0, position: "relative" }}>
              <ErrorBoundary label="Design canvas" onHome={goHome}>
                <CanvasWorkspace editor={editor} prefs={prefs} svgOverride={svg} />
              </ErrorBoundary>
            </div>
            {!editor.focusMode && (editor.rightCollapsed ? <CollapsedRightStrip editor={editor} /> : <Inspector editor={editor} />)}
          </div>
        )}
      </main>

      <StatusBar editor={editor} status={status} />
      {bootReady && <CursorGlow mode={prefs.cursorGlow} reducedMotion={prefs.reducedMotion} />}

      <OverlayHost>
      {showGuideMe && <GuideMe onNavigate={(mode,section)=>{setShowHome(false);editor.setMode(mode);editor.setLeftCollapsed(false);if(section)setDiscoverySection(section);}} editor={editor} onClose={() => setShowGuideMe(false)} onCustomizeMore={() => { setShowGuideMe(false); editor.setMode("design"); }} onFinish={() => { setShowGuideMe(false); setShowExportStudio(true); }} />}
      {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={() => setCtxMenu(null)} />}
      {paletteOpen && <CommandPalette editor={editor} actions={actions} onClose={() => setPaletteOpen(false)} />}
      {editor.dialog === "new" && <NewProjectDialog onClose={() => editor.setDialog(null)} onCreate={(name, tpl) => createProject(name, tpl)} />}
      {editor.dialog === "compatibility" && <CompatibilityDialog editor={editor} onClose={() => editor.setDialog(null)} />}
      {editor.dialog === "tutorial" && <TutorialDialog onClose={() => editor.setDialog(null)} />}
      {editor.dialog === "about" && <AboutDialog onClose={() => editor.setDialog(null)} />}
      {showPublish && <PublishWizard editor={editor} onClose={() => setShowPublish(false)} />}
      {showExportStudio && (
        <ExportStudio editor={editor} onClose={() => setShowExportStudio(false)} onOpenPublishWizard={() => { setShowExportStudio(false); setShowPublish(true); }} />
      )}
      {showSettings && <SettingsDialog prefs={prefs} onChange={setPrefs} onResetLayout={resetLayout} onTutorial={startTour} onClose={() => setShowSettings(false)} />}
        {showWelcome && <TutorialWelcome onStart={startTour} onSkip={()=>endTour("skipped")}/>}
        <Toasts />
        <TooltipHost delay={prefs.tooltipDelay} />
        {closePrompt && <ClosePrompt projectName={closePrompt.projectName} onChoice={(c) => void closeChoice(c)} />}
      {tourStep !== null && <SpotlightTour steps={tourSteps} step={tourStep} onStep={setTourStep} onDone={endTour} />}
      </OverlayHost>
    </div>
  );
}
