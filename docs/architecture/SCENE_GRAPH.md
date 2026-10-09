# Scene graph

BannerSpec 0.3 describes an ordered layer tree: rectangles, text, ellipses, lines, images and nested groups. It includes paints, effects, explicit keyframe tracks and beginner motion behaviors. Group parameters support generated atmosphere and scene sequencing.

SceneStore applies edits and records undo/redo. Editor selection, tools and panels are separate UI state. The shared SVG renderer supports static frames and SVG motion; raster export samples a still frame. Animated GIF/video encoding is unavailable. Imported documents are validated, numeric values are bounded and user strings are escaped before inline SVG rendering.

See the authoritative types in `packages/bannerspec/src/types.ts` and renderer in `packages/scene-core/src/render.ts`.
