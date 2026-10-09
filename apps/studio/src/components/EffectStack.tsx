import type { LayerEffect } from "@pcs/bannerspec";
import type { Editor } from "../editor.js";
import { effectName } from "../effects.js";
import { ColorField, PropertyRow, Toggle } from "./controls.js";

type Parameter = [string, string, number, number, number, number];
const PARAMETERS: Record<string, Parameter[]> = {
  glow: [["Radius", "amount", 0, 50, 1, 8], ["Intensity", "intensity", 0, 1, .05, .65], ["Spread", "spread", 0, 20, 1, 0]],
  bloom: [["Radius", "amount", 0, 60, 1, 18], ["Threshold", "threshold", 0, .95, .05, .55], ["Strength", "strength", 0, 3, .1, 1.5]],
  neon: [["Edge", "edge", .5, 8, .5, 1.5], ["Outer glow", "outer", 0, 40, 1, 10], ["Inner glow", "inner", 0, 8, .5, 2]],
  halo: [["Radius", "amount", 0, 60, 1, 24], ["Opacity", "opacity", 0, 1, .05, .7], ["Falloff", "falloff", .1, 1, .05, .6]],
};
const weather: Parameter[] = [["Density", "amount", 0, 100, 1, 50], ["Speed", "speed", .1, 4, .1, 1], ["Wind", "wind", -2, 2, .1, .15], ["Smallest particle", "sizeMin", .2, 8, .2, .6], ["Largest particle", "sizeMax", 1, 25, .5, 3.5], ["Depth", "depth", 0, 1, .05, .6], ["Softness", "blur", 0, 12, .5, 0], ["Brightness", "brightness", .1, 2, .1, 1]];
for (const key of ['rain-fx','snow-fx','dust-fx','stars-fx','fireflies-fx','embers-fx','leaves-fx','bokeh-fx']) PARAMETERS[key] = weather;
PARAMETERS['rain-fx'] = [...weather, ["Trail length", "trailLength", 0, 30, 1, 14], ["Trail width", "trailWidth", .1, 2, .1, .45], ["Opacity", "opacity", 0, 1, .05, .8]];
PARAMETERS['snow-fx'] = [...weather, ["Flutter", "flutter", 0, 60, 1, 14], ["Turbulence", "turbulence", 0, 2, .1, .4], ["Opacity", "opacity", 0, 1, .05, .8]];
for (const key of ['fog-fx','mist','smoke','steam','clouds','condensation']) PARAMETERS[key] = [["Density", "density", 0, 1, .05, .5], ["Height", "height", .1, 1, .05, .65], ["Softness", "softness", .1, 1, .05, .65], ["Texture scale", "noiseScale", .2, 3, .1, 1], ["Turbulence", "turbulence", 0, 2, .1, .6], ["Drift", "speed", .1, 3, .1, 1], ["Direction", "direction", -1, 1, .1, 1], ["Layers", "layers", 1, 12, 1, 7], ["Opacity", "opacity", 0, 1, .05, .8]];
for (const key of ['scanlines','crt','grid','hud']) PARAMETERS[key] = [["Strength", "amount", 0, 100, 1, 50], ["Spacing", "spacing", 2, 50, 1, 4], ["Thickness", "thickness", .2, 4, .2, 1]];
PARAMETERS.heavenly = [["Glow strength","amount",0,100,1,45],["Particles","count",0,150,1,48],["Rise speed","speed",.1,3,.1,.6],["Softness","blur",0,8,.5,2],["Smallest mote","sizeMin",.2,4,.1,.6],["Largest mote","sizeMax",1,8,.1,2.1],["Opacity","opacity",0,1,.05,.8]];
PARAMETERS['motion-blur'] = [["Distance", "amount", 0, 60, 1, 12], ["Angle", "angle", 0, 180, 1, 0]];
/** The same stack and parameters feed the canvas, cards, and exports. */
export function EffectStack({ editor }: { editor: Editor }) {
  const layer = editor.selected;
  if (!layer) return null;
  const effects = layer.effects ?? [];
  const replace = (next: LayerEffect[]) => editor.updateLayer(layer.id, { effects: next });
  const patch = (id: string, changes: Partial<LayerEffect>) => replace(effects.map(fx => fx.id === id ? { ...fx, ...changes } : fx));
  return <div className="studio-effect-stack">{effects.map((fx, index) => <details key={fx.id} open={effects.length === 1}>
    <summary>{effectName(fx)}</summary>
    <div className="studio-stack-actions">
      <Toggle on={fx.visible} label={`Enable ${effectName(fx)}`} onChange={() => patch(fx.id, { visible: !fx.visible })}/>
      <button className="btn" disabled={index === 0} aria-label={`Move ${effectName(fx)} earlier`} onClick={() => { const next = [...effects]; [next[index-1], next[index]] = [next[index]!, next[index-1]!]; replace(next); }}>↑</button>
      <button className="btn" disabled={index === effects.length-1} aria-label={`Move ${effectName(fx)} later`} onClick={() => { const next = [...effects]; [next[index+1], next[index]] = [next[index]!, next[index+1]!]; replace(next); }}>↓</button>
      <button className="btn" aria-label={`Remove ${effectName(fx)}`} onClick={() => replace(effects.filter(e => e.id !== fx.id))}>×</button>
    </div>
    {fx.type !== "bloom" && <PropertyRow label="Color"><ColorField value={fx.color ?? "#5b8cff"} onChange={color => patch(fx.id, { color })}/></PropertyRow>}
    {(PARAMETERS[fx.type] ?? [["Strength", "amount", 0, 100, 1, 20] as Parameter]).map(([label, key, min, max, step, fallback]) => <label className="studio-effect-parameter" key={key}>
      <span>{label}</span><input type="range" aria-label={`${effectName(fx)} ${label}`} min={min} max={max} step={step} value={Number(fx.params[key] ?? fallback)} onChange={e => patch(fx.id, { params: { ...fx.params, [key]: Number(e.target.value) } })}/><output>{Number(fx.params[key] ?? fallback).toFixed(step < 1 ? 2 : 0)}</output>
    </label>)}
  </details>)}</div>;
}
