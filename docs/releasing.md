# Local release preparation

1. Preserve a live-source checkpoint and review AGPL, dependency notices, assets and advisory status.
2. Run typechecks, all workspace tests, native tests, frontend/native builds and isolated native QA. Record missing checks precisely. There is no standalone JavaScript lint configuration; TypeScript checks are mandatory. Native Clippy is the configured-tool lint check for Studio.
3. Promote only Studio's package/version module/Tauri/Cargo metadata to 0.3.3 after functional gates pass. Library and local Launcher versions have independent identities. Rebuild and recheck the promoted app.
4. Use scripts/package-public.mjs with the reviewed source and main Studio executable. Never use package-local.ps1 for public packaging. Check embedded frontend asset, matching versions, hashes and archive inventories. Include full corresponding source, AGPL and third-party license texts.
5. Exclude Launcher/helper binaries, installed-version trees, update feeds, user data, private history, caches, diagnostics and personal paths. Source retains local development Launcher code for reproducible workspace tests.
6. Nothing publishes automatically. Only after explicit user authorization in the Work chat create public GitHub history/tag/release and upload the reviewed packages. Do not push private local development history.
