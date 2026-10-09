import { describe, expect, it } from "vitest";
import {
  emptyBannerSpec,
  hasErrors,
  linear,
  migrateDocument,
  validateBannerSpec,
  type BannerSpecDocument,
} from "../src/index.js";

describe("BannerSpec 0.2 paint model", () => {
  it("accepts gradient and animated paints", () => {
    const doc: BannerSpecDocument = {
      ...emptyBannerSpec(),
      layers: [
        {
          id: "g", type: "rect", name: "G", visible: true, locked: false,
          opacity: 1, rotation: 0,
          fill: linear([{ color: "#5b8cff", offset: 0 }, { color: "#8a63ff", offset: 1 }], 30),
          x: 0, y: 0, width: 400, height: 100,
        },
        {
          id: "a", type: "rect", name: "A", visible: true, locked: false,
          opacity: 1, rotation: 0,
          fill: { type: "animated", mode: "hue-cycle", base: linear([{ color: "#ff5577", offset: 0 }, { color: "#55ffaa", offset: 1 }], 0), duration: 6 },
          x: 0, y: 120, width: 400, height: 100,
        },
      ],
    };
    expect(hasErrors(validateBannerSpec(doc))).toBe(false);
  });

  it("rejects gradients with fewer than two stops and bad animated duration", () => {
    const issues = validateBannerSpec({
      ...emptyBannerSpec(),
      layers: [{
        id: "x", type: "rect", name: "X", visible: true, locked: false,
        opacity: 1, rotation: 0,
        fill: { type: "linear", stops: [{ color: "#fff", offset: 0 }], angle: 0 },
        x: 0, y: 0, width: 10, height: 10,
      }],
    });
    expect(issues.some((i) => i.message.includes("at least 2 stops"))).toBe(true);
  });

  it("still accepts legacy 0.1 string fills", () => {
    const issues = validateBannerSpec({
      specVersion: "0.1",
      canvas: { width: 100, height: 100, background: "#000" },
      layers: [{
        id: "r", type: "rect", name: "R", visible: true, locked: false,
        opacity: 1, rotation: 0, fill: "#3355ff", x: 0, y: 0, width: 10, height: 10, cornerRadius: 0,
      }],
    });
    expect(hasErrors(issues)).toBe(false);
  });
});

describe("migration → 0.3", () => {
  it("upgrades string fills to solid paints and adds defaults", () => {
    const old = {
      specVersion: "0.1",
      canvas: { width: 1200, height: 350, background: "#0f1420" },
      layers: [{
        id: "r", type: "rect", name: "R", visible: true, locked: false,
        opacity: 1, rotation: 0, fill: "#3355ff", x: 0, y: 0, width: 10, height: 10, cornerRadius: 0,
      }],
    };
    const { doc, from, to } = migrateDocument(old);
    expect(from).toBe("0.1");
    expect(to).toBe("0.3");
    expect(doc.layers[0]?.fill).toEqual({ type: "solid", color: "#3355ff" });
    expect(doc.animation).toBeDefined();
    expect(hasErrors(validateBannerSpec(doc))).toBe(false);
  });

  it("rejects documents it cannot make valid", () => {
    expect(() => migrateDocument({ specVersion: "0.1", canvas: { width: 0, height: 0 }, layers: [] })).toThrow();
  });
});
