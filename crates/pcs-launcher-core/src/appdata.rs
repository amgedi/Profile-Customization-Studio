//! Launcher-side persistent settings, recents and diagnostics helpers.
//! All data lives under the PCS app-data root; nothing is written to
//! project or source directories.

use std::fs;
use std::io;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LauncherSettings {
    #[serde(default = "default_channel")]
    pub channel: String,
    #[serde(default)]
    pub auto_check_updates: bool,
    /// When true, download+install found updates without asking.
    #[serde(default)]
    pub auto_install_updates: bool,
    /// Optional HTTP update feed override. Empty = local feed directory.
    #[serde(default)]
    pub update_url: String,
    /// Download found updates automatically (in the background).
    #[serde(default)]
    pub auto_download_updates: bool,
    /// Ask before installing a downloaded update.
    #[serde(default = "default_true")]
    pub ask_before_install: bool,
}

fn default_channel() -> String { "dev".into() }
fn default_true() -> bool { true }

impl LauncherSettings {
    /// Effective "install updates without asking" decision, combining the
    /// legacy single switch with the download + ask pair.
    pub fn effective_auto_install(&self) -> bool {
        self.auto_install_updates || (self.auto_download_updates && !self.ask_before_install)
    }
}

impl Default for LauncherSettings {
    fn default() -> Self {
        Self {
            channel: default_channel(),
            auto_check_updates: false,
            auto_install_updates: false,
            update_url: String::new(),
            auto_download_updates: false,
            ask_before_install: true,
        }
    }
}

pub fn settings_path(root: &std::path::Path) -> PathBuf {
    root.join("launcher-settings.json")
}

pub fn load_settings(root: &std::path::Path) -> LauncherSettings {
    fs::read_to_string(settings_path(root))
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default()
}

pub fn save_settings(root: &std::path::Path, s: &LauncherSettings) -> io::Result<()> {
    fs::create_dir_all(root)?;
    fs::write(settings_path(root), serde_json::to_string_pretty(s)?)
}

// ---------------------------------------------------------------- recents

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentProject {
    pub name: String,
    pub path: String,
    pub last_opened: String,
}

pub fn recents_path(root: &std::path::Path) -> PathBuf {
    root.join("recent-projects.json")
}

pub fn load_recents(root: &std::path::Path) -> Vec<RecentProject> {
    fs::read_to_string(recents_path(root))
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default()
}

pub fn save_recents(root: &std::path::Path, recents: &[RecentProject]) -> io::Result<()> {
    fs::create_dir_all(root)?;
    fs::write(recents_path(root), serde_json::to_string_pretty(recents)?)
}

// ---------------------------------------------------------------- studio appdata
//
// The Studio keeps its own per-user data under %APPDATA%/dev.pcs.studio
// (identifier `dev.pcs.studio`). The launcher only ever touches two files
// there: the UI-state/preferences file (repairable) and the startup
// heartbeat (crash-loop detection). Everything else — drafts, projects,
// recents — is strictly off-limits.

/// The Studio's own app-data directory (`%APPDATA%/dev.pcs.studio`).
pub fn studio_appdata_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("dev.pcs.studio")
}

/// Studio window/panel preferences file. Safe to delete: the Studio
/// recreates it with defaults. Never a draft or a project.
pub fn studio_prefs_path() -> PathBuf {
    studio_appdata_dir().join("pcs-app-prefs.json")
}

/// Heartbeat the Studio touches shortly after a successful boot.
pub fn studio_heartbeat_path() -> PathBuf {
    studio_appdata_dir().join("pcs-startup-ok.json")
}

/// Delete (or sanitize) the Studio preferences file. This is "Repair UI
/// state": it removes exactly that one file and nothing else.
pub fn repair_studio_prefs() -> Result<bool, String> {
    let p = studio_prefs_path();
    if !p.exists() {
        return Ok(false);
    }
    fs::remove_file(&p).map_err(|e| format!("could not remove {}: {e}", p.display()))?;
    Ok(true)
}

// ---------------------------------------------------------------- crash-loop

const CRASH_STATE_FILE: &str = "launch-health.json";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct LaunchHealth {
    #[serde(default)]
    consecutive_failures: u32,
    #[serde(default)]
    last_attempt_epoch: u64,
}

fn crash_state_path(root: &std::path::Path) -> PathBuf {
    root.join(CRASH_STATE_FILE)
}

fn load_launch_health(root: &std::path::Path) -> LaunchHealth {
    fs::read_to_string(crash_state_path(root))
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default()
}

fn save_launch_health(root: &std::path::Path, h: &LaunchHealth) {
    if let Some(dir) = crash_state_path(root).parent() {
        let _ = fs::create_dir_all(dir);
    }
    let _ = fs::write(crash_state_path(root), serde_json::to_string_pretty(h).unwrap_or_default());
}

/// After N consecutive failed Studio starts the launcher offers recovery.
pub const CRASH_LOOP_THRESHOLD: u32 = 2;

/// Reconcile crash state with the Studio heartbeat: if the Studio started
/// successfully after our last launch attempt, the counter resets.
pub fn reconcile_crash_state(root: &std::path::Path) -> u32 {
    let mut h = load_launch_health(root);
    if h.consecutive_failures == 0 {
        return 0;
    }
    if let Ok(meta) = fs::metadata(studio_heartbeat_path()) {
        if let Ok(modified) = meta.modified() {
            if let Ok(m) = modified.duration_since(std::time::UNIX_EPOCH) {
                if m.as_secs() > h.last_attempt_epoch {
                    h.consecutive_failures = 0;
                    save_launch_health(root, &h);
                }
            }
        }
    }
    h.consecutive_failures
}

/// Record a Studio launch attempt (spawn succeeded or failed).
pub fn record_launch_attempt(root: &std::path::Path, spawned: bool) -> u32 {
    let mut h = load_launch_health(root);
    h.last_attempt_epoch = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    h.consecutive_failures = if spawned { h.consecutive_failures.saturating_add(1) } else { h.consecutive_failures };
    save_launch_health(root, &h);
    h.consecutive_failures
}

/// Current consecutive-failure count without reconciling (for display).
pub fn consecutive_failures(root: &std::path::Path) -> u32 {
    load_launch_health(root).consecutive_failures
}

/// Manually clear the crash-loop counter (e.g. after successful recovery).
pub fn clear_crash_state(root: &std::path::Path) {
    save_launch_health(root, &LaunchHealth::default());
}

// ---------------------------------------------------------------- logging

pub fn append_log(root: &std::path::Path, file: &str, line: &str) -> io::Result<()> {
    use std::io::Write;
    let dir = root.join("logs");
    fs::create_dir_all(&dir)?;
    let mut f = fs::OpenOptions::new().create(true).append(true).open(dir.join(file))?;
    f.write_all(line.as_bytes())?;
    f.write_all(b"\n")
}

pub fn log_tail(root: &std::path::Path, file: &str, lines: usize) -> Vec<String> {
    match fs::read_to_string(root.join("logs").join(file)) {
        Ok(t) => {
            let all: Vec<&str> = t.lines().collect();
            let start = all.len().saturating_sub(lines);
            all[start..].iter().map(|s| s.to_string()).collect()
        }
        Err(_) => Vec::new(),
    }
}

// ---------------------------------------------------------------- diagnostics

/// Builds the privacy-safe diagnostics text. Never includes project content.
pub fn build_diagnostics_text(root: &std::path::Path) -> String {
    let layout = crate::install::InstallLayout::new(root);
    let mut out = String::new();
    out.push_str("Profile Customization Studio — Diagnostics\n");
    out.push_str("==========================================\n");
    out.push_str(&format!("Launcher version: {}\n", crate::LAUNCHER_VERSION));
    out.push_str(&format!("OS: {} {}\n", std::env::consts::OS, std::env::consts::ARCH));
    out.push_str(&format!("WebView2 runtime: {}\n", webview2_version()));

    match layout.load_current_validated() {
        Ok(ptr) => out.push_str(&format!(
            "Active Studio: v{} (health verified, activated {})\n  exe: {}\n",
            ptr.version, ptr.activated_at, ptr.exe
        )),
        Err(crate::install::PointerError::Missing) => out.push_str("Active Studio: not installed\n"),
        Err(crate::install::PointerError::Invalid(e)) => {
            out.push_str(&format!("Active Studio pointer invalid: {e}\n"))
        }
    }
    out.push_str("\nInstalled versions:\n");
    let roles = layout.version_roles();
    if roles.is_empty() {
        out.push_str("  (none)\n");
    }
    for (v, role, exe) in &roles {
        out.push_str(&format!(
            "  v{} — {} ({})\n",
            v,
            role.label(),
            if exe.exists() { "exe present" } else { "exe MISSING" }
        ));
    }

    let health = load_launch_health(root);
    if health.consecutive_failures > 0 {
        out.push_str(&format!(
            "\nConsecutive failed Studio starts: {}\n",
            health.consecutive_failures
        ));
    }

    let settings = load_settings(root);
    out.push_str(&format!("\nLauncher settings schema: 1\n"));
    out.push_str(&format!("Update channel: {}\n", settings.channel));
    out.push_str(&format!("Auto-check updates: {}\n", settings.auto_check_updates));
    out.push_str(&format!("Auto-install updates: {}\n", settings.auto_install_updates));
    out.push_str(&format!(
        "Update feed: {}\n",
        if settings.update_url.is_empty() { "local (app data)".to_string() } else { settings.update_url.clone() }
    ));

    out.push_str("\nRecent launcher log:\n");
    for l in log_tail(root, "launch.log", 10) {
        out.push_str(&format!("  {l}\n"));
    }
    out.push_str("\nRecent update log:\n");
    for l in log_tail(root, "update.log", 10) {
        out.push_str(&format!("  {l}\n"));
    }
    out
}

/// Best-effort WebView2 runtime version on Windows (registry via `reg`).
pub fn webview2_version() -> String {
    #[cfg(windows)]
    {
        let key = r#"HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"#;
        if let Ok(out) = std::process::Command::new("reg").args(["query", key, "/v", "pv"]).output() {
            let s = String::from_utf8_lossy(&out.stdout);
            if let Some(pos) = s.find("REG_SZ") {
                let v = s[pos + 6..].trim();
                if !v.is_empty() {
                    return v.to_string();
                }
            }
        }
        "unknown".into()
    }
    #[cfg(not(windows))]
    {
        "n/a".into()
    }
}

/// Writes the diagnostics text to a timestamped file under <root>/diagnostics.
pub fn write_diagnostics(root: &std::path::Path) -> io::Result<PathBuf> {
    let out = build_diagnostics_text(root);
    let dir = root.join("diagnostics");
    fs::create_dir_all(&dir)?;
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let path = dir.join(format!("diagnostics-{ts}.txt"));
    fs::write(&path, out)?;
    Ok(path)
}
