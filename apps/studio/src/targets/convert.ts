/**
 * Non-destructive auto-conversion planner.
 *
 * Pure functions only — the master BannerSpecDocument is never mutated.
 * planConversion produces a ConversionPlan describing exactly what the
 * renderer must do (pick a frame, flatten, crop, re-encode); the actual
 * rasterization/rendering lives elsewhere and reads this plan.
 */
import type { BannerSpecDocument, Paint } from "@pcs/bannerspec";
import type { TargetDef } from "./registry.js";

export interface ConversionStep {
  label: string;
  detail: string;
}

export type OutputFormat = "png" | "jpg" | "webp" | "gif" | "svg";

export interface ConversionPlan {
  targetId: string;
  output: {
    width: number;
    height: number;
    format: OutputFormat;
    animated: boolean;
    fps?: number;
    loop?: boolean;
    alpha: boolean;
    flattenBackground?: string;
    quality?: number;
  };
  scaleMode: "fit" | "cover-crop";
  /** Source-space rect to crop to (only for cover-crop). */
  crop?: { x: number; y: number; width: number; height: number };
  changes: ConversionStep[];
  warnings: ConversionStep[];
  estimatedSizeMB?: number;
}

export interface PlanOptions {
  preferAnimated?: boolean;
  scaleMode?: "fit" | "cover-crop";
  focalX?: number;
  focalY?: number;
  /** Requested format id (e.g. "png") — honored if the target accepts it. */
  format?: string;
  /** Override flatten background (default dark #0f1115). */
  flattenBackground?: string;
}

export const DEFAULT_FLATTEN_BACKGROUND = "#0f1115";

// ------------------------------------------------------------ doc analysis

/** Extract alpha (0..1) from a CSS color string; 1 when none/unknown. */
function colorAlpha(color: string): number {
  const c = color.trim();
  let m = /^#([0-9a-f]{8})$/i.exec(c);
  if (m) return parseInt(m[1]!.slice(6, 8), 16) / 255;
  m = /^#([0-9a-f]{4})$/i.exec(c);
  if (m) return parseInt(m[1]!.slice(3, 4).repeat(2), 16) / 255;
  m = /rgba?\(\s*[\d.]+(?:\s*,\s*[\d.]+){0,2}\s*(?:[,/]\s*([\d.]+%?)\s*)?\)/i.exec(c);
  if (m && m[1] != null) {
    return m[1].endsWith("%") ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
  }
  return 1;
}

function paintAlpha(p: Paint): number {
  switch (p.type) {
    case "solid":
      return colorAlpha(p.color);
    case "linear":
    case "radial":
    case "conic":
      return Math.min(...p.stops.map((s) => colorAlpha(s.color)));
    default:
      // animated / token paints are treated as opaque; the renderer
      // resolves them before any flattening decision matters.
      return 1;
  }
}

/**
 * A document is "potentially transparent" when its canvas background is
 * absent or any part of its paint has alpha < 1 (fully or partially
 * see-through regions render as transparency).
 */
export function isPotentiallyTransparent(doc: BannerSpecDocument): boolean {
  const bg = doc.canvas.background;
  if (bg == null || bg === "") return true;
  if (typeof bg === "string") return colorAlpha(bg) < 1;
  return paintAlpha(bg) < 1;
}

/**
 * A master is "animated" when it carries a timeline (doc.animation),
 * keyframe tracks, beginner behaviors, or animated paints.
 */
export function isMasterAnimated(doc: BannerSpecDocument): boolean {
  if (doc.animation) return true;
  for (const layer of doc.layers) {
    if (layer.tracks?.length) return true;
    if (layer.behaviors?.length) return true;
    const fill = layer.fill;
    if (fill && typeof fill === "object" && (fill as Paint).type === "animated") return true;
  }
  return false;
}

// ------------------------------------------------------------- planning

function targetAcceptsFormat(target: TargetDef, format: string): boolean {
  const f = format.toLowerCase();
  return target.staticFormats.includes(f) || target.animatedFormats.includes(f);
}

function pickFormat(target: TargetDef, animated: boolean, want?: string): OutputFormat {
  if (want && targetAcceptsFormat(target, want)) return want.toLowerCase() as OutputFormat;
  if (animated && target.animationSupport === "native" && target.animatedFormats.length > 0) {
    return (target.animatedFormats.includes("gif") ? "gif" : target.animatedFormats[0]!) as OutputFormat;
  }
  const statics = target.staticFormats.filter((f) => f !== "gif");
  if (statics.includes("png")) return "png";
  return (statics[0] ?? "png") as OutputFormat;
}

/**
 * Compute a source-space cover crop matching the target aspect ratio,
 * centered on the target's first safe area when one exists (projected
 * proportionally), otherwise on the canvas center.
 */
function coverCrop(docW: number, docH: number, target: TargetDef): { x: number; y: number; width: number; height: number } {
  const targetAspect = target.recommended.width / target.recommended.height;
  let cropW = docW;
  let cropH = docW / targetAspect;
  if (cropH > docH) {
    cropH = docH;
    cropW = docH * targetAspect;
  }
  // Bias the crop center toward the first safe area's center when present.
  let cx = docW / 2;
  let cy = docH / 2;
  const safe = target.safeAreas[0];
  if (safe) {
    const recW = target.recommended.width;
    const recH = target.recommended.height;
    const safeCx = (safe.x + safe.width / 2) / recW; // 0..1
    const safeCy = (safe.y + safe.height / 2) / recH;
    cx = Math.min(Math.max(safeCx * docW, cropW / 2), docW - cropW / 2);
    cy = Math.min(Math.max(safeCy * docH, cropH / 2), docH - cropH / 2);
  }
  return { x: Math.round(cx - cropW / 2), y: Math.round(cy - cropH / 2), width: Math.round(cropW), height: Math.round(cropH) };
}

/** Rough output size estimate in MB for the given raster settings. */
function estimateSizeMB(width: number, height: number, format: OutputFormat, animated: boolean, fps: number, quality?: number): number {
  const pixels = width * height;
  const perFrameFactor: Record<OutputFormat, number> = { png: 0.55, jpg: 0.15, webp: 0.25, gif: 0.28, svg: 0.001 };
  const frames = animated ? Math.max(1, Math.round(fps * 3)) : 1; // assume ~3s loops
  const q = quality == null ? 1 : quality / 100;
  const bytes = pixels * 4 * perFrameFactor[format] * frames * (0.4 + 0.6 * q);
  return Math.round((bytes / (1024 * 1024)) * 100) / 100;
}

export function planConversion(doc: BannerSpecDocument, target: TargetDef, opts: PlanOptions = {}): ConversionPlan {
  const changes: ConversionStep[] = [];
  const warnings: ConversionStep[] = [];

  const docW = doc.canvas.width;
  const docH = doc.canvas.height;
  const outW = target.recommended.width;
  const outH = target.recommended.height;

  const masterAnimated = isMasterAnimated(doc);
  const transparent = isPotentiallyTransparent(doc);
  const wantAnimated = Boolean(opts.preferAnimated) && masterAnimated;

  // --- animation decision -------------------------------------------------
  const targetAnimatesNatively = target.animationSupport === "native" && target.animatedFormats.length > 0;
  const animated = masterAnimated && wantAnimated && targetAnimatesNatively;

  if (masterAnimated && !animated) {
    changes.push({
      label: "SVG animation rasterized to a static frame",
      detail: targetAnimatesNatively
        ? "Animation export was not requested — the selected still frame is used."
        : `PCS file export for ${target.displayName} uses the selected still frame. The master document keeps its animation.`,
    });
  }
  if (masterAnimated && wantAnimated && !targetAnimatesNatively && target.animationSupport !== "none") {
    warnings.push({
      label: "Animation support unverified",
      detail: `${target.displayName} is listed with unverified animation support — the plan falls back to a static frame.`,
    });
  }

  // --- format -------------------------------------------------------------
  const format = pickFormat(target, animated, opts.format);
  if (opts.format && opts.format.toLowerCase() !== format) {
    changes.push({
      label: `Format set to ${format.toUpperCase()}`,
      detail: `${opts.format.toUpperCase()} is not accepted by ${target.displayName}; ${format.toUpperCase()} is used instead.`,
    });
  }

  // --- geometry -----------------------------------------------------------
  const scaleMode: ConversionPlan["scaleMode"] = opts.scaleMode ?? (Math.abs(docW / docH - outW / outH) < 1e-6 ? "fit" : "cover-crop");
  let crop: ConversionPlan["crop"];
  if (scaleMode === "fit") {
    if (docW !== outW || docH !== outH) {
      changes.push({
        label: `Scaled to ${outW}×${outH}`,
        detail: `Same aspect ratio — the scene scales cleanly from ${docW}×${docH}.`,
      });
    }
  } else {
    crop = coverCrop(docW, docH, target);
    if (opts.focalX != null) crop.x = Math.round(Math.max(0,Math.min(docW-crop.width,opts.focalX*docW-crop.width/2)));
    if (opts.focalY != null) crop.y = Math.round(Math.max(0,Math.min(docH-crop.height,opts.focalY*docH-crop.height/2)));
    changes.push({
      label: "Cover-cropped to target aspect ratio",
      detail: `The ${docW}×${docH} master is cropped to ${crop.width}×${crop.height}${target.safeAreas[0] ? ", centered on the platform safe area" : ", centered"} and scaled to ${outW}×${outH}.`,
    });
  }

  // --- alpha / flattening -------------------------------------------------
  const alphaFormat = format === "png" || format === "webp" || format === "gif" || format === "svg";
  let alpha = target.supportsAlpha && alphaFormat;
  let flattenBackground: string | undefined;
  if (transparent) {
    if (!target.supportsAlpha || !alphaFormat) {
      alpha = false;
      flattenBackground = opts.flattenBackground ?? DEFAULT_FLATTEN_BACKGROUND;
      warnings.push({
        label: "Transparency is not supported — flattened to background",
        detail: `${target.displayName} does not preserve transparency, so the scene is flattened against ${flattenBackground} (configurable per export).`,
      });
    } else {
      changes.push({
        label: "Transparency preserved",
        detail: "The master's background is transparent and the target format keeps alpha.",
      });
    }
  }

  // --- file size / quality ------------------------------------------------
  let fps: number | undefined;
  let loop: boolean | undefined;
  let quality: number | undefined;
  if (animated) {
    fps = 15;
    loop = doc.animation?.loop ?? true;
  }
  let estimatedSizeMB = estimateSizeMB(outW, outH, format, animated, fps ?? 15, quality);
  const limit = target.maxFileSizeMB;
  if (limit != null && estimatedSizeMB > limit) {
    if (format === "jpg" || format === "webp") {
      quality = 80;
      estimatedSizeMB = estimateSizeMB(outW, outH, format, animated, fps ?? 15, quality);
    }
    if (animated && fps != null && fps > 10 && estimatedSizeMB > limit) {
      fps = 10;
      changes.push({
        label: "Frame rate reduced to 10 fps",
        detail: `Estimated size exceeds the ${limit}MB limit; fps is lowered to stay under it.`,
      });
      estimatedSizeMB = estimateSizeMB(outW, outH, format, animated, fps, quality);
    }
    if (estimatedSizeMB > limit) {
      warnings.push({
        label: `Estimated size (${estimatedSizeMB}MB) exceeds the ${limit}MB limit`,
        detail: "PCS cannot guarantee compliance — reduce complexity (fewer layers, gradients, or a shorter loop) before exporting.",
      });
    } else {
      changes.push({
        label: `Output quality set to ${quality}%`,
        detail: `Applied to keep the export under the ${limit}MB limit.`,
      });
    }
  }

  // --- verification gate --------------------------------------------------
  if (target.verification === "unverified") {
    warnings.push({
      label: "Target rules are unverified — review before exporting",
      detail: `${target.displayName} metadata could not be confirmed against first-party documentation. Review the plan; PCS never auto-exports silently for unverified targets.`,
    });
  }

  return {
    targetId: target.id,
    output: {
      width: outW,
      height: outH,
      format,
      animated,
      fps,
      loop,
      alpha,
      flattenBackground,
      quality,
    },
    scaleMode,
    crop,
    changes,
    warnings,
    estimatedSizeMB,
  };
}

/** Human-readable lines for the conversion report UI. */
export function describePlan(plan: ConversionPlan): string[] {
  const o = plan.output;
  const lines: string[] = [];
  lines.push(`Output: ${o.width}×${o.height} ${o.format.toUpperCase()}${o.animated ? ` @ ${o.fps} fps (loop${o.loop === false ? " off" : ""})` : " (static)"}${o.alpha ? " with alpha" : ""}`);
  lines.push(`Scale: ${plan.scaleMode === "fit" ? "fit (scale, no crop)" : `cover-crop${plan.crop ? ` to ${plan.crop.width}×${plan.crop.height} source rect` : ""}`}`);
  if (o.flattenBackground) lines.push(`Flattened against ${o.flattenBackground}`);
  if (o.quality != null) lines.push(`Quality: ${o.quality}%`);
  if (plan.estimatedSizeMB != null) lines.push(`Estimated size: ~${plan.estimatedSizeMB}MB`);
  for (const c of plan.changes) lines.push(`Change: ${c.label} — ${c.detail}`);
  for (const w of plan.warnings) lines.push(`Warning: ${w.label} — ${w.detail}`);
  return lines;
}
