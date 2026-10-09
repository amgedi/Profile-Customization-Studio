//! pcs-launcher-core
//!
//! Owns the versioned-install model, update manifests and the update
//! transaction for Profile Customization Studio. Deliberately dependency-light
//! so a future update-helper binary can reuse it unchanged.

pub mod appdata;
pub mod health;
pub mod handshake;
pub mod install;
pub mod manifest;
pub mod provider;
pub mod transaction;

pub use appdata::{
    build_diagnostics_text, clear_crash_state, consecutive_failures, load_recents, load_settings,
    reconcile_crash_state, record_launch_attempt, repair_studio_prefs, save_settings,
    studio_appdata_dir, studio_prefs_path, write_diagnostics, LauncherSettings, RecentProject,
    CRASH_LOOP_THRESHOLD,
};
pub use health::{run_health_checks, HealthCheck, HealthReport};
pub use install::{CurrentPointer, InstallLayout, InstallStatus, PointerError, VersionRole};
pub use manifest::UpdateManifest;
pub use provider::{FileSystemProvider, HttpProvider, UpdateProvider};
pub use transaction::{UpdateOutcome, run_update_transaction};

pub const LAUNCHER_VERSION: &str = env!("CARGO_PKG_VERSION");
