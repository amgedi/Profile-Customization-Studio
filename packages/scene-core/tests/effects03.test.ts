import { describe, expect, it } from "vitest";
import type { BannerSpecDocument } from "@pcs/bannerspec";
import { renderSvg } from "../src/render.js";

const doc = (effects: NonNullable<BannerSpecDocument["layers"][number]["effects"]>): BannerSpecDocument => ({
  specVersion: "0.3",
  canvas: { width: 300, height: 150, background: "#101216" },
  layers: [
    {
      id: "fx1", type: "rect", name: "R", visible: true, locked: false,
      opacity: 1, rotation: 0, x: 20, y: 20, width: 120, height: 60, cornerRadius: 8,
      fill: { type: "solid", color: "#5b8cff" },
      effects,
    },
  ],
  animation: { duration: 6, loop: true },
});

describe("extended effect library rendering", () => {
  const cases: Array<[string, NonNullable<BannerSpecDocument["layers"][number]["effects"]>, RegExp[]]> = [
    ["rim light", [{ id: "e", type: "rim", visible: true, params: {} }], [/feMorphology/, /feFlood flood-color="#cfe4ff"/]],
    ["electric", [{ id: "e", type: "electric", visible: true, params: {} }], [/feDisplacementMap/]],
    ["duotone", [{ id: "e", type: "duotone", visible: true, params: {}, color: "#ff5577" }], [/feComponentTransfer/, /feFuncR type="table"/]],
    ["rain-fx", [{ id: "e", type: "rain-fx", visible: true, params: { amount: 45 } }], [/clip-path=/, /<path d="M/]],
    ["scanlines", [{ id: "e", type: "scanlines", visible: true, params: {} }], [/clip-path=/, /stroke-width=/]],
    ["rgb-split", [{ id: "e", type: "rgb-split", visible: true, params: {} }], [/feOffset/, /mode="screen"/]],
    ["neon-border", [{ id: "e", type: "neon-border", visible: true, params: {}, color: "#4fd8ff" }], [/feMorphology/, /feFlood flood-color="#4fd8ff"/]],
    ["heavenly", [{ id: "e", type: "heavenly", visible: true, params: { amount: 40 } }], [/radialGradient/, /<circle/]],
    ["chrome", [{ id: "e", type: "chrome", visible: true, params: {} }], [/feSpecularLighting/]],
    ["fog-fx", [{ id: "e", type: "fog-fx", visible: true, params: {} }], [/feTurbulence/, /feDisplacementMap/, /feGaussianBlur/]],
  ];

  it.each(cases)("%s renders a meaningful filter", (_name, effects, patterns) => {
    const svg = renderSvg(doc(effects));
    expect(svg).toContain("<g");
    for (const p of patterns) expect(svg).toMatch(p);
  });

  it("still validates unknown effect types as errors (bannerspec whitelist)", async () => {
    const { validateBannerSpec, hasErrors } = await import("@pcs/bannerspec");
    const d = doc([{ id: "e", type: "bogus" as never, visible: true, params: {} }]);
    expect(hasErrors(validateBannerSpec(d))).toBe(true);
  });

  it("applies hue tracks via hueRotate at sampled times", () => {
    const d = doc([]);
    d.layers = [{
      id: "h", type: "rect", name: "H", visible: true, locked: false,
      opacity: 1, rotation: 0, x: 0, y: 0, width: 50, height: 50,
      fill: { type: "solid", color: "#ff0000" },
      tracks: [{ prop: "hue", keys: [{ t: 0, value: 0 }, { t: 6, value: 180 }] }],
    }];
    const svg = renderSvg(d, { time: 3 });
    expect(svg).toContain("hueRotate");
  });

  it("scales group children coherently (window behaves as one component)", () => {
    const d: BannerSpecDocument = {
      specVersion: "0.3",
      canvas: { width: 400, height: 200, background: "#101216" },
      layers: [{
        id: "win", type: "group", name: "Window view", kind: "scene",
        visible: true, locked: false, opacity: 1, rotation: 0,
        params: { scaleX: 1.5, scaleY: 1.5 },
        children: [
          { id: "v", type: "rect", name: "View", visible: true, locked: false, opacity: 1, rotation: 0, x: 100, y: 50, width: 100, height: 60, fill: { type: "solid", color: "#123456" } },
          { id: "f", type: "rect", name: "Window frame", visible: true, locked: false, opacity: 1, rotation: 0, x: 90, y: 40, width: 120, height: 80, fill: { type: "solid", color: "#1b2438" } },
        ],
      }],
    };
    const svg = renderSvg(d);
    expect(svg).toContain('scale(1.5 1.5)');
  });
});
