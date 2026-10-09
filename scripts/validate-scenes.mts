import { validateBannerSpec } from "../packages/bannerspec/src/index.js";
import { SCENE_LIBRARY, lofiScene } from "../apps/studio/src/sceneLibrary.js";
import { generateGroupChildren } from "../apps/studio/src/scenegen.js";
import type { GroupKind } from "../packages/bannerspec/src/index.js";
const doc = lofiScene({ view: "city", weather: "rain", time: "night", lighting: "monitor", decor: "coffee" })(1200, 350);
const errs = validateBannerSpec(doc).filter((i) => i.severity === "error");
console.log("lofi errors:", JSON.stringify(errs, null, 1).slice(0, 1600));
for (const s of SCENE_LIBRARY) {
  const d = s.make(1200, 350);
  const e = validateBannerSpec(d).filter((i) => i.severity === "error");
  if (e.length) console.log(s.id, "→", JSON.stringify(e).slice(0, 300));
}
const kids = generateGroupChildren("rain" as GroupKind, { count: 10, speed: 1, intensity: 1, seed: 1 }, 1200, 350);
const e2 = validateBannerSpec({ specVersion: "0.3", canvas: { width: 1200, height: 350, background: "#000" }, layers: [{ id: "g", type: "group", name: "Rain", kind: "rain", visible: true, locked: false, opacity: 1, rotation: 0, children: kids }] }).filter((i) => i.severity === "error");
console.log("rain group errors:", JSON.stringify(e2).slice(0, 400));
