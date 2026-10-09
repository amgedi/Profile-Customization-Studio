//! Verify the selected executable's own identity before starting its UI.
use std::{path::Path, process::{Command, Stdio}, time::{Duration, Instant}};
use crate::install::{CurrentPointer, InstallLayout};

/// Older builds predate the runtime query. Their recorded install hash remains
/// the compatibility path; newer builds must answer the exact runtime query.
pub fn verify_installed_identity(layout: &InstallLayout, pointer: &CurrentPointer) -> Result<(), String> {
    let exe = layout.resolve_exe(&pointer.exe);
    if crate::manifest::version_is_newer("0.2.6-dev", &pointer.version) {
        let manifest = layout.read_install_manifest(&pointer.version).ok_or("Legacy build is missing its install identity manifest")?;
        if manifest.version != pointer.version { return Err("Legacy install manifest version mismatch".into()); }
        crate::transaction::verify_sha256(&exe, &manifest.exe_sha256)
    } else {
        verify_executable(&exe, &pointer.version)
    }
}

pub fn validate_identity(json: &str, expected: &str) -> Result<(), String> {
    let identity: serde_json::Value = serde_json::from_str(json).map_err(|_| "Studio returned an invalid version identity".to_string())?;
    if identity["product"] != "pcs-studio" { return Err("Selected executable is not PCS Studio".into()); }
    if identity["version"] != expected { return Err(format!("Studio version mismatch: expected {expected}, executable reports {}", identity["version"])); }
    Ok(())
}

pub fn verify_executable(exe: &Path, expected: &str) -> Result<(), String> {
    let mut command = Command::new(exe);
    command.arg("--version-json").stdout(Stdio::piped()).stderr(Stdio::null());
    #[cfg(windows)] {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    let mut child = command.spawn().map_err(|e| format!("Cannot verify Studio identity: {e}"))?;
    let start = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) if start.elapsed() < Duration::from_secs(3) => std::thread::sleep(Duration::from_millis(20)),
            _ => { let _ = child.kill(); let _ = child.wait(); return Err("Studio did not answer the version handshake. Choose a compatible build in Versions.".into()); }
        }
    }
    let result = child.wait_with_output().map_err(|e| e.to_string())?;
    if !result.status.success() { return Err("Studio version handshake failed".into()); }
    validate_identity(&String::from_utf8_lossy(&result.stdout), expected)
}

#[cfg(test)] mod tests {
    use super::*;
    #[test] fn exact_version() { assert!(validate_identity(r#"{"product":"pcs-studio","version":"0.2.6-dev"}"#, "0.2.6-dev").is_ok()); }
    #[test] fn mismatch_is_rejected() { assert!(validate_identity(r#"{"product":"pcs-studio","version":"0.2.5"}"#, "0.2.6-dev").is_err()); }
    #[test] fn wrong_product_is_rejected() { assert!(validate_identity(r#"{"product":"other","version":"0.2.6-dev"}"#, "0.2.6-dev").is_err()); }
    #[test] fn malformed_identity_is_rejected() { assert!(validate_identity("not json", "0.2.6-dev").is_err()); }
}
