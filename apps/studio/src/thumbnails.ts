/**
 * Scene thumbnail system — posters rendered from the REAL scene generators
 * (no drift between preview and editor). Static poster frames by default;
 * SMIL-animated SVGs only for the hovered card. Cached per scene+mode.
 */
import { renderSvg } from "@pcs/scene-core";
import { SCENE_LIBRARY, type SceneEntry } from "./sceneLibrary.js";

const cache = new Map<string, string>();

function sceneById(id: string): SceneEntry | undefined {
  return SCENE_LIBRARY.find((s) => s.id === id);
}

function renderFor(id: string, animated: boolean): string | null {
  const key = `${id}:${animated ? "anim" : "still"}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const scene = sceneById(id);
  if (!scene) return null;
  let svg: string;
  try {
    const doc = scene.make(1200, 350);
    svg = renderSvg(doc, animated ? { animate: true } : { time: (doc.animation?.duration ?? 8) * 0.4 });
  } catch {
    cache.set(key, "");
    return null;
  }
  cache.set(key, svg);
  return svg;
}

export function scenePoster(id: string): string | null {
  return renderFor(id, false);
}

export function sceneAnimated(id: string): string | null {
  return renderFor(id, true);
}

/** Inline SVG markup scaled to fill its container. */
let previewInstance = 0;
export function svgToInline(svg: string): string {
  // SVG resource IDs are document-global even inside separate <svg> roots.
  // Each mounted poster/guide must own its gradients, clips and filters.
  const prefix = `preview-${++previewInstance}-`;
  const ids = new Map<string, string>();
  const isolated = svg.replace(/\sid="([^"]+)"/g, (_, id: string) => {
    ids.set(id, prefix + id);
    return ` id="${prefix}${id}"`;
  }).replace(/url\(#([^)]+)\)/g, (_, id: string) => `url(#${ids.get(id) ?? id})`)
    .replace(/((?:xlink:)?href)="#([^"]+)"/g, (_, attr: string, id: string) => `${attr}="#${ids.get(id) ?? id}"`);
  return isolated.replace("<svg", '<svg style="width:100%;height:100%;display:block" preserveAspectRatio="xMidYMid slice"');
}

// ------------------------------------------------------------------ effect posters

import type { BannerSpecDocument } from "@pcs/bannerspec";
import type { EffectPreset } from "./effects.js";
import { makeEffect } from "./effects.js";

const fxCache = new Map<string, string>();

/** A small sample composition every effect is previewed on. */
function effectSampleDoc(preset: EffectPreset): BannerSpecDocument {
  const fx = makeEffect(preset);
  if (['Atmosphere','Color','Retro'].includes(preset.category) || ['rays','heavenly','light-leak','lens-glow'].includes(preset.type)) {
    return {specVersion:'0.3',canvas:{width:240,height:140,background:'#0b1425'},animation:{duration:8,loop:true},layers:[
      {id:'night-study',type:'rect',name:'Night landscape',visible:true,locked:false,opacity:1,rotation:0,x:0,y:0,width:240,height:140,fill:{type:'linear',angle:90,stops:[{offset:0,color:'#101c38'},{offset:1,color:'#425c76'}]},effects:[fx]},
      {id:'mountain-study',type:'rect',name:'Distant silhouette',visible:true,locked:false,opacity:.65,rotation:15,x:-20,y:110,width:300,height:90,fill:{type:'solid',color:'#060d19'}},
      {id:'moon-study',type:'ellipse',name:'Moon',visible:true,locked:false,opacity:.85,rotation:0,x:168,y:23,width:22,height:22,fill:{type:'solid',color:'#c5d8ed'}}
    ]};
  }
  return {
    specVersion: "0.3",
    canvas: { width: 240, height: 140, background: "#0e1422" },
    layers: [
      { id: "fx-title", type: "text", name: "Light study", visible: true, locked: false,
        opacity: 1, rotation: 0, x: 28, y: 87, text: "Aa", fontFamily: "Segoe UI, sans-serif",
        fontSize: 76, fontWeight: 700, fill: { type: "solid", color: "#e4f5ff" }, effects: [fx] },
      { id: "fx-ring", type: "ellipse", name: "Light ring", visible: true, locked: false,
        opacity: 1, rotation: 0, x: 158, y: 44, width: 42, height: 42,
        fill: { type: "solid", color: "#a4dfff" }, effects: [{...fx, id: fx.id + "-ring"}] },
    ],
    animation: { duration: 6, loop: true },
  };
}

/** Real rendered thumbnail for an effect preset (cached). */
export function effectPoster(preset: EffectPreset): string | null {
  const hit = fxCache.get(preset.id);
  if (hit !== undefined) return hit;
  let svg: string | null = null;
  try {
    const doc = effectSampleDoc(preset);
    svg = renderSvg(doc, { time: 1.2 });
  } catch {
    svg = null;
  }
  fxCache.set(preset.id, svg ?? "");
  return svg;
}
