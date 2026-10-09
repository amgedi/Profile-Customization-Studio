> Historical BannerSpec 0.1 reference. Current BannerSpec is 0.3; see `packages/bannerspec/src/types.ts`, validation and migrations for current behavior. This historical reference is retained for compatibility context.

# BannerSpec 0.1 (experimental)

BannerSpec is a portable, versioned, declarative format for banner scenes.
It must not depend on Studio internals. Studio 0.1 supports BannerSpec **0.1**.

## Document shape
```jsonc
{
  "specVersion": "0.1",
  "canvas": { "width": 1200, "height": 350, "background": "#0f1420" },
  "layers": [
    {
      "id": "uuid",
      "type": "rect",           // "rect" | "text" in 0.1
      "name": "Background panel",
      "visible": true,
      "locked": false,
      "opacity": 1,
      "x": 40, "y": 40, "width": 400, "height": 120,   // rect
      "rotation": 0,
      "fill": "#3355ff",
      "cornerRadius": 12,       // rect
      // text layers use: text, fontFamily, fontSize, fontWeight, fill (no x/y width/height except x/y anchor)
    }
  ]
}
```

## Rules
- `specVersion` is semver-like `0.x`; readers must reject unknown major incompatibilities and hand projects off to migration.
- Layer `id` is a stable UUID; ordering in `layers` is z-order (last = top).
- Unknown properties are preserved, never silently dropped (forward compatibility).
- Validation lives in `packages/bannerspec/src/validate.ts`; JSON Schema (`schema/bannerspec-0.1.schema.json`) is generated from the same definitions.

## Out of scope for 0.1 (planned 0.2+)
Groups, masks, timeline/keyframes, data bindings, theme tokens, platform overrides, procedural seeds.
