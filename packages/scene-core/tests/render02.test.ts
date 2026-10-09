import { describe, expect, it } from "vitest";
import { linear, type BannerSpecDocument } from "@pcs/bannerspec";
import { renderSvg, SceneStore } from "../src/index.js";

const gradientDoc = (): BannerSpecDocument => ({
  specVersion: "0.2",
  canvas: { width: 400, height: 200, background: "#101216" },
  brand: { primary: "#5b8cff" },
  animation: { duration: 6, loop: true },
  layers: [
    {
      id: "g1", type: "rect", name: "Grad", visible: true, locked: false,
      opacity: 1, rotation: 0, x: 0, y: 0, width: 400, height: 200,
      fill: linear([{ color: "#5b8cff", offset: 0 }, { color: "#ff5577", offset: 1 }], 25),
    },
    {
      id: "k1", type: "rect", name: "Keyframed", visible: true, locked: false,
      opacity: 1, rotation: 0, x: 0, y: 80, width: 60, height: 40,
      fill: { type: "solid", color: "#ffffff" },
      tracks: [
        { prop: "x", keys: [{ t: 0, value: 0 }, { t: 3, value: 300 }, { t: 6, value: 0 }] },
        { prop: "opacity", keys: [{ t: 0, value: 0 }, { t: 1.5, value: 1 }] },
      ],
      effects: [{ id: "e1", type: "glow", visible: true, params: { amount: 10 } }],
    },
  ],
});

describe("renderSvg 0.2", () => {
  it("renders gradients into defs", () => {
    const svg = renderSvg(gradientDoc());
    expect(svg).toContain("linearGradient");
    expect(svg).toContain('stop-color="#5b8cff"');
  });

  it("resolves token paints from the brand kit", () => {
    const doc = gradientDoc();
    doc.layers = [{
      id: "t", type: "rect", name: "T", visible: true, locked: false,
      opacity: 1, rotation: 0, x: 0, y: 0, width: 100, height: 100,
      fill: { type: "token", token: "primary" },
    }];
    expect(renderSvg(doc)).toContain('fill="#5b8cff"');
  });

  it("samples keyframes at a static time", () => {
    const at3 = renderSvg(gradientDoc(), { time: 3 });
    expect(at3).toContain('x="300"');
    const at0 = renderSvg(gradientDoc(), { time: 0 });
    expect(at0).toContain('opacity="0"');
  });

  it("emits SMIL animation when requested", () => {
    const svg = renderSvg(gradientDoc(), { animate: true });
    expect(svg).toContain("<animate");
    expect(svg).toContain("repeatCount=\"indefinite\"");
  });

  it("renders effects as filters", () => {
    const svg = renderSvg(gradientDoc());
    expect(svg).toContain("<filter");
    expect(svg).toContain("feGaussianBlur");
  });
});

describe("SceneStore 0.2", () => {
  it("creates ellipse/line/image layers and manages effects", () => {
    const store = new SceneStore();
    store.addEllipse({});
    store.addLine({});
    const img = store.addImage({ src: "data:image/png;base64,AAAA" });
    expect(store.getDocument().layers).toHaveLength(3);
    store.addEffect(img, "shadow", { dy: 4 });
    expect(store.layerById(img)?.effects).toHaveLength(1);
    store.toggleEffect(img, store.layerById(img)!.effects![0]!.id);
    expect(store.layerById(img)!.effects![0]!.visible).toBe(false);
    store.removeEffect(img, store.layerById(img)!.effects![0]!.id);
    expect(store.layerById(img)?.effects).toHaveLength(0);
  });
});
