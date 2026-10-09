# Launcher architecture

The Slint Launcher is a separate executable. `crates/pcs-launcher-core` owns installation pointers, version discovery, verification, rollback, diagnostics and update transactions. `apps/update-helper` replaces a stopped Launcher with hash verification and rollback backup.

An OS-resolved application-data root contains `studio/current.json`, `studio/versions`, staging and operational logs. A development checkout uses `artifacts/development`; explicit environment overrides support isolated testing. Project files remain in user-selected locations, outside installation state.

The local package script stages Studio/Launcher/helper and records checksums. It refuses to overwrite an immutable version with different bytes. Default update feeds are empty; no hosted publisher is configured. HTTP Studio single-file packages are not a supported installer. Remote transport/publisher trust and package format limits must be reviewed before enabling a public update feed.
