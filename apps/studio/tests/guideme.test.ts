import { describe, expect, it } from "vitest";
import { SCENE_LIBRARY } from "../src/sceneLibrary.js";
import {
  animationStack,
  applyPalette,
  vibeScenes,
  PALETTES,
  type Palette,
} from "../src/components/GuideMe.js";

describe("GuideMe vibeScenes", () => {
  it("maps vibes only to real, non-experimental scenes from the catalog", () => {
    const ids = new Set(SCENE_LIBRARY.map(scene => scene.id));
    for (const vibe of ["cozy", "minimal", "retro", "dark", "nature"]) {
      const hits = vibeScenes(vibe);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.every((s) => !s.experimental && ids.has(s.id))).toBe(true);
    }
    const minimal = vibeScenes("minimal");
    expect(minimal.some((s) => s.id === "editorial-black")).toBe(true);
    const retro = vibeScenes("retro");
    expect(retro.some((s) => s.id === "retro-terminal")).toBe(true);
  });
});

describe("GuideMe animationStack", () => {
  it("returns no behaviors for Still and a curated stack for higher levels", () => {
    expect(animationStack("still")).toEqual([]);
    expect(animationStack("subtle").map((b) => b.preset)).toEqual(["rise"]);
    expect(animationStack("animated").map((b) => b.preset)).toEqual(["rise", "float"]);
    expect(animationStack("lively").map((b) => b.preset)).toEqual(["rise", "float", "glow-pulse"]);
  });
});

describe("GuideMe applyPalette", () => {
  const palette: Palette = PALETTES.find((p) => p.id === "ocean")!;

  it("recolors text layers and brand tokens using real Paint shapes", () => {
    const doc = {
      specVersion: "0.3",
      canvas: { width: 1280, height: 640 },
      layers: [
        { id: "a", type: "text", name: "Title", visible: true, locked: false, opacity: 1, rotation: 0, x: 0, y: 0, text: "Hi", fontFamily: "x", fontSize: 40, fill: { type: "solid", color: "#ffffff" } },
        {
          id: "g", type: "group", name: "G", kind: "scene", visible: true, locked: false, opacity: 1, rotation: 0, params: {},
          children: [
            { id: "b", type: "text", name: "Subtitle", visible: true, locked: false, opacity: 1, rotation: 0, x: 0, y: 0, text: "sub", fontFamily: "x", fontSize: 20, fill: { type: "solid", color: "#8b93a1" } },
          ],
        },
      ],
    } as unknown as Parameters<typeof applyPalette>[0];

    applyPalette(doc, palette);
    expect(doc.layers[0]).toMatchObject({ fill: { type: "solid", color: palette.text } });
    const group = doc.layers[1] as { children: Array<{ fill: { color: string } }> };
    expect(group.children[0]!.fill.color).toBe(palette.muted);
    expect(doc.brand).toMatchObject({ text: palette.text, accent: palette.accent });
  });
});
