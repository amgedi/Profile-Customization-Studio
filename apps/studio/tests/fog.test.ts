/**
 * Fog weather config — generation + serialization round-trip.
 * The fog config lives in group params (a generic number map), so it must
 * survive save/load (JSON) untouched and keep rendering after a round-trip.
 */
import { describe, expect, it } from "vitest";
import { validateBannerSpec, type BannerSpecDocument } from "@pcs/bannerspec";
import { renderSvg } from "@pcs/scene-core";
import { FOG_PRESETS, generateGroupChildren, makeGroup, type GroupParams } from "../src/scenegen.js";

const W = 800, H = 350;

const fogDoc = (): BannerSpecDocument => ({
  specVersion: "0.3",
  canvas: { width: W, height: H, background: "#0f1420" },
  brand: { primary: "#5b8cff" },
  animation: { duration: 8, loop: true },
  layers: [
    makeGroup("fog", "Fog", { ...FOG_PRESETS[3]!.params, seed: 42 }, W, H),
  ],
});

describe("fog generation", () => {
  it("every preset yields layered smooth fog fields (no blurred ellipse blobs)", () => {
    for (const preset of FOG_PRESETS) {
      const children = generateGroupChildren("fog", { ...preset.params, seed: 7 } as GroupParams, W, H);
      expect(children.length).toBeGreaterThanOrEqual(3); // haze + banks + wisps
      for (const c of children as unknown as Array<Record<string, unknown>>) {
        expect(c.type).toBe("rect");
        const effects = c.effects as Array<{ type: string; params: Record<string, number> }>;
        expect(effects?.[0]?.type).toBe("fog-fx"); // turbulence mist, not blur shapes
        expect(effects?.[0]?.params.seed).toBeDefined();
        // drift tracks ping-pong: the drift starts and ends at the same x
        const track = (c.tracks as Array<{ prop: string; keys: Array<{ t: number; value: number }> }>).find((t) => t.prop === "x")!;
        expect(track.keys[0]!.value).toBe(track.keys[track.keys.length - 1]!.value);
      }
    }
  });

  it("fog presets stay visually distinct (density/height/tint differ)", () => {
    const tints = new Set(FOG_PRESETS.map((p) => p.params.tint));
    expect(tints.size).toBe(FOG_PRESETS.length);
    const densities = FOG_PRESETS.map((p) => p.params.density ?? 0);
    expect(Math.max(...densities) - Math.min(...densities)).toBeGreaterThan(0.2);
  });
});

describe("fog serialization", () => {
  it("config survives a save/load JSON round-trip and still validates + renders", () => {
    const doc = fogDoc();
    const loaded = JSON.parse(JSON.stringify(doc)) as BannerSpecDocument;
    const group = loaded.layers[0] as unknown as { params: Record<string, number> };
    expect(group.params.density).toBeDefined();
    expect(group.params.tint).toBe(FOG_PRESETS[3]!.params.tint);
    expect(hasErrors(validateBannerSpec(loaded))).toBe(false);
    const before = renderSvg(doc, { time: 2 });
    const after = renderSvg(loaded, { time: 2 });
    expect(after).toBe(before); // identical frames — nothing lost in transit
  });

  it("renders fractal-noise fog with SMIL drift, matching the rain animation mechanism", () => {
    const doc = fogDoc();
    const svg = renderSvg(doc, { animate: true });
    expect(svg).toContain("feTurbulence");
    expect(svg).toContain("fractalNoise");
    expect(svg).toContain("animateTransform");
  });
});

function hasErrors(issues: ReturnType<typeof validateBannerSpec>): boolean {
  return issues.some((i) => i.severity === "error");
}
