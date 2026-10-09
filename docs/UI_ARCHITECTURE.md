# Studio architecture

`apps/studio/src/App.tsx` owns editor workspaces and dialogs. `editor.ts` adapts SceneStore and local project state. Shared BannerSpec readers/migrations live in `packages/bannerspec`; rendering, behaviour compilation and store/history commands live in `packages/scene-core`. Preserve those boundaries when changing UI.

Home, Guide Me, Design, Motion, Profile and Preview are separate user workflows. Scene/effect registries drive cards and inspectors. Export target registry/capability records drive previews, conversions and warnings. Native file/keyring operations sit behind Tauri commands/plugins; browser fallbacks support limited preview use.

Presets and dynamically registered effects may not appear as direct static component references. Do not delete modules/assets using a search result alone. Keep keyboard/reduced-motion/accessibility support and old saved-project readers.
