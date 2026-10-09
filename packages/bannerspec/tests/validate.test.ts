import { describe, expect, it } from "vitest";
import {
  BANNERSPEC_VERSION,
  emptyBannerSpec,
  hasErrors,
  isValidColor,
  validateBannerSpec,
} from "../src/index.js";

describe("emptyBannerSpec", () => {
  it("produces a valid 0.1 document", () => {
    const doc = emptyBannerSpec();
    expect(doc.specVersion).toBe(BANNERSPEC_VERSION);
    expect(hasErrors(validateBannerSpec(doc))).toBe(false);
  });
});

describe("validateBannerSpec", () => {
  const goodRect = {
    id: "a", type: "rect", name: "R", visible: true, locked: false,
    opacity: 1, rotation: 0, fill: "#3355ff",
    x: 0, y: 0, width: 100, height: 50, cornerRadius: 4,
  };
  const goodText = {
    id: "b", type: "text", name: "T", visible: true, locked: false,
    opacity: 1, rotation: 0, fill: "#ffffff",
    x: 10, y: 10, text: "hello", fontFamily: "Inter", fontSize: 32, fontWeight: 600,
  };

  const base = () => ({
    specVersion: "0.1",
    canvas: { width: 1200, height: 350, background: "#0f1420" },
    layers: [goodRect, goodText],
  });

  it("accepts a valid document", () => {
    expect(hasErrors(validateBannerSpec(base()))).toBe(false);
  });

  it("rejects unsupported spec versions", () => {
    const issues = validateBannerSpec({ ...base(), specVersion: "9.9" });
    expect(hasErrors(issues)).toBe(true);
    expect(issues[0]?.message).toContain("unsupported specVersion");
  });

  it("rejects duplicate layer ids", () => {
    const doc = base();
    doc.layers = [goodRect, { ...goodRect }];
    const issues = validateBannerSpec(doc);
    expect(issues.some((i) => i.message.startsWith("duplicate layer id"))).toBe(true);
  });

  it("rejects out-of-range opacity and canvas size", () => {
    const doc = base();
    (doc.layers[0] as { opacity: number }).opacity = 1.5;
    (doc.canvas as { width: number }).width = 99999;
    const issues = validateBannerSpec(doc);
    expect(issues.some((i) => i.path.includes("opacity"))).toBe(true);
    expect(issues.some((i) => i.path === "$.canvas.width")).toBe(true);
  });

  it("rejects rect with negative width and text without text", () => {
    const issues = validateBannerSpec({
      ...base(),
      layers: [{ ...goodRect, width: -1 }, { ...goodText, text: undefined }],
    });
    expect(issues.some((i) => i.path.endsWith(".width"))).toBe(true);
    expect(issues.some((i) => i.path.endsWith(".text"))).toBe(true);
  });

  it("flags but does not error on unknown future layer types as errors only", () => {
    const issues = validateBannerSpec({
      ...base(),
      layers: [{ ...goodRect, type: "gadget" }],
    });
    expect(issues.some((i) => i.message.includes("unknown layer type"))).toBe(true);
  });
});

describe("isValidColor", () => {
  it("accepts CSS color forms", () => {
    expect(isValidColor("#fff")).toBe(true);
    expect(isValidColor("#0f1420")).toBe(true);
    expect(isValidColor("#11223344")).toBe(true);
    expect(isValidColor("rgb(10, 20, 30)")).toBe(true);
    expect(isValidColor("rgba(1,2,3,0.5)")).toBe(true);
    expect(isValidColor("transparent")).toBe(true);
  });
  it("rejects non-colors", () => {
    expect(isValidColor("javascript:alert(1)")).toBe(false);
    expect(isValidColor("#12345")).toBe(false);
    expect(isValidColor(123)).toBe(false);
    expect(isValidColor("url(x)")).toBe(false);
  });
});
