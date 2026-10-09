/**
 * Effect browser — visual cards with real rendered thumbnails, hover live
 * preview on the selected layer, and an explicit "+ Add" to push onto the
 * layer's effect stack. No dropdowns: cards only, everywhere.
 */
import { runtimePrefs } from "../prefs.js";
import { useEffect, useState } from "react";
import type { LayerEffect } from "@pcs/bannerspec";
import type { Editor } from "../editor.js";
import { EFFECT_PRESETS, makeEffect, type EffectPreset } from "../effects.js";
import { effectPoster } from "../thumbnails.js";
import { PresetBrowser, type PresetBrowserItem } from "./PresetBrowser.js";
import "../styles/effects.css";

export function EffectThumb({ preset }: { preset: EffectPreset }) {
  const svg = effectPoster(preset);
  if (!svg) {
    return <span className="fx-thumb-fallback" style={{ background: preset.color ?? "#5b8cff" }} />;
  }
  return (
    <img className="fx-thumb" src={"data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)} alt="" draggable={false}/>
  );
}

/** Live hover preview: temporarily appends an effect to the selected layer. */
export function useEffectHoverPreview(editor: Editor) {
  useEffect(() => {
    const cancel = (e: KeyboardEvent) => { if (e.key === "Escape") editor.setPreviewEffect(null); };
    window.addEventListener("keydown", cancel);
    return () => { window.removeEventListener("keydown", cancel); editor.setPreviewEffect(null); };
  }, [editor.setPreviewEffect]);
  return (effect: LayerEffect | null) => editor.setPreviewEffect(effect && editor.selectedId ? { layerId: editor.selectedId, effect } : null);
}

export function EffectBrowser({ editor, onAdd, onClose, compact, atmosphereOnly }: {
  editor: Editor;
  onAdd: (preset: EffectPreset) => void;
  onClose?: () => void;
  compact?: boolean;
  atmosphereOnly?: boolean;
}) {
  const hoverPreview = useEffectHoverPreview(editor);
  const [listView, setListView] = useState(false);
  const items: PresetBrowserItem[] = EFFECT_PRESETS.filter(p => !atmosphereOnly || p.category === "Atmosphere" || p.type === "heavenly").map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    blurb: p.blurb,
    tags: [p.category.toLowerCase(), p.type],
    render: () => <EffectThumb preset={p} />,
  }));

  return (
    <div className={"effect-browser" + (compact ? " compact" : "") + (listView ? " effect-list-view" : "")}><div className="effect-view-options"><button className="btn" aria-pressed={listView} onClick={()=>setListView(!listView)}>{listView ? "Card view" : "List view"}</button><span>{editor.selected?.effects?.length ?? 0} added to {editor.selected?.name ?? "scene"}</span></div>
      <PresetBrowser
        kind="effect"
        items={items}
        searchPlaceholder="Search effects — try “glow”, “rain”, “chrome”…"
        onHover={(item) => {
          const preset = item ? EFFECT_PRESETS.find((p) => p.id === item.id) : null;
          hoverPreview(preset && runtimePrefs().cardHoverAnimation ? makeEffect(preset) : null);
        }}
        onApply={(item) => {
          const preset = EFFECT_PRESETS.find((p) => p.id === item.id);
          editor.setPreviewEffect(null);
          if (preset) onAdd(preset);
        }}
      />
      {onClose && (
        <button className="btn ghost" style={{ width: "100%", marginTop: 8 }} onClick={onClose}>
          Close browser
        </button>
      )}
      <p className="paint-hint" style={{ marginTop: 6 }}>
        Hover a card to try it live · click <strong>+</strong> (or Apply) to add it to the stack. Effects stack.
      </p>
    </div>
  );
}
