import { describe, expect, it } from "vitest";
import { defaultLevels, renderSimSvg, rng, runSimulation, seedFromString } from "../src/index.js";
import type { SimConfig } from "../src/index.js";

const config = (over: Partial<SimConfig> = {}): SimConfig => ({
  mode: "snake-classic",
  seed: 12345,
  weeks: 20,
  duration: 6,
  fps: 12,
  levels: defaultLevels(20, 42),
  ...over,
});

describe("deterministic simulations", () => {
  it("same seed produces identical frames", () => {
    const a = runSimulation(config());
    const b = runSimulation(config());
    expect(a.frames).toEqual(b.frames);
  });

  it("different seeds produce different frames", () => {
    const a = runSimulation(config({ seed: 1 }));
    const b = runSimulation(config({ seed: 2 }));
    expect(JSON.stringify(a.frames)).not.toBe(JSON.stringify(b.frames));
  });

  it("seedFromString is stable", () => {
    expect(seedFromString("rainy-room")).toBe(seedFromString("rainy-room"));
    expect(seedFromString("a")).not.toBe(seedFromString("b"));
  });

  it("all snake variants and tetris produce frames", () => {
    for (const mode of ["snake-classic", "snake-long", "snake-random", "tetris"] as const) {
      const r = runSimulation(config({ mode }));
      expect(r.frames.length).toBeGreaterThan(8);
      expect(r.frames.every((f) => f.actor.length > 0)).toBe(true);
    }
  });

  it("rng stays within [0,1)", () => {
    const r = rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("renderSimSvg", () => {
  it("static render shows one frame; animated render shows SMIL", () => {
    const r = runSimulation(config());
    const still = renderSimSvg(r, { cell: 10, gap: 2, palette: ["#111", "#222", "#333", "#444", "#555"], snakeColor: "#39d353", glow: false, background: "#0f1420" });
    expect(still).toContain("<svg");
    expect(still).not.toContain("<animate");

    const anim = renderSimSvg(r, { cell: 10, gap: 2, palette: ["#111", "#222", "#333", "#444", "#555"], snakeColor: "#39d353", glow: true, background: "#0f1420" }, true);
    expect(anim).toContain("<animate");
    expect(anim).toContain("sim-glow");
  });
});
