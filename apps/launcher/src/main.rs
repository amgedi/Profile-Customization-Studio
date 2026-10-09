//! Profile Customization Studio Launcher — Slint presentation shell (0.2.5).
//!
//! All presentation lives in `ui/launcher.slint` (compiled by `build.rs`
//! through slint-build). This file owns the backend (install layout +
//! settings, backed by `pcs-launcher-core`) and wires it to the UI's
//! `Bridge` global.
//!
//! Key invariants:
//!   - "Current" always comes from the active-version pointer
//!     (`studio/current.json`), validated on load — never from directory
//!     sort order or hardcoded strings. A broken pointer offers recovery.
//!   - Launch resolves the Studio exe through that pointer only.
//!   - Activation (update or restore) records the outgoing version as the
//!     last known good ("Previous") automatically.
//!   - After 2+ consecutive failed Studio starts the launcher shows the
//!     recovery screen (crash-loop protection via launch-health.json and
//!     the Studio heartbeat pcs-startup-ok.json).
//!
//! Network and disk work runs on background threads; every UI mutation is
//! marshalled back to the event loop with `slint::invoke_from_event_loop`.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use slint::{SharedString, Weak};

use pcs_launcher_core::appdata::{
    append_log, build_diagnostics_text, clear_crash_state, load_recents, load_settings,
    reconcile_crash_state, record_launch_attempt, repair_studio_prefs, save_recents,
    save_settings, write_diagnostics, LauncherSettings, RecentProject, CRASH_LOOP_THRESHOLD,
};
use pcs_launcher_core::health::run_health_checks;
use pcs_launcher_core::install::{InstallLayout, PointerError, VersionRole};
use pcs_launcher_core::provider::{FileSystemProvider, HttpProvider, UpdateProvider};
use pcs_launcher_core::transaction::{run_update_transaction, UpdateOutcome};

slint::include_modules!();

/// Product version shown for both launcher and Studio.
const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

const STUDIO_PRODUCT: &str = "profile-customization-studio";
const LAUNCHER_PRODUCT: &str = "profile-customization-studio-launcher";

// ============================================================ backend state

/// Everything the UI needs from the outside world, backed by
/// `pcs-launcher-core`. Shared with background threads through `Arc`.
struct Backend {
    layout: InstallLayout,
    settings: LauncherSettings,
}

impl Backend {
    fn save_settings(&self) {
        let _ = save_settings(self.layout.root(), &self.settings);
    }

    /// The authoritative active-version state for the UI.
    /// 1 = healthy pointer, 0 = not installed, 2 = invalid/broken.
    fn pointer_state(&self) -> (i32, String) {
        match self.layout.load_current_validated() {
            Ok(ptr) => (1, ptr.version),
            Err(PointerError::Missing) => (0, String::new()),
            Err(PointerError::Invalid(_)) => (2, String::new()),
        }
    }

    /// What kind of update feed is configured for this install.
    fn feed_kind(&self) -> FeedKind {
        if !self.settings.update_url.is_empty() {
            return FeedKind::Remote(self.settings.update_url.clone());
        }
        let dir = update_root(self.layout.root(), &self.settings);
        if dir.join("manifest.json").exists() {
            FeedKind::LocalDev
        } else {
            FeedKind::None
        }
    }
}

enum FeedKind {
    LocalDev,
    Remote(String),
    None,
}

impl FeedKind {
    fn label(&self) -> String {
        match self {
            FeedKind::LocalDev => "Development update feed".into(),
            FeedKind::Remote(url) => format!("Remote feed · {url}"),
            FeedKind::None => "No update feed configured".into(),
        }
    }
}

struct NoFeed;

fn update_root(root: &std::path::Path, _settings: &LauncherSettings) -> PathBuf {
    std::env::var_os("PCS_UPDATE_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(|| root.join("update"))
}

fn make_provider(
    root: &std::path::Path,
    settings: &LauncherSettings,
) -> Result<Box<dyn UpdateProvider>, NoFeed> {
    if !settings.update_url.is_empty() {
        return Ok(Box::new(HttpProvider { base_url: settings.update_url.clone() }));
    }
    let dir = update_root(root, settings);
    if dir.join("manifest.json").exists() {
        Ok(Box::new(FileSystemProvider::new(dir)))
    } else {
        Err(NoFeed)
    }
}

fn current_exe_dir() -> PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_default()
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Copy text to the Windows clipboard via the bundled `clip.exe`
/// (no extra dependencies; text is piped over stdin).
fn copy_to_clipboard(text: &str) {
    use std::io::Write;
    if let Ok(mut child) = Command::new("clip").stdin(std::process::Stdio::piped()).spawn() {
        if let Some(stdin) = child.stdin.as_mut() {
            let _ = stdin.write_all(text.as_bytes());
        }
        let _ = child.wait();
    }
}

fn ago_text(then: u64) -> String {
    let d = now_secs().saturating_sub(then);
    if d < 60 {
        "just now".into()
    } else if d < 3600 {
        format!("{} min ago", d / 60)
    } else if d < 86_400 {
        format!("{} h ago", d / 3600)
    } else {
        format!("{} d ago", d / 86_400)
    }
}

// ============================================================ app / UI glue

/// Owns the backend and the weak UI handle. Shared as `Arc<App>` with
/// background threads; all UI mutations funnel through the event loop.
struct App {
    ui: Weak<LauncherWindow>,
    backend: Mutex<Backend>,
    last_checked: AtomicU64,
}

impl App {
    // ---- UI state pushes

    /// Run `f` on the event loop with the UI. Safe from any thread.
    fn with_ui(&self, f: impl FnOnce(&LauncherWindow) + Send + 'static) {
        let ui = self.ui.clone();
        let _ = slint::invoke_from_event_loop(move || {
            if let Some(ui) = ui.upgrade() {
                f(&ui);
            }
        });
    }

    fn push_status(&self, line: impl Into<String> + Send + 'static, is_error: bool) {
        self.with_ui(move |ui| {
            let b = ui.global::<Bridge>();
            b.set_status_line(line.into().into());
            b.set_status_error(is_error);
        });
    }

    /// Update-state codes mirror the UI: 0 not checked, 1 up to date,
    /// 2 available, 3 no feed, 4 failed, 5 installed/ready. The available
    /// build is cleared here and set explicitly where state 2 is pushed.
    fn push_update_state(&self, state: i32, text: impl Into<String> + Send + 'static) {
        self.with_ui(move |ui| {
            let b = ui.global::<Bridge>();
            b.set_update_state(state);
            b.set_update_status_text(text.into().into());
            if state != 2 {
                b.set_available_version("".into());
            }
        });
    }

    fn push_available_version(&self, version: impl Into<String> + Send + 'static) {
        let version = version.into();
        self.with_ui(move |ui| {
            ui.global::<Bridge>().set_available_version(version.into());
        });
    }

    fn push_feed_label(&self, label: String) {
        self.with_ui(move |ui| {
            ui.global::<Bridge>().set_feed_label(label.into());
        });
    }

    fn push_busy(&self, stage: &str) {
        let stage = stage.to_string();
        self.with_ui(move |ui| {
            let b = ui.global::<Bridge>();
            b.set_busy(true);
            b.set_busy_stage(stage.into());
        });
    }

    fn push_ready(self: &Arc<Self>) {
        let checked = self.last_checked.load(Ordering::Relaxed);
        self.with_ui(move |ui| {
            let b = ui.global::<Bridge>();
            b.set_busy(false);
            b.set_busy_stage("".into());
            if checked > 0 {
                b.set_last_checked(ago_text(checked).into());
            }
        });
    }

    /// Refresh install state, versions and recents into the UI.
    fn refresh_state(self: &Arc<Self>) {
        let app = Arc::clone(self);
        self.with_ui(move |ui| {
            let backend = app.backend.lock().unwrap();
            let b = ui.global::<Bridge>();

            let (state, version) = backend.pointer_state();
            b.set_pointer_state(state);
            b.set_studio_version(version.into());

            let rows = slint::VecModel::<VersionRow>::default();
            for (v, role, exe) in backend.layout.version_roles() {
                rows.push(VersionRow {
                    version: v.into(),
                    role: match role {
                        VersionRole::Current => 0,
                        VersionRole::Previous => 1,
                        VersionRole::Older => 2,
                    },
                    is_active: role == VersionRole::Current && exe.exists(),
                });
            }
            b.set_versions(slint::ModelRc::new(rows));

            let install_root = backend.layout.root().display().to_string();
            drop(backend);
            app.push_recents(&ui);

            b.set_install_location(install_root.into());
            b.set_app_version(APP_VERSION.into());
        });
    }

    /// Push up to 3 recent projects into the UI (name, relative last-edited
    /// time, missing-on-disk flag).
    fn push_recents(&self, ui: &LauncherWindow) {
        let recents = load_recents(self.backend.lock().unwrap().layout.root());
        let rows = slint::VecModel::<RecentRow>::default();
        for r in recents.iter().take(3) {
            let edited = r
                .last_opened
                .parse::<u64>()
                .map(ago_text)
                .unwrap_or_else(|_| r.last_opened.clone());
            rows.push(RecentRow {
                name: r.name.clone().into(),
                path: r.path.clone().into(),
                edited: edited.into(),
                missing: !std::path::Path::new(&r.path).exists(),
            });
        }
        ui.global::<Bridge>().set_recents(slint::ModelRc::new(rows));
    }

    // ---- health checks

    /// Run the health checks on a background thread and push the report
    /// into the UI. Runs once at startup and on explicit refresh — never
    /// in a render loop.
    fn run_health(self: &Arc<Self>) {
        let app = Arc::clone(self);
        app.with_ui(|ui| {
            ui.global::<Bridge>().set_health_busy(true);
        });
        std::thread::spawn(move || {
            let layout = app.backend.lock().unwrap().layout.clone();
            let report = run_health_checks(&layout);
            app.with_ui(move |ui| {
                let b = ui.global::<Bridge>();
                let rows = slint::VecModel::<HealthRow>::default();
                for c in &report.checks {
                    rows.push(HealthRow {
                        id: c.id.into(),
                        label: c.label.clone().into(),
                        ok: c.ok,
                        critical: c.critical,
                        detail: c.detail.clone().into(),
                    });
                }
                b.set_health_rows(slint::ModelRc::new(rows));
                b.set_health_healthy(report.healthy);
                b.set_health_busy(false);
            });
        });
    }

    // ---- actions

    /// Spawn the Studio, resolving the exe from the active-version pointer
    /// (validated). Never derived from directory listings.
    fn launch(self: &Arc<Self>, safe_mode: bool) {
        let app = Arc::clone(self);
        std::thread::spawn(move || app.launch_verified(safe_mode));
    }

    fn launch_verified(&self, safe_mode: bool) {
        let backend = self.backend.lock().unwrap();
        let ptr = match backend.layout.load_current_validated() {
            Ok(ptr) => ptr,
            Err(PointerError::Missing) => {
                self.push_status(
                    "The Studio is not installed yet — use Check for updates in the Updates page.",
                    true,
                );
                return;
            }
            Err(PointerError::Invalid(e)) => {
                self.push_status(format!("Installation needs repair: {e}"), true);
                return;
            }
        };
        let exe = backend.layout.resolve_exe(&ptr.exe);
        if let Err(error) = pcs_launcher_core::handshake::verify_installed_identity(&backend.layout, &ptr) {
            self.push_status(error, true);
            return;
        }
        let mut cmd = Command::new(&exe);
        if safe_mode {
            cmd.arg("--safe-mode").env("PCS_SAFE_MODE", "1");
        }
        match cmd.spawn() {
            Ok(_) => {
                // Crash-loop tracking: a successful spawn starts an attempt;
                // the Studio heartbeat (pcs-startup-ok.json) clears it later.
                let failures = record_launch_attempt(backend.layout.root(), true);
                let _ = append_log(
                    backend.layout.root(),
                    "launch.log",
                    &format!(
                        "epoch {epoch} launch v{version} {kind}",
                        epoch = now_secs(),
                        version = ptr.version,
                        kind = if safe_mode { "safe" } else { "ok" }
                    ),
                );
                let _ = failures;
                self.push_status("", false);
            }
            Err(e) => {
                record_launch_attempt(backend.layout.root(), false);
                self.push_status(format!("Failed to start the Studio: {e}"), true);
            }
        }
    }

    fn launch_project(self: &Arc<Self>, path: &str) {
        let app = Arc::clone(self);
        let path = path.to_string();
        std::thread::spawn(move || app.launch_project_verified(&path));
    }

    fn launch_project_verified(&self, path: &str) {
        if !std::path::Path::new(path).exists() {
            self.push_status("Recent project is missing on disk.", true);
            return;
        }
        let backend = self.backend.lock().unwrap();
        if let Ok(ptr) = backend.layout.load_current_validated() {
            let exe = backend.layout.resolve_exe(&ptr.exe);
            if let Err(error) = pcs_launcher_core::handshake::verify_installed_identity(&backend.layout, &ptr) { self.push_status(error, true); return; }
            match Command::new(&exe).arg("--project").arg(path).spawn() {
                Ok(_) => { record_launch_attempt(backend.layout.root(), true); self.push_status("", false); }
                Err(error) => self.push_status(format!("Could not open the project: {error}"), true),
            }
        } else {
            self.push_status("Studio is not ready to open projects.", true);
        }
    }

    /// Check the configured feed for updates. Runs on a background thread.
    fn check_updates(self: &Arc<Self>, _quiet: bool) {
        let app = Arc::clone(self);
        std::thread::spawn(move || {
            app.push_busy("Checking");
            app.last_checked.store(now_secs(), Ordering::Relaxed);

            let (root, settings, current) = {
                let backend = app.backend.lock().unwrap();
                let current = backend
                    .layout
                    .load_current_validated()
                    .map(|p| p.version)
                    .unwrap_or_else(|_| "0.0.0".into());
                (backend.layout.root().to_path_buf(), backend.settings.clone(), current)
            };

            let provider = match make_provider(&root, &settings) {
                Ok(p) => p,
                Err(NoFeed) => {
                    app.push_ready();
                    app.push_update_state(3, "No update feed is configured. A local development feed can be placed in the app-data update folder.");
                    return;
                }
            };
            let manifest = match provider.fetch_manifest() {
                Ok(m) => m,
                Err(e) => {
                    app.push_ready();
                    app.push_update_state(4, format!("Unable to check for updates: {e}"));
                    return;
                }
            };
            if manifest.channel != settings.channel {
                app.push_ready();
                app.push_update_state(
                    4,
                    format!(
                        "No {} build available on this feed (feed serves {}).",
                        settings.channel, manifest.channel
                    ),
                );
                return;
            }
            match manifest.product.as_str() {
                LAUNCHER_PRODUCT => app.apply_launcher_update(manifest),
                STUDIO_PRODUCT => {
                    if !pcs_launcher_core::manifest::version_is_newer(&manifest.version, &current) {
                        app.push_ready();
                        app.push_update_state(1, "You're on the latest build.");
                        return;
                    }
                    let auto_install = app.backend.lock().unwrap().settings.effective_auto_install();
                    if auto_install {
                        app.apply_studio_update();
                    } else {
                        app.push_available_version(manifest.version.clone());
                        app.push_ready();
                        app.push_update_state(
                            2,
                            format!("A new build (v{}) is ready to install.", manifest.version),
                        );
                    }
                }
                other => {
                    app.push_ready();
                    app.push_update_state(4, format!("Unknown update product '{other}'."));
                }
            }
        });
    }

    /// Download and install a found Studio update from the configured feed.
    fn apply_studio_update(self: &Arc<Self>) {
        let app = Arc::clone(self);
        std::thread::spawn(move || {
            app.push_busy("Downloading · verifying · installing");
            let (root, settings, current, layout) = {
                let backend = app.backend.lock().unwrap();
                let current = backend
                    .layout
                    .load_current_validated()
                    .map(|p| p.version)
                    .unwrap_or_else(|_| "0.0.0".into());
                (
                    backend.layout.root().to_path_buf(),
                    backend.settings.clone(),
                    current,
                    backend.layout.clone(),
                )
            };
            let provider = match make_provider(&root, &settings) {
                Ok(p) => p,
                Err(NoFeed) => {
                    app.push_ready();
                    app.push_update_state(3, "No update feed is configured.");
                    return;
                }
            };
            let outcome = run_update_transaction(&layout, provider.as_ref(), &current);
            app.push_ready();
            match outcome {
                UpdateOutcome::Installed { version } => {
                    app.push_update_state(5, format!("Updated Studio to v{version}."));
                    app.push_status(format!("Updated Studio to v{version}."), false);
                    app.refresh_state();
                    app.run_health();
                }
                UpdateOutcome::UpToDate => app.push_update_state(1, "You're on the latest build."),
                UpdateOutcome::Failed(e) => app.push_update_state(4, format!("Update failed: {e}")),
            }
        });
    }

    /// Two-stage launcher self-update: stage the new launcher, spawn the
    /// helper, then exit so the helper can replace us.
    fn apply_launcher_update(self: &Arc<Self>, manifest: pcs_launcher_core::manifest::UpdateManifest) {
        let app = Arc::clone(self);
        std::thread::spawn(move || {
            app.push_busy("Downloading");
            let (root, settings) = {
                let backend = app.backend.lock().unwrap();
                (backend.layout.root().to_path_buf(), backend.settings.clone())
            };
            let provider = match make_provider(&root, &settings) {
                Ok(p) => p,
                Err(NoFeed) => {
                    app.push_ready();
                    return;
                }
            };
            let staging = app.backend.lock().unwrap().layout.staging_dir();
            match provider.fetch_artifact(&manifest, &staging) {
                Ok(staged) => {
                    let helper = current_exe_dir().join("pcs-update-helper.exe");
                    if !helper.exists() {
                        app.push_ready();
                        app.push_update_state(4, "Update helper is missing beside the launcher.");
                        return;
                    }
                    let me = std::env::current_exe().unwrap_or_default();
                    let _ = Command::new(&helper)
                        .arg("--current")
                        .arg(&me)
                        .arg("--staged")
                        .arg(&staged)
                        .arg("--sha256")
                        .arg(&manifest.sha256)
                        .arg("--restart")
                        .spawn();
                    app.push_ready();
                    app.push_update_state(5, "Updating launcher…");
                    std::thread::sleep(std::time::Duration::from_millis(600));
                    std::process::exit(0);
                }
                Err(e) => {
                    app.push_ready();
                    app.push_update_state(4, format!("Update download failed: {e}"));
                }
            }
        });
    }

    fn verify_files(&self) {
        let backend = self.backend.lock().unwrap();
        let report = backend.layout.verify_active();
        self.with_ui(move |ui| {
            let b = ui.global::<Bridge>();
            let (ok, lines): (bool, Vec<SharedString>) = match &report {
                Ok(lines) => (true, lines.iter().map(|l| l.clone().into()).collect()),
                Err(e) => (false, vec![e.clone().into()]),
            };
            b.set_verify_ok(ok);
            b.set_verify_lines(slint::ModelRc::new(slint::VecModel::from(lines)));
            b.set_has_verify_report(true);
        });
    }

    /// Build the diagnostics text, write it to a file and copy it to the
    /// clipboard (Slint clipboard, works without extra deps).
    fn support_report(&self) {
        let (root, text) = {
            let backend = self.backend.lock().unwrap();
            (backend.layout.root().to_path_buf(), build_diagnostics_text(backend.layout.root()))
        };
        copy_to_clipboard(&text);
        match write_diagnostics(&root) {
            Ok(p) => self.push_status(
                format!("Report copied to clipboard and written to {}", p.display()),
                false,
            ),
            Err(e) => self.push_status(format!("Report copied, but saving failed: {e}"), true),
        }
    }

    /// Repair UI state: delete the Studio preferences file (only that file).
    fn repair_prefs(&self) {
        match repair_studio_prefs() {
            Ok(true) => self.push_status(
                "Studio preferences deleted. They will be recreated with defaults on the next launch.",
                false,
            ),
            Ok(false) => self.push_status("No Studio preferences file found — nothing to repair.", false),
            Err(e) => self.push_status(format!("Repair failed: {e}"), true),
        }
    }

    /// Offer a recovery candidate when the pointer is broken: pick the
    /// newest installed version with a real exe and show it in Versions.
    fn offer_pointer_recovery(self: &Arc<Self>) {
        let candidate = {
            let backend = self.backend.lock().unwrap();
            backend.layout.recover_current()
        };
        if let Some(ptr) = candidate {
            self.push_status(
                format!(
                    "Active-version pointer is broken. Version {} is installed — restore it from the Versions page.",
                    ptr.version
                ),
                true,
            );
        } else {
            self.push_status(
                "Active-version pointer is broken and no installed version was found. Use Check for updates to reinstall.",
                true,
            );
        }
    }

    /// Restore (activate) an installed version after verifying its exe.
    fn restore_version(self: &Arc<Self>, version: &str) {
        let backend = self.backend.lock().unwrap();
        // Verify first: refuse to point at a build without an executable.
        if !backend.layout.studio_exe(version).exists() {
            drop(backend);
            self.push_status(format!("Cannot restore v{version}: the build is missing its executable."), true);
            return;
        }
        if let Some(manifest) = backend.layout.read_install_manifest(version) {
            if manifest.version != version || pcs_launcher_core::transaction::verify_sha256(&backend.layout.studio_exe(version), &manifest.exe_sha256).is_err() {
                self.push_status(format!("Cannot restore v{version}: installed files do not match their recorded identity."), true);
                return;
            }
        } else { self.push_status(format!("Cannot restore v{version}: install manifest is missing."), true); return; }
        match backend.layout.rollback_to(version) {
            Ok(()) => {
                drop(backend);
                self.push_status(
                    format!("Restored v{version}. The Studio will use it on next launch."),
                    false,
                );
                self.refresh_state();
            }
            Err(e) => {
                drop(backend);
                self.push_status(e, true);
            }
        }
    }

    /// Compute whether the crash-loop recovery screen should show and push
    /// the failure count into the UI.
    fn evaluate_recovery(self: &Arc<Self>) {
        let (failures, versions) = {
            let backend = self.backend.lock().unwrap();
            (
                reconcile_crash_state(backend.layout.root()),
                backend.layout.list_versions().len(),
            )
        };
        let show = failures >= CRASH_LOOP_THRESHOLD;
        self.with_ui(move |ui| {
            let b = ui.global::<Bridge>();
            b.set_crash_count(failures as i32);
            b.set_recovery_visible(show);
            let _ = versions;
        });
    }
}

// ============================================================ main

fn main() -> Result<(), slint::PlatformError> {
    let root = std::env::var_os("PCS_INSTALL_ROOT").map(std::path::PathBuf::from).unwrap_or_else(|| {
        let directory = std::env::current_exe().ok().and_then(|p| p.parent().map(|p| p.to_path_buf()));
        match directory { Some(p) if p.join("Cargo.toml").exists() => p.join("artifacts/development"), _ => InstallLayout::default_appdata() }
    });
    let settings = load_settings(&root);
    let auto_check = settings.auto_check_updates;

    let ui = LauncherWindow::new()?;
    let app = Arc::new(App {
        ui: ui.as_weak(),
        backend: Mutex::new(Backend { layout: InstallLayout::new(root), settings }),
        last_checked: AtomicU64::new(0),
    });

    {
        let b = ui.global::<Bridge>();
        let backend = app.backend.lock().unwrap();
        b.set_channel(backend.settings.channel.as_str().into());
        b.set_auto_check(backend.settings.auto_check_updates);
        b.set_auto_download(backend.settings.auto_download_updates);
        b.set_ask_before_install(backend.settings.ask_before_install);
        b.set_feed_url(backend.settings.update_url.as_str().into());
        b.set_feed_label(backend.feed_kind().label().as_str().into());
    }

    app.refresh_state();
    app.evaluate_recovery();
    app.run_health();

    // If the pointer is broken but versions exist, surface recovery guidance
    // up front instead of a bogus "Current" version.
    {
        let backend = app.backend.lock().unwrap();
        if matches!(backend.pointer_state(), (2, _)) {
            drop(backend);
            app.offer_pointer_recovery();
        }
    }

    // Navigation: swap the page and run the enter fade.
    {
        let app = Arc::clone(&app);
        ui.global::<Bridge>().on_navigate(move |page: SharedString| {
            if let Some(ui) = app.ui.upgrade() {
                ui.global::<Bridge>().set_page(page);
                ui.set_entering(false);
            }
            let app = Arc::clone(&app);
            slint::Timer::single_shot(std::time::Duration::from_millis(50), move || {
                if let Some(ui) = app.ui.upgrade() {
                    ui.set_entering(true);
                }
            });
        });
    }

    macro_rules! on {
        ($name:ident, |$app:ident| $body:block) => {
            {
                let $app = Arc::clone(&app);
                ui.global::<Bridge>().$name(move || $body);
            }
        };
        ($name:ident, |$app:ident, $($arg:ident : $ty:ty),*| $body:block) => {
            {
                let $app = Arc::clone(&app);
                ui.global::<Bridge>().$name(move |$($arg : $ty),*| $body);
            }
        };
    }

    on!(on_launch, |app| { app.launch(false); });

    // Custom chrome (frameless window): minimize, maximize/restore, close.
    on!(on_minimize, |app| {
        app.with_ui(|ui| ui.window().set_minimized(true));
    });
    on!(on_toggle_maximize, |app| {
        app.with_ui(|ui| {
            let w = ui.window();
            w.set_maximized(!w.is_maximized());
            ui.global::<Bridge>().set_maximized(w.is_maximized());
        });
    });
    on!(on_close_window, |app| {
        app.with_ui(|ui| { let _ = ui.window().hide(); });
    });

    // Health page: explicit refresh re-runs the checks in the background.
    on!(on_refresh_health, |app| { app.run_health(); });

    on!(on_safe_mode, |app| { app.launch(true); });
    on!(on_check_updates, |app| {
        app.push_update_state(0, "Not checked yet");
        app.check_updates(false);
    });
    on!(on_install_update, |app| { app.apply_studio_update(); });
    on!(on_launch_recent, |app, path: SharedString| { app.launch_project(&path); });
    on!(on_locate_recent, |app, path: SharedString| {
        let exists = std::path::Path::new(path.as_str()).exists();
        if exists {
            app.push_status("Project found — Open should work now.", false);
        } else {
            app.push_status("Project is still missing on disk. Remove it or move the file back.", true);
        }
        let app2 = Arc::clone(&app);
        app.with_ui(move |ui| app2.push_recents(ui));
    });
    on!(on_remove_recent, |app, path: SharedString| {
        let root = app.backend.lock().unwrap().layout.root().to_path_buf();
        let kept: Vec<RecentProject> = load_recents(&root)
            .into_iter()
            .filter(|r| r.path != path.as_str())
            .collect();
        match save_recents(&root, &kept) {
            Ok(()) => {
                app.push_status("Removed from recent projects.", false);
                let app2 = Arc::clone(&app);
                app.with_ui(move |ui| app2.push_recents(ui));
            }
            Err(e) => app.push_status(format!("Could not update recents: {e}"), true),
        }
    });
    on!(on_verify_files, |app| { app.verify_files(); });
    on!(on_repair_prefs, |app| { app.repair_prefs(); });
    on!(on_request_reset_prefs, |app| {
        app.with_ui(|ui| ui.global::<Bridge>().set_reset_confirm_open(true));
    });
    on!(on_confirm_reset_prefs, |app| {
        app.with_ui(|ui| ui.global::<Bridge>().set_reset_confirm_open(false));
        app.repair_prefs(); // same single file, behind the double confirm
    });
    on!(on_cancel_reset_prefs, |app| {
        app.with_ui(|ui| ui.global::<Bridge>().set_reset_confirm_open(false));
    });
    on!(on_support_report, |app| { app.support_report(); });
    on!(on_copy_diagnostics, |app| {
        let text = {
            let backend = app.backend.lock().unwrap();
            build_diagnostics_text(backend.layout.root())
        };
        copy_to_clipboard(&text);
        app.push_status("Diagnostics copied to clipboard.", false);
    });
    on!(on_open_logs, |app| {
        let dir = app.backend.lock().unwrap().layout.logs_dir();
        let _ = std::fs::create_dir_all(&dir);
        let _ = open::that(dir);
    });
    on!(on_open_appdata, |app| {
        let dir = app.backend.lock().unwrap().layout.root().to_path_buf();
        let _ = std::fs::create_dir_all(&dir);
        let _ = open::that(dir);
    });
    on!(on_restore_version, |app, version: SharedString| {
        app.restore_version(&version);
    });
    on!(on_remove_version, |app, version: SharedString| {
        let result = { app.backend.lock().unwrap().layout.remove_version(&version) };
        match result {
            Ok(()) => {
                app.push_status(format!("Removed v{version}."), false);
                app.refresh_state();
            }
            Err(e) => app.push_status(e, true),
        }
    });
    on!(on_remove_old_copies, |app| {
        // Keep the active version and the recorded/newest previous one.
        let result = {
            let backend = app.backend.lock().unwrap();
            let mut removed = 0usize;
            let mut errors = 0usize;
            for (v, role, _) in backend.layout.version_roles() {
                if role != VersionRole::Older {
                    continue;
                }
                if backend.layout.remove_version(&v).is_ok() {
                    removed += 1;
                } else {
                    errors += 1;
                }
            }
            (removed, errors)
        };
        let (removed, errors) = result;
        if errors == 0 {
            app.push_status(
                format!("Removed {removed} old version{}.", if removed == 1 { "" } else { "s" }),
                false,
            );
        } else {
            app.push_status(format!("Removed {removed}, {errors} could not be removed."), true);
        }
        app.refresh_state();
    });

    // Settings mutations persist immediately.
    on!(on_set_auto_check, |app, v: bool| {
        {
            let mut backend = app.backend.lock().unwrap();
            backend.settings.auto_check_updates = v;
            backend.save_settings();
        }
        if v {
            app.push_status("Will check for updates at startup.", false);
        }
    });
    on!(on_set_auto_download, |app, v: bool| {
        let mut backend = app.backend.lock().unwrap();
        backend.settings.auto_download_updates = v;
        backend.save_settings();
    });
    on!(on_set_ask_before_install, |app, v: bool| {
        let mut backend = app.backend.lock().unwrap();
        backend.settings.ask_before_install = v;
        backend.save_settings();
    });
    on!(on_set_channel, |app, v: SharedString| {
        {
            let mut backend = app.backend.lock().unwrap();
            backend.settings.channel = v.to_string();
            backend.save_settings();
        }
        app.push_update_state(0, format!("Channel set to {v}. Check for updates to continue."));
    });
    on!(on_set_feed_url, |app, v: SharedString| {
        let label = {
            let mut backend = app.backend.lock().unwrap();
            backend.settings.update_url = v.trim().to_string();
            backend.save_settings();
            backend.feed_kind().label()
        };
        app.push_feed_label(label);
    });

    // ---- crash-loop recovery screen actions
    on!(on_recovery_launch_normal, |app| {
        {
            let backend = app.backend.lock().unwrap();
            clear_crash_state(backend.layout.root());
        }
        app.with_ui(|ui| ui.global::<Bridge>().set_recovery_visible(false));
        app.launch(false);
    });
    on!(on_recovery_safe_mode, |app| {
        {
            let backend = app.backend.lock().unwrap();
            clear_crash_state(backend.layout.root());
        }
        app.with_ui(|ui| ui.global::<Bridge>().set_recovery_visible(false));
        app.launch(true); // sets PCS_SAFE_MODE=1
    });
    on!(on_recovery_repair_prefs, |app| { app.repair_prefs(); });
    on!(on_recovery_restore_previous, |app| {
        // Restore the newest non-current installed version, then launch it.
        let previous = {
            let backend = app.backend.lock().unwrap();
            backend
                .layout
                .version_roles()
                .into_iter()
                .find(|(_, role, _)| *role == VersionRole::Previous)
                .map(|(v, _, _)| v)
        };
        match previous {
            Some(v) => {
                app.restore_version(&v);
                app.with_ui(|ui| ui.global::<Bridge>().set_recovery_visible(false));
                app.launch(false);
            }
            None => app.push_status("No previous version is available to restore.", true),
        }
    });
    on!(on_recovery_open_logs, |app| {
        let dir = app.backend.lock().unwrap().layout.logs_dir();
        let _ = std::fs::create_dir_all(&dir);
        let _ = open::that(dir);
    });
    on!(on_recovery_dismiss, |app| {
        app.with_ui(|ui| {
            let b = ui.global::<Bridge>();
            b.set_recovery_visible(false);
        });
    });

    // Auto check at startup (background thread, same path as a manual check).
    if auto_check {
        app.check_updates(true);
    }

    ui.run()
}
