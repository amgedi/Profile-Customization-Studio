# Testing

Run `npm run typecheck`, `npm test`, `npm run build`, `cargo test --workspace --locked` and `cargo build --workspace --release --locked`. The suite covers document validation/migration, editing, rendering, project round trips, platform capabilities, statistics, contribution games, preferences and native update/rollback/health behavior. No dedicated lint or formatter configuration currently exists.

Use the [isolated native smoke procedure](../native-testing.md) for navigation and resize checks. Review screenshots manually. Builds and passing tests do not prove accessibility, high-DPI dialogs, performance or every GUI interaction. Ordinary tests require no personal account or secret. CI configuration is checked in, but a local run is not evidence that a hosted GitHub workflow has passed.
