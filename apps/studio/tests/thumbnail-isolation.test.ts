import { expect, it } from "vitest";
import { renderSvg } from "@pcs/scene-core";
import { SCENE_LIBRARY } from "../src/sceneLibrary.js";
import { svgToInline } from "../src/thumbnails.js";

it("isolates real scene thumbnail resources from the master and other previews", () => {
  const scene = SCENE_LIBRARY.find(scene => scene.id === "midnight-glass") ?? SCENE_LIBRARY[0]!;
  const master = renderSvg(scene.make(1280, 640), { editable: true });
  const poster = svgToInline(master), another = svgToInline(master);
  const ids = (svg: string) => [...svg.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]!);
  const all = [...ids(master), ...ids(poster), ...ids(another)];
  expect(ids(poster).length).toBeGreaterThan(0);
  expect(new Set(all).size).toBe(all.length);
  for (const ref of poster.matchAll(/url\(#([^)]+)\)/g)) expect(ids(poster)).toContain(ref[1]);
  expect(poster.match(/data-layer-id="([^"]+)"/)?.[1]).toBe(master.match(/data-layer-id="([^"]+)"/)?.[1]);
});
