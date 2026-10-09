//! Lightweight health checks for the launcher (Health page).
//!
//! `run_health_checks` runs once at startup and on explicit refresh —
//! never in a render loop. Every check is read-only or touches only a
//! throwaway temp file it creates itself.

use std::fs;
use std::net::TcpStream;
use std::path::Path;
use std::time::Duration;
use std::sync::atomic::{AtomicU64, Ordering};

use crate::appdata::{
    load_settings, reconcile_crash_state, studio_appdata_dir, studio_prefs_path,
    webview2_version, LauncherSettings,
};
use crate::install::{InstallLayout, PointerError};

/// One health-check result.
#[derive(Debug, Clone)]
pub struct HealthCheck {
    pub id: &'static str,
    pub label: String,
    pub ok: bool,
    pub critical: bool,
    pub detail: String,
}

/// Full report. `healthy` is true when every critical check passed.
#[derive(Debug, Clone)]
pub struct HealthReport {
    pub checks: Vec<HealthCheck>,
    pub healthy: bool,
}

fn check(id: &'static str, label: impl Into<String>, ok: bool, critical: bool, detail: impl Into<String>) -> HealthCheck {
    HealthCheck { id, label: label.into(), ok, critical, detail: detail.into() }
}

/// App-data writability: create + delete a temp file in `dir`.
/// Factored out so tests can point it at a temp dir.
pub fn appdata_writable(dir: &Path) -> (bool, String) {
    if let Err(e) = fs::create_dir_all(dir) {
        return (false, format!("cannot create {}: {e}", dir.display()));
    }
    // Concurrent launcher checks must never delete one another's probe.
    static NEXT_PROBE: AtomicU64 = AtomicU64::new(0);
    let probe = dir.join(format!(".pcs-health-probe-{}-{}", std::process::id(), NEXT_PROBE.fetch_add(1, Ordering::Relaxed)));
    match fs::write(&probe, b"ok").and_then(|_| fs::remove_file(&probe)) {
        Ok(()) => (true, dir.display().to_string()),
        Err(e) => (false, format!("cannot write in {}: {e}", dir.display())),
    }
}

/// Preferences schema check: ok when the file is missing OR parses as JSON.
/// Factored out so tests can point it at a temp file.
pub fn prefs_readable(path: &Path) -> (bool, String) {
    if !path.exists() {
        return (true, "no preferences file yet (defaults in use)".into());
    }
    match fs::read_to_string(path) {
        Err(e) => (false, format!("cannot read {}: {e}", path.display())),
        Ok(text) => match serde_json::from_str::<serde_json::Value>(&text) {
            Ok(_) => (true, path.display().to_string()),
            Err(e) => (false, format!("preferences file is corrupt: {e}")),
        },
    }
}

/// Recents metadata check: ok when the file is missing OR parses.
/// (`load_recents` swallows errors, so parse explicitly to report them.)
pub fn recents_readable(root: &Path) -> (bool, String) {
    let path = root.join("recent-projects.json");
    if !path.exists() {
        return (true, "no recent projects yet".into());
    }
    match fs::read_to_string(&path) {
        Err(e) => (false, format!("cannot read {}: {e}", path.display())),
        Ok(text) => match serde_json::from_str::<Vec<serde_json::Value>>(&text) {
            Ok(v) => (true, format!("{} recent project{}", v.len(), if v.len() == 1 { "" } else { "s" })),
            Err(e) => (false, format!("recents file is corrupt: {e}")),
        },
    }
}

/// WebView2 runtime check. On Windows the EdgeUpdate Clients registry value
/// (already probed by `webview2_version`) must resolve; elsewhere n/a.
pub fn webview2_check() -> (bool, String) {
    #[cfg(windows)]
    {
        let v = webview2_version();
        if v == "unknown" {
            (false, "WebView2 runtime not found — install the Microsoft Edge WebView2 runtime".into())
        } else {
            (true, format!("WebView2 runtime {v}"))
        }
    }
    #[cfg(not(windows))]
    {
        (true, "n/a".into())
    }
}

/// Update feed reachability. Only probes when a remote feed URL is
/// configured; the local development feed always counts as reachable.
/// A short TCP connect with no extra dependencies.
pub fn feed_reachable(settings: &LauncherSettings) -> (bool, String) {
    if settings.update_url.is_empty() {
        return (true, "not configured (local development feed in app data)".into());
    }
    let rest = settings
        .update_url
        .strip_prefix("https://")
        .or_else(|| settings.update_url.strip_prefix("http://"))
        .unwrap_or(&settings.update_url);
    let host_port = rest.split('/').next().unwrap_or("");
    let (host, default_port) = if settings.update_url.starts_with("https") {
        (host_port, 443u16)
    } else {
        (host_port, 80u16)
    };
    let port = host_port.rsplit_once(':').and_then(|(_, p)| p.parse().ok()).unwrap_or(default_port);
    let addr = format!("{host}:{port}");
    // Deliberately dependency-free: std resolver + one short TCP connect.
    let probe = std::net::ToSocketAddrs::to_socket_addrs(addr.as_str())
        .map_err(|e| e.to_string())
        .and_then(|mut addrs| {
            addrs.next().ok_or_else(|| format!("cannot resolve {addr}"))
        })
        .and_then(|sa| TcpStream::connect_timeout(&sa, Duration::from_secs(2)).map_err(|e| e.to_string()));
    match probe {
        Ok(_) => (true, format!("feed at {addr} responded")),
        Err(e) => (false, format!("feed at {addr} unreachable: {e}")),
    }
}

/// Run all health checks. Lightweight: a handful of file stats plus at
/// most one short network probe.
pub fn run_health_checks(layout: &InstallLayout) -> HealthReport {
    let mut checks: Vec<HealthCheck> = Vec::new();
    let root = layout.root();

    // 1. Installation pointer valid.
    let pointer = layout.load_current_validated();
    checks.push(match &pointer {
        Ok(ptr) => check("pointer", "Installation pointer valid", true, true,
            format!("Studio v{} is the active build", ptr.version)),
        Err(PointerError::Missing) => check("pointer", "Installation pointer valid", false, true,
            "Studio is not installed yet"),
        Err(PointerError::Invalid(e)) => check("pointer", "Installation pointer valid", false, true,
            format!("Pointer unusable: {e}")),
    });

    // 2. Active executable exists.
    checks.push(match &pointer {
        Ok(ptr) => {
            let exe = layout.resolve_exe(&ptr.exe);
            if exe.exists() {
                check("exe", format!("Studio {} found", ptr.version), true, true, exe.display().to_string())
            } else {
                check("exe", format!("Studio {} found", ptr.version), false, true,
                    "Executable is missing from the install directory")
            }
        }
        Err(_) => check("exe", "Studio executable found", false, true, "No active version to look up"),
    });

    // 3. Install manifest readable (critical when present; older installs
    // may legitimately have none).
    checks.push(match &pointer {
        Ok(ptr) => match layout.read_install_manifest(&ptr.version) {
            Some(m) => check("manifest", "Installation manifest readable", true, true,
                format!("installed {}", m.installed_at)),
            None => check("manifest", "Installation manifest readable", true, true,
                "no manifest recorded for this version (basic check only)"),
        },
        Err(_) => check("manifest", "Installation manifest readable", false, true,
            "No active version to look up"),
    });

    // 4. App data writable.
    let (ok, detail) = appdata_writable(&studio_appdata_dir());
    checks.push(check("appdata", "Application data writable", ok, true, detail));

    // 5. WebView2 available.
    let (ok, detail) = webview2_check();
    checks.push(check("webview2", "WebView2 available", ok, true, detail));

    // 6. Update disk space: not trivially obtainable without new deps.
    checks.push(check("diskspace", "Disk space for updates", true, false, "not checked"));

    // 7. Update feed reachable (warning only, short timeout).
    let settings = load_settings(root);
    let (ok, detail) = feed_reachable(&settings);
    checks.push(check("feed", "Update feed reachable", ok, false, detail));

    // 8. Last Studio launch (crash / heartbeat state) — warning only.
    let failures = reconcile_crash_state(root);
    checks.push(if failures == 0 {
        check("lastlaunch", "Last launch OK", true, false, "no failed starts recorded")
    } else {
        check("lastlaunch", "Last launch had problems", false, false,
            format!("{failures} consecutive failed start(s) — see the recovery options"))
    });

    // 9. Studio preferences schema readable (critical).
    let (ok, detail) = prefs_readable(&studio_prefs_path());
    checks.push(check("prefs", "Preferences readable", ok, true, detail));

    // 10. Recents / projects metadata readable (critical per pointer/exe/
    // manifest/appdata/prefs grouping; keep it critical=false so a stray
    // recents file never blocks launching — it is a warning in practice).
    let (ok, detail) = recents_readable(root);
    checks.push(check("recents", "Recent projects readable", ok, false, detail));

    let healthy = checks.iter().all(|c| c.ok || !c.critical);
    HealthReport { checks, healthy }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::install::CurrentPointer;
    use std::fs;

    #[test]
    fn concurrent_writability_checks_do_not_interfere() {
        let dir = tempfile::tempdir().unwrap();
        std::thread::scope(|scope| {
            let handles: Vec<_> = (0..24).map(|_| scope.spawn(|| appdata_writable(dir.path()))).collect();
            for handle in handles { assert!(handle.join().unwrap().0); }
        });
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 0);
    }

    fn ptr(layout: &InstallLayout, version: &str) -> CurrentPointer {
        CurrentPointer {
            version: version.into(),
            exe: layout.studio_exe(version).to_string_lossy().into_owned(),
            healthy: true,
            activated_at: "2026-10-06T00:00:00Z".into(),
            previous_version: None,
        }
    }

    /// Fresh layout with one seeded, activated version — the healthy case.
    fn seeded(root: &Path, version: &str) -> InstallLayout {
        let layout = InstallLayout::new(root);
        let exe = layout.studio_exe(version);
        fs::create_dir_all(exe.parent().unwrap()).unwrap();
        fs::write(&exe, b"exe").unwrap();
        layout.activate(&ptr(&layout, version)).unwrap();
        layout
    }

    #[test]
    fn healthy_install_reports_healthy() {
        let tmp = tempfile::tempdir().unwrap();
        let layout = seeded(tmp.path(), "0.2.6-dev");
        let report = run_health_checks(&layout);
        assert!(report.healthy, "expected healthy, got {:?}", report.checks);
        let ids: Vec<&str> = report.checks.iter().map(|c| c.id).collect();
        for id in ["pointer", "exe", "manifest", "appdata", "webview2", "diskspace", "feed", "lastlaunch", "prefs", "recents"] {
            assert!(ids.contains(&id), "missing check {id}");
        }
        let pointer = report.checks.iter().find(|c| c.id == "pointer").unwrap();
        assert!(pointer.ok && pointer.critical);
        assert!(pointer.detail.contains("0.2.6-dev"));
    }

    #[test]
    fn missing_pointer_is_unhealthy() {
        let tmp = tempfile::tempdir().unwrap();
        let layout = InstallLayout::new(tmp.path());
        let report = run_health_checks(&layout);
        assert!(!report.healthy);
        let pointer = report.checks.iter().find(|c| c.id == "pointer").unwrap();
        assert!(!pointer.ok && pointer.critical);
        let exe = report.checks.iter().find(|c| c.id == "exe").unwrap();
        assert!(!exe.ok);
    }

    #[test]
    fn corrupt_pointer_is_unhealthy_but_recents_stay_warning_only() {
        let tmp = tempfile::tempdir().unwrap();
        let layout = seeded(tmp.path(), "0.2.5-dev");
        fs::write(layout.current_pointer(), "{ not json").unwrap();
        let report = run_health_checks(&layout);
        assert!(!report.healthy);
        // A corrupt recents file alone never flips the whole report.
        let tmp2 = tempfile::tempdir().unwrap();
        let layout2 = seeded(tmp2.path(), "0.2.5-dev");
        fs::write(tmp2.path().join("recent-projects.json"), "[ not json").unwrap();
        let report2 = run_health_checks(&layout2);
        let recents = report2.checks.iter().find(|c| c.id == "recents").unwrap();
        assert!(!recents.ok && !recents.critical);
        assert!(report2.healthy);
    }

    #[test]
    fn missing_exe_is_unhealthy() {
        let tmp = tempfile::tempdir().unwrap();
        let layout = InstallLayout::new(tmp.path());
        // Pointer names a version whose exe was never written.
        layout.activate(&ptr(&layout, "0.2.6-dev")).unwrap();
        let report = run_health_checks(&layout);
        assert!(!report.healthy);
        assert!(!report.checks.iter().find(|c| c.id == "exe").unwrap().ok);
    }

    #[test]
    fn appdata_writable_true_and_false() {
        let tmp = tempfile::tempdir().unwrap();
        let (ok, _) = appdata_writable(tmp.path());
        assert!(ok);
        // A file where a directory is needed cannot be created.
        let file_dir = tmp.path().join("notadir");
        fs::write(&file_dir, b"x").unwrap();
        let (ok, detail) = appdata_writable(&file_dir);
        assert!(!ok);
        assert!(!detail.is_empty());
    }

    #[test]
    fn prefs_readable_accepts_missing_and_valid() {
        let tmp = tempfile::tempdir().unwrap();
        let p = tmp.path().join("prefs.json");
        assert!(prefs_readable(&p).0); // missing is fine
        fs::write(&p, r#"{"sidebar":true}"#).unwrap();
        assert!(prefs_readable(&p).0);
        fs::write(&p, "{ not json").unwrap();
        assert!(!prefs_readable(&p).0);
    }

    #[test]
    fn feed_check_without_url_is_ok_not_configured() {
        let settings = LauncherSettings::default();
        let (ok, detail) = feed_reachable(&settings);
        assert!(ok);
        assert!(detail.contains("not configured"));
    }

    #[test]
    fn webview2_check_returns_a_result() {
        // Shape only: must not panic and detail must be non-empty.
        let (ok, detail) = webview2_check();
        let _ = ok;
        assert!(!detail.is_empty());
    }

    #[test]
    fn recents_readable_counts_projects() {
        let tmp = tempfile::tempdir().unwrap();
        let (ok, detail) = recents_readable(tmp.path());
        assert!(ok && detail.contains("no recent"));
        fs::write(tmp.path().join("recent-projects.json"), r#"[{"name":"A","path":"a","last_opened":"0"}]"#).unwrap();
        let (ok, detail) = recents_readable(tmp.path());
        assert!(ok && detail.contains("1 recent project"));
    }
}
