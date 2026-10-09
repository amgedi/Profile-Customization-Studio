import { describe, it, expect } from "vitest";
import {
  validatePrefs, DEFAULT_PREFS, sanitizeBounds, MIN_WINDOW_W, MIN_WINDOW_H,
  SETTINGS_SCHEMA_VERSION, safeModePrefs,
} from "../src/prefs.js";

describe("prefs validation (R4/R96)", () => {
  it("returns defaults for garbage input", () => {
    for (const raw of [null, undefined, 42, "x", [], { theme: 5 }]) {
      const r = validatePrefs(raw);
      expect(r.prefs).toEqual(DEFAULT_PREFS);
      expect(r.ok).toBe(false);
    }
  });

  it("accepts a clean v2 schema unchanged", () => {
    const clean = { ...DEFAULT_PREFS, settingsSchemaVersion: SETTINGS_SCHEMA_VERSION };
    const r = validatePrefs(clean);
    expect(r.ok).toBe(true);
    expect(r.prefs).toEqual(DEFAULT_PREFS);
  });

  it("rejects out-of-enum values and clamps numeric ranges", () => {
    const r = validatePrefs({
      theme: "purple", ambience: "lava", cursorGlow: "laser",
      snapStrength: 9999, autosaveInterval: -5, tooltipDelay: 40,
    });
    expect(r.prefs.theme).toBe("dark");
    expect(r.prefs.ambience).toBe("none");
    expect(r.prefs.cursorGlow).toBe("off");
    expect(r.prefs.snapStrength).toBe(24);
    expect(r.prefs.autosaveInterval).toBe(500);
    expect(r.prefs.tooltipDelay).toBe(40); // in-range values are kept
    expect(r.resetFields).toContain("theme");
  });

  it("drops legacy 0.2.4 keys (migration R95) and stamps the version", () => {
    const legacy = {
      ...DEFAULT_PREFS,
      cursorGlowX: 512, cursorGlowY: 300,
      settingsOpen: true, paletteOpen: true, overlayOpen: true, tourOpen: true,
      windowState: { garbage: true },
      ambienceParams: { x: 1 },
    };
    const r = validatePrefs(legacy);
    expect(r.prefs).toEqual(DEFAULT_PREFS);
    expect(r.migratedFrom).toBeNull(); // old file had no version stamp
  });

  it("never restores overlay/modal flags (R5)", () => {
    const r = validatePrefs({ ...DEFAULT_PREFS, settingsOpen: true, modalOpen: true });
    const keys = Object.keys(r.prefs);
    expect(keys).not.toContain("settingsOpen");
    expect(keys).not.toContain("modalOpen");
  });

  it("rejects an invalid accent but keeps a valid hex", () => {
    const r = validatePrefs({ ...DEFAULT_PREFS, accent: "red" });
    expect(r.prefs.accent).toBe("");
    const r2 = validatePrefs({ ...DEFAULT_PREFS, accent: "#7aa2ff" });
    expect(r2.prefs.accent).toBe("#7aa2ff");
  });
});

describe("window bounds sanitization (R21/R76/R77)", () => {
  const primary: Parameters<typeof sanitizeBounds>[1] = [{ x: 0, y: 0, width: 1920, height: 1080 }];
  const twoMonitors = [...primary, { x: 1920, y: 0, width: 1920, height: 1080 } as const];

  it("returns null for garbage or tiny inputs", () => {
    expect(sanitizeBounds(null, primary)).toBeNull();
    expect(sanitizeBounds({ x: 0, y: 0, width: "big", height: 5 }, primary)).toBeNull();
    expect(sanitizeBounds({ x: 0, y: 0, width: 10, height: 10 }, primary)).not.toBeNull();
  });

  it("lifts a tiny window to the minimum size", () => {
    const b = sanitizeBounds({ x: 10, y: 10, width: 200, height: 150 }, primary)!;
    expect(b.width).toBe(MIN_WINDOW_W);
    expect(b.height).toBe(MIN_WINDOW_H);
  });

  it("recenters a window saved on a disconnected monitor", () => {
    const b = sanitizeBounds({ x: 5000, y: 5000, width: 1440, height: 900 }, primary)!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(1920);
  });

  it("keeps a valid window on a secondary monitor", () => {
    const b = sanitizeBounds({ x: 2000, y: 100, width: 1440, height: 900 }, twoMonitors)!;
    expect(b.x).toBe(2000);
    expect(b.y).toBe(100);
  });
});

describe("safe mode prefs (R7/R43)", () => {
  it("disables ambience, cursor glow and UI glow, forces reduced motion", () => {
    const p = safeModePrefs({ ...DEFAULT_PREFS, ambience: "aurora", cursorGlow: "glow", uiGlow: "strong", reducedMotion: false });
    expect(p.ambience).toBe("none");
    expect(p.cursorGlow).toBe("off");
    expect(p.uiGlow).toBe("off");
    expect(p.reducedMotion).toBe(true);
  });
});
