import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { hasErrors, validateBannerSpec, type BannerSpecDocument, type Layer, type Track } from "@pcs/bannerspec";
import { SceneStore } from "@pcs/scene-core";
import { appendCheckpoint } from "./history.js";
import { canonicalTarget } from "./targets/platforms.js";
import { newProject, type PCSProject } from "./project.js";
import { layerContainer } from "./layerTree.js";

export type SaveState = "saved" | "unsaved";
export type EditorTool = "select" | "text" | "rect" | "ellipse" | "line" | "hand";
export type WorkspaceMode = "design" | "animate" | "profile" | "preview";
export type Experience = "quick" | "advanced";

function cloneForInsertion(layer: Layer): Layer {
  const copy = structuredClone(layer);
  const remap = (item: Layer) => {
    item.id = crypto.randomUUID();
    for (const effect of item.effects ?? []) effect.id = crypto.randomUUID();
    if (item.type === "group") item.children.forEach(remap);
  };
  remap(copy);
  return copy;
}

export interface EditorState {
  project: PCSProject;
  doc: BannerSpecDocument;
  selectedId: string | null;
  saveState: SaveState;
  validation: string[];
  zoom: number;
  showSafeArea: boolean;
}

export function useEditor() {
  const store = useMemo(() => new SceneStore(), []);
  const [project, setProject] = useState<PCSProject>(() => newProject());
  const [doc, setDoc] = useState<BannerSpecDocument>(() => store.getDocument());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("unsaved");
  const projectRef = useRef(project); projectRef.current = project;
  const savedFingerprint = useRef<string | null>(null);
  const fingerprint = (p: PCSProject, d: BannerSpecDocument) => JSON.stringify({ ...p, bannerSpec: d, updatedAt: "" });
  useEffect(() => { setSaveState(savedFingerprint.current === fingerprint(project, doc) ? "saved" : "unsaved"); }, [project, doc]);
  const [projectPath, setProjectPath] = useState<string | undefined>(undefined);
  const [exportTargetId, setExportTargetId] = useState("github-repo-social");
  const [previewBehavior, setPreviewBehavior] = useState<{ layerId: string; behavior: import("@pcs/bannerspec").LayerBehavior } | null>(null);
  const [previewEffect, setPreviewEffect] = useState<{ layerId: string; effect: import("@pcs/bannerspec").LayerEffect } | null>(null);
  const [zoom, setZoom] = useState(0.6);
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [safeAreaMode, setSafeAreaMode] = useState<"guides" | "dim" | "crop">(
    () => (localStorage.getItem("pcs-safe-area-mode") as "guides" | "dim" | "crop") || "guides",
  );
  useEffect(() => { localStorage.setItem("pcs-safe-area-mode", safeAreaMode); }, [safeAreaMode]);
  // R38 — safe-area locking: important content (text/logo layers) is softly
  // clamped inside the target's safe region. Default ON in Quick Mode; Alt
  // while dragging bypasses (R40). Persisted so the choice survives restarts.
  const [safeAreaLock, setSafeAreaLock] = useState<boolean>(() => localStorage.getItem("pcs-safe-area-lock") === "1");
  useEffect(() => { localStorage.setItem("pcs-safe-area-lock", safeAreaLock ? "1" : "0"); }, [safeAreaLock]);
  // R36 — editor-only transparency checkerboard. Never exported.
  const [transparencyGrid, setTransparencyGrid] = useState<boolean>(() => localStorage.getItem("pcs-transparency-grid") === "1");
  useEffect(() => { localStorage.setItem("pcs-transparency-grid", transparencyGrid ? "1" : "0"); }, [transparencyGrid]);
  const [tool, setTool] = useState<EditorTool>("select");
  const [mode, setMode] = useState<WorkspaceMode>("design");
  const [experience, setExperience] = useState<Experience>(() => (localStorage.getItem("pcs-experience") as Experience) || "quick");
  useEffect(() => { localStorage.setItem("pcs-experience", experience); }, [experience]);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  // Panel layout persists across sessions (R109). Values are clamped into the
  // same ranges the resizers enforce, so corrupted storage cannot create an
  // impossible layout (R42 invariant check).
  const readNum = (k: string, d: number, min: number, max: number) => {
    const v = Number(localStorage.getItem(k));
    return Number.isFinite(v) && v > 0 ? Math.min(max, Math.max(min, v)) : d;
  };
  const [leftWidth, setLeftWidth] = useState(() => readNum("pcs-left-width", 232, 200, 400));
  const [rightWidth, setRightWidth] = useState(() => readNum("pcs-right-width", 288, 240, 420));
  const [leftCollapsed, setLeftCollapsed] = useState(() => localStorage.getItem("pcs-left-collapsed") === "1");
  const [rightCollapsed, setRightCollapsed] = useState(() => localStorage.getItem("pcs-right-collapsed") === "1");
  const clampWidth = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
  useEffect(() => { localStorage.setItem("pcs-left-width", String(leftWidth)); }, [leftWidth]);
  useEffect(() => { localStorage.setItem("pcs-right-width", String(rightWidth)); }, [rightWidth]);
  useEffect(() => { localStorage.setItem("pcs-left-collapsed", leftCollapsed ? "1" : "0"); }, [leftCollapsed]);
  useEffect(() => { localStorage.setItem("pcs-right-collapsed", rightCollapsed ? "1" : "0"); }, [rightCollapsed]);
  const [focusMode, setFocusMode] = useState(false);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [bottomPanel, setBottomPanel] = useState<"timeline" | "readme" | "contribution" | "stats" | null>(null);
  const [dialog, setDialog] = useState<"new" | "compatibility" | "tutorial" | "about" | null>(null);
  const clipboard = useRef<Layer[]>([]);
  const [fitRequestCount, setFitRequestCount] = useState(0);
  // Real multi-selection (R38): primary selection stays selectedId; additional
  // members live in selectedIds. Ctrl+click toggles, Shift+click ranges.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => store.subscribe(setDoc), [store]);

  const issues = useMemo(() => validateBannerSpec(doc), [doc]);
  const validation = useMemo(
    () => issues.map((i) => `${i.severity}: ${i.path} — ${i.message}`),
    [issues],
  );

  useEffect(()=>{
    const name=store.lastAction();if(!name)return;
    const currentId=projectRef.current.createdAt;
    const timer=setTimeout(()=>{if(projectRef.current.createdAt!==currentId)return;const p=projectRef.current;const history=appendCheckpoint(p.history??[],store.getDocument(),name,Number(localStorage.getItem('pcs-history-limit'))||30);if(history!==p.history){const next={...p,history};projectRef.current=next;setProject(next);}},1400);
    return()=>clearTimeout(timer);
  },[doc,store]);

  const applyDocChange = useCallback(() => {
    setSaveState("unsaved");
  }, []);

  // Wrap store mutations so any edit marks the project dirty.
  const wrapped = useMemo(() => {
    const mark = <A extends unknown[], R>(fn: (...a: A) => R) =>
      (...a: A): R => { const r = fn(...a); setSaveState("unsaved"); return r; };
    return {
      addRect: mark((patch?: Parameters<SceneStore["addRect"]>[0]) => {
        const id = store.addRect(patch);
        setSelectedId(id);
        return id;
      }),
      addText: mark((patch?: Parameters<SceneStore["addText"]>[0]) => {
        const id = store.addText(patch);
        setSelectedId(id);
        return id;
      }),
      addEllipse: mark((patch?: Parameters<SceneStore["addEllipse"]>[0]) => {
        const id = store.addEllipse(patch);
        setSelectedId(id);
        return id;
      }),
      addLine: mark((patch?: Parameters<SceneStore["addLine"]>[0]) => {
        const id = store.addLine(patch);
        setSelectedId(id);
        return id;
      }),
      addImage: mark((patch: Parameters<SceneStore["addImage"]>[0]) => {
        const id = store.addImage(patch);
        setSelectedId(id);
        return id;
      }),
      removeLayer: mark((id: string) => {
        store.removeLayer(id);
        setSelectedId((cur) => (cur === id ? null : cur));
      }),
      updateLayer: mark(store.updateLayer.bind(store)),
      updateCanvas: mark(store.updateCanvas.bind(store)),
      reorderLayer: mark(store.reorderLayer.bind(store)),
      undo: mark(store.undo.bind(store)),
      redo: mark(store.redo.bind(store)),
    };
  }, [store]);

  const selected = selectedId ? store.layerById(selectedId) ?? null : null;

  const loadProject = useCallback((p: PCSProject, path?: string) => {
    projectRef.current = p;
    savedFingerprint.current = path ? fingerprint(p, p.bannerSpec) : null;
    store.loadDocument(p.bannerSpec);
    setProject(p);
    setExportTargetId(canonicalTarget(p.settings?.target??(p.readme?"github-profile-readme":undefined)));
    setProjectPath(path);
    setSelectedId(null);
    setSelectedIds([]);
    setPreviewEffect(null);
    setPreviewBehavior(null);
    setSaveState(path ? "saved" : "unsaved");
  }, [store]);

  const currentProject = useCallback((): PCSProject => {
    return { ...project, bannerSpec: store.getDocument() };
  }, [project, store]);

  /** Patch project-level metadata (readme/stats/contribution). */
  const setProjectMeta = useCallback((patch: Partial<PCSProject>) => {
    const before = projectRef.current;
    const after = { ...before, ...patch };
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    store.executeCommand({ label: "Edit profile", apply: () => { projectRef.current = after; setProject(after); }, revert: () => { projectRef.current = before; setProject(before); } });
    setSaveState("unsaved");
  }, [store]);

  useEffect(()=>{setExportTargetId(canonicalTarget(project.settings?.target??(project.readme?"github-profile-readme":undefined)));},[project.settings?.target]);
  const selectTarget=(id:string)=>{const target=canonicalTarget(id);setExportTargetId(target);setProjectMeta({settings:{...projectRef.current.settings,target}});};

  const editorCore = {
    markSaved: (path?: string, snapshot?: PCSProject) => { if (path) setProjectPath(path); savedFingerprint.current = snapshot ? fingerprint(snapshot, snapshot.bannerSpec) : fingerprint(projectRef.current, store.getDocument()); setSaveState(savedFingerprint.current === fingerprint(projectRef.current, store.getDocument()) ? "saved" : "unsaved"); },
    store, project, doc, selected, selectedId, saveState, validation, exportTargetId, setExportTargetId:selectTarget, previewEffect, setPreviewEffect, previewBehavior, setPreviewBehavior,
    zoom, setZoom, showSafeArea, setShowSafeArea, safeAreaMode, setSafeAreaMode,
    safeAreaLock, setSafeAreaLock, transparencyGrid, setTransparencyGrid, projectPath,
    tool, setTool, mode, setMode, pan, setPan, experience, setExperience,
    leftWidth, setLeftWidth: (v: number) => setLeftWidth(clampWidth(v, 200, 400)),
    rightWidth, setRightWidth: (v: number) => setRightWidth(clampWidth(v, 240, 420)),
    leftCollapsed, setLeftCollapsed, rightCollapsed, setRightCollapsed,
    focusMode, setFocusMode,
    time, setTime, playing, setPlaying, playbackRate, setPlaybackRate,
    timelineOpen, setTimelineOpen, bottomPanel, setBottomPanel, dialog, setDialog,
    clipboard,
    requestFit: () => { setFitRequestCount(n => n + 1); },
    fitRequestCount,
    /** Real multi-select scoped select-all (R37/R38): selects every unlocked,
     *  visible layer. Does NOT touch the WebView DOM. */
    selectAll: () => {
      const ids = store.getDocument().layers
        .filter((l) => !l.locked && l.visible)
        .map((l) => l.id);
      setSelectedIds(ids);
      const top = store.getDocument().layers.filter((l) => !l.locked && l.visible).pop();
      setSelectedId(top?.id ?? null);
    },
    /** Ctrl+click toggle / plain click replace. */
    toggleSelectedId: (id: string, additive: boolean) => {
      if (!additive) {
        setSelectedId(id);
        setSelectedIds([id]);
        return;
      }
      setSelectedId(id);
      setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
    },
    /** Shift+click: select the range from the anchor (primary) to id. */
    rangeSelect: (id: string) => {
      const layers = layerContainer(store.getDocument().layers, id) ?? [];
      const a = selectedId ? layers.findIndex((l) => l.id === selectedId) : -1;
      const b = layers.findIndex((l) => l.id === id);
      if (a < 0 || b < 0) { setSelectedId(id); setSelectedIds([id]); return; }
      const [lo, hi] = a < b ? [a, b] : [b, a];
      const ids = layers.slice(lo, hi + 1).filter((l) => !l.locked && l.visible).map((l) => l.id);
      setSelectedIds(ids);
    },
    selectedIds, setSelectedIds,
    clearMultiSelect: () => setSelectedIds([]),
    /** Number of layers currently on the internal clipboard (menu state). */
    pasteCount: () => clipboard.current.length,
    /** Group the current multi-selection into one group layer (R21). */
    groupSelected: () => {
      const ids = selectedIds.length > 1 ? selectedIds : selectedId ? [selectedId] : [];
      if (ids.length < 2) return null;
      const layers = layerContainer(store.getDocument().layers, ids[0] ?? "") ?? [];
      const members = ids
        .map((id) => layers.find((l) => l.id === id))
        .filter((l): l is Layer => !!l);
      if (members.length < 2) return null;
      let minX = Infinity, minY = Infinity;
      for (const l of members) {
        if ("x" in l) minX = Math.min(minX, (l as { x: number }).x);
        if ("y" in l) minY = Math.min(minY, (l as { y: number }).y);
      }
      const group = {
        id: `grp-${Math.random().toString(36).slice(2, 10)}`,
        type: "group" as const,
        name: "Group",
        kind: "scene",
        x: Number.isFinite(minX) ? minX : 0,
        y: Number.isFinite(minY) ? minY : 0,
        visible: true, locked: false, opacity: 1, rotation: 0,
        params: {},
        children: members,
      };
      // Group is one undo step; children retain their world coordinates.
      const topIdx = Math.max(...members.map((m) => layers.findIndex((l) => l.id === m.id)));
        const next = structuredClone(store.getDocument());
        const siblings = layerContainer(next.layers, members[0]!.id)!;
        for (let i = siblings.length - 1; i >= 0; i--) if (ids.includes(siblings[i]!.id)) siblings.splice(i, 1);
        siblings.splice(Math.min(topIdx, siblings.length), 0, group as unknown as Layer);
      store.replaceDocument(next, "Group selection");
      setSelectedId(group.id);
      setSelectedIds([group.id]);
      setSaveState("unsaved");
      return group.id;
    },
    ungroupSelected: () => {
      const group = selectedId ? store.layerById(selectedId) : null;
      if (!group || group.type !== "group" || group.locked) return;
      const next = structuredClone(store.getDocument());
        const siblings = layerContainer(next.layers, group.id);
        if (!siblings) return;
        const i = siblings.findIndex(l => l.id === group.id);
      if (i < 0) return;
        siblings.splice(i, 1, ...group.children);
      store.replaceDocument(next, "Ungroup selection");
      setSelectedId(group.children[0]?.id ?? null);
      setSelectedIds(group.children.map(l => l.id));
    },
    duplicateSelected: () => {
      const ids = selectedIds.length > 1 ? selectedIds : selectedId ? [selectedId] : [];
      let lastId: string | null = null;
      const copies: string[] = [];
      for (const id of ids) {
        const l = store.layerById(id);
        if (!l) continue;
        const copy = cloneForInsertion(l);
        const newId = `dup-${Math.random().toString(36).slice(2, 10)}`;
        (copy as { id: string }).id = newId;
        copy.name = `${copy.name} copy`;
        if ("x" in copy) (copy as unknown as { x: number }).x += 20;
        if ("y" in copy) (copy as unknown as { y: number }).y += 20;
        copy.locked = false;
        store.commitForeign(copy);
        lastId = newId;
        copies.push(newId);
      }
      if (lastId) { setSelectedId(lastId); setSelectedIds(copies); setSaveState("unsaved"); }
    },
    copySelected: () => {
      // Internal PCS clipboard payload — independent from the OS text clipboard.
      const ids = selectedIds.length > 1 ? selectedIds : selectedId ? [selectedId] : [];
      clipboard.current = ids
          .map((id) => store.layerById(id))
        .filter((l): l is Layer => !!l && !l.locked)
        .map((l) => structuredClone(l));
      return clipboard.current.length;
    },
    cutSelected: () => {
      const ids = selectedIds.length > 1 ? selectedIds : selectedId ? [selectedId] : [];
      const grabbed = ids
          .map((id) => store.layerById(id))
        .filter((l): l is Layer => !!l && !l.locked)
        .map((l) => structuredClone(l));
      if (grabbed.length === 0) return;
      clipboard.current = grabbed;
      for (const id of ids) store.removeLayer(id);
      setSelectedId(null);
      setSelectedIds([]);
      setSaveState("unsaved");
    },
    paste: (atX?: number, atY?: number) => {
      const stack = clipboard.current;
      if (stack.length === 0) return;
      const pasted: string[] = [];
      for (const l of stack) {
        const copy = cloneForInsertion(l);
        (copy as { id: string }).id = `dup-${Math.random().toString(36).slice(2, 10)}`;
        copy.name = `${copy.name} copy`;
        copy.locked = false;
        if (atX !== undefined) (copy as { x: number }).x = atX;
        if (atY !== undefined) (copy as { y: number }).y = atY;
        store.commitForeign(copy);
        pasted.push((copy as { id: string }).id);
      }
      setSelectedId(pasted[pasted.length - 1] ?? null);
      setSelectedIds(pasted);
      setSaveState("unsaved");
    },
    reorderLayerTo: (id: string, where: "front" | "back" | "forward" | "backward") => {
      const idx = store.getDocument().layers.findIndex((l) => l.id === id);
      if (idx < 0) return;
      const len = store.getDocument().layers.length;
      const target = where === "front" ? len - 1 : where === "back" ? 0 : where === "forward" ? idx + 1 : idx - 1;
      store.reorderLayer(id, Math.max(0, Math.min(len - 1, target)));
    },
    setSelectedId, loadProject, currentProject, setSaveState, setProjectMeta,
    hasErrors: issues.some((i) => i.severity === "error") ? validation : [],
    ...wrapped,
  };
  return editorCore;
}

export type Editor = ReturnType<typeof useEditor>;
export type { Layer };
