import {
  BANNERSPEC_VERSION,
  SUPPORTED_SPEC_VERSIONS,
  EFFECT_TYPES,
  isGroupLayer,
  asPaint,
  type BannerSpecDocument,
  type Layer,
  type Paint,
} from "./types.js";

export interface ValidationIssue {
  /** error = document unusable; warning = renderable but suspect */
  severity: "error" | "warning";
  path: string;
  message: string;
}

const HEX_COLOR = /^(#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|transparent)$/;
// Numeric CSS colour syntax only; reject markup, URLs and nested expressions.
export function isValidColor(v: unknown): boolean {
  if (typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  if (HEX_COLOR.test(s)) return true;
  const m = /^(rgba?|hsla?)\(([-+\d.e%\s,\/degturnrad]+)\)$/.exec(s);
  if (!m) return false;
  const parts = m[2]!.trim().split(/[\s,\/]+/);
  if (parts.length < 3 || parts.length > 4) return false;
  return parts.every(part => /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?(?:%|deg|turn|rad)?$/.test(part) && Number.isFinite(Number(part.replace(/(?:%|deg|turn|rad)$/,''))));
}

export function validatePaint(paint: unknown, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (typeof paint === "string") {
    if (!isValidColor(paint)) issues.push({ severity: "error", path, message: "legacy string fill must be a CSS color" });
    return issues;
  }
  if (typeof paint !== "object" || paint === null) {
    return [{ severity: "error", path, message: "paint must be an object or CSS color string" }];
  }
  const p = paint as Record<string, unknown>;
  switch (p.type) {
    case "solid":
      if (!isValidColor(p.color)) issues.push({ severity: "error", path: `${path}.color`, message: "must be a CSS color" });
      break;
    case "linear":
    case "radial":
    case "conic": {
      if (!Array.isArray(p.stops) || p.stops.length < 2) {
        issues.push({ severity: "error", path: `${path}.stops`, message: "gradient needs at least 2 stops" });
      } else {
        p.stops.forEach((s: unknown, i: number) => {
          const st = s as Record<string, unknown>;
          if (!isValidColor(st?.color)) issues.push({ severity: "error", path: `${path}.stops[${i}].color`, message: "must be a CSS color" });
          if (typeof st?.offset !== "number" || !Number.isFinite(st.offset) || st.offset < 0 || st.offset > 1)
            issues.push({ severity: "error", path: `${path}.stops[${i}].offset`, message: "must be in [0,1]" });
        });
      }
      if (p.type !== "radial" && (typeof p.angle !== "number" || !Number.isFinite(p.angle)))
        issues.push({ severity: "error", path: `${path}.angle`, message: "must be a number (degrees)" });
      break;
    }
    case "animated": {
      const inner = p.base as Record<string, unknown> | undefined;
      if (!inner || inner.type !== "linear") {
        issues.push({ severity: "error", path: `${path}.base`, message: "animated paint needs a linear gradient base" });
      }
      if (inner) issues.push(...validatePaint(inner,`${path}.base`));
      if (typeof p.duration !== "number" || !Number.isFinite(p.duration) || p.duration <= 0)
        issues.push({ severity: "error", path: `${path}.duration`, message: "must be a number > 0 (seconds)" });
      if (!["hue-cycle", "gradient-drift", "color-pulse", "aurora", "light-sweep", "palette-cycle"].includes(p.mode as string))
        issues.push({ severity: "error", path: `${path}.mode`, message: "unknown animated paint mode" });
      break;
    }
    case "token":
      if (typeof p.token !== "string" || !p.token) issues.push({ severity: "error", path: `${path}.token`, message: "must name a brand token" });
      break;
    default:
      issues.push({ severity: "error", path, message: `unknown paint type ${JSON.stringify(p.type)}` });
  }
  return issues;
}

const NUM = (path: string, v: unknown, min?: number, max?: number): ValidationIssue[] => {
  if (typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > 1e9 || (min !== undefined && v < min) || (max !== undefined && v > max)) {
    return [{ severity: "error", path, message: `must be a number${min !== undefined ? ` >= ${min}` : ""}${max !== undefined ? ` <= ${max}` : ""}` }];
  }
  return [];
};

export function validateLayer(layer: unknown, path: string, depth = 0): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (depth > 32) return [{severity:"error",path,message:"layer nesting exceeds 32 levels"}];
  if (typeof layer !== "object" || layer === null) {
    return [{ severity: "error", path, message: "layer must be an object" }];
  }
  const l = layer as Record<string, unknown>;
  for (const key of ["id", "name", "type"] as const) {
    if (typeof l[key] !== "string" || (l[key] as string).length === 0) {
      issues.push({ severity: "error", path: `${path}.${key}`, message: `must be a non-empty string` });
    }
  }
  const known = ["rect", "text", "ellipse", "line", "image", "group"];
  if (!known.includes(l.type as string)) {
    issues.push({ severity: "error", path: `${path}.type`, message: `unknown layer type ${JSON.stringify(l.type)}` });
    return issues;
  }
  for (const key of ["visible", "locked"] as const) {
    if (typeof l[key] !== "boolean") issues.push({ severity: "error", path: `${path}.${key}`, message: "must be a boolean" });
  }
  issues.push(...NUM(`${path}.opacity`, l.opacity, 0, 1));
  issues.push(...NUM(`${path}.rotation`, l.rotation));
  if (l.fill !== undefined) issues.push(...validatePaint(l.fill, `${path}.fill`));
  if (l.type !== "group") {
    issues.push(...NUM(`${path}.x`, l.x));
    issues.push(...NUM(`${path}.y`, l.y));
  }

  if (l.type === "rect" || l.type === "ellipse" || l.type === "image") {
    issues.push(...NUM(`${path}.width`, l.width, 0));
    issues.push(...NUM(`${path}.height`, l.height, 0));
  }
  if (l.type === "rect" && l.cornerRadius !== undefined) issues.push(...NUM(`${path}.cornerRadius`, l.cornerRadius, 0));
  if (l.type === "line") {
    issues.push(...NUM(`${path}.x2`, l.x2));
    issues.push(...NUM(`${path}.y2`, l.y2));
    issues.push(...NUM(`${path}.strokeWidth`, l.strokeWidth, 0));
  }
  if (l.type === "image") {
    if (typeof l.src !== "string" || !l.src) issues.push({ severity: "error", path: `${path}.src`, message: "must be a data URL or path" });
    if (typeof l.src === "string" && l.src.startsWith("data:") && l.src.length > 8_000_000) {
      issues.push({ severity: "warning", path: `${path}.src`, message: "embedded image is very large (>6 MB)" });
    }
  }
  if (l.type === "text") {
    if (typeof l.text !== "string") issues.push({ severity: "error", path: `${path}.text`, message: "must be a string" });
    if (typeof l.fontFamily !== "string" || l.fontFamily.length === 0) issues.push({ severity: "error", path: `${path}.fontFamily`, message: "must be a non-empty string" });
    issues.push(...NUM(`${path}.fontSize`, l.fontSize, 1));
  }
  if (l.type === "rect" && l.border !== undefined && typeof l.border === "object" && l.border !== null) {
    const b = l.border as Record<string, unknown>;
    issues.push(...validatePaint(b.paint, `${path}.border.paint`));
    issues.push(...NUM(`${path}.border.width`, b.width, 0));
  }
  if (l.type === "group") {
    if (Array.isArray(l.children) && l.children.length > 2048) return [{severity:"error",path,message:"too many child layers"}];
    if (!Array.isArray(l.children)) {
      issues.push({ severity: "error", path: `${path}.children`, message: "group must have a children array" });
    } else {
      const ids = new Set<string>();
      l.children.forEach((child: unknown, ci: number) => {
        for (const issue of validateLayer(child, `${path}.children[${ci}]`, depth + 1)) issues.push(issue);
        const cid = (child as Partial<Layer>)?.id;
        if (typeof cid === "string") {
          if (ids.has(cid)) issues.push({ severity: "error", path: `${path}.children[${ci}].id`, message: "duplicate child id" });
          ids.add(cid);
        }
      });
    }
  }
  if (Array.isArray(l.effects)) {
    l.effects.forEach((e: unknown, i: number) => {
      const ef = e as Record<string, unknown>;
      if (!EFFECT_TYPES.includes(ef?.type as never)) {
        issues.push({ severity: "error", path: `${path}.effects[${i}].type`, message: "unknown effect type" });
      }
    });
  }
  if (Array.isArray(l.tracks)) {
    l.tracks.forEach((t: unknown, i: number) => {
      const tr = t as Record<string, unknown>;
      if (!["x", "y", "width", "height", "rotation", "opacity", "hue"].includes(tr?.prop as string)) {
        issues.push({ severity: "error", path: `${path}.tracks[${i}].prop`, message: "unknown animated property" });
      }
      if (!Array.isArray(tr?.keys) || tr.keys.length === 0) {
        issues.push({ severity: "error", path: `${path}.tracks[${i}].keys`, message: "track needs at least one keyframe" });
      }
    });
  }
  for (const key of ["fontWeight","letterSpacing","lineHeight","cornerRadius"]) {
    if (l[key] !== undefined) issues.push(...NUM(`${path}.${key}`,l[key]));
  }
  for (const key of ["params","corners","imageFit"]) {
    const value = l[key];
    if (value !== undefined && typeof value === 'object' && value !== null) {
      for (const [name,n] of Object.entries(value)) { if (key === "params" && typeof n === "string" && isValidColor(n)) continue; issues.push(...NUM(`${path}.${key}.${name}`,n)); }
    }
  }
  if (l.border && typeof l.border === 'object' && 'opacity' in l.border) issues.push(...NUM(`${path}.border.opacity`,(l.border as Record<string,unknown>).opacity,0,1));
  if (l.stroke !== undefined) issues.push(...validatePaint(l.stroke,`${path}.stroke`));
  if (Array.isArray(l.effects)) for (const [i,fx] of l.effects.entries()) {
    if (fx?.color !== undefined && !isValidColor(fx.color)) issues.push({severity:'error',path:`${path}.effects[${i}].color`,message:'must be a CSS colour'});
    for (const [key,value] of Object.entries(fx?.params ?? {})) issues.push(...NUM(`${path}.effects[${i}].params.${key}`,value));
  }
  if (Array.isArray(l.tracks)) for (const [i,tr] of l.tracks.entries()) {
    if (Array.isArray(tr?.keys)) {
      if (tr.keys.length > 2048) issues.push({severity:'error',path:`${path}.tracks[${i}]`,message:'too many keyframes'});
      for (const [j,key] of tr.keys.entries()) { issues.push(...NUM(`${path}.tracks[${i}].keys[${j}].t`,key?.t,0)); issues.push(...NUM(`${path}.tracks[${i}].keys[${j}].value`,key?.value)); }
    }
  }
  if (l.behaviors !== undefined && !Array.isArray(l.behaviors)) issues.push({severity:'error',path:`${path}.behaviors`,message:'must be an array'});
  if (Array.isArray(l.behaviors)) {
    if (l.behaviors.length > 64) issues.push({severity:'error',path:`${path}.behaviors`,message:'too many behaviours'});
    for (const [i,b] of l.behaviors.entries()) {
      issues.push(...NUM(`${path}.behaviors[${i}].speed`,b?.speed,.01,10));
      issues.push(...NUM(`${path}.behaviors[${i}].amount`,b?.amount,0,100));
      if (b?.delay !== undefined) issues.push(...NUM(`${path}.behaviors[${i}].delay`,b.delay,0,3600));
      if (b?.loops !== undefined) issues.push(...NUM(`${path}.behaviors[${i}].loops`,b.loops,0,10000));
    }
  }
  return issues;
}

export function validateBannerSpec(doc: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (typeof doc !== "object" || doc === null) {
    return [{ severity: "error", path: "$", message: "document must be an object" }];
  }
  const d = doc as Record<string, unknown>;
  if (typeof d.specVersion !== "string") {
    issues.push({ severity: "error", path: "$.specVersion", message: "missing specVersion" });
  } else if (!(SUPPORTED_SPEC_VERSIONS as readonly string[]).includes(d.specVersion)) {
    issues.push({
      severity: "error",
      path: "$.specVersion",
      message: `unsupported specVersion ${d.specVersion} (supported: ${SUPPORTED_SPEC_VERSIONS.join(", ")})`,
    });
  }
  const canvas = d.canvas as Record<string, unknown> | undefined;
  if (typeof canvas !== "object" || canvas === null) {
    issues.push({ severity: "error", path: "$.canvas", message: "canvas must be an object" });
  } else {
    for (const key of ["width", "height"] as const) {
      const v = canvas[key];
      if (typeof v !== "number" || !Number.isFinite(v) || v <= 0 || v > 16384) {
        issues.push({ severity: "error", path: `$.canvas.${key}`, message: "must be a number in (0, 16384]" });
      }
    }
    if (canvas.background !== undefined && !isValidColor(canvas.background)) {
      issues.push({ severity: "error", path: "$.canvas.background", message: "must be a CSS color string" });
    }
    if (canvas.shape !== undefined && !["rectangle", "rounded", "cut", "ticket", "notched"].includes(canvas.shape as string)) {
      issues.push({ severity: "error", path: "$.canvas.shape", message: "must be one of rectangle | rounded | cut | ticket | notched" });
    }
  }
  if (!Array.isArray(d.layers)) {
    issues.push({ severity: "error", path: "$.layers", message: "layers must be an array" });
  } else {
    if (d.layers.length > 2048) return [{severity:"error",path:"$.layers",message:"too many layers"}];
    const ids = new Set<string>();
    d.layers.forEach((layer, i) => {
      const path = `$.layers[${i}]`;
      for (const issue of validateLayer(layer, path)) issues.push(issue);
      const id = (layer as Partial<Layer>)?.id;
      if (typeof id === "string") {
        if (ids.has(id)) issues.push({ severity: "error", path: `${path}.id`, message: `duplicate layer id ${id}` });
        ids.add(id);
      }
    });
  }
  if (d.animation !== undefined) {
    const a = (d.animation ?? {}) as Record<string, unknown>;
    if (typeof a.duration !== "number" || !Number.isFinite(a.duration) || a.duration <= 0 || a.duration > 3600) {
      issues.push({ severity: "error", path: "$.animation.duration", message: "must be a number > 0 (seconds)" });
    }
  }
  if (d.brand && typeof d.brand === 'object') for (const [key,value] of Object.entries(d.brand)) {
    if (!isValidColor(value)) issues.push({severity:'error',path:`$.brand.${key}`,message:'must be a CSS colour'});
  }
  if (canvas?.shapeRadius !== undefined) issues.push(...NUM('$.canvas.shapeRadius',canvas.shapeRadius,0));
  return issues;
}

export function hasErrors(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}

/** Default valid document, used for "new project". */
export function emptyBannerSpec(): BannerSpecDocument {
  return {
    specVersion: BANNERSPEC_VERSION,
    canvas: { width: 1200, height: 350, background: "#0f1420" },
    layers: [],
    brand: { primary: "#5b8cff", secondary: "#8a63ff", accent: "#3ecf8e", text: "#ffffff", muted: "#8b93a1" },
    animation: { duration: 8, loop: true },
  };
}

export { asPaint };
export type { Paint };
