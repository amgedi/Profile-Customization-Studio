import { useEffect, useMemo, useRef, useState } from "react";
import { buildCommands, type StudioActions } from "../commands.js";
import type { Editor } from "../editor.js";
import { SCENE_LIBRARY } from "../sceneLibrary.js";
import { TARGET_REGISTRY } from "../targets/registry.js";
import { atmosphereLayer } from "../atmosphere.js";
import { EFFECT_PRESETS, makeEffect } from "../effects.js";
import { BEHAVIOR_PRESETS } from "@pcs/scene-core";
import { useOutsideClose } from "./useOutsideClose.js";

type PaletteCategory = "Commands" | "Scenes" | "Photos" | "Effects" | "Animations" | "Tools" | "Profile" | "Settings";

interface PaletteResult {
  id: string;
  label: string;
  category: PaletteCategory;
  hint: string;
  keywords: string;
  run: () => void;
}

/** Scenes, effects and animations searchable by natural terms like "rain". */
function buildExtraResults(editor: Editor): PaletteResult[] {
  const sceneRes: PaletteResult[] = SCENE_LIBRARY.filter((s) => !s.experimental).map((s) => ({
    id: `scene:${s.id}`,
    label: s.name,
    category: s.category === "photo" ? "Photos" : "Scenes",
    hint: s.category === "photo" ? "Photo scene" : "Scene",
    keywords: [s.category, ...s.tags, "scene"].join(" "),
    run: () => {
      const doc = s.make(editor.doc.canvas.width, editor.doc.canvas.height);
      if (editor.doc.layers.length > 0) editor.store.replaceDocument(doc, `Apply scene: ${s.name}`);
      else editor.store.loadDocument(doc);
      editor.setSaveState("unsaved");
    },
  }));
  const effectRes: PaletteResult[] = EFFECT_PRESETS.map((p) => ({
    id: `effect:${p.id}`,
    label: `Add Effect — ${p.name}`,
    category: "Effects",
    hint: "Effect",
    keywords: `${p.category} ${p.blurb} effect`,
    run: () => {
      if (editor.selectedId && editor.selected) editor.updateLayer(editor.selectedId, { effects: [...(editor.selected.effects ?? []), makeEffect(p)] });
      else { const layer = atmosphereLayer(editor.doc, p); editor.store.addLayer(layer); editor.setSelectedId(layer.id); editor.setSaveState("unsaved"); }
    },
  }));
  const animRes: PaletteResult[] = BEHAVIOR_PRESETS.map((a) => ({
    id: `anim:${a.id}`,
    label: a.name,
    category: "Animations",
    hint: a.category,
    keywords: `${a.category} ${a.blurb} animation animate`,
    run: () => editor.setMode("animate"),
  }));
  const toolRes: PaletteResult[] = [
    { id: "tool:fit", label: "Fit Canvas", category: "Tools", hint: "F", keywords: "fit zoom view canvas", run: () => editor.requestFit() },
    { id: "tool:focus", label: editor.focusMode ? "Exit focus canvas" : "Focus canvas", category: "Tools", hint: "Esc", keywords: "focus distraction zen", run: () => editor.setFocusMode(!editor.focusMode) },
    { id: "tool:safe", label: editor.showSafeArea ? "Hide safe area" : "Show safe area", category: "Tools", hint: "Guides", keywords: "safe area guides crop platform", run: () => editor.setShowSafeArea(!editor.showSafeArea) },
  ];
  const profileRes: PaletteResult[] = [
    { id: "profile:open", label: "Open Profile Builder", category: "Profile", hint: "Workspace", keywords: "profile readme builder github page", run: () => editor.setMode("profile") },
    { id: "profile:stats", label: "Profile Stats", category: "Profile", hint: "GitHub", keywords: "stats github contributions data", run: () => editor.setMode("profile") },
  ];
  const settingsRes: PaletteResult[] = [
    { id: "settings:open", label: "Open Settings", category: "Settings", hint: "", keywords: "settings preferences theme accent options", run: () => {
      // Settings opens from the top bar; route through the same path.
      document.querySelector<HTMLButtonElement>('[aria-label="Settings"]')?.click();
    } },
    { id: "settings:weather", label: "Weather settings", category: "Settings", hint: "Ambience", keywords: "weather rain snow fog ambience atmosphere settings", run: () => editor.setMode("design") },
    { id: "settings:glow", label: "UI Glow settings", category: "Settings", hint: "Appearance", keywords: "glow ui light settings appearance", run: () => {
      document.querySelector<HTMLButtonElement>('[aria-label="Settings"]')?.click();
    } },
  ];
  const platforms: PaletteResult[] = TARGET_REGISTRY.map(t => ({id: "platform:"+t.id, label: t.displayName, category: "Tools", hint: "Platform preview", keywords: "platform target "+t.displayName.toLowerCase(), run: () => {editor.setExportTargetId(t.id);editor.setMode("profile");}}));
  toolRes.push({id:"tool:assets",label:"Your images, fonts & components",category:"Tools",hint:"Local Studio",keywords:"assets fonts images components library import",run:()=>window.dispatchEvent(new Event("pcs-open-assets"))});
  return [...platforms, ...sceneRes, ...effectRes, ...animRes, ...toolRes, ...profileRes, ...settingsRes];
}

const CATEGORY_ORDER: PaletteCategory[] = ["Commands", "Scenes", "Photos", "Effects", "Animations", "Tools", "Profile", "Settings"];

/** Ctrl+K command palette — top-center floating frosted surface (R18–R20). */
export function CommandPalette({ editor, actions, onClose }: {
  editor: Editor;
  actions: StudioActions;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const cmds = useMemo(() => buildCommands(actions), [actions]);
  const extras = useMemo(() => buildExtraResults(editor), [editor]);
  const ctx = useMemo(() => ({ editor, actions }), [editor, actions]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cmdHits = cmds
      .filter((c) => c.enabled(ctx))
      .filter((c) => !q || c.label.toLowerCase().includes(q) || (c.keywords ?? "").includes(q))
      .map((c) => ({ id: c.id, label: c.label, category: "Commands" as PaletteCategory, hint: c.shortcut ?? c.group, keywords: c.keywords ?? "", run: () => c.run(ctx) }));
    const extraHits = extras
      .filter((x) => !q || x.label.toLowerCase().includes(q) || x.keywords.includes(q));
    const all = [...cmdHits, ...extraHits];
    if (!q) return all.slice(0, 14);
    // Ranked: label prefix matches first, then label contains, then keyword hits.
    const score = (r: PaletteResult) => {
      const l = r.label.toLowerCase();
      if (l.startsWith(q)) return 0;
      if (l.includes(q)) return 1;
      return 2;
    };
    return all.sort((a, b) => score(a) - score(b)).slice(0, 20);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, cmds, extras]);

  // Grouped rows preserve category headers when there is no query.
  const grouped = useMemo(() => {
    if (query.trim()) return [{ category: null as PaletteCategory | null, items: results }];
    const out: Array<{ category: PaletteCategory | null; items: PaletteResult[] }> = [];
    for (const cat of CATEGORY_ORDER) {
      const items = results.filter((r) => r.category === cat);
      if (items.length) out.push({ category: cat, items });
    }
    return out;
  }, [results, query]);

  useEffect(() => setIndex(0), [query]);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useOutsideClose(surfaceRef, onClose);

  // Keyboard: up/down moves the highlight, Enter executes. Selection changes
  // scroll the highlighted row smoothly into view (R19).
  const flat = grouped.flatMap((g) => g.items);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(flat.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const r = flat[index];
      if (r) { r.run(); onClose(); }
    }
  };
  useEffect(() => {
    listRef.current?.querySelector(".palette-row.selected")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [index]);

  let rowIdx = -1;

  return (
    <div className="dialog-overlay palette-overlay" onClick={onClose} role="dialog" aria-label="Command palette">
      <div className="palette-surface v2" ref={surfaceRef} onClick={(e) => e.stopPropagation()}>
        <div className="palette-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            className="field-input palette-input"
            placeholder="Type a command, scene, effect or animation…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Search commands"
          />
          <kbd className="palette-kbd">Esc</kbd>
        </div>
        <div className="palette-list" ref={listRef}>
          {results.length === 0 && <p className="empty-hint">No matching commands.</p>}
          {grouped.map((g, gi) => (
            <div key={gi} className="palette-group">
              {g.category && <div className="palette-cat">{g.category}</div>}
              {g.items.map((c) => {
                rowIdx += 1;
                const i = rowIdx;
                return (
                  <button
                    key={c.id}
                    className={"palette-row" + (i === index ? " selected" : "")}
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => { c.run(); onClose(); }}
                  >
                    <span className="palette-row-label">{c.label}</span>
                    <span className="menu-hint">{c.hint}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
