/**
 * BannerSpec 0.2 — portable, versioned, declarative banner scene format.
 *
 * 0.2 changes over 0.1:
 *  - Paint model: solid | linear/radial/conic gradient | animated paint | brand token
 *  - New layer types: ellipse, line, image
 *  - Layer effects (glow, shadow, blur, grain, light sweep)
 *  - Border (stroke) properties and per-corner radius
 *  - Animation timeline (per-layer property tracks with keyframes)
 * 0.1 documents remain readable via migration (fills become solid paints).
 */

export const BANNERSPEC_VERSION = "0.3";
/** Versions this build can read. */
export const SUPPORTED_SPEC_VERSIONS = ["0.1", "0.2", "0.3"] as const;

/** Visible banner shape, separate from the canvas rectangle (0.2.6 R37).
 *  Pixels outside the shape are fully transparent in preview and export. */
export type CanvasShape = "rectangle" | "rounded" | "cut" | "ticket" | "notched";

export interface CanvasSettings {
  width: number;
  height: number;
  /** CSS color or paint object. Absent = transparent canvas. */
  background?: string;
  /** Visible banner shape. Default "rectangle" fills the whole canvas. */
  shape?: CanvasShape;
  /** Corner radius / cut size for shaped banners (px). Default 24. */
  shapeRadius?: number;
}

// ---------------------------------------------------------------- paints

export interface Stop {
  color: string;
  /** 0..1 */
  offset: number;
}

export interface SolidPaint {
  type: "solid";
  color: string;
}
export interface LinearGradientPaint {
  type: "linear";
  stops: Stop[];
  /** degrees, 0 = left→right */
  angle: number;
}
export interface RadialGradientPaint {
  type: "radial";
  stops: Stop[];
}
export interface ConicGradientPaint {
  type: "conic";
  stops: Stop[];
  angle: number;
}
export type AnimatedPaintMode =
  | "hue-cycle"
  | "gradient-drift"
  | "color-pulse"
  | "aurora"
  | "light-sweep"
  | "palette-cycle";
export interface AnimatedPaint {
  type: "animated";
  mode: AnimatedPaintMode;
  base: LinearGradientPaint;
  /** seconds per full cycle */
  duration: number;
  easing?: string;
  phase?: number;
}
export interface TokenPaint {
  type: "token";
  /** key into project brand kit */
  token: string;
}
export type Paint =
  | SolidPaint
  | LinearGradientPaint
  | RadialGradientPaint
  | ConicGradientPaint
  | AnimatedPaint
  | TokenPaint;

export const solid = (color: string): SolidPaint => ({ type: "solid", color });
export const linear = (stops: Stop[], angle = 0): LinearGradientPaint => ({ type: "linear", stops, angle });

// ---------------------------------------------------------------- effects

export type EffectType =
  // light
  | "glow" | "bloom" | "neon" | "halo" | "rim" | "film-glow" | "heavenly" | "light-sweep" | "rays" | "electric"
  // material
  | "frost" | "glass" | "tinted-glass" | "chrome" | "holo" | "plastic"
  // color
  | "grad-overlay" | "duotone" | "grade" | "gradmap" | "tint" | "contrast" | "saturation"
  // atmosphere
  | "rain-fx" | "snow-fx" | "fog-fx" | "mist" | "dust-fx" | "bokeh-fx" | "stars-fx" | "fireflies-fx" | "embers-fx" | "leaves-fx" | "smoke" | "steam" | "condensation"
  // retro
  | "grain" | "noise" | "scanlines" | "crt" | "chromatic" | "rgb-split" | "pixel-glow" | "hud" | "grid"
  // edge
  | "soft-border" | "neon-border" | "aurora-border" | "grad-border" | "chase" | "electric-edge" | "pixel-border" | "breath"
  // utility
  | "shadow" | "blur" | "vignette" | "clouds" | "lens-glow" | "light-leak" | "motion-blur" | "depth-blur" | "inner-glow" | "outline";

/** Every valid effect type — single source of truth for validation and UI. */
export const EFFECT_TYPES: readonly EffectType[] = [
  "glow", "bloom", "neon", "halo", "rim", "film-glow", "heavenly", "light-sweep", "rays", "electric",
  "frost", "glass", "tinted-glass", "chrome", "holo", "plastic",
  "grad-overlay", "duotone", "grade", "gradmap", "tint", "contrast", "saturation",
  "rain-fx", "snow-fx", "fog-fx", "mist", "dust-fx", "bokeh-fx", "stars-fx", "fireflies-fx", "embers-fx", "leaves-fx", "smoke", "steam", "condensation",
  "grain", "noise", "scanlines", "crt", "chromatic", "rgb-split", "pixel-glow", "hud", "grid",
  "soft-border", "neon-border", "aurora-border", "grad-border", "chase", "electric-edge", "pixel-border", "breath",
  "shadow", "blur", "vignette", "clouds", "lens-glow", "light-leak", "motion-blur", "depth-blur", "inner-glow", "outline",
];

export interface LayerEffect {
  id: string;
  type: EffectType;
  visible: boolean;
  params: Record<string, number>;
  /** Optional accent color used by color/edge/atmosphere effects (hex string). */
  color?: string;
}

// ---------------------------------------------------------------- border

export interface Border {
  paint: Paint;
  width: number;
  opacity?: number;
  glow?: number;
  /** per-side overrides where supported */
  sides?: { top?: number; right?: number; bottom?: number; left?: number };
}

export interface Corners {
  tl: number;
  tr: number;
  br: number;
  bl: number;
}

// ---------------------------------------------------------------- tracks

export type AnimatableProp = "x" | "y" | "width" | "height" | "rotation" | "opacity" | "hue";
export interface Keyframe {
  /** seconds */
  t: number;
  value: number;
  easing?: string;
}
export interface Track {
  prop: AnimatableProp;
  keys: Keyframe[];
}

export interface DocumentAnimation {
  duration: number;
  loop: boolean;
}

// ---------------------------------------------------------------- layers

/**
 * High-level animation behavior (0.3, additive & optional): friendly motion
 * a beginner can stack on one object. Compiled to tracks deterministically —
 * see compileTracks in @pcs/scene-core.
 */
export type BehaviorCategory =
  | "entrance" | "loop" | "exit"
  | "text" | "color" | "lighting" | "ambient";

export interface LayerBehavior {
  id: string;
  /** preset id from the animation behavior library */
  preset: string;
  category: BehaviorCategory;
  enabled: boolean;
  /** 0.25..3, 1 = normal */
  speed: number;
  /** strength in px (or relative units per preset) */
  amount: number;
  /** seconds to wait before this behavior starts */
  delay?: number;
  /** how many cycles a loop behavior runs (Infinity/omitted = whole scene) */
  loops?: number;
}

export interface LayerBase {
  /** Stable UUID. Z-order = position in the layers array (last = top). */
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  /** 0..1 */
  opacity: number;
  /** degrees, clockwise */
  rotation: number;
  /** Paint (object) — legacy string is treated as a solid color */
  fill?: string | Paint;
  effects?: LayerEffect[];
  tracks?: Track[];
  /** Beginner animation stack (additive; compiled to tracks at render time). */
  behaviors?: LayerBehavior[];
}

export interface RectLayer extends LayerBase {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius?: number;
  corners?: Corners;
  border?: Border;
}

export interface EllipseLayer extends LayerBase {
  type: "ellipse";
  x: number;
  y: number;
  width: number;
  height: number;
  border?: Border;
}

export interface LineLayer extends LayerBase {
  type: "line";
  x: number;
  y: number;
  /** end point relative to x/y */
  x2: number;
  y2: number;
  strokeWidth: number;
}

export interface ImageLayer extends LayerBase {
  type: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  /** data URL or relative path */
  src: string;
  fit?: "contain" | "cover" | "stretch";
  sourceWidth?: number;
  sourceHeight?: number;
  focalX?: number;
  focalY?: number;
  cornerRadius?: number;
}

export interface TextLayer extends LayerBase {
  type: "text";
  x: number;
  y: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight?: number | string;
  fontStyle?: "normal" | "italic";
  letterSpacing?: number;
  lineHeight?: number;
  align?: "start" | "middle" | "end";
}

/**
 * Semantic group: a named container of layers (0.3).
 * `kind` marks procedural collections so editors can offer beginner
 * controls (intensity/speed) and regenerate children from a seed.
 */
export type GroupKind =
  | "scene"          // generic semantic group
  | "rain"
  | "snow"
  | "fog"
  | "fireflies"
  | "stars"
  | "leaves"
  | "city"
  | "trees"
  | "lights"
  | "bokeh"
  | "dust"
  | "embers"
  | "custom";
export interface GroupLayer extends LayerBase {
  type: "group";
  kind: GroupKind;
  children: Layer[];
  /** beginner-facing procedural parameters (kind-dependent) */
  params?: Record<string, number>;
}

export type Layer = RectLayer | EllipseLayer | LineLayer | ImageLayer | TextLayer | GroupLayer;

export interface BrandKit {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  surface?: string;
  text?: string;
  muted?: string;
}

export interface BannerSpecDocument {
  specVersion: string;
  canvas: CanvasSettings;
  layers: Layer[];
  brand?: BrandKit;
  animation?: DocumentAnimation;
  /** Unknown/future properties are preserved, never dropped. */
  [key: string]: unknown;
}

export const isRectLayer = (l: Layer): l is RectLayer => l.type === "rect";
export const isTextLayer = (l: Layer): l is TextLayer => l.type === "text";
export const isEllipseLayer = (l: Layer): l is EllipseLayer => l.type === "ellipse";
export const isLineLayer = (l: Layer): l is LineLayer => l.type === "line";
export const isImageLayer = (l: Layer): l is ImageLayer => l.type === "image";
export const isGroupLayer = (l: Layer): l is GroupLayer => l.type === "group";

/** Coerce a legacy string fill into a Paint. */
export function asPaint(fill: string | Paint | undefined, fallback = "#888888"): Paint {
  if (!fill) return solid(fallback);
  if (typeof fill === "string") return solid(fill);
  return fill;
}
