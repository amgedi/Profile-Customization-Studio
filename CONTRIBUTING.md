# Contributing

Follow [Windows setup](docs/getting-started.md), install with `npm ci`, and run `npm run typecheck`, `npm test`, `npm run build` and `cargo test --workspace --locked` before a pull request. Native changes also require a release build and desktop smoke test. No authenticated GitHub account is needed for ordinary tests.

The workspace keeps Studio in `apps/studio`, the native Launcher in `apps/launcher`, its replacement helper in `apps/update-helper`, launcher services in `crates/pcs-launcher-core`, and shared schema/rendering packages in `packages`.

Use the existing TypeScript/Rust style. There is no repository-wide formatter/linter configured; avoid unrelated reformatting. Keep changes focused and test meaningful boundaries. Preserve saved project readers, schema migrations, literal user data, accessibility, keyboard support and reduced motion.

## Adding designs and platforms

- Platforms: update `apps/studio/src/targets/registry.ts` and any context in `targets/platforms.ts`. Cite official capability guidance, distinguish documented vs approximate limits, and add conversion tests. Never advertise unsupported encoding or account integration.
- Effects/motion: extend the existing effect/behaviour registries and renderer; keep canvas, thumbnail and exported rendering consistent. Check reduced motion and narrow windows.
- Presets: register scenes through the existing scene/photo catalogues, verify their referenced files, and test replacing/undoing them.
- Assets: provide creator, source URL, exact licence, modification notice and redistribution permission in both photo manifests or the relevant asset catalogue. Include required credits and full licence text when needed. Do not add scraped screenshots, unverified artwork, or restrictive noncommercial/no-derivatives media.

PRs should explain the problem, change and validation. Include current screenshots for UI changes and rights/provenance for new assets. Never include tokens, private profiles, recovery files or machine-specific QA output. Contributions to PCS source use AGPL-3.0-only unless an explicitly documented third-party licence applies.
