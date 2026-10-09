import type { BannerSpecDocument, Layer } from "@pcs/bannerspec";
import { makeEffect, type EffectPreset } from "./effects.js";

/** Transparent carriers keep spatial effects independent of object selection. */
export function atmosphereLayer(doc: BannerSpecDocument, preset: EffectPreset, intensity?: number): Layer {
  const effect = makeEffect(preset);
  if (intensity !== undefined) effect.params = { ...effect.params, amount: Math.max(0, Math.min(100, intensity)) };
  return { id: crypto.randomUUID(), type: "rect", name: preset.name, visible: true, locked: false,
    opacity: 1, rotation: 0, x: 0, y: 0, width: doc.canvas.width, height: doc.canvas.height,
    fill: "#00000000", effects: [effect] };
}

export function insertAtmosphere(doc: BannerSpecDocument, preset: EffectPreset, intensity?: number): Layer {
  const layer = atmosphereLayer(doc, preset, intensity);
  let index = doc.layers.length;
  while (index > 0 && doc.layers[index - 1]?.type === "text") index--;
  doc.layers.splice(index, 0, layer);
  return layer;
}
