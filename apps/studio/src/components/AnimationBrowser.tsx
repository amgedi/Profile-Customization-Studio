import { useReducedMotion } from "../useReducedMotion.js";
import { OverlaySurface } from "./OverlayHost.js";
/**
 * Animation browser — a floating frosted modal (never a dropdown, never a
 * workspace switch). Categories: Entrance / Continuous / Exit / Text / Color /
 * Lighting / Ambient. Cards animate themselves with the preset's own CSS
 * keyframes; hovering previews the motion on the selected layer, and the
 * explicit "+ Add" button appends it to the layer's animation stack.
 */
import { useEffect, useMemo, useRef } from "react";
import { X } from "lucide-react";
import type { LayerBehavior } from "@pcs/bannerspec";
import { renderSvg, BEHAVIOR_PRESETS, type BehaviorPreset } from "@pcs/scene-core";
import type { Editor } from "../editor.js";
import { PresetBrowser, type PresetBrowserItem } from "./PresetBrowser.js";
import "../styles/effects.css";

export const ANIM_CATEGORY_ORDER = [
  { id: "entrance", label: "Entrance" },
  { id: "loop", label: "Continuous" },
  { id: "exit", label: "Exit" },
  { id: "text", label: "Text" },
  { id: "color", label: "Color" },
  { id: "lighting", label: "Lighting" },
  { id: "ambient", label: "Ambient" },
] as const;

/** Injects every preset's keyframes once so cards can animate themselves. */
export function AnimationKeyframes() {
  const css = BEHAVIOR_PRESETS.map((p) => p.css).join("\n");
  return <style>{css}</style>;
}

// One throttled clock for every visible thumbnail, stopped when the browser closes.
const previewFrames = new Set<(time: number) => void>();
let previewRequest = 0, lastPreviewFrame = 0;
function previewTick(now: number) {
  if (!document.hidden && now - lastPreviewFrame >= 66) {
    lastPreviewFrame = now;
    for (const paint of previewFrames) paint((now / 1000) % 4);
  }
  previewRequest = previewFrames.size ? requestAnimationFrame(previewTick) : 0;
}
function subscribePreview(paint: (time: number) => void) {
  previewFrames.add(paint);
  if (!previewRequest) previewRequest = requestAnimationFrame(previewTick);
  return () => {
    previewFrames.delete(paint);
    if (!previewFrames.size) { cancelAnimationFrame(previewRequest); previewRequest = 0; }
  };
}

export function AnimCardVisual({ preset }: { preset: BehaviorPreset }) {
  const reduced = useReducedMotion();
  const image = useRef<HTMLImageElement>(null);
  const doc = useMemo(() => ({specVersion:'0.3' as const,canvas:{width:240,height:116,background:'#111827'},animation:{duration:4,loop:true},layers:[{id:'preview',type:'text' as const,name:'Preview',visible:true,locked:false,x:120,y:64,opacity:1,rotation:0,text:'Create something',fontFamily:'Segoe UI, sans-serif',fontSize:19,align:'middle' as const,fill:'#c4b5fd',behaviors:[{...makeBehavior(preset),id:'preview-motion'}]}]}), [preset]);
  const frame = (time: number) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(renderSvg(doc, {time}));
  useEffect(() => {
    const node = image.current;
    if (!node || reduced) return;
    let unsubscribe: (() => void) | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      unsubscribe?.(); unsubscribe = undefined;
      if (entry?.isIntersecting) unsubscribe = subscribePreview(time => {
        node.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(renderSvg(doc, {time}));
      });
    });
    observer.observe(node);
    return () => { observer.disconnect(); unsubscribe?.(); };
  }, [doc, reduced]);
  return <span className="anim-card-visual"><img ref={image} src={frame(2)} alt={`${preset.name} motion preview`}/></span>;
}

/** Temporary behavior preview on the selected layer (stash + restore). */
export function useBehaviorHoverPreview(editor: Editor, dur: number) {
 useEffect(() => {
  const cancel = (e: KeyboardEvent) => { if (e.key === "Escape") editor.setPreviewBehavior(null); };
  window.addEventListener("keydown", cancel);
  return () => { window.removeEventListener("keydown", cancel); editor.setPreviewBehavior(null); };
 }, [editor.setPreviewBehavior]);
 return (preset: BehaviorPreset | null) => editor.setPreviewBehavior(preset && editor.selectedId ? { layerId: editor.selectedId, behavior: makeBehavior(preset) } : null);
}

export function makeBehavior(preset: BehaviorPreset): LayerBehavior {
  return {
    id: `bh-${Math.random().toString(36).slice(2, 10)}`,
    preset: preset.id,
    category: preset.category,
    enabled: true,
    speed: 1,
    amount: 60,
  };
}

export function AnimationBrowserModal({ editor, onAdd, onClose }: {
  editor: Editor;
  onAdd: (preset: BehaviorPreset) => void;
  onClose: () => void;
}) {
  const hoverPreview = useBehaviorHoverPreview(editor, editor.doc.animation?.duration ?? 8);
  const items: PresetBrowserItem[] = BEHAVIOR_PRESETS.map((p) => ({
    id: p.id,
    name: p.name,
    category: (ANIM_CATEGORY_ORDER.find((c) => c.id === p.category)?.label) ?? p.category,
    blurb: p.blurb,
    tags: [p.category, p.id],
    render: () => <AnimCardVisual preset={p} />,
  }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <OverlaySurface><div className="fx-modal-overlay" role="dialog" aria-modal="true" aria-label="Animation browser" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fx-modal">
        <div className="fx-modal-head">
          <h3>Add Animation</h3>
          <span style={{ flex: 1 }} />
          <button className="fx-modal-close" aria-label="Close" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="fx-modal-body">
          <AnimationKeyframes />
          <PresetBrowser
            kind="animation"
            items={items}
            searchPlaceholder="Search motions — try “float”, “typewriter”, “flicker”…"
            onHover={(item) => hoverPreview(item ? BEHAVIOR_PRESETS.find((p) => p.id === item.id) ?? null : null)}
            onAddItem={(item) => {
              const preset = BEHAVIOR_PRESETS.find((p) => p.id === item.id);
              if (preset) { editor.setPreviewBehavior(null); onAdd(preset); }
            }}
            onApply={(item) => {
              const preset = BEHAVIOR_PRESETS.find((p) => p.id === item.id);
              if (preset) onAdd(preset);
            }}
          />
          <p className="paint-hint" style={{ marginTop: 6 }}>
            Choose a card, then Apply · use <strong>+</strong> to stack it. You can stack several.
          </p>
        </div>
      </div>
    </div></OverlaySurface>
  );
}
