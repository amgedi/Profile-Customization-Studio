import { spatialEffects, SPATIAL_EFFECTS } from "./spatialEffects.js";
import {
  asPaint,
  validateBannerSpec,
  isGroupLayer,
  isEllipseLayer,
  isImageLayer,
  isLineLayer,
  isRectLayer,
  isTextLayer,
  type BannerSpecDocument,
  type Layer,
  type Paint,
  type SolidPaint,
  type Track,
} from "@pcs/bannerspec";
import { compileTracks } from "./behaviors.js";

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const attrColor = (c: string): string => (c === "transparent" ? "none" : esc(c));

// ---------------------------------------------------------------- color utils

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 8) h = h.slice(0, 6);
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
export function shiftHue(color: string, delta: number): string {
  if (!color.startsWith("#")) return color;
  const [r, g, b] = hexToRgb(color);
  const [h, s, l] = rgbToHsl(r, g, b);
  const [r2, g2, b2] = hslToRgb((h + delta + 360) % 360, s, l);
  return rgbToHex(r2, g2, b2);
}
export function scaleColor(color: string, factor: number): string {
  if (!color.startsWith("#")) return color;
  const [r, g, b] = hexToRgb(color);
  return rgbToHex(r * factor, g * factor, b * factor);
}

// ---------------------------------------------------------------- paints

export interface RenderOptions {
  editable?: boolean;
  /** Render a static frame at this time (seconds). Takes priority over animate. */
  time?: number;
  /** Emit SMIL animations for tracks and animated paints (animated SVG export). */
  animate?: boolean;
}

interface GradientDef {
  def: string;
  fill: string;
}

let uidCounter = 0;
function nextId(): string {
  return `pcs-${(++uidCounter).toString(36)}`;
}

function gradientDef(paint: Paint, opts: RenderOptions, geo: { x: number; y: number; w: number; h: number }): GradientDef | null {
  const p = asPaint(paint, "#888888");
  const animate = opts.animate === true;
  const time = opts.time ?? 0;
  switch (p.type) {
    case "solid":
      return { def: "", fill: attrColor(p.color) };
    case "linear": {
      const id = nextId();
      const rad = ((p.angle - 90) * Math.PI) / 180;
      const cx = geo.x + geo.w / 2, cy = geo.y + geo.h / 2;
      const len = Math.abs(geo.w * Math.cos(rad)) + Math.abs(geo.h * Math.sin(rad));
      const x1 = cx - (Math.cos(rad) * len) / 2, y1 = cy - (Math.sin(rad) * len) / 2;
      const x2 = cx + (Math.cos(rad) * len) / 2, y2 = cy + (Math.sin(rad) * len) / 2;
      let def = `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">`;
      if (animate) {
        def += p.stops.map((s) => `<stop offset="${s.offset}" stop-color="${attrColor(s.color)}"><animate attributeName="stop-color" values="${s.color};${shiftHue(s.color, 120)};${s.color}" dur="${Math.max(0.5, 8)}s" repeatCount="indefinite"/></stop>`).join("");
      } else {
        def += p.stops.map((s) => `<stop offset="${s.offset}" stop-color="${attrColor(s.color)}"/>`).join("");
      }
      def += `</linearGradient>`;
      return { def, fill: `url(#${id})` };
    }
    case "radial": {
      const id = nextId();
      const cx = geo.x + geo.w / 2, cy = geo.y + geo.h / 2;
      const r = Math.max(geo.w, geo.h) / 2;
      let def = `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}">`;
      def += p.stops.map((s) => `<stop offset="${s.offset}" stop-color="${attrColor(s.color)}"/>`).join("");
      def += `</radialGradient>`;
      return { def, fill: `url(#${id})` };
    }
    case "conic": {
      // SVG has no native conic gradient; approximate with a linear blend of first/last.
      const first = p.stops[0], last = p.stops[p.stops.length - 1];
      if (!first || !last) return { def: "", fill: "#888888" };
      return gradientDef({ type: "linear", stops: [first, last], angle: p.angle }, opts, geo);
    }
    case "animated": {
      const t = time % p.duration;
      const phase = (t / p.duration + (p.phase ?? 0)) * 360;
      const base = p.base;
      switch (p.mode) {
        case "hue-cycle": {
          const shifted = { ...base, stops: base.stops.map((s) => ({ ...s, color: shiftHue(s.color, phase) })) };
          return gradientDef(shifted, { ...opts, animate: false }, geo);
        }
        case "color-pulse": {
          const k = 0.75 + 0.25 * Math.sin((t / p.duration) * Math.PI * 2);
          const scaled = { ...base, stops: base.stops.map((s) => ({ ...s, color: scaleColor(s.color, k) })) };
          return gradientDef(scaled, { ...opts, animate: false }, geo);
        }
        case "gradient-drift":
        case "aurora": {
          const drift = { ...base, angle: base.angle + Math.sin((t / p.duration) * Math.PI * 2) * 30 };
          return gradientDef(drift, { ...opts, animate: false }, geo);
        }
        case "palette-cycle":
        case "light-sweep": {
          const shifted = { ...base, stops: base.stops.map((s) => ({ ...s, color: shiftHue(s.color, -phase) })) };
          return gradientDef(shifted, { ...opts, animate: false }, geo);
        }
      }
      return gradientDef(base, opts, geo);
    }
    case "token":
      return { def: "", fill: "#888888" }; // resolved by caller with brand
    default:
      return { def: "", fill: "#888888" };
  }
}

function resolvePaint(paint: string | Paint | undefined, brand: Record<string, string | undefined>, opts: RenderOptions, geo: { x: number; y: number; w: number; h: number }): { defs: string; fill: string } {
  let p = asPaint(paint, "#888888");
  if (p.type === "token") {
    const color = brand[p.token] ?? "#888888";
    p = { type: "solid", color } as SolidPaint;
  }
  const g = gradientDef(p, opts, geo);
  if (!g) return { defs: "", fill: "#888888" };
  return { defs: g.def, fill: g.fill };
}

// ---------------------------------------------------------------- effects

const DEFAULT_FX_COLOR: Record<string, string> = {
  rim: "#cfe4ff", heavenly: "#ffe9b8", rays: "#ffe9b8", electric: "#7fe4ff",
  "tinted-glass": "#9fc0ff", chrome: "#ffffff", holo: "#7fe4ff",
  "grad-overlay": "#5b8cff", duotone: "#1b2440", grade: "#0e1a2a", gradmap: "#0a1024", tint: "#5b8cff",
  "fog-fx": "#dfe8f5", mist: "#cfdcee", smoke: "#8b93a1", steam: "#ffffff", condensation: "#e8f1ff",
  "bokeh-fx": "#ffe9b0", "fireflies-fx": "#d9f99d", "embers-fx": "#ff9a5c", "leaves-fx": "#d97742",
  scanlines: "#000000", crt: "#0a2030", "pixel-glow": "#4fd8ff", hud: "#39d353", grid: "#39d353",
  "soft-border": "#5b8cff", "neon-border": "#4fd8ff", "aurora-border": "#34d399", "grad-border": "#8a63ff",
  chase: "#ffffff", "electric-edge": "#7fe4ff", "pixel-border": "#4fd8ff", breath: "#5b8cff",
  rain: "#9fc0ff", snow: "#e8f1ff",
};

/** Duotone channel tableValues: shadows → colorA, highlights → colorB. */
function duoTables(a: string, b: string): [string, string, string] {
  const pa = hexToRgb(a), pb = hexToRgb(b);
  return [0, 1, 2].map((i) =>
    `0 ${(pa[i]! / 255).toFixed(3)} ${((pa[i]! + pb[i]!) / 510).toFixed(3)} ${(pb[i]! / 255).toFixed(3)}`,
  ) as [string, string, string];
}

function effectFilter(layer: Layer, opts: RenderOptions, hue = 0): { def: string; filterAttr: string } {
  const effects = (layer.effects ?? []).filter((e) => e.visible !== false && !SPATIAL_EFFECTS.has(e.type));
  if (effects.length === 0 && hue === 0) return { def: "", filterAttr: "" };
  const id = `fx-${esc(layer.id)}`;
  const time = opts.time ?? 0;
  // Compose the stack: each effect transforms the previous result via
  // result/in chaining (SourceGraphic feeds the first stage).
  let inRef = "SourceGraphic";
  const stages: string[] = [];
  const push = (s: string) => stages.push(s);
  const inheritedColor=typeof layer.fill==='string'?layer.fill:layer.fill?.type==='solid'?layer.fill.color:layer.fill&&'stops' in layer.fill?layer.fill.stops[0]?.color:undefined;
  const fxColor = (e: (typeof effects)[number], fallbackKey?: string) =>
    attrColor(e.color ?? (fallbackKey ? DEFAULT_FX_COLOR[fallbackKey] : undefined) ?? inheritedColor ?? "#ffffff");
  const num = (e: (typeof effects)[number], key: string, d: number) => {
    const v = e.params[key];
    return typeof v === "number" && Number.isFinite(v) ? v : d;
  };
  effects.forEach((e, i) => {
    const out = `s${i}`;
    switch (e.type) {
      case "glow": {
        const amount = num(e, "amount", 12);
        push(`<feMorphology in="SourceAlpha" operator="dilate" radius="${num(e, "spread", 0)}" result="${out}a"/><feGaussianBlur in="${out}a" stdDeviation="${amount}" result="${out}b"/><feFlood flood-color="${fxColor(e)}" flood-opacity="${num(e, "intensity", 0.65)}" result="${out}f"/><feComposite in="${out}f" in2="${out}b" operator="in" result="${out}c"/><feMerge result="${out}"><feMergeNode in="${out}c"/><feMergeNode in="${inRef}"/></feMerge>`);
        break;
      }
      case "shadow": {
        const dx = num(e, "dx", 0), dy = num(e, "dy", 6), b = num(e, "blur", 10);
        push(`<feDropShadow in="${inRef}" dx="${dx}" dy="${dy}" stdDeviation="${b}" flood-opacity="0.45" result="${out}"/>`);
        break;
      }
      case "motion-blur": {
        push(`<feGaussianBlur in="${inRef}" stdDeviation="${num(e,'amount',8)} ${num(e,'vertical',0)}" result="${out}"/>`);break;
      }
      case "depth-blur": {
        push(`<feGaussianBlur in="${inRef}" stdDeviation="${num(e,'amount',5)}" result="${out}"/>`);break;
      }
      case "inner-glow": {
        push(`<feMorphology in="SourceAlpha" operator="erode" radius="${num(e,'amount',4)}" result="${out}e"/><feComposite in="SourceAlpha" in2="${out}e" operator="out" result="${out}edge"/><feGaussianBlur in="${out}edge" stdDeviation="${num(e,'blur',3)}" result="${out}b"/><feFlood flood-color="${fxColor(e)}" result="${out}c"/><feComposite in="${out}c" in2="${out}b" operator="in" result="${out}g"/><feComposite in="${out}g" in2="SourceAlpha" operator="in" result="${out}clip"/><feMerge result="${out}"><feMergeNode in="${inRef}"/><feMergeNode in="${out}clip"/></feMerge>`);break;
      }
      case "outline": {
        push(`<feMorphology in="SourceAlpha" operator="dilate" radius="${num(e,'amount',2)}" result="${out}e"/><feFlood flood-color="${fxColor(e)}" result="${out}c"/><feComposite in="${out}c" in2="${out}e" operator="in" result="${out}g"/><feMerge result="${out}"><feMergeNode in="${out}g"/><feMergeNode in="${inRef}"/></feMerge>`);break;
      }
      case "blur": {
        push(`<feGaussianBlur in="${inRef}" stdDeviation="${num(e, "amount", 4)}" result="${out}"/>`);
        break;
      }
      case "grain": {
        push(`<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="${out}n"/><feColorMatrix in="${out}n" type="saturate" values="0" result="${out}g"/><feComposite in="${inRef}" in2="${out}g" operator="in" result="${out}c"/><feBlend in="${inRef}" in2="${out}c" mode="multiply" result="${out}"/>`);
        break;
      }
      case "noise": {
        push(`<feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="3" seed="${Math.floor(time * 7)}" result="${out}n"/><feColorMatrix in="${out}n" type="saturate" values="0" result="${out}g"/><feComposite in="${out}g" in2="${inRef}" operator="in" result="${out}c"/><feBlend in="${inRef}" in2="${out}c" mode="soft-light" result="${out}"/>`);
        break;
      }
      case "light-sweep": {
        push(`<feGaussianBlur in="${inRef}" stdDeviation="2" result="${out}b"/><feMerge result="${out}"><feMergeNode in="${out}b"/><feMergeNode in="${inRef}"/></feMerge>`);
        break;
      }
      case "bloom": {
        const amount = num(e, "amount", 18);
        const threshold = Math.max(0, Math.min(0.95, num(e, "threshold", 0.55)));
        const gain = 1 / (1 - threshold);
        push(`<feComponentTransfer in="${inRef}" result="${out}t"><feFuncR type="linear" slope="${gain}" intercept="${-threshold * gain}"/><feFuncG type="linear" slope="${gain}" intercept="${-threshold * gain}"/><feFuncB type="linear" slope="${gain}" intercept="${-threshold * gain}"/></feComponentTransfer><feGaussianBlur in="${out}t" stdDeviation="${amount}" result="${out}b"/><feComponentTransfer in="${out}b" result="${out}c"><feFuncA type="linear" slope="${num(e, "strength", 1.5)}"/></feComponentTransfer><feBlend in="${inRef}" in2="${out}c" mode="screen" result="${out}"/>`);
        break;
      }
      case "film-glow": {
        push(`<feGaussianBlur in="${inRef}" stdDeviation="${num(e, "amount", 14)}" result="${out}b"/><feColorMatrix in="${out}b" type="saturate" values="1.6" result="${out}w"/><feColorMatrix in="${out}w" type="hueRotate" values="-18" result="${out}c"/><feMerge result="${out}"><feMergeNode in="${out}c"/><feMergeNode in="${out}c"/><feMergeNode in="${inRef}"/></feMerge>`);
        break;
      }
      case "neon": {
        push(`<feMorphology in="SourceAlpha" operator="erode" radius="${num(e, "edge", 1.5)}" result="${out}e"/><feComposite in="SourceAlpha" in2="${out}e" operator="out" result="${out}edge"/><feFlood flood-color="${fxColor(e, "neon")}" result="${out}f"/><feComposite in="${out}f" in2="${out}edge" operator="in" result="${out}tube"/><feGaussianBlur in="${out}tube" stdDeviation="${num(e, "outer", 10)}" result="${out}b"/><feGaussianBlur in="${out}tube" stdDeviation="${num(e, "inner", 2)}" result="${out}a"/><feMerge result="${out}"><feMergeNode in="${out}b"/><feMergeNode in="${out}b"/><feMergeNode in="${inRef}"/><feMergeNode in="${out}a"/><feMergeNode in="${out}tube"/></feMerge>`);
        break;
      }
      case "halo": {
        const amount = num(e, "amount", 24);
        push(`<feMorphology in="SourceAlpha" operator="dilate" radius="${num(e, "spread", 10)}" result="${out}a"/><feGaussianBlur in="${out}a" stdDeviation="${amount * num(e, "falloff", 0.6)}" result="${out}b"/><feComposite in="${out}b" in2="SourceAlpha" operator="out" result="${out}ring"/><feFlood flood-color="${fxColor(e, "halo")}" flood-opacity="${num(e, "opacity", 0.7)}" result="${out}f"/><feComposite in="${out}f" in2="${out}ring" operator="in" result="${out}c"/><feMerge result="${out}"><feMergeNode in="${out}c"/><feMergeNode in="${inRef}"/></feMerge>`);
        break;
      }
      case "rim": {
        const c = fxColor(e, "rim");
        push(`<feMorphology in="SourceAlpha" operator="erode" radius="2" result="${out}e"/><feComposite in="SourceAlpha" in2="${out}e" operator="out" result="${out}edge"/><feFlood flood-color="${c}" result="${out}f"/><feComposite in="${out}f" in2="${out}edge" operator="in" result="${out}l"/><feGaussianBlur in="${out}l" stdDeviation="1" result="${out}g"/><feMerge result="${out}"><feMergeNode in="${inRef}"/><feMergeNode in="${out}g"/></feMerge>`);
        break;
      }
      case "heavenly":
      case "rays": {
        const c = fxColor(e, e.type === "rays" ? "rays" : "heavenly");
        const f = e.type === "rays" ? "0.004 0.03" : "0.002 0.016";
        push(`<feTurbulence type="turbulence" baseFrequency="${f}" numOctaves="2" seed="7" result="${out}n"/><feComponentTransfer in="${out}n" result="${out}t"><feFuncA type="discrete" tableValues="0 0 0 0.7 0 0.5 0 0.9 0 0"/></feComponentTransfer><feFlood flood-color="${c}" flood-opacity="${(num(e, "amount", 40) / 100).toFixed(2)}" result="${out}f"/><feComposite in="${out}f" in2="${out}t" operator="in" result="${out}r"/><feGaussianBlur in="${out}r" stdDeviation="1.5" result="${out}b"/><feMerge result="${out}"><feMergeNode in="${out}b"/><feMergeNode in="${inRef}"/></feMerge>`);
        break;
      }
      case "electric": {
        const c = fxColor(e, "electric");
        push(`<feMorphology in="SourceAlpha" operator="dilate" radius="3" result="${out}d"/><feFlood flood-color="${c}" result="${out}f"/><feComposite in="${out}f" in2="${out}d" operator="in" result="${out}c0"/><feTurbulence type="turbulence" baseFrequency="0.05" numOctaves="2" seed="3" result="${out}n"/><feDisplacementMap in="${out}c0" in2="${out}n" scale="10" result="${out}d2"/><feGaussianBlur in="${out}d2" stdDeviation="0.6" result="${out}g"/><feMerge result="${out}"><feMergeNode in="${out}g"/><feMergeNode in="${inRef}"/></feMerge>`);
        break;
      }
      case "frost": {
        push(`<feGaussianBlur in="${inRef}" stdDeviation="${num(e, "amount", 6)}" result="${out}b"/><feColorMatrix in="${out}b" type="saturate" values="0.6" result="${out}"/>`);
        break;
      }
      case "glass": {
        push(`<feGaussianBlur in="${inRef}" stdDeviation="0.6" result="${out}b"/><feComponentTransfer in="${out}b" result="${out}l"><feFuncR type="linear" slope="1.12"/><feFuncG type="linear" slope="1.12"/><feFuncB type="linear" slope="1.12"/></feComponentTransfer><feMerge result="${out}"><feMergeNode in="${out}l"/></feMerge>`);
        break;
      }
      case "tinted-glass": {
        const c = fxColor(e, "tinted-glass");
        push(`<feGaussianBlur in="${inRef}" stdDeviation="${num(e, "amount", 2)}" result="${out}b"/><feFlood flood-color="${c}" flood-opacity="0.28" result="${out}f"/><feComposite in="${out}f" in2="${out}b" operator="in" result="${out}t"/><feMerge result="${out}"><feMergeNode in="${out}b"/><feMergeNode in="${out}t"/></feMerge>`);
        break;
      }
      case "chrome": {
        push(`<feGaussianBlur in="SourceAlpha" stdDeviation="1.5" result="${out}b"/><feSpecularLighting in="${out}b" surfaceScale="2.4" specularConstant="0.9" specularExponent="14" lighting-color="#ffffff" result="${out}s"><feDistantLight azimuth="235" elevation="55"/></feSpecularLighting><feComposite in="${out}s" in2="SourceAlpha" operator="in" result="${out}sc"/><feComposite in="${inRef}" in2="${out}sc" operator="arithmetic" k1="0" k2="1" k3="0.9" k4="0" result="${out}"/>`);
        break;
      }
      case "plastic": {
        push(`<feGaussianBlur in="SourceAlpha" stdDeviation="2" result="${out}b"/><feSpecularLighting in="${out}b" surfaceScale="1.4" specularConstant="0.55" specularExponent="24" lighting-color="#ffffff" result="${out}s"><feDistantLight azimuth="225" elevation="62"/></feSpecularLighting><feComposite in="${out}s" in2="SourceAlpha" operator="in" result="${out}sc"/><feComposite in="${inRef}" in2="${out}sc" operator="arithmetic" k1="0" k2="1" k3="0.55" k4="0" result="${out}"/>`);
        break;
      }
      case "holo": {
        const c = fxColor(e, "holo");
        push(`<feGaussianBlur in="${inRef}" stdDeviation="0.8" result="${out}b"/><feColorMatrix in="${out}b" type="saturate" values="1.8" result="${out}s"/><feFlood flood-color="${c}" flood-opacity="0.22" result="${out}f"/><feComposite in="${out}f" in2="${out}s" operator="in" result="${out}t"/><feMerge result="${out}"><feMergeNode in="${out}s"/><feMergeNode in="${out}t"/></feMerge>`);
        break;
      }
      case "grad-overlay": {
        const c = fxColor(e, "grad-overlay");
        push(`<feFlood flood-color="${c}" flood-opacity="${(num(e, "amount", 35) / 100).toFixed(2)}" result="${out}f"/><feComposite in="${out}f" in2="${inRef}" operator="in" result="${out}t"/><feBlend in="${inRef}" in2="${out}t" mode="screen" result="${out}"/>`);
        break;
      }
      case "duotone":
      case "gradmap": {
        const hi = e.color ?? "#5b8cff";
        const lo = e.type === "gradmap" ? "#0a1024" : "#141a2e";
        const [tr, tg, tb] = duoTables(lo, hi);
        push(`<feColorMatrix in="${inRef}" type="saturate" values="0" result="${out}g"/><feComponentTransfer in="${out}g" result="${out}"><feFuncR type="table" tableValues="${tr}"/><feFuncG type="table" tableValues="${tg}"/><feFuncB type="table" tableValues="${tb}"/></feComponentTransfer>`);
        break;
      }
      case "grade": {
        push(`<feColorMatrix in="${inRef}" type="saturate" values="1.25" result="${out}a"/><feColorMatrix in="${out}a" type="hueRotate" values="-10" result="${out}b"/><feComponentTransfer in="${out}b" result="${out}"><feFuncR type="linear" slope="1.05" intercept="-0.01"/><feFuncG type="linear" slope="1.02"/><feFuncB type="linear" slope="1.1" intercept="0.02"/></feComponentTransfer>`);
        break;
      }
      case "tint": {
        const c = fxColor(e, "tint");
        push(`<feFlood flood-color="${c}" flood-opacity="${(num(e, "amount", 25) / 100).toFixed(2)}" result="${out}f"/><feComposite in="${out}f" in2="${inRef}" operator="in" result="${out}t"/><feMerge result="${out}"><feMergeNode in="${inRef}"/><feMergeNode in="${out}t"/></feMerge>`);
        break;
      }
      case "contrast": {
        const k = num(e, "amount", 40) / 40;
        const ic = (0.5 - k * 0.5).toFixed(3);
        push(`<feComponentTransfer in="${inRef}" result="${out}"><feFuncR type="linear" slope="${k.toFixed(2)}" intercept="${ic}"/><feFuncG type="linear" slope="${k.toFixed(2)}" intercept="${ic}"/><feFuncB type="linear" slope="${k.toFixed(2)}" intercept="${ic}"/></feComponentTransfer>`);
        break;
      }
      case "saturation": {
        push(`<feColorMatrix in="${inRef}" type="saturate" values="${num(e, "amount", 60) / 50}" result="${out}"/>`);
        break;
      }
      case "rain-fx": {
        push(`<feTurbulence type="turbulence" baseFrequency="0.18 0.004" numOctaves="2" seed="11" result="${out}n"/><feComponentTransfer in="${out}n" result="${out}t"><feFuncA type="discrete" tableValues="0 0 0.8 0 0 0.5 0 0 0.9 0"/></feComponentTransfer><feFlood flood-color="#9fc0ff" flood-opacity="${(num(e, "amount", 45) / 100).toFixed(2)}" result="${out}f"/><feComposite in="${out}f" in2="${out}t" operator="in" result="${out}r"/><feGaussianBlur in="${out}r" stdDeviation="0.4" result="${out}g"/><feMerge result="${out}"><feMergeNode in="${inRef}"/><feMergeNode in="${out}g"/></feMerge>`);
        break;
      }
      case "snow-fx": {
        push(`<feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="2" seed="5" result="${out}n"/><feComponentTransfer in="${out}n" result="${out}t"><feFuncA type="discrete" tableValues="0 0 0 0 0.9 0 0 0.6 0 0"/></feComponentTransfer><feFlood flood-color="#e8f1ff" flood-opacity="${(num(e, "amount", 55) / 100).toFixed(2)}" result="${out}f"/><feComposite in="${out}f" in2="${out}t" operator="in" result="${out}r"/><feGaussianBlur in="${out}r" stdDeviation="0.5" result="${out}g"/><feMerge result="${out}"><feMergeNode in="${inRef}"/><feMergeNode in="${out}g"/></feMerge>`);
        break;
      }
      case "fog-fx":
      case "mist":
      case "smoke":
      case "steam":
      case "condensation": {
        // Smooth atmospheric fog: horizontally stretched fractal noise is
        // turned into soft mist (luminance → alpha), then blurred hard so
        // every edge — band borders included — feathers away. Optional
        // params tune the field per depth layer when the scene generator
        // stacks several of these: seed (noise variation), scale (wispy
        // detail), soft (edge feather amount). "amount" drives density.
        const c = fxColor(e, e.type === "mist" ? "mist" : e.type === "smoke" ? "smoke" : e.type === "condensation" ? "condensation" : "fog-fx");
        const scale = Math.max(0.2, num(e, "scale", 1));
        const soft = Math.max(0.3, num(e, "soft", 1));
        const seed = Math.round(num(e, "seed", 9));
        const [bfx, bfy] =
          e.type === "smoke" ? [0.022, 0.038] :
          e.type === "steam" ? [0.03, 0.06] :
          e.type === "condensation" ? [0.028, 0.028] :
          e.type === "mist" ? [0.012, 0.02] : [0.009, 0.017];
        const blur = (e.type === "condensation" ? 2 : e.type === "smoke" ? 5 : 10) * soft;
        const op = num(e, "amount", e.type === "condensation" ? 30 : 45) / 100;
        push(
          `<feTurbulence type="fractalNoise" baseFrequency="${(bfx * scale).toFixed(5)} ${(bfy * scale).toFixed(5)}" numOctaves="5" seed="${seed}" result="${out}n"/>` +
          `<feColorMatrix in="${out}n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.55 0.55 0.55 0 -0.5" result="${out}t"/>` +
          `<feGaussianBlur in="${out}t" stdDeviation="${blur.toFixed(1)}" result="${out}b"/>` +
          `<feFlood flood-color="${c}" flood-opacity="${op.toFixed(2)}" result="${out}f"/>` +
          `<feComposite in="${out}f" in2="${out}b" operator="in" result="${out}r"/>` +
          `<feMerge result="${out}"><feMergeNode in="${inRef}"/><feMergeNode in="${out}r"/></feMerge>`,
        );
        break;
      }
      case "dust-fx":
      case "stars-fx":
      case "fireflies-fx":
      case "embers-fx":
      case "bokeh-fx":
      case "leaves-fx": {
        const c = fxColor(e, e.type.replace("-fx", ""));
        const bf = e.type === "bokeh-fx" ? "0.06" : e.type === "leaves-fx" ? "0.03" : "0.35";
        const blur = e.type === "bokeh-fx" ? 2.5 : e.type === "fireflies-fx" || e.type === "embers-fx" ? 1.4 : 0.4;
        push(`<feTurbulence type="fractalNoise" baseFrequency="${bf}" numOctaves="2" seed="17" result="${out}n"/><feComponentTransfer in="${out}n" result="${out}t"><feFuncA type="discrete" tableValues="0 0 0 0 0 0 0.9 0 0.6 0 0 0 0.8 0 0"/></feComponentTransfer><feFlood flood-color="${c}" flood-opacity="${(num(e, "amount", 50) / 100).toFixed(2)}" result="${out}f"/><feComposite in="${out}f" in2="${out}t" operator="in" result="${out}r"/><feGaussianBlur in="${out}r" stdDeviation="${blur}" result="${out}g"/><feMerge result="${out}"><feMergeNode in="${inRef}"/><feMergeNode in="${out}g"/></feMerge>`);
        break;
      }
      case "scanlines":
      case "crt": {
        const c = fxColor(e, e.type === "crt" ? "crt" : "scanlines");
        const pre = e.type === "crt" ? `<feGaussianBlur in="${inRef}" stdDeviation="0.5" result="${out}s0"/><feColorMatrix in="${out}s0" type="saturate" values="1.35" result="${out}s1"/>` : `<feColorMatrix in="${inRef}" type="saturate" values="1" result="${out}s1"/>`;
        push(`${pre}<feTurbulence type="fractalNoise" baseFrequency="0 0.55" numOctaves="1" seed="2" result="${out}n"/><feComponentTransfer in="${out}n" result="${out}t"><feFuncA type="discrete" tableValues="0 0.45 0 0.45 0 0.45"/></feComponentTransfer><feFlood flood-color="${c}" flood-opacity="${(num(e, "amount", 30) / 100).toFixed(2)}" result="${out}f"/><feComposite in="${out}f" in2="${out}t" operator="in" result="${out}r"/><feMerge result="${out}"><feMergeNode in="${out}s1"/><feMergeNode in="${out}r"/></feMerge>`);
        break;
      }
      case "rgb-split":
      case "chromatic": {
        const off = num(e,"amount", e.type === "chromatic" ? 4 : 2.5);
        push(`<feColorMatrix in="${inRef}" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="${out}r"/><feOffset in="${out}r" dx="${off}" dy="0" result="${out}ro"/><feColorMatrix in="${inRef}" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="${out}g"/><feColorMatrix in="${inRef}" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="${out}b"/><feOffset in="${out}b" dx="-${off}" dy="0" result="${out}bo"/><feBlend in="${out}ro" in2="${out}g" mode="screen" result="${out}rg"/><feBlend in="${out}rg" in2="${out}bo" mode="screen" result="${out}"/>`);
        break;
      }
      case "pixel-glow": {
        const c = fxColor(e, "pixel-glow");
        push(`<feMorphology in="SourceAlpha" operator="dilate" radius="3" result="${out}d"/><feFlood flood-color="${c}" result="${out}f"/><feComposite in="${out}f" in2="${out}d" operator="in" result="${out}p"/><feGaussianBlur in="${out}p" stdDeviation="4" result="${out}g"/><feMerge result="${out}"><feMergeNode in="${out}g"/><feMergeNode in="${inRef}"/></feMerge>`);
        break;
      }
      case "hud": {
        const c = fxColor(e, "hud");
        push(`<feTurbulence type="turbulence" baseFrequency="0 0.14" numOctaves="1" seed="4" result="${out}n"/><feComponentTransfer in="${out}n" result="${out}t"><feFuncA type="discrete" tableValues="0 0 0.85 0 0 0 0.7 0 0"/></feComponentTransfer><feFlood flood-color="${c}" flood-opacity="${(num(e, "amount", 40) / 100).toFixed(2)}" result="${out}f"/><feComposite in="${out}f" in2="${out}t" operator="in" result="${out}r"/><feMerge result="${out}"><feMergeNode in="${inRef}"/><feMergeNode in="${out}r"/></feMerge>`);
        break;
      }
      case "grid": {
        const c = fxColor(e, "grid");
        push(`<feTurbulence type="turbulence" baseFrequency="0.09" numOctaves="1" seed="8" result="${out}n"/><feComponentTransfer in="${out}n" result="${out}t"><feFuncA type="discrete" tableValues="0 0.9 0 0.9 0"/></feComponentTransfer><feMorphology in="${out}t" operator="erode" radius="0.4" result="${out}t2"/><feFlood flood-color="${c}" flood-opacity="${(num(e, "amount", 35) / 100).toFixed(2)}" result="${out}f"/><feComposite in="${out}f" in2="${out}t2" operator="in" result="${out}r"/><feMerge result="${out}"><feMergeNode in="${inRef}"/><feMergeNode in="${out}r"/></feMerge>`);
        break;
      }
      case "soft-border": {
        const c = fxColor(e, "soft-border");
        push(`<feDropShadow in="${inRef}" dx="0" dy="0" stdDeviation="${num(e, "amount", 6)}" flood-color="${c}" flood-opacity="0.8" result="${out}"/>`);
        break;
      }
      case "neon-border":
      case "electric-edge": {
        const c = fxColor(e, e.type === "electric-edge" ? "electric-edge" : "neon-border");
        const warp = e.type === "electric-edge" ? `<feTurbulence type="turbulence" baseFrequency="0.06" numOctaves="2" seed="6" result="${out}n"/><feDisplacementMap in="${out}p" in2="${out}n" scale="7" result="${out}p2"/>` : "";
        const warpRef = e.type === "electric-edge" ? `${out}p2` : `${out}p`;
        push(`<feMorphology in="SourceAlpha" operator="dilate" radius="3" result="${out}d"/><feFlood flood-color="${c}" result="${out}f"/><feComposite in="${out}f" in2="${out}d" operator="in" result="${out}p"/>${warp}<feGaussianBlur in="${warpRef}" stdDeviation="3.5" result="${out}g"/><feGaussianBlur in="${warpRef}" stdDeviation="1" result="${out}g2"/><feMerge result="${out}"><feMergeNode in="${out}g"/><feMergeNode in="${out}g2"/><feMergeNode in="${inRef}"/></feMerge>`);
        break;
      }
      case "aurora-border": {
        push(`<feMorphology in="SourceAlpha" operator="dilate" radius="3" result="${out}d"/><feFlood flood-color="#34d399" result="${out}f1"/><feComposite in="${out}f1" in2="${out}d" operator="in" result="${out}p1"/><feFlood flood-color="#22d3ee" result="${out}f2"/><feComposite in="${out}f2" in2="${out}d" operator="in" result="${out}p2"/><feOffset in="${out}p2" dx="2" dy="-2" result="${out}p3"/><feGaussianBlur in="${out}p1" stdDeviation="4" result="${out}g1"/><feGaussianBlur in="${out}p3" stdDeviation="2" result="${out}g2"/><feMerge result="${out}"><feMergeNode in="${out}g1"/><feMergeNode in="${out}g2"/><feMergeNode in="${inRef}"/></feMerge>`);
        break;
      }
      case "grad-border": {
        const c = fxColor(e, "grad-border");
        push(`<feMorphology in="SourceAlpha" operator="dilate" radius="2.5" result="${out}d"/><feFlood flood-color="${c}" result="${out}f"/><feComposite in="${out}f" in2="${out}d" operator="in" result="${out}p"/><feGaussianBlur in="${out}p" stdDeviation="1.5" result="${out}g"/><feMerge result="${out}"><feMergeNode in="${out}g"/><feMergeNode in="${inRef}"/></feMerge>`);
        break;
      }
      case "chase": {
        const c = fxColor(e, "chase");
        push(`<feMorphology in="SourceAlpha" operator="dilate" radius="2.5" result="${out}d"/><feFlood flood-color="${c}" flood-opacity="0.9" result="${out}f"/><feComposite in="${out}f" in2="${out}d" operator="in" result="${out}p"/><feOffset in="${out}p" dx="0" dy="-1.5" result="${out}p2"/><feGaussianBlur in="${out}p2" stdDeviation="2" result="${out}g"/><feMerge result="${out}"><feMergeNode in="${out}g"/><feMergeNode in="${inRef}"/></feMerge>`);
        break;
      }
      case "pixel-border": {
        const c = fxColor(e, "pixel-border");
        push(`<feMorphology in="SourceAlpha" operator="dilate" radius="${Math.max(1, Math.round(num(e, "amount", 8) / 4))}" result="${out}d"/><feFlood flood-color="${c}" result="${out}f"/><feComposite in="${out}f" in2="${out}d" operator="in" result="${out}p"/><feMerge result="${out}"><feMergeNode in="${out}p"/><feMergeNode in="${inRef}"/></feMerge>`);
        break;
      }
      case "breath": {
        const c = fxColor(e, "breath");
        push(`<feGaussianBlur in="${inRef}" stdDeviation="${num(e, "amount", 14)}" result="${out}b"/><feFlood flood-color="${c}" flood-opacity="0.5" result="${out}f"/><feComposite in="${out}f" in2="${out}b" operator="in" result="${out}g"/><feMerge result="${out}"><feMergeNode in="${out}g"/><feMergeNode in="${inRef}"/></feMerge>`);
        break;
      }
    }
    inRef = out;
  });
  if (hue !== 0) {
    const out = `hue${stages.length}`;
    push(`<feColorMatrix in="${inRef}" type="hueRotate" values="${hue.toFixed(1)}" result="${out}"/>`);
    inRef = out;
  }
  if (stages.length === 0) return { def: "", filterAttr: "" };
  return {
    def: `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">${stages.join("")}</filter>`,
    filterAttr: ` filter="url(#${id})"`,
  };
}

// ---------------------------------------------------------------- geometry

function roundedRectPath(x: number, y: number, w: number, h: number, corners: { tl: number; tr: number; br: number; bl: number }): string {  const { tl, tr, br, bl } = corners;
  return [
    `M ${x + tl} ${y}`,
    `L ${x + w - tr} ${y}`,
    tr ? `Q ${x + w} ${y} ${x + w} ${y + tr}` : "",
    `L ${x + w} ${y + h - br}`,
    br ? `Q ${x + w} ${y + h} ${x + w - br} ${y + h}` : "",
    `L ${x + bl} ${y + h}`,
    bl ? `Q ${x} ${y + h} ${x} ${y + h - bl}` : "",
    `L ${x} ${y + tl}`,
    tl ? `Q ${x} ${y} ${x + tl} ${y}` : "",
    "Z",
  ].filter(Boolean).join(" ");
}

/** Bounding box of a group's children (for coherent group scaling). */
function groupBBox(g: { children: Layer[] }): { x: number; y: number; w: number; h: number } | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const add = (x: number, y: number, w: number, h: number) => {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h);
  };
  const walk = (layers: Layer[]) => {
    for (const l of layers) {
      if (l.type === "group") { walk(l.children); continue; }
      const b = l as unknown as { x?: number; y?: number; width?: number; height?: number; x2?: number; y2?: number; fontSize?: number; text?: string };
      if (typeof b.x !== "number") continue;
      const w = b.width ?? (typeof b.x2 === "number" ? Math.abs(b.x2) + 4 : typeof b.text === "string" ? b.text.length * (b.fontSize ?? 20) * 0.6 : 40);
      const h = b.height ?? (typeof b.y2 === "number" ? Math.abs(b.y2) + 4 : b.fontSize ?? 40);
      add(b.x, b.y ?? 0, w, h);
    }
  };
  walk(g.children);
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// ---------------------------------------------------------------- tracks

function sampleTracks(layer: Layer, t: number, all: Track[]): Partial<Record<string, number>> {
  const out: Partial<Record<string, number>> = {};
  for (const track of all) {
    const keys = [...track.keys].sort((a, b) => a.t - b.t);
    if (keys.length === 0) continue;
    if (t <= keys[0]!.t) { out[track.prop] = keys[0]!.value; continue; }
    const last = keys[keys.length - 1]!;
    if (t >= last.t) { out[track.prop] = last.value; continue; }
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i]!, b = keys[i + 1]!;
      if (t >= a.t && t <= b.t) {
        const f = (t - a.t) / (b.t - a.t || 1);
        out[track.prop] = a.value + (b.value - a.value) * f;
        break;
      }
    }
  }
  return out;
}

function smilFor(layer: Exclude<Layer, { type: "group" }>, duration: number, all: Track[]): string {
  let smil = "";
  for (const track of all) {
    const keys = [...new Map(track.keys.map(key=>{const t=Math.max(0,Math.min(duration,key.t));return [t,{...key,t}];})).values()].sort((a,b)=>a.t-b.t);
    if (!keys.length) continue;
    if(keys[0]!.t>0)keys.unshift({...keys[0]!,t:0});
    if(keys[keys.length-1]!.t<duration)keys.push({...keys[keys.length-1]!,t:duration});
    if(keys.length<2)continue;
    const values = keys.map((k) => k.value).join(";");
    const keyTimes = keys.map((k) => Math.max(0, Math.min(1, k.t / duration)).toFixed(3)).join(";");
    if (track.prop === "x" || track.prop === "y") {
      // translate needs pairs; animate single axis by anchoring the other to 0 delta.
      smil += `<animateTransform attributeName="transform" type="translate" additive="sum" values="${values.split(";").map((v) => (track.prop === "x" ? `${Number(v)-Number((layer as {x?:number}).x??0)} 0` : `0 ${Number(v)-Number((layer as {y?:number}).y??0)}`)).join(";")}" keyTimes="${keyTimes}" dur="${duration}s" repeatCount="indefinite"/>`;
    } else if (track.prop === "rotation") {
      smil += `<animateTransform attributeName="transform" type="rotate" additive="sum" values="${values.split(";").map((v) => `${Number(v)-(layer.rotation??0)} ${Number((layer as {x?:number}).x??0)} ${Number((layer as {y?:number}).y??0)}`).join(";")}" keyTimes="${keyTimes}" dur="${duration}s" repeatCount="indefinite"/>`;
    } else if (track.prop === "hue") {
      // Hue applies via a filter hueRotate (see effectFilter); SMIL export of
      // filter channels is not broadly supported — poster frames only.
      continue;
    } else {
      smil += `<animate attributeName="${track.prop}" values="${values}" keyTimes="${keyTimes}" dur="${duration}s" repeatCount="indefinite"/>`;
    }
  }
  return smil;
}

// ---------------------------------------------------------------- layers

function animDuration(doc: BannerSpecDocument) { return Math.max(.1, doc.animation?.duration ?? 8); }

function layerNode(layer: Layer, doc: BannerSpecDocument, opts: RenderOptions, defsOut: string[]): string {
  let content=layerContentNode(layer,doc,opts,defsOut);
  const hueTrack=compileTracks(layer,animDuration(doc)).find(t=>t.prop==='hue');
  if(opts.animate&&hueTrack){
    const keys=[...hueTrack.keys];if(keys.length&&keys[0]!.t>0)keys.unshift({...keys[0]!,t:0});if(keys.length&&keys[keys.length-1]!.t<animDuration(doc))keys.push({...keys[keys.length-1]!,t:animDuration(doc)});
    const id='animated-hue-'+esc(layer.id);defsOut.push(`<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feColorMatrix type="hueRotate" values="0"><animate attributeName="values" values="${keys.map(k=>k.value).join(';')}" keyTimes="${keys.map(k=>k.t/animDuration(doc)).join(';')}" dur="${animDuration(doc)}s" repeatCount="indefinite"/></feColorMatrix></filter>`);content=`<g filter="url(#${id})">${content}</g>`;
  }
  for(const behavior of (layer.behaviors??[]).filter(b=>b.enabled&&['scale-in','shrink-out'].includes(b.preset))){
    const d=animDuration(doc),entrance=behavior.preset==='scale-in',span=Math.min(d,1.2/Math.max(.25,behavior.speed)),t=Math.max(0,Math.min(d,(opts.time??0)-(behavior.delay??0))),factor=entrance?.7+.3*Math.min(1,t/span):1-.2*Math.max(0,(t-(d-span))/span);
    const bb=isGroupLayer(layer)?groupBBox(layer):null,cx=bb?bb.x+bb.w/2:('x' in layer?layer.x:0)+('width' in layer?layer.width/2:0),cy=bb?bb.y+bb.h/2:('y' in layer?layer.y:0)+('height' in layer?layer.height/2:0);
    const values=entrance?'.7;1;1':'1;1;.8',times=entrance?`0;${Math.min(.999,span/d)};1`:`0;${Math.max(.001,(d-span)/d)};1`;
    content=`<g transform="translate(${cx} ${cy})"><g transform="scale(${opts.animate?1:factor})">${opts.animate?`<animateTransform attributeName="transform" type="scale" values="${values}" keyTimes="${times}" dur="${d}s" repeatCount="indefinite"/>`:''}<g transform="translate(${-cx} ${-cy})">${content}</g></g></g>`;
  }
  const wave=layer.behaviors?.find(b=>b.enabled&&b.preset.startsWith('wave-'));
  if(!wave||!content)return content;
  const side=wave.preset.slice(5),vertical=side==='top'||side==='bottom',reverse=side==='right'||side==='bottom';
  const textWidth=layer.type==='text'?Math.max(...layer.text.split('\n').map(line=>line.length))*layer.fontSize*.65:0;
  const box=isGroupLayer(layer)?groupBBox(layer):layer.type==='text'?{x:layer.x-(layer.align==='middle'?textWidth/2:layer.align==='end'?textWidth:0),y:layer.y-layer.fontSize,w:textWidth,h:layer.fontSize*(layer.lineHeight??1.2)*layer.text.split('\n').length+layer.fontSize*.4}:null;
  const x=box?.x??('x' in layer?layer.x:0), y=box?.y??('y' in layer?layer.y:0), w=box?.w??('width' in layer?layer.width:doc.canvas.width), h=box?.h??('height' in layer?layer.height:doc.canvas.height);
  const phase=(opts.time??0)*Math.max(.25,wave.speed),edge=Math.max(.05,Math.min(.8,wave.amount/100));
  const offset=Math.max(.01,Math.min(.95,edge+Math.sin(phase)*.08));const id='wave-'+esc(layer.id);
  const duration=4/Math.max(.25,wave.speed),animated=opts.animate===true;
  defsOut.push(`<linearGradient id="${id}-gradient" x1="${vertical?'0':reverse?'100%':'0'}" y1="${vertical&&reverse?'100%':'0'}" x2="${vertical?'0':reverse?'0':'100%'}" y2="${vertical&&!reverse?'100%':'0'}"><stop offset="0" stop-color="black"/><stop offset="${offset}" stop-color="white">${animated?`<animate attributeName="offset" values="${Math.max(.01,edge-.08)};${Math.min(.95,edge+.08)};${Math.max(.01,edge-.08)}" dur="${duration}s" repeatCount="indefinite"/>`:''}</stop><stop offset="1" stop-color="white"/></linearGradient><filter id="${id}-warp"><feTurbulence baseFrequency=".008" numOctaves="2" seed="4" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="16"/></filter><mask id="${id}" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${id}-gradient)" filter="url(#${id}-warp)"/></mask>`);
  return `<g mask="url(#${id})">${content}</g>`;
}

function layerContentNode(layer: Layer, doc: BannerSpecDocument, opts: RenderOptions, defsOut: string[]): string {
  if (!layer.visible) return "";
  if (isGroupLayer(layer) && layer.params?.sequence === 1) {
    const start = layer.params.start ?? 0, length = layer.params.duration ?? 8;
    if (opts.animate !== true && opts.time !== undefined && (opts.time < start || opts.time >= start + length)) return "";
    const children = layer.children.map(c => layerNode(c, {...doc,animation:{duration:length,loop:false}}, {...opts,time:opts.time === undefined ? undefined : Math.max(0,opts.time-start)}, defsOut)).join("");
    if (opts.animate === true) {
      const total = animDuration(doc), times = [0], values = [start === 0 ? 1 : 0];
      if(start>0){times.push(start/total);values.push(1);}
      if(start+length<total){times.push((start+length)/total);values.push(0);}
      times.push(1);values.push(0);
      const timed = children.replace(/<(animate(?:Transform|Motion)?)(\s[^>]*?)(\/?)>/g, (_all,tag,attrs,close) => `<${tag}${attrs.replace(/\s(?:begin|repeatCount)="[^"]*"/g,'')} begin="${start}s;pcs-sequence-clock.repeatEvent+${start}s" repeatCount="1"${close}>`);
      return `<g opacity="${start===0?1:0}"><animate attributeName="opacity" values="${values.join(';')}" keyTimes="${times.join(';')}" calcMode="discrete" dur="${total}s" repeatCount="indefinite"/>${timed}</g>`;
    }
    return children;
  }
  const editable = opts.editable === true;
  const time = opts.time ?? 0;
  const anim = doc.animation ?? { duration: 8, loop: true };
  // Tracks only apply when explicitly rendering a point in time
  // (motion/preview/poster frames). Plain design view shows base values.
  const allTracks = compileTracks(layer, anim.duration);
  // R27: SMIL only when an animated render is requested. Design view and
  // poster frames ({ time }) render static values with zero <animate> nodes.
  const smil = opts.animate === true ? smilFor(layer as Exclude<Layer, { type: "group" }>, anim.duration, allTracks) : "";
  const over = opts.time !== undefined ? sampleTracks(layer, time, allTracks) : {};
  const baseLayer = layer as unknown as { x: number; y: number; opacity: number; rotation: number };
  const x = Number(over.x ?? baseLayer.x ?? 0);
  const y = Number(over.y ?? baseLayer.y ?? 0);
  const opacity = Math.max(0, Math.min(1, (over.opacity ?? baseLayer.opacity) as number));
  const rotation = (over.rotation ?? baseLayer.rotation) as number;
  const brand = (doc.brand ?? {}) as Record<string, string | undefined>;

  const common = `opacity="${opacity}"`;
  const hue = over.hue ?? 0;
  const fx = effectFilter(layer, opts, hue);
  if (fx.def) defsOut.push(fx.def);
  const bounds = isGroupLayer(layer) ? (groupBBox(layer) ?? {x:0,y:0,w:doc.canvas.width,h:doc.canvas.height}) : {x,y:layer.type==='text'?y-layer.fontSize:y,w:'width' in layer?Number(over.width??layer.width):layer.type==='text'?layer.text.length*layer.fontSize*.6:doc.canvas.width,h:'height' in layer?Number(over.height??layer.height):layer.type==='text'?layer.fontSize*1.3:doc.canvas.height};
  const spatial = spatialEffects(layer, bounds, time, opts.animate===true);
  const dataId = editable ? ` data-layer-id="${esc(layer.id)}"` : "";
  const cursor = editable ? ` style="cursor: ${layer.locked ? "default" : "move"}"` : "";
  const transform = rotation !== 0 ? ` transform="rotate(${rotation} ${x} ${y})"` : "";

  // Semantic groups recurse; group opacity multiplies children (children
  // carry their own opacity in their own markup).
  if (isGroupLayer(layer)) {
    const children = layer.children
      .filter((c) => c.visible)
      .map((c) => layerNode(c, doc, opts, defsOut))
      .join("\n  ");
    const groupFx = effectFilter(layer, opts, hue);

    const dataAttr = editable ? ` data-layer-id="${esc(layer.id)}"` : "";
    // Group scale: when params carry scaleX/scaleY the whole group — frame,
    // glass, view, everything — scales coherently around its own bounding box.
    const sx = layer.params?.scaleX ?? 1;
    const sy = layer.params?.scaleY ?? sx;
    let scaleT = "";
    if (Math.abs(sx - 1) > 1e-6 || Math.abs(sy - 1) > 1e-6) {
      const bb = groupBBox(layer);
      if (bb) {
        const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2;
        scaleT = ` translate(${(cx * (1 - sx)).toFixed(2)} ${(cy * (1 - sy)).toFixed(2)}) scale(${sx} ${sy})`;
      }
    }
    const motionT = `translate(${Number(over.x ?? 0)} ${Number(over.y ?? 0)})`;
    const groupTransform = [rotation!==0?`rotate(${rotation} ${x} ${y})`:"", scaleT.trim(), motionT].filter(Boolean).join(" ");
    return `<g opacity="${opacity}"${groupFx.filterAttr}${groupTransform ? ` transform="${groupTransform}"` : ""}${dataAttr}>${children}${spatial}${smil}</g>`;
  }
  if (isRectLayer(layer)) {
    const w = (over.width ?? layer.width) as number;
    const h = (over.height ?? layer.height) as number;
    const c = layer.corners;
    const { defs, fill } = resolvePaint(layer.fill, brand, opts, { x, y, w, h });
    if (defs) defsOut.push(defs);
    const body = c
      ? `<path d="${roundedRectPath(x, y, w, h, c)}" fill="${fill}"/>`
      : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${layer.cornerRadius ?? 0}" fill="${fill}"/>`;
    let border = "";
    if (layer.border && layer.border.width > 0) {
      const b = layer.border;
      const bp = resolvePaint(b.paint, brand, opts, { x, y, w, h });
      if (bp.defs) defsOut.push(bp.defs);
      border = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${layer.cornerRadius ?? 0}" fill="none" stroke="${bp.fill}" stroke-width="${b.width}" opacity="${b.opacity ?? 1}"/>`;
    }
    return `<g ${common}${fx.filterAttr}${transform}${dataId}${cursor}>${body}${border}${spatial}${smil}</g>`;
  }
  if (isEllipseLayer(layer)) {
    const w = (over.width ?? layer.width) as number;
    const h = (over.height ?? layer.height) as number;
    const { defs, fill } = resolvePaint(layer.fill, brand, opts, { x, y, w, h });
    if (defs) defsOut.push(defs);
    return `<g ${common}${fx.filterAttr}${transform}${dataId}${cursor}><ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fill}"/>${spatial}${smil}</g>`;
  }
  if (isLineLayer(layer)) {
    const strokePaint = asPaint(layer.fill, "#ffffff");
    const sp = resolvePaint(strokePaint, brand, opts, { x, y, w: Math.abs(layer.x2), h: Math.abs(layer.y2) });
    if (sp.defs) defsOut.push(sp.defs);
    return `<g ${common}${fx.filterAttr}${transform}${dataId}${cursor}><line x1="${x}" y1="${y}" x2="${x + layer.x2}" y2="${y + layer.y2}" stroke="${sp.fill}" stroke-width="${layer.strokeWidth}" stroke-linecap="round"/>${spatial}${smil}</g>`;
  }
  if (isImageLayer(layer)) {
    const fit = layer.fit ?? "cover";
    const preserve = fit === "stretch" ? "none" : fit === "contain" ? "xMidYMid meet" : "xMidYMid slice";
    const naturalW=layer.sourceWidth??layer.width,naturalH=layer.sourceHeight??layer.height;
    const coverScale=Math.max(layer.width/naturalW,layer.height/naturalH);
    const iw=fit==='cover'?naturalW*coverScale:layer.width,ih=fit==='cover'?naturalH*coverScale:layer.height;
    const ix=x-(iw-layer.width)*Math.max(0,Math.min(1,layer.focalX??.5)),iy=y-(ih-layer.height)*Math.max(0,Math.min(1,layer.focalY??.5));
    const clip = true
      ? ` clip-path="url(#clip-${esc(layer.id)})"`
      : "";
    const clipDef = true
      ? `<clipPath id="clip-${esc(layer.id)}"><rect x="${x}" y="${y}" width="${layer.width}" height="${layer.height}" rx="${layer.cornerRadius ?? 0}"/></clipPath>`
      : "";
    if (clipDef) defsOut.push(clipDef);
    return `<g ${common}${fx.filterAttr}${transform}${dataId}${cursor}><image href="${esc(layer.src)}" x="${ix}" y="${iy}" width="${iw}" height="${ih}" preserveAspectRatio="${preserve}"${clip}/>${spatial}${smil}</g>`;
  }
  if (isTextLayer(layer)) {
    const { defs, fill } = resolvePaint(layer.fill, brand, opts, { x, y: y - layer.fontSize, w: layer.text.length * layer.fontSize * 0.6, h: layer.fontSize });
    if (defs) defsOut.push(defs);
    const lh = layer.lineHeight ?? 1.2;
    const typing = layer.behaviors?.find(b => b.enabled && b.preset === 'typewriter');
    const localTime = Math.max(0, time - (typing?.delay ?? 0));
    const count = typing && opts.time !== undefined ? Math.floor(localTime * Math.max(.25,typing.speed) * 24) : layer.text.length;
    const lines = (typing && !opts.animate ? layer.text.slice(0,count) : layer.text).split("\n");
    const tspans = lines
      .map((ln, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lh * layer.fontSize}">${typing && opts.animate ? Array.from(ln).map((ch,j)=>`<tspan opacity="0">${esc(ch)}<animate attributeName="opacity" values="0;1;1" keyTimes="0;${Math.max(.001,Math.min(.999,((typing.delay??0)+j/(24*Math.max(.25,typing.speed)))/anim.duration))};1" calcMode="discrete" dur="${anim.duration}s" repeatCount="indefinite"/></tspan>`).join('') : esc(ln)}</tspan>`)
      .join("");
    const anchor = layer.align === "middle" ? ` text-anchor="middle"` : layer.align === "end" ? ` text-anchor="end"` : "";
    const style =
      (layer.letterSpacing ? ` letter-spacing="${layer.letterSpacing}"` : "") +
      (layer.fontStyle === "italic" ? ` font-style="italic"` : "");
    return `<g ${common}${fx.filterAttr}${transform}${dataId}${cursor}><text x="${x}" y="${y}" fill="${fill}" font-family="${esc(layer.fontFamily)}" font-size="${layer.fontSize}" font-weight="${layer.fontWeight ?? 600}"${anchor}${style}>${tspans}${typing && (!opts.animate && Math.floor(time*2)%2===0) ? '<tspan>▌</tspan>' : ''}${typing && opts.animate ? '<tspan>▌<animate attributeName="opacity" values="1;0" calcMode="discrete" dur="1s" repeatCount="indefinite"/></tspan>' : ''}${smil}</text>${spatial}</g>`;
  }
  return "";
}

/**
 * Visible banner shape (0.2.6 R35/R37). Returns an SVG path covering the
 * shape region inside a width x height canvas, or null for the plain
 * rectangle (no clipping, no transparency semantics).
 */
export function bannerShapePath(shape: string, width: number, height: number, radius: number): string | null {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  switch (shape) {
    case "rounded":
      return `M ${r} 0 L ${width - r} 0 A ${r} ${r} 0 0 1 ${width} ${r} L ${width} ${height - r} A ${r} ${r} 0 0 1 ${width - r} ${height} L ${r} ${height} A ${r} ${r} 0 0 1 0 ${height - r} L 0 ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
    case "cut": {
      const c = r;
      return `M ${c} 0 L ${width - c} 0 L ${width} ${c} L ${width} ${height - c} L ${width - c} ${height} L ${c} ${height} L 0 ${height - c} L 0 ${c} Z`;
    }
    case "notched": {
      const c = r;
      return `M 0 0 L ${width - c} 0 L ${width} ${c} L ${width} ${height} L ${c} ${height} L 0 ${height - c} Z`;
    }
    case "ticket": {
      const ry = Math.min(r, height / 4);
      const my = height / 2;
      return (
        `M 0 0 L ${width} 0 L ${width} ${my - ry} ` +
        `A ${ry} ${ry} 0 0 0 ${width} ${my + ry} ` +
        `L ${width} ${height} L 0 ${height} L 0 ${my + ry} ` +
        `A ${ry} ${ry} 0 0 0 0 ${my - ry} Z`
      );
    }
    default:
      return null;
  }
}

/**
 * The one renderer for preview and export.
 * - default: static frame at t=0
 * - { time } : static poster frame at that time
 * - { animate: true } : SMIL-animated SVG (animated paints + tracks)
 */
export function renderSvg(doc: BannerSpecDocument, options: RenderOptions = {}): string {
  const invalid = validateBannerSpec(doc).find(issue => issue.severity === "error");
  if (invalid) throw new Error(`Invalid scene at ${invalid.path}: ${invalid.message}`);
  uidCounter = 0;
  if(options.time !== undefined && options.time >= animDuration(doc)) options={...options,time:Math.max(0,animDuration(doc)-.0001)};
  const { width, height } = doc.canvas;
  const defsOut: string[] = [];
  const body = doc.layers
    .filter((l) => l.visible)
    .map((l) => layerNode(l, doc, options, defsOut))
    .join("\n  ");
  // Banner shape (0.2.6 R35/R37): pixels OUTSIDE the visible shape are alpha 0
  // — never the editor background. Layers are clipped to the shape and the
  // background is painted as the shape itself. A missing background means a
  // genuinely transparent canvas (no default fill is invented).
  const shapePath = doc.canvas.shape && doc.canvas.shape !== "rectangle"
    ? bannerShapePath(doc.canvas.shape, width, height, doc.canvas.shapeRadius ?? 24)
    : null;
  if (shapePath) defsOut.push(`<clipPath id="pcs-banner-shape"><path d="${shapePath}"/></clipPath>`);
  const defs = defsOut.length ? `  <defs>\n  ${defsOut.join("\n  ")}\n  </defs>` : "";
  const bgRect = doc.canvas.background === undefined
    ? ""
    : shapePath
      ? `  <path d="${shapePath}" fill="${attrColor(doc.canvas.background)}"/>\n`
      : `  <rect x="0" y="0" width="${width}" height="${height}" fill="${attrColor(doc.canvas.background)}"/>\n`;
  const clippedBody = shapePath ? `<g clip-path="url(#pcs-banner-shape)">\n  ${body}\n  </g>` : `  ${body}`;
  const result = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    defs,
    bgRect,
    options.animate && doc.layers.some(l=>isGroupLayer(l)&&l.params?.sequence===1) ? `<g opacity="0"><animate id="pcs-sequence-clock" attributeName="opacity" values="0;0" dur="${animDuration(doc)}s" repeatCount="indefinite"/></g>` : "",
    clippedBody,
    `</svg>`,
    "",
  ].filter((s) => s !== "").join("\n");
  return options.animate && doc.animation?.loop === false ? result.replace(/repeatCount="indefinite"/g, 'repeatCount="1" fill="freeze"') : result;
}
