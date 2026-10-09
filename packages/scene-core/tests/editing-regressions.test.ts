import { describe, expect, it } from "vitest";
import { emptyBannerSpec, type GroupLayer } from "@pcs/bannerspec";
import { SceneStore } from "../src/store.js";
import { renderSvg } from "../src/render.js";

describe("editing history invariants", () => {
  it("restores a deleted middle layer at its original z-order", () => {
    const store = new SceneStore(emptyBannerSpec());
    const ids = [store.addRect(), store.addRect(), store.addText()];
    store.removeLayer(ids[1]!); store.undo();
    expect(store.getDocument().layers.map(l => l.id)).toEqual(ids);
    store.redo(); expect(store.getDocument().layers.map(l => l.id)).toEqual([ids[0], ids[2]]);
  });
  it("coalesces mixed property edits without losing original or replayed values", () => {
    const store = new SceneStore(emptyBannerSpec());
    const id = store.addRect({ x: 10, y: 20 });
    store.updateLayer(id, { x: 30 }, "drag");
    store.updateLayer(id, { x: 40, y: 50 }, "drag");
    store.undo(); expect(store.layerById(id)).toMatchObject({ x: 10, y: 20 });
    store.redo(); expect(store.layerById(id)).toMatchObject({ x: 40, y: 50 });
  });
  it("allows unlocking while protecting other locked-layer edits", () => {
    const store = new SceneStore(emptyBannerSpec());
    const id = store.addRect({ locked: true, x: 10 });
    store.updateLayer(id, { x: 90 }); expect(store.layerById(id)).toMatchObject({ x: 10 });
    store.updateLayer(id, { locked: false }); store.updateLayer(id, { x: 90 });
    expect(store.layerById(id)).toMatchObject({ x: 90, locked: false });
  });
  it("edits and deletes nested children with reversible sibling order", () => {
    const store = new SceneStore(emptyBannerSpec());
    const a = store.addRect(), b = store.addText();
    const children = structuredClone(store.getDocument().layers);
    const group: GroupLayer = { id: "group", type: "group", name: "Group", visible: true, locked: false, opacity: 1, rotation: 0, children, kind: "scene", params: {} };
    store.loadDocument({ ...emptyBannerSpec(), layers: [group] });
    store.updateLayer(b, { name: "Nested title" }); expect(store.layerById(b)?.name).toBe("Nested title");
    store.removeLayer(a); expect(store.layerById(a)).toBeUndefined();
    store.undo(); expect((store.getDocument().layers[0] as GroupLayer).children.map(l => l.id)).toEqual([a,b]);
    store.undo(); expect(store.layerById(b)?.name).toBe("Text");
  });
  it("renders independently identifiable luminous effects without mutating the master", () => {
    const store = new SceneStore(emptyBannerSpec()); const id = store.addText({ text: "Light" });
    const results = new Set<string>();
    for (const type of ["glow", "bloom", "neon", "halo"] as const) {
      store.updateLayer(id, { effects: [{ id: "light", type, visible: true, color: "#38bdf8", params: {} }] });
      const before = JSON.stringify(store.getDocument());
      const svg = renderSvg(store.getDocument()); results.add(svg);
      expect(svg).toContain("<filter"); expect(svg).not.toContain("NaN");
      expect(JSON.stringify(store.getDocument())).toBe(before);
    }
    expect(results.size).toBe(4);
  });
});
