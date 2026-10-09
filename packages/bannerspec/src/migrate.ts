import type { BannerSpecDocument, Layer, Paint } from "./types.js";
import { validateBannerSpec } from "./validate.js";

/**
 * Migrate a loaded document to the newest supported spec version.
 * Non-destructive: returns a migrated copy; the caller decides what to persist.
 * 0.1 → 0.2: string fills become solid paints (strings are also accepted
 * as-is by the renderer, but migrated documents are canonical).
 */
export function migrateDocument(raw: unknown): { doc: BannerSpecDocument; from: string; to: string } {
  const d = raw as BannerSpecDocument;
  const from = d?.specVersion ?? "unknown";
  let doc: BannerSpecDocument = structuredClone(d);

  if (from === "0.1" || from === "0.2" || from === "unknown") {
    doc = {
      ...doc,
      specVersion: "0.3",
      layers: (doc.layers ?? []).map((l: Layer) => {
        const out = { ...l } as Layer & { fill?: string | Paint };
        if (typeof out.fill === "string" && out.fill) {
          // keep strings — renderer treats them as solid; mark canonical paint
          out.fill = { type: "solid", color: out.fill } as Paint;
        }
        return out;
      }),
      brand: doc.brand ?? {},
      animation: doc.animation ?? { duration: 8, loop: true },
    };
  }

  const issues = validateBannerSpec(doc);
  if (issues.some((i) => i.severity === "error")) {
    const first = issues.find((i) => i.severity === "error")!;
    throw new Error(`migration produced an invalid document: ${first.path} ${first.message}`);
  }
  return { doc, from, to: doc.specVersion };
}
