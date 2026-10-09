/**
 * Window component controls — the lo-fi "Window view" group (frame + glass +
 * outside view) is editable as ONE semantic component. Style presets reshape
 * the frame, glass types swap the pane's material, and the Scale slider
 * resizes frame, glass and view coherently (renderer group scaling).
 */
import type { GroupLayer, Layer } from "@pcs/bannerspec";
import type { Editor } from "../editor.js";
import { SliderField } from "./SliderField.js";
import { ColorField } from "./controls.js";
import { InspectorSectionShell } from "./QuickPanels.js";
import { uid } from "../scenegen.js";
import "../styles/effects.css";

// ---------------------------------------------------------------- descriptors

export interface WindowStyleDef {
  name: string;
  frame: string;
  barWidth: number;
  radius: number;
  dividers: "none" | "cross" | "grid" | "rows";
  edgeLight?: string;
}

export const WINDOW_STYLES: WindowStyleDef[] = [
  { name: "Modern", frame: "#1b2438", barWidth: 8, radius: 12, dividers: "cross", edgeLight: "#5b8cff" },
  { name: "Wood", frame: "#5c3a28", barWidth: 12, radius: 4, dividers: "cross", edgeLight: "#e0a458" },
  { name: "Cabin", frame: "#3e2a1c", barWidth: 16, radius: 2, dividers: "cross", edgeLight: "#a4753f" },
  { name: "Train", frame: "#2a2f3a", barWidth: 10, radius: 14, dividers: "rows", edgeLight: "#8fb0e8" },
  { name: "Industrial", frame: "#3a3f46", barWidth: 18, radius: 0, dividers: "grid", edgeLight: "#c9d2dd" },
  { name: "Gothic", frame: "#17131f", barWidth: 10, radius: 26, dividers: "cross", edgeLight: "#8a63ff" },
  { name: "Frameless", frame: "#10141f", barWidth: 3, radius: 18, dividers: "none", edgeLight: "#5b8cff" },
  { name: "Pixel", frame: "#141425", barWidth: 14, radius: 0, dividers: "grid", edgeLight: "#4fd8ff" },
  { name: "Sci-Fi", frame: "#0f2030", barWidth: 6, radius: 10, dividers: "grid", edgeLight: "#7fe4ff" },
];

export interface GlassTypeDef {
  name: string;
  transparency: number;
  frost: number;
  reflection: number;
  droplets: number;
  tint: number; // 0xRRGGBB
  holo?: boolean;
}

export const GLASS_TYPES: GlassTypeDef[] = [
  { name: "Clear", transparency: 0.1, frost: 0, reflection: 0.2, droplets: 0, tint: 0xffffff },
  { name: "Frosted", transparency: 0.35, frost: 0.7, reflection: 0.25, droplets: 0, tint: 0xdfe8f5 },
  { name: "Tinted", transparency: 0.3, frost: 0.1, reflection: 0.3, droplets: 0, tint: 0x9fc0ff },
  { name: "Smoked", transparency: 0.5, frost: 0.15, reflection: 0.35, droplets: 0, tint: 0x50586a },
  { name: "Rainy", transparency: 0.18, frost: 0.2, reflection: 0.3, droplets: 0.7, tint: 0xaecbe8 },
  { name: "Condensed", transparency: 0.4, frost: 0.8, reflection: 0.15, droplets: 0.35, tint: 0xe8f1ff },
  { name: "Fogged", transparency: 0.55, frost: 0.9, reflection: 0.1, droplets: 0, tint: 0xcfdcee },
  { name: "Holographic", transparency: 0.25, frost: 0.05, reflection: 0.45, droplets: 0, tint: 0x7fe4ff, holo: true },
];

export interface WindowOptions {
  style: number;
  glass: number;
  transparency: number;
  frost: number;
  reflection: number;
  droplets: number;
  tint: number;
  opacity: number;
  blur: number;
  noise: number;
  highlight: number;
  edge: number;
  shadow: number;
  scale: number;
}

export const DEFAULT_WINDOW: WindowOptions = {
  style: 0, glass: 0, transparency: 0.1, frost: 0, reflection: 0.2, droplets: 0,
  tint: 0xffffff, opacity: 1, blur: 0, noise: 0, highlight: 0.5, edge: 0.3, shadow: 0.4, scale: 1,
};

const FURNITURE = new Set([
  "Window frame", "Glass", "Frame bar", "Glass droplets", "Glass reflection",
  "Glass frost patch", "Glass noise", "Glass hologram",
]);

export const isWindowGroup = (l: Layer | null | undefined): l is GroupLayer =>
  !!l && l.type === "group" && (l.name === "Window view" || l.params?.window === 1);

export const isWindowSelected = (editor: Editor): editor is Editor & { selected: GroupLayer } =>
  isWindowGroup(editor.selected);

const hexOf = (n: number) => `#${n.toString(16).padStart(6, "0").slice(-6)}`;
const pseudo = (i: number, m: number) => ((i * 61 + 13) % m) / m;

// ---------------------------------------------------------------- builder

interface Geo { x: number; y: number; w: number; h: number }

function viewBBox(children: Layer[]): Geo | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of children) {
    const b = c as unknown as { x?: number; y?: number; width?: number; height?: number };
    if (typeof b.x !== "number" || typeof b.width !== "number") continue;
    minX = Math.min(minX, b.x); minY = Math.min(minY, b.y ?? 0);
    maxX = Math.max(maxX, b.x + b.width); maxY = Math.max(maxY, (b.y ?? 0) + (b.height ?? 0));
  }
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Rebuilds the window furniture around the (untouched) view children. */
export function buildWindowChildren(view: Layer[], geo: Geo, o: WindowOptions): Layer[] {
  const style = WINDOW_STYLES[Math.min(o.style, WINDOW_STYLES.length - 1)]!;
  const glass = GLASS_TYPES[Math.min(o.glass, GLASS_TYPES.length - 1)]!;
  const out: Layer[] = [...view];
  const { x, y, w, h } = geo;
  const tintHex = hexOf(o.tint);
  const transparency = 0.04 + o.transparency * 0.5;
  const frostBlur = o.frost * 14;

  // glass pane
  out.push({
    id: `win-glass-${uid()}`, type: "rect", name: "Glass", visible: true, locked: false,
    opacity: o.opacity * transparency, rotation: 0, x, y, width: w, height: h, cornerRadius: 4,
    fill: { type: "solid", color: tintHex },
    effects: [
      ...(frostBlur > 0.2 ? [{ id: uid(), type: "blur", visible: true, params: { amount: frostBlur } }] : []),
      ...(o.blur > 0.02 ? [{ id: uid(), type: "blur", visible: true, params: { amount: o.blur * 8 } }] : []),
      ...(o.noise > 0.02 ? [{ id: uid(), type: "grain", visible: true, params: {} }] : []),
      ...(glass.holo ? [{ id: uid(), type: "holo", visible: true, params: {}, color: "#7fe4ff" }] : []),
    ],
  } as unknown as Layer);

  // diagonal reflection sweep
  if (o.reflection > 0.03) {
    out.push({
      id: `win-reflect-${uid()}`, type: "rect", name: "Glass reflection", visible: true, locked: false,
      opacity: o.opacity * o.reflection * 0.35, rotation: 0,
      x: x + w * 0.1, y, width: w * 0.35, height: h, cornerRadius: 4,
      fill: { type: "linear", stops: [{ color: "#ffffff", offset: 0 }, { color: "#ffffff00", offset: 1 }], angle: 115 },
    } as unknown as Layer);
  }

  // highlight sheen (advanced)
  if (o.highlight > 0.03) {
    out.push({
      id: `win-hl-${uid()}`, type: "rect", name: "Glass highlight", visible: true, locked: false,
      opacity: o.opacity * o.highlight * 0.25, rotation: 0, x, y, width: w, height: h * 0.4, cornerRadius: 4,
      fill: { type: "linear", stops: [{ color: "#ffffff", offset: 0 }, { color: "#ffffff00", offset: 1 }], angle: 90 },
    } as unknown as Layer);
  }

  // droplets (rainy glass)
  if (o.droplets > 0.03) {
    const n = Math.round(4 + o.droplets * 18);
    for (let i = 0; i < n; i++) {
      const size = 2.5 + pseudo(i, 7) * 5.5;
      out.push({
        id: `win-drop-${i}-${uid()}`, type: "ellipse", name: "Glass droplets", visible: true, locked: false,
        opacity: o.opacity * (0.3 + pseudo(i + 3, 5) * 0.4), rotation: 0,
        x: x + pseudo(i, 89) * (w - 12), y: y + pseudo(i + 17, 53) * (h - 12),
        width: size, height: size * (1.15 + pseudo(i + 5, 3) * 0.5),
        fill: { type: "solid", color: "#d8e8ff" },
        effects: [{ id: uid(), type: "glow", visible: true, params: { amount: 1.5 } }],
      } as unknown as Layer);
    }
  }

  // condensation / frost patches
  if (glass.name === "Condensed" || glass.name === "Fogged") {
    for (let i = 0; i < 5; i++) {
      out.push({
        id: `win-cond-${i}-${uid()}`, type: "ellipse", name: "Glass frost patch", visible: true, locked: false,
        opacity: o.opacity * 0.18, rotation: 0,
        x: x + pseudo(i, 31) * w * 0.8, y: y + pseudo(i + 7, 23) * h * 0.75,
        width: w * (0.14 + pseudo(i + 2, 5) * 0.2), height: h * (0.18 + pseudo(i + 4, 4) * 0.22),
        fill: { type: "solid", color: "#eef5ff" },
        effects: [{ id: uid(), type: "blur", visible: true, params: { amount: 10 } }],
      } as unknown as Layer);
    }
  }

  // frame + bars (on top)
  out.push({
    id: `win-frame-${uid()}`, type: "rect", name: "Window frame", visible: true, locked: false,
    opacity: 1, rotation: 0, x: x - 10, y: y - 10, width: w + 20, height: h + 20,
    cornerRadius: style.radius,
    fill: { type: "solid", color: style.frame },
    effects: [
      ...(o.shadow > 0.03 ? [{ id: uid(), type: "shadow", visible: true, params: { dx: 0, dy: 6, blur: 12 + o.shadow * 10 } }] : []),
      ...(o.edge > 0.03 ? [{ id: uid(), type: "glow", visible: true, params: { amount: 1 + o.edge * 5 } }] : []),
    ],
    border: o.edge > 0.03 ? { paint: { type: "solid", color: style.edgeLight ?? style.frame }, width: 1 + o.edge * 2 } : undefined,
  } as unknown as Layer);

  const pushBar = (bx: number, by: number, bw: number, bh: number) => {
    out.push({
      id: `win-bar-${uid()}`, type: "rect", name: "Frame bar", visible: true, locked: false,
      opacity: 1, rotation: 0, x: bx, y: by, width: bw, height: bh, cornerRadius: 0,
      fill: { type: "solid", color: style.frame },
    } as unknown as Layer);
  };
  const bw = style.barWidth;
  if (style.dividers === "cross" || style.dividers === "grid") {
    pushBar(x + w / 2 - bw / 2, y, bw, h);
  }
  if (style.dividers === "grid") {
    pushBar(x + w * 0.25 - bw / 2, y, bw, h);
    pushBar(x + w * 0.75 - bw / 2, y, bw, h);
  }
  if (style.dividers === "cross" || style.dividers === "rows" || style.dividers === "grid") {
    pushBar(x, y + h / 2 - bw / 2, w, bw);
    if (style.dividers === "rows") {
      pushBar(x, y + h * 0.25 - bw / 2, w, bw * 0.7);
      pushBar(x, y + h * 0.75 - bw / 2, w, bw * 0.7);
    }
  }
  return out;
}

export function readWindowOptions(group: GroupLayer): WindowOptions {
  const p = group.params ?? {};
  return {
    style: p.style ?? 0, glass: p.glass ?? 0,
    transparency: p.transparency ?? 0.1, frost: p.frost ?? 0, reflection: p.reflection ?? 0.2,
    droplets: p.droplets ?? 0, tint: p.tint ?? 0xffffff, opacity: p.glassOpacity ?? 1,
    blur: p.glassBlur ?? 0, noise: p.noise ?? 0, highlight: p.highlight ?? 0.5,
    edge: p.edge ?? 0.3, shadow: p.shadow ?? 0.4, scale: p.scaleX ?? 1,
  };
}

/** Apply a partial options update: rewrite furniture children + persist params. */
export function applyWindowOptions(editor: Editor, group: GroupLayer, patch: Partial<WindowOptions>) {
  const o = { ...readWindowOptions(group), ...patch };
  const view = group.children.filter((c) => !FURNITURE.has(c.name));
  const geo = viewBBox(view) ?? { x: 0, y: 0, w: editor.doc.canvas.width * 0.4, h: editor.doc.canvas.height * 0.7 };
  const children = buildWindowChildren(view, geo, o);
  editor.store.updateLayer(group.id, {
    children,
    params: {
      window: 1,
      style: o.style, glass: o.glass, transparency: o.transparency, frost: o.frost,
      reflection: o.reflection, droplets: o.droplets, tint: o.tint,
      glassOpacity: o.opacity, glassBlur: o.blur, noise: o.noise,
      highlight: o.highlight, edge: o.edge, shadow: o.shadow,
      scaleX: o.scale, scaleY: o.scale,
    },
  } as never);
  editor.setSaveState("unsaved");
}

// ---------------------------------------------------------------- UI

export function WindowControls({ editor, group, shell = true }: { editor: Editor; group: GroupLayer; shell?: boolean }) {
  const o = readWindowOptions(group);
  const set = (patch: Partial<WindowOptions>) => applyWindowOptions(editor, group, patch);
  const glass = GLASS_TYPES[Math.min(o.glass, GLASS_TYPES.length - 1)]!;

  const body = (
    <div className="win-controls-col">
      <p className="paint-hint">Window style — reshape the frame</p>
      <div className="window-chip-row">
        {WINDOW_STYLES.map((s, i) => (
          <button key={s.name} className={"window-chip" + (o.style === i ? " active" : "")} onClick={() => set({ style: i })}>
            {s.name}
          </button>
        ))}
      </div>
      <p className="paint-hint" style={{ marginTop: 8 }}>Glass type — swap the pane</p>
      <div className="window-chip-row">
        {GLASS_TYPES.map((g, i) => (
          <button key={g.name} className={"window-chip" + (o.glass === i ? " active" : "")}
            onClick={() => set({ glass: i, transparency: g.transparency, frost: g.frost, reflection: g.reflection, droplets: g.droplets, tint: g.tint })}>
            {g.name}
          </button>
        ))}
      </div>
      <p className="paint-hint" style={{ marginTop: 8 }}>Quick controls</p>
      <SliderField label="Transparency" value={o.transparency} min={0} max={1} defaultValue={0.1}
        lowLabel="Solid" highLabel="Clear" onChange={(v) => set({ transparency: v })} />
      <SliderField label="Frost" value={o.frost} min={0} max={1} defaultValue={0}
        lowLabel="Crisp" highLabel="Frosted" onChange={(v) => set({ frost: v })} />
      <SliderField label="Reflection" value={o.reflection} min={0} max={1} defaultValue={0.2}
        lowLabel="Matte" highLabel="Shiny" onChange={(v) => set({ reflection: v })} />
      <SliderField label="Droplets" value={o.droplets} min={0} max={1} defaultValue={0}
        lowLabel="Dry" highLabel="Soaked" onChange={(v) => set({ droplets: v })} />
      <div className="prop-row">
        <span className="prop-label">Tint</span>
        <ColorField value={hexOf(o.tint)} onChange={(hex) => set({ tint: parseInt(hex.replace("#", ""), 16) })} />
      </div>
      <SliderField label="Scale" value={o.scale} min={0.4} max={1.8} step={0.01} defaultValue={1}
        lowLabel="Small" highLabel="Big" format={(v) => `${Math.round(v * 100)}%`}
        onChange={(v) => set({ scale: v })} />
      <details className="window-advanced" style={{ marginTop: 6 }}>
        <summary className="paint-hint" style={{ cursor: "pointer" }}>Advanced glass &amp; frame</summary>
        <SliderField label="Opacity" value={o.opacity} min={0.1} max={1} defaultValue={1}
          lowLabel="Ghost" highLabel="Solid" onChange={(v) => set({ opacity: v })} />
        <SliderField label="Blur" value={o.blur} min={0} max={1} defaultValue={0}
          lowLabel="Sharp" highLabel="Soft" onChange={(v) => set({ blur: v })} />
        <SliderField label="Noise" value={o.noise} min={0} max={1} defaultValue={0}
          lowLabel="Clean" highLabel="Grimy" onChange={(v) => set({ noise: v })} />
        <SliderField label="Highlight" value={o.highlight} min={0} max={1} defaultValue={0.5}
          lowLabel="Flat" highLabel="Glossy" onChange={(v) => set({ highlight: v })} />
        <SliderField label="Edge" value={o.edge} min={0} max={1} defaultValue={0.3}
          lowLabel="Plain" highLabel="Lit" onChange={(v) => set({ edge: v })} />
        <SliderField label="Shadow" value={o.shadow} min={0} max={1} defaultValue={0.4}
          lowLabel="Flat" highLabel="Deep" onChange={(v) => set({ shadow: v })} />
      </details>
      <p className="paint-hint" style={{ marginTop: 4 }}>Glass: {glass.name}. Frame, glass and view resize together.</p>
    </div>
  );

  if (!shell) return body;
  return (
    <InspectorSectionShell title="Window" defaultOpen>
      {body}
    </InspectorSectionShell>
  );
}
