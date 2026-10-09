/**
 * Validated application preferences — 0.2.6-dev foundation.
 *
 * Rules enforced here (never elsewhere):
 *  - Persisted prefs are NEVER trusted blindly: every field is validated and
 *    out-of-range/unknown values fall back to defaults.
 *  - Transient UI state (open overlays, modals, palettes, tours, toasts…) is
 *    structurally absent from the schema, so it can never survive a restart.
 *  - Migrations run through an explicit settingsSchemaVersion ladder; 0.2.4-era
 *    junk (cursor coordinates, overlay flags, stale ambience representation)
 *    is dropped once, then the clean v2 schema is written back.
 */
import { loadJSON, saveJSON, hasTauri } from "./storage.js";

export const SETTINGS_SCHEMA_VERSION = 2;

export interface AppPrefs {
  customAppearance: string;
  theme: "system" | "dark" | "light";
  density: "comfortable" | "compact";
  reducedMotion: boolean;
  highContrast: boolean;
  tooltipDelay: number;
  showSmartGuides: boolean;
  snapStrength: number;
  defaultExperience: "quick" | "advanced";
  autosaveInterval: number;
  loopPreview: boolean;
  cardHoverAnimation: boolean;
  exportFolder: string;
  openFolderAfterExport: boolean;
  staticFallback: boolean;
  updateChannel: "stable" | "preview" | "dev";
  autoCheckUpdates: boolean;
  githubUsername: string;
  appTheme: import("./themes.js").StudioThemeId;
  ambience: "none" | "soft-glow" | "forest" | "aurora" | "warm-lamp" | "night-blue";
  accent: string;
  contrast: "low" | "normal" | "high";
  uiGlow: "off" | "subtle" | "strong";
  cursorGlow: "off" | "subtle" | "glow";
}

export const DEFAULT_PREFS: AppPrefs = {
  customAppearance: "",
  theme: "dark", density: "comfortable", reducedMotion: false, highContrast: false,
  tooltipDelay: 400, showSmartGuides: true, snapStrength: 8, defaultExperience: "quick",
  autosaveInterval: 2500, loopPreview: true, cardHoverAnimation: true,
  exportFolder: "", openFolderAfterExport: true, staticFallback: true,
  updateChannel: "dev", autoCheckUpdates: true, githubUsername: "",
  appTheme: "graphite", ambience: "none",
  accent: "", contrast: "normal", uiGlow: "subtle", cursorGlow: "off",
};

/** Keys of the known string-enum fields → their allowed values. */
const ENUMS: Partial<Record<keyof AppPrefs, readonly string[]>> = {
  theme: ["system", "dark", "light"],
  density: ["comfortable", "compact"],
  defaultExperience: ["quick", "advanced"],
  updateChannel: ["stable", "preview", "dev"],
  appTheme: ["graphite", "midnight", "oled", "frost", "cyber", "forest", "warm", "studio-light", "terminal", "slate", "plum", "espresso"],
  ambience: ["none", "soft-glow", "forest", "aurora", "warm-lamp", "night-blue"],
  contrast: ["low", "normal", "high"],
  uiGlow: ["off", "subtle", "strong"],
  cursorGlow: ["off", "subtle", "glow"],
};

/** Numeric fields with [min, max] clamps. */
const NUM_RANGES: Partial<Record<keyof AppPrefs, [number, number]>> = {
  tooltipDelay: [0, 2000],
  snapStrength: [0, 24],
  autosaveInterval: [500, 15000],
};

const BOOL_KEYS = new Set<keyof AppPrefs>([
  "reducedMotion", "highContrast", "showSmartGuides", "loopPreview",
  "cardHoverAnimation", "openFolderAfterExport", "staticFallback", "autoCheckUpdates",
]);

const STRING_KEYS = new Set<keyof AppPrefs>(["exportFolder", "githubUsername", "accent", "customAppearance"]);

export interface PrefsValidationResult {
  prefs: AppPrefs;
  ok: boolean;               // true when input was already a clean v2 schema
  resetFields: string[];     // fields that failed validation and were defaulted
  migratedFrom: number | null; // schema version found on disk (null = none)
}

/** Validate + migrate a raw persisted object into a trustworthy AppPrefs. */
export function validatePrefs(raw: unknown): PrefsValidationResult {
  const resetFields: string[] = [];
  const out: AppPrefs = { ...DEFAULT_PREFS };
  const obj = (raw && typeof raw === "object" && !Array.isArray(raw))
    ? (raw as Record<string, unknown>) : {};
  const migratedFrom = typeof obj.settingsSchemaVersion === "number"
    ? (obj.settingsSchemaVersion as number) : null;

  // 0.2.4 → 0.2.5 migration: drop legacy keys that have no place in v2.
  // (Cursor-glow coordinates, overlay/modal flags, old ambience payloads.)
  const legacy = ["cursorGlowX", "cursorGlowY", "overlayOpen", "settingsOpen",
    "paletteOpen", "modalOpen", "tourOpen", "toastStack", "ambienceParams",
    "lastAmbienceRoot", "windowState"];
  for (const k of legacy) delete obj[k];

  for (const key of Object.keys(DEFAULT_PREFS) as (keyof AppPrefs)[]) {
    const v = obj[key];
    if (key in ENUMS) {
      const allowed = ENUMS[key]!;
      if (typeof v === "string" && allowed.includes(v)) {
        (out[key] as unknown) = v;
      } else {
        resetFields.push(key);
      }
    } else if (key in NUM_RANGES) {
      const [min, max] = NUM_RANGES[key]!;
      if (typeof v === "number" && Number.isFinite(v)) {
        (out[key] as unknown) = Math.min(max, Math.max(min, v));
      } else {
        resetFields.push(key);
      }
    } else if (BOOL_KEYS.has(key)) {
      if (typeof v === "boolean") (out[key] as unknown) = v;
      else resetFields.push(key);
    } else if (STRING_KEYS.has(key)) {
      if (v === undefined || v === null) {
        // absent optional string = default (not a corruption signal)
      } else if (typeof v === "string") {
        (out[key] as unknown) = key === "accent" && !/^#[0-9a-fA-F]{6}$/.test(v) && v !== "" ? "" : v;
      } else {
        resetFields.push(key);
      }
    }
  }
  const ok = resetFields.length === 0 && migratedFrom === SETTINGS_SCHEMA_VERSION;
  return { prefs: out, ok, resetFields, migratedFrom };
}

const PREFS_NAME = "app-prefs";

/** Load prefs from app-data with full validation. Never throws. */
export async function loadValidatedPrefs(): Promise<PrefsValidationResult> {
  let raw: unknown = null;
  if (hasTauri) {
    raw = await loadJSON<unknown>(PREFS_NAME);
  } else {
    try {
      const ls = localStorage.getItem("pcs-app-prefs");
      raw = ls ? JSON.parse(ls) : null;
    } catch { raw = null; }
  }
  const result = validatePrefs(raw);
  if (!result.ok && raw != null) {
    // R4: log without leaking private data — field names only.
    console.warn("[prefs] invalid preference reset:", result.resetFields.join(","),
      "schema:", result.migratedFrom, "→", SETTINGS_SCHEMA_VERSION);
  }
  // Persist the clean schema immediately (migration R95 + version stamp R96).
  await saveJSON(PREFS_NAME, { ...result.prefs, settingsSchemaVersion: SETTINGS_SCHEMA_VERSION });
  return result;
}

/** Persist prefs with the schema version stamped. */
export async function persistPrefs(p: AppPrefs): Promise<void> {
  await saveJSON(PREFS_NAME, { ...p, settingsSchemaVersion: SETTINGS_SCHEMA_VERSION });
}

// ---------------------------------------------------------------------------
// Window bounds sanitization (R21/R76/R77) — pure, unit-testable core.
// ---------------------------------------------------------------------------

export interface WindowBounds { x: number; y: number; width: number; height: number; maximized?: boolean }
export interface MonitorInfo { x: number; y: number; width: number; height: number }

export const MIN_WINDOW_W = 960;
export const MIN_WINDOW_H = 640;

/** Clamp/repair persisted bounds against the set of available monitors.
 *  Returns null when input is unusable garbage (caller uses defaults). */
export function sanitizeBounds(
  b: unknown,
  monitors: MonitorInfo[],
): WindowBounds | null {
  if (!b || typeof b !== "object") return null;
  const { x, y, width, height, maximized } = b as Record<string, unknown>;
  if (![x, y, width, height].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  if (monitors.length === 0) return null;
  const W = width as number, H = height as number;

  // Tiny/negative-sized window → unusable.
  const w = Math.max(MIN_WINDOW_W, Math.round(W));
  const h = Math.max(MIN_WINDOW_H, Math.round(H));

  const visibleOn = (mx: number, my: number) =>
    monitors.some((m) =>
      mx + Math.min(120, w / 2) > m.x && mx < m.x + m.width - 40 &&
      my + 40 > m.y && my < m.y + m.height - 60);

  let nx = Math.round(x as number), ny = Math.round(y as number);
  if (!visibleOn(nx, ny)) {
    // Prefer the monitor nearest to the saved point; else primary.
    const cx = nx + w / 2, cy = ny + h / 2;
    let best = monitors[0]!, bestD = Infinity;
    for (const m of monitors) {
      const d = Math.hypot(m.x + m.width / 2 - cx, m.y + m.height / 2 - cy);
      if (d < bestD) { bestD = d; best = m; }
    }
    nx = best.x + Math.max(0, Math.round((best.width - w) / 2));
    ny = best.y + Math.max(0, Math.round((best.height - h) / 2));
  }
  return { x: nx, y: ny, width: w, height: h, maximized: maximized === true };
}

/** Global safe-mode flag, set once at boot from the native side. */
let safeModeActive = false;
export function setSafeMode(v: boolean): void { safeModeActive = v; }
export function isSafeMode(): boolean { return safeModeActive; }

/** Prefs a Safe Mode boot applies: neutral chrome, no ambience/effects. */
export function safeModePrefs(p: AppPrefs): AppPrefs {
  return { ...p, ambience: "none", cursorGlow: "off", uiGlow: "off", reducedMotion: true };
}

let activePrefs: AppPrefs = {...DEFAULT_PREFS};
export function setRuntimePrefs(p:AppPrefs){activePrefs=p;}
export function runtimePrefs(){return activePrefs;}
