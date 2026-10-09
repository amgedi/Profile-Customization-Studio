/**
 * Procedural scene generation — semantic groups for ambience and repeated
 * elements. Beginner controls (intensity/speed) regenerate group children
 * deterministically from a seed.
 */
import type { GroupKind } from "@pcs/bannerspec";
import { rng } from "@pcs/contribution";
import type { Layer } from "@pcs/bannerspec";

export interface GroupParams {
  count: number;
  speed: number;
  intensity: number; // 0..1 — density/opacity
  seed: number;
  // ---- weather extras (kind-dependent, all optional) ----
  /** -1..1 crosswind (rain/snow slant). 0 = straight down. */
  wind?: number;
  /** 0..1 rain-on-glass droplets in the foreground. */
  glass?: number;
  /** 0..1 extra depth blur on the background layer. */
  blur?: number;
  /** 0..1 occasional lightning flashes (storm rain). */
  lightning?: number;
  /** 0.5..2 snowflake size scale. */
  size?: number;
  /** 0..1 snow depth layering (far small dim → near big bright). */
  depth?: number;
  /** 0..1 glow/sparkle on snowflakes. */
  glow?: number;
  /** 0..1 fog density (bank opacity). Falls back from intensity for old docs. */
  density?: number;
  /** 0..1 fog field height (0 = thin ground band, 1 = fills the scene). */
  height?: number;
  /** 0..1 fog softness — how far the noise/edges feather. */
  softness?: number;
  /** fog tint as 0xRRGGBB (e.g. 0xdfe8f5). */
  tint?: number;
  /** optional warm light pickup tint as 0xRRGGBB, blended into near layers. */
  lampTint?: number;
  /** legacy fog preset (0 soft, 1 ground mist, 2 heavy, 3 rolling) — old docs only. */
  variant?: number;
}

let n = 0;
export const uid = () => `gen-${Math.random().toString(36).slice(2, 10)}-${n++}`;

export function makeId(): string {
  return uid();
}

export const AMBIENCE_KINDS: Array<{ kind: GroupKind; label: string; blurb: string }> = [
  { kind: "rain", label: "Rain", blurb: "Soft falling rain streaks" },
  { kind: "snow", label: "Snow", blurb: "Gentle drifting snowflakes" },
  { kind: "fireflies", label: "Fireflies", blurb: "Warm glowing wanderers" },
  { kind: "stars", label: "Stars", blurb: "Quiet twinkling night sky" },
  // "fog" deliberately removed from the product surface in 0.2.6 (user
  // decision): the generator stays so old projects keep rendering.
  { kind: "leaves", label: "Falling leaves", blurb: "Autumn leaves on the wind" },
  { kind: "bokeh", label: "Bokeh", blurb: "Soft out-of-focus light dots" },
  { kind: "dust", label: "Dust", blurb: "Fine drifting motes in the air" },
  { kind: "embers", label: "Embers", blurb: "Warm sparks rising slowly" },
];

export function generateGroupChildren(kind: GroupKind, params: GroupParams, W: number, H: number): Layer[] {
  const rand = rng(params.seed);
  const out: Layer[] = [];
  const count = params.count;

  const base = (extra: Partial<Layer>): Partial<Layer> => ({
    name: kind, visible: true, locked: false, opacity: params.intensity, rotation: 0, ...extra,
  });

  switch (kind) {
    case "rain": {
      // Depth-layered rain: background drizzle (thin, slow, blurred),
      // mid streaks (varied length/angle/speed), and a few bright
      // foreground drops — plus optional glass droplets and storm lightning.
      // No two drops are identical.
      const intensity = params.intensity ?? 0.8;
      const wind = (params.wind ?? 0.35) * 0.55; // slant factor per unit length
      const depthBlur = 0.8 + (params.blur ?? 0.3) * 2.2;
      const nBack = Math.max(2, Math.round(count * 0.45));
      const nMid = Math.max(2, Math.round(count * 0.4));
      const nFront = Math.max(1, Math.round(count * 0.15));
      const drop = (depth: "back" | "mid" | "front", i: number) => {
        const r1 = rand(), r2 = rand(), r3 = rand(), r4 = rand(), r5 = rand();
        const x = r1 * (W + 60) - 30;
        if (depth === "back") {
          const len = 7 + r2 * 9;
          const dur = Math.max(1.1, 3.4 / params.speed) * (0.75 + r3 * 0.5);
          out.push({
            id: uid(), type: "line", ...base({}),
            x, y: r4 * H, x2: wind * len, y2: len, strokeWidth: 0.8 + r5 * 0.4,
            opacity: 0.35 + r5 * 0.2,
            fill: { type: "solid", color: "#8fb0e8" },
            effects: [{ id: uid(), type: "blur", visible: true, params: { amount: depthBlur } }],
            tracks: [{ prop: "y", keys: [{ t: 0, value: -len }, { t: dur, value: H + len }] }],
          } as unknown as Layer);
        } else if (depth === "mid") {
          const len = 12 + r2 * 14;
          const dur = Math.max(0.7, 2.3 / params.speed) * (0.7 + r3 * 0.6);
          out.push({
            id: uid(), type: "line", ...base({}),
            x, y: r4 * H, x2: wind * len, y2: len, strokeWidth: 1.1 + r5 * 0.7,
            opacity: 0.5 + r5 * 0.3,
            fill: { type: "solid", color: "#9fc0ff" },
            tracks: [{ prop: "y", keys: [{ t: 0, value: -len }, { t: dur, value: H + len }] }],
          } as unknown as Layer);
        } else {
          const len = 20 + r2 * 18;
          const dur = Math.max(0.45, 1.6 / params.speed) * (0.75 + r3 * 0.5);
          out.push({
            id: uid(), type: "line", ...base({}),
            x, y: r4 * H, x2: wind * len, y2: len, strokeWidth: 1.6 + r5 * 0.8,
            opacity: 0.75 + r5 * 0.25,
            fill: { type: "solid", color: "#c8dcff" },
            effects: [{ id: uid(), type: "glow", visible: true, params: { amount: 2 + Math.round(intensity * 3) } }],
            tracks: [
              { prop: "y", keys: [{ t: 0, value: -len }, { t: dur, value: H + len }] },
              { prop: "opacity", keys: [{ t: 0, value: 0.4 }, { t: dur * 0.3, value: 0.95 }, { t: dur, value: 0.4 }] },
            ],
          } as unknown as Layer);
        }
        void i;
      };
      for (let i = 0; i < nBack; i++) drop("back", i);
      for (let i = 0; i < nMid; i++) drop("mid", i);
      for (let i = 0; i < nFront; i++) drop("front", i);
      // Rain-on-glass: a handful of static droplets catching the light.
      const glass = params.glass ?? 0;
      if (glass > 0.02) {
        const nGlass = Math.max(2, Math.round(count * 0.18 * glass));
        for (let i = 0; i < nGlass; i++) {
          const r1 = rand(), r2 = rand(), r3 = rand();
          const size = 3 + r3 * 6;
          out.push({
            id: uid(), type: "ellipse", ...base({ opacity: 0.35 + r2 * 0.35 }),
            x: r1 * W, y: rand() * H, width: size, height: size * (1.1 + r3 * 0.5),
            fill: { type: "solid", color: "#cfe0ff" },
            effects: [{ id: uid(), type: "glow", visible: true, params: { amount: 2 } }],
          } as unknown as Layer);
        }
      }
      // Storm lightning: full-canvas flashes at staggered offsets.
      const lightning = params.lightning ?? 0;
      if (lightning > 0.02) {
        const flashes = lightning > 0.6 ? 3 : 2;
        for (let f = 0; f < flashes; f++) {
          const t0 = (f / flashes) * Math.max(2, 8 / params.speed) + rand() * 0.6;
          out.push({
            id: uid(), type: "rect", ...base({ opacity: 0 }),
            x: 0, y: 0, width: W, height: H,
            fill: { type: "solid", color: "#eaf2ff" },
            tracks: [{
              prop: "opacity",
              keys: [
                { t: t0, value: 0 },
                { t: t0 + 0.08, value: 0.55 * lightning },
                { t: t0 + 0.18, value: 0.1 * lightning },
                { t: t0 + 0.3, value: 0.7 * lightning },
                { t: t0 + 0.55, value: 0 },
              ],
            }],
          } as unknown as Layer);
        }
      }
      break;
    }
    case "snow": {
      // Depth-layered snowfall: far flakes (small, dim, slow), mid flakes,
      // and near flakes (big, bright, fast) with wind drift and optional glow.
      const size = params.size ?? 1;
      const wind = (params.wind ?? 0.3) * 60;
      const depth = params.depth ?? 0.7;
      const glow = params.glow ?? 0;
      const intensity = params.intensity ?? 0.8;
      const flake = (layer: 0 | 1 | 2) => {
        const r1 = rand(), r2 = rand(), r3 = rand(), r4 = rand(), r5 = rand();
        const scaleMul = layer === 0 ? 0.55 + depth * 0.15 : layer === 1 ? 0.9 + depth * 0.25 : 1.35 + depth * 0.45;
        const sizePx = (2 + r2 * 4) * size * scaleMul;
        const speedMul = layer === 0 ? 0.65 : layer === 1 ? 1 : 1.5;
        const dur = Math.max(3, (9 / params.speed) * (0.7 + r3 * 0.6) / speedMul);
        const drift = (20 + r4 * 40 + wind * (0.5 + r5 * 0.5)) * (layer === 2 ? 1.4 : 1);
        const x = r1 * W;
        const op = layer === 0 ? 0.35 + intensity * 0.2 : layer === 1 ? 0.55 + intensity * 0.3 : 0.75 + intensity * 0.25;
        const effects: Layer["effects"] =
          layer === 2 && glow > 0.05
            ? [{ id: uid(), type: "glow", visible: true, params: { amount: 2 + glow * 5 } }]
            : undefined;
        out.push({
          id: uid(), type: "ellipse", ...base({ opacity: Math.min(1, op) }),
          x, y: r5 * H, width: sizePx, height: sizePx,
          fill: { type: "solid", color: layer === 2 ? "#f4f9ff" : "#e8f1ff" },
          ...(effects ? { effects } : {}),
          tracks: [
            { prop: "y", keys: [{ t: 0, value: -10 }, { t: dur, value: H + 10 }] },
            { prop: "x", keys: [{ t: 0, value: x }, { t: dur / 2, value: x + drift }, { t: dur, value: x }] },
          ],
        } as unknown as Layer);
      };
      const nFar = Math.max(2, Math.round(count * (0.45 - depth * 0.15)));
      const nMid = Math.max(2, Math.round(count * (0.35 + depth * 0.05)));
      const nNear = Math.max(1, Math.round(count * (0.2 + depth * 0.1)));
      for (let i = 0; i < nFar; i++) flake(0);
      for (let i = 0; i < nMid; i++) flake(1);
      for (let i = 0; i < nNear; i++) flake(2);
      break;
    }
    case "fireflies":
      for (let i = 0; i < count; i++) {
        const x = 40 + rand() * (W - 120);
        const y = 30 + rand() * (H - 100);
        const size = 3 + rand() * 4;
        out.push({
          id: uid(), type: "ellipse", ...base({ opacity: params.intensity }),
          x, y, width: size, height: size,
          fill: { type: "solid", color: "#d9f99d" },
          effects: [{ id: uid(), type: "glow", visible: true, params: { amount: 6 } }],
          tracks: [
            { prop: "x", keys: [{ t: 0, value: x }, { t: 4, value: x + 30 + rand() * 30 }, { t: 8, value: x }] },
            { prop: "y", keys: [{ t: 0, value: y }, { t: 3, value: y - 20 - rand() * 20 }, { t: 6, value: y + 12 }, { t: 8, value: y }] },
            { prop: "opacity", keys: [{ t: 0, value: 0.15 }, { t: 1.5, value: 1 }, { t: 3.5, value: 0.15 }, { t: 5.5, value: 1 }, { t: 8, value: 0.15 }] },
          ],
        } as unknown as Layer);
      }
      break;
    case "stars":
      for (let i = 0; i < count; i++) {
        const x = rand() * W;
        const y = rand() * H * 0.75;
        const size = 1.5 + rand() * 2.5;
        out.push({
          id: uid(), type: "ellipse", ...base({}),
          x, y, width: size, height: size,
          fill: { type: "solid", color: "#dfe8ff" },
          tracks: [{ prop: "opacity", keys: [{ t: 0, value: 0.25 }, { t: 1 + rand() * 2, value: 1 }, { t: 2 + rand() * 3, value: 0.25 }, { t: 5, value: 1 }] }],
        } as unknown as Layer);
      }
      break;
    case "fog": {
      // Layered atmospheric fog — no blobs. Each depth layer is a wide
      // transparent field filled by the scene-core "fog-fx" filter:
      // feTurbulence fractal noise → luminance-to-alpha → heavy gaussian
      // blur, so structure and edges are feathered mist, never shapes.
      // Layers (background haze → mid banks → foreground wisps) drift
      // horizontally at slightly different slow rates with seamless
      // ping-pong tracks that loop inside the document animation period.
      const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
      const legacy = params.variant ?? 0;
      const density = clamp01(params.density ?? (params.intensity ?? 0.7) * (legacy === 2 ? 1.1 : 0.85));
      const height = clamp01(params.height ?? (legacy === 1 ? 0.14 : legacy === 2 ? 0.6 : 0.38));
      const softness = clamp01(params.softness ?? 0.6);
      const depth = clamp01(params.depth ?? 0.65);
      const tint = params.tint ?? 0xdfe8f5;
      const lamp = params.lampTint;
      const hex = (n: number) => `#${(n & 0xffffff).toString(16).padStart(6, "0")}`;
      const mix = (a: number, b: number, k: number) => {
        const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
        const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
        const r = Math.round(ar + (br - ar) * k), g = Math.round(ag + (bg - ag) * k), bl = Math.round(ab + (bb - ab) * k);
        return hex((r << 16) | (g << 8) | bl);
      };
      // depth drives layer count/intensity: 3 base layers up to 5.
      const nLayers = Math.max(3, Math.min(5, Math.round(2 + depth * 3)));
      const loopDur = 8; // matches the default scene loop — drift repeats seamlessly
      const speedK = Math.max(0.15, params.speed ?? 0.5);
      const fieldTop = H * (1 - height * 0.92);
      const fieldH = H - fieldTop;
      for (let i = 0; i < nLayers; i++) {
        const f = nLayers === 1 ? 0 : i / (nLayers - 1); // 0 = far haze, 1 = near wisps
        const r1 = rand(), r2 = rand(), r3 = rand(), r4 = rand();
        const bandH = fieldH * (1.15 - f * 0.25) * (0.85 + r1 * 0.3);
        const y = fieldTop - bandH * 0.25 + f * fieldH * 0.55 + (r2 - 0.5) * fieldH * 0.15;
        const x0 = -W * 0.3 - r3 * W * 0.1;
        const op = clamp01(density * (0.62 - f * 0.14) * (0.85 + r4 * 0.3));
        // near layers pick up a whisper of the lamp tint; far layers stay clean
        const color = mix(tint, lamp ?? tint, f * 0.3);
        const amp = (16 + speedK * 44) * (0.55 + f * 1.0) * (0.7 + r3 * 0.6);
        const mid = loopDur * (0.35 + r2 * 0.3); // phase variety between layers
        const tracks: NonNullable<Layer["tracks"]> = [
          { prop: "x", keys: [{ t: 0, value: x0 }, { t: mid, value: x0 + amp }, { t: loopDur, value: x0 }] },
        ];
        if (i === nLayers - 1 && op > 0.03) {
          // foreground wisps breathe faintly
          tracks.push({ prop: "opacity", keys: [{ t: 0, value: op }, { t: loopDur / 2, value: op * 0.6 }, { t: loopDur, value: op }] });
        }
        out.push({
          id: uid(), type: "rect", ...base({ opacity: op }),
          x: x0, y, width: W * 1.6, height: bandH,
          fill: { type: "solid", color: "#00000000" }, // the fog comes from the filter, not the shape
          effects: [{
            id: uid(), type: "fog-fx", visible: true, color,
            params: {
              amount: Math.round(50 + r1 * 30),
              seed: 9 + i * 41 + Math.floor(r4 * 97),
              scale: 1.15 + f * 0.85 + r1 * 0.2, // finer fractal detail — mist, never blobs
              soft: 0.9 + softness * 1.5,
            },
          }],
          tracks,
        } as unknown as Layer);
      }
      break;
    }
    case "leaves":
      for (let i = 0; i < count; i++) {
        const x = rand() * W;
        const dur = Math.max(4, 10 / params.speed);
        out.push({
          id: uid(), type: "ellipse", ...base({}),
          x, y: -20, width: 8, height: 5,
          fill: { type: "solid", color: ["#d97742", "#c2552f", "#e0a458"][Math.floor(rand() * 3)] },
          tracks: [
            { prop: "y", keys: [{ t: 0, value: -20 }, { t: dur, value: H + 20 }] },
            { prop: "x", keys: [{ t: 0, value: x }, { t: dur / 3, value: x - 40 }, { t: (2 * dur) / 3, value: x + 20 }, { t: dur, value: x - 30 }] },
            { prop: "rotation", keys: [{ t: 0, value: 0 }, { t: dur / 2, value: 180 }, { t: dur, value: 360 }] },
          ],
        } as unknown as Layer);
      }
      break;
    case "bokeh":
      for (let i = 0; i < Math.max(4, Math.round(count * 0.6)); i++) {
        const size = 8 + rand() * 26;
        const x = rand() * W, y = rand() * H;
        out.push({
          id: uid(), type: "ellipse", ...base({ opacity: params.intensity * 0.35 }),
          x, y, width: size, height: size,
          fill: { type: "solid", color: ["#ffe9b0", "#9fc0ff", "#f9c6d8"][Math.floor(rand() * 3)] },
          effects: [{ id: uid(), type: "blur", visible: true, params: { amount: size / 4 } }],
          tracks: [{ prop: "opacity", keys: [{ t: 0, value: 0.1 }, { t: 2 + rand() * 3, value: params.intensity * 0.45 }, { t: 5 + rand() * 3, value: 0.1 }] }],
        } as unknown as Layer);
      }
      break;
    case "dust":
      for (let i = 0; i < count; i++) {
        const x = rand() * W, y = rand() * H;
        out.push({
          id: uid(), type: "ellipse", ...base({ opacity: params.intensity * 0.4 }),
          x, y, width: 1.5 + rand() * 2, height: 1.5 + rand() * 2,
          fill: { type: "solid", color: "#e8ecf5" },
          tracks: [
            { prop: "x", keys: [{ t: 0, value: x }, { t: 8 / params.speed, value: x + 30 + rand() * 50 }] },
            { prop: "y", keys: [{ t: 0, value: y }, { t: 8 / params.speed, value: y - 20 - rand() * 30 }] },
            { prop: "opacity", keys: [{ t: 0, value: 0.05 }, { t: 3 + rand() * 2, value: params.intensity * 0.5 }, { t: 7 + rand(), value: 0.05 }] },
          ],
        } as unknown as Layer);
      }
      break;
    case "embers":
      for (let i = 0; i < count; i++) {
        const x = rand() * W;
        const size = 2 + rand() * 3;
        out.push({
          id: uid(), type: "ellipse", ...base({}),
          x, y: H - rand() * H * 0.3, width: size, height: size,
          fill: { type: "solid", color: "#ff9a5c" },
          effects: [{ id: uid(), type: "glow", visible: true, params: { amount: 5 } }],
          tracks: [
            { prop: "y", keys: [{ t: 0, value: H + 6 }, { t: (5 + rand() * 4) / params.speed, value: -10 }] },
            { prop: "x", keys: [{ t: 0, value: x }, { t: 3, value: x + (rand() - 0.5) * 60 }, { t: 8, value: x + (rand() - 0.5) * 60 }] },
            { prop: "opacity", keys: [{ t: 0, value: 0.9 }, { t: 5 + rand() * 3, value: 0 }] },
          ],
        } as unknown as Layer);
      }
      break;
    default:
      // non-procedural kinds keep their children as-is
      break;
  }
  return out;
}

export function makeGroup(kind: GroupKind, name: string, params: GroupParams, W: number, H: number): Layer {
  return {
    id: uid(), type: "group", name, kind,
    visible: true, locked: false, opacity: 1, rotation: 0,
    params: { ...params } as Record<string, number>,
    children: generateGroupChildren(kind, params, W, H),
  } as unknown as Layer;
}

// ---------------------------------------------------------------- weather presets

export interface WeatherPreset {
  id: string;
  name: string;
  blurb: string;
  params: Omit<GroupParams, "seed">;
}

export const RAIN_PRESETS: WeatherPreset[] = [
  { id: "rain-relaxing", name: "Relaxing", blurb: "A gentle drizzle for quiet moods", params: { count: 16, speed: 0.7, intensity: 0.5, wind: 0.25, glass: 0.2, blur: 0.3, lightning: 0 } },
  { id: "rain-heavy", name: "Heavy", blurb: "A steady downpour with real weight", params: { count: 36, speed: 1.3, intensity: 0.9, wind: 0.45, glass: 0.4, blur: 0.4, lightning: 0 } },
  { id: "rain-storm", name: "Storm", blurb: "Fast, wind-driven rain on glass", params: { count: 54, speed: 2, intensity: 1, wind: 0.75, glass: 0.6, blur: 0.5, lightning: 0.8 } },
];

export const SNOW_PRESETS: WeatherPreset[] = [
  { id: "snow-gentle", name: "Gentle", blurb: "Sparse, unhurried flakes", params: { count: 18, speed: 0.6, intensity: 0.6, size: 0.9, wind: 0.2, depth: 0.5, glow: 0 } },
  { id: "snow-heavy", name: "Heavy", blurb: "A thick, cozy snowfall", params: { count: 40, speed: 1, intensity: 0.9, size: 1.1, wind: 0.3, depth: 0.7, glow: 0.2 } },
  { id: "snow-blizzard", name: "Blizzard", blurb: "A wild, wind-driven whiteout", params: { count: 60, speed: 1.8, intensity: 1, size: 1.2, wind: 0.8, depth: 0.9, glow: 0.3 } },
];

export const FOG_PRESETS: WeatherPreset[] = [
  { id: "fog-morning", name: "Morning Haze", blurb: "Light, warm haze at first light", params: { count: 6, speed: 0.4, intensity: 0.55, density: 0.38, height: 0.45, softness: 0.85, depth: 0.35, tint: 0xffe3c2, lampTint: 0xffd9a0 } },
  { id: "fog-forest", name: "Forest Mist", blurb: "Low mist drifting between the trees", params: { count: 6, speed: 0.5, intensity: 0.6, density: 0.5, height: 0.16, softness: 0.65, depth: 0.55, tint: 0xc6d4c9 } },
  { id: "fog-dreamy", name: "Dreamy Fog", blurb: "Soft luminous layers of fog", params: { count: 7, speed: 0.45, intensity: 0.7, density: 0.55, height: 0.55, softness: 1, depth: 0.9, tint: 0xe9e2f6, lampTint: 0xf6d9ff } },
  { id: "fog-heavy", name: "Heavy Fog", blurb: "Thick fog with real atmospheric depth", params: { count: 8, speed: 0.6, intensity: 0.9, density: 0.85, height: 0.7, softness: 0.7, depth: 1, tint: 0xc9d3e0 } },
];
