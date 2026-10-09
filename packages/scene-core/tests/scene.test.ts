import { describe, expect, it } from "vitest";
import { emptyBannerSpec, hasErrors, validateBannerSpec } from "@pcs/bannerspec";
import { SceneStore } from "../src/store.js";
import { renderSvg } from "../src/render.js";

const doc = () => ({
  ...emptyBannerSpec(),
  layers: [
    {
      id: "r1", type: "rect" as const, name: "R", visible: true, locked: false,
      opacity: 1, rotation: 0, fill: "#3355ff", x: 10, y: 10, width: 100, height: 50, cornerRadius: 4,
    },
    {
      id: "t1", type: "text" as const, name: "T", visible: true, locked: false,
      opacity: 1, rotation: 0, fill: "#ffffff", x: 20, y: 60,
      text: "Hello <world>", fontFamily: "Inter", fontSize: 32, fontWeight: 600,
    },
  ],
});

describe("SceneStore", () => {
  it("adds layers and notifies subscribers", () => {
    const store = new SceneStore(emptyBannerSpec());
    let notified = 0;
    store.subscribe(() => notified++);
    const id = store.addRect({ x: 5 });
    expect(store.layerById(id)?.name).toBe("Rectangle");
    expect(notified).toBe(1);
    expect(hasErrors(validateBannerSpec(store.getDocument()))).toBe(false);
  });

  it("undoes and redoes add/remove", () => {
    const store = new SceneStore(doc() as never);
    const id = store.addText({ text: "x" });
    expect(store.getDocument().layers).toHaveLength(3);
    store.undo();
    expect(store.getDocument().layers).toHaveLength(2);
    store.redo();
    expect(store.getDocument().layers).toHaveLength(3);
    store.removeLayer(id);
    expect(store.getDocument().layers).toHaveLength(2);
    store.undo();
    expect(store.getDocument().layers).toHaveLength(3);
  });

  it("coalesces consecutive keyed edits into one undo step", () => {
    const store = new SceneStore(doc() as never);
    store.updateLayer("t1", { x: 30 }, "drag:t1");
    store.updateLayer("t1", { x: 40 }, "drag:t1");
    store.updateLayer("t1", { x: 50 }, "drag:t1");
    expect((store.layerById("t1") as { x: number }).x).toBe(50);
    store.undo();
    expect((store.layerById("t1") as { x: number }).x).toBe(20);
  });

  it("does not edit locked layers", () => {
    const d = doc();
    (d.layers[0] as { locked: boolean }).locked = true;
    const store = new SceneStore(d as never);
    store.updateLayer("r1", { x: 999 });
    expect((store.layerById("r1") as { x: number }).x).toBe(10);
    store.removeLayer("r1");
    expect(store.getDocument().layers).toHaveLength(2);
  });

  it("reorders layers within z-order", () => {
    const store = new SceneStore(doc() as never);
    store.reorderLayer("t1", 0);
    expect(store.getDocument().layers.map((l) => l.id)).toEqual(["t1", "r1"]);
    store.undo();
    expect(store.getDocument().layers.map((l) => l.id)).toEqual(["r1", "t1"]);
  });

  it("loadDocument replaces state and clears history", () => {
    const store = new SceneStore(doc() as never);
    store.addRect();
    store.loadDocument(emptyBannerSpec());
    expect(store.getDocument().layers).toHaveLength(0);
    expect(store.canUndo()).toBe(false);
  });
});

describe("renderSvg", () => {
  it("renders background and visible layers in z-order", () => {
    const svg = renderSvg(doc() as never, { editable: true });
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('fill="#0f1420"');
    const ri = svg.indexOf('data-layer-id="r1"');
    const ti = svg.indexOf('data-layer-id="t1"');
    expect(ri).toBeGreaterThan(-1);
    expect(ti).toBeGreaterThan(ri);
  });

  it("escapes XML in text and skips hidden layers", () => {
    const d = doc();
    (d.layers[0] as { visible: boolean }).visible = false;
    const svg = renderSvg(d as never, { editable: true });
    expect(svg).not.toContain('data-layer-id="r1"');
    expect(svg).toContain("Hello &lt;world&gt;");
  });
});
