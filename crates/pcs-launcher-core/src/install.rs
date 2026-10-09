//! Versioned, non-destructive install layout.
//!
//! <root>/studio/versions/<semver>/   immutable installs
//! <root>/studio/current.json         atomic pointer to the active version
//! <root>/staging/                    downloads land here before verification

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

/// The active-version pointer (`studio/current.json`). This is the single
/// source of truth for which Studio build runs.
///
/// JSON keys follow the 0.2.5 spec (`version` / `path` / `activatedAt` /
/// `healthVerified`); older layouts (`exe` / `activated_at` / `healthy`)
/// are still read via serde aliases.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrentPointer {
    pub version: String,
    #[serde(rename = "path", alias = "exe")]
    pub exe: String,
    #[serde(rename = "healthVerified", alias = "healthy")]
    pub healthy: bool,
    #[serde(rename = "activatedAt", alias = "activated_at")]
    pub activated_at: String,
    /// Version that was active before this one (last known good), recorded
    /// automatically on every activation. Used for the "Previous" role.
    #[serde(default, rename = "previousVersion", alias = "previous_version")]
    pub previous_version: Option<String>,
}

impl CurrentPointer {
    /// Structural validation: version and path must be non-empty.
    /// (Path existence is checked separately, against disk.)
    pub fn validate(&self) -> Result<(), String> {
        if self.version.trim().is_empty() {
            return Err("version must not be empty".into());
        }
        if self.exe.trim().is_empty() {
            return Err("path must not be empty".into());
        }
        if self.activated_at.trim().is_empty() {
            return Err("activatedAt must not be empty".into());
        }
        Ok(())
    }
}

/// Why a `current.json` could not be used as-is.
#[derive(Debug, Clone, PartialEq)]
pub enum PointerError {
    /// No pointer file at all (fresh install).
    Missing,
    /// The file exists but is unusable (bad JSON, empty fields, or the
    /// executable it points at is gone).
    Invalid(String),
}

/// Role an installed version plays relative to the active pointer.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VersionRole {
    Current,
    Previous,
    Older,
}

impl VersionRole {
    pub fn label(self) -> &'static str {
        match self {
            VersionRole::Current => "Current",
            VersionRole::Previous => "Previous",
            VersionRole::Older => "Older",
        }
    }
}

/// ISO-8601 UTC timestamp without external deps (YYYY-MM-DDTHH:MM:SSZ).
pub fn iso8601_now() -> String {
    iso8601_from_secs(
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0),
    )
}

pub fn iso8601_from_secs(secs: u64) -> String {
    let days = (secs / 86_400) as i64;
    let rem = secs % 86_400;
    // Howard Hinnant's civil-from-days algorithm.
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!(
        "{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}Z",
        rem / 3600,
        (rem % 3600) / 60,
        rem % 60
    )
}

#[derive(Debug, Clone)]
pub struct InstallLayout {
    root: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallManifest {
    pub version: String,
    pub exe_sha256: String,
    pub installed_at: String,
}

impl InstallLayout {
    /// All installed version numbers, sorted ascending.
    pub fn list_versions(&self) -> Vec<String> {
        let mut out: Vec<String> = fs::read_dir(self.versions_dir())
            .map(|rd| {
                rd.filter_map(|e| e.ok())
                    .filter(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false))
                    .filter_map(|e| e.file_name().into_string().ok())
                    .collect()
            })
            .unwrap_or_default();
        out.sort();
        out
    }

    /// Write the install manifest for a version (called by the update transaction).
    pub fn write_install_manifest(&self, m: &InstallManifest) -> io::Result<()> {
        let dir = self.checked_version_dir(&m.version)?;
        fs::create_dir_all(&dir)?;
        fs::write(dir.join("install-manifest.json"), serde_json::to_string_pretty(m)?)
    }

    pub fn read_install_manifest(&self, version: &str) -> Option<InstallManifest> {
        let p = self.checked_version_dir(version).ok()?.join("install-manifest.json");
        let t = fs::read_to_string(p).ok()?;
        serde_json::from_str(&t).ok()
    }

    /// Remove a non-active version. Refuses to remove the active one or the last one.
    pub fn remove_version(&self, version: &str) -> Result<(), String> {
        let dir = self.checked_version_dir(version).map_err(|e| e.to_string())?;
        if let Some(cur) = self.read_current().map_err(|e| e.to_string())? {
            if cur.version == version {
                return Err("cannot remove the active version".into());
            }
        }
        let versions = self.list_versions();
        if versions.len() <= 1 {
            return Err("refusing to remove the only installed version".into());
        }
        fs::remove_dir_all(dir).map_err(|e| e.to_string())
    }

    /// Roll back to a previous installed version (must exist on disk).
    /// The version being rolled back FROM is recorded as the previous one,
    /// so returning to the newest build stays one click away.
    pub fn rollback_to(&self, version: &str) -> Result<(), String> {
        let exe = self.checked_version_dir(version).map_err(|e| e.to_string())?.join("Profile Customization Studio.exe");
        if !exe.exists() {
            return Err(format!("version {version} is not installed"));
        }
        let ptr = CurrentPointer {
            version: version.into(),
            exe: exe.to_string_lossy().into_owned(),
            healthy: true,
            activated_at: iso8601_now(),
            previous_version: None, // filled in by activate()
        };
        self.activate(&ptr).map_err(|e| e.to_string())
    }

    /// Resolve a pointer's exe field against the layout root.
    pub fn resolve_exe(&self, exe_field: &str) -> PathBuf {
        let exe = PathBuf::from(exe_field);
        if exe.is_absolute() {
            exe
        } else {
            self.root.join(exe)
        }
    }

    /// Load and fully validate the active pointer, including that the
    /// executable it names exists on disk. This is the authoritative way
    /// to decide what "Current" is — never directory sort order.
    pub fn load_current_validated(&self) -> Result<CurrentPointer, PointerError> {
        let ptr = self.read_current().map_err(|e| PointerError::Invalid(e.to_string()))?;
        let ptr = match ptr {
            Some(p) => p,
            None => return Err(PointerError::Missing),
        };
        ptr.validate().map_err(PointerError::Invalid)?;
        if !self.resolve_exe(&ptr.exe).exists() {
            return Err(PointerError::Invalid(format!(
                "pointed executable does not exist: {}",
                ptr.exe
            )));
        }
        Ok(ptr)
    }

    /// Recovery candidate: scan installed versions (newest first) and pick
    /// the newest one that actually has a Studio executable. Never called
    /// automatically by the launcher — it is offered to the user first.
    pub fn recover_current(&self) -> Option<CurrentPointer> {
        let mut versions = self.list_versions();
        versions.sort_by(|a, b| b.cmp(a)); // newest first
        for v in versions {
            let exe = self.studio_exe(&v);
            if exe.exists() {
                return Some(CurrentPointer {
                    version: v,
                    exe: exe.to_string_lossy().into_owned(),
                    healthy: true,
                    activated_at: iso8601_now(),
                    previous_version: None,
                });
            }
        }
        None
    }

    /// Every installed version with its role. Current comes from the
    /// pointer (validated when possible); Previous is the recorded last
    /// known good if installed, else the newest non-current version.
    pub fn version_roles(&self) -> Vec<(String, VersionRole, PathBuf)> {
        let current = self.read_current().ok().flatten();
        let versions = self.list_versions();
        let previous_recorded = current
            .as_ref()
            .and_then(|c| c.previous_version.clone())
            .filter(|p| versions.iter().any(|v| v == p));
        let previous = previous_recorded.or_else(|| {
            versions
                .iter()
                .rev()
                .find(|v| current.as_ref().map(|c| &c.version) != Some(*v))
                .cloned()
        });
        versions
            .into_iter()
            .map(|v| {
                let role = if current.as_ref().map(|c| c.version == v).unwrap_or(false) {
                    VersionRole::Current
                } else if previous.as_deref() == Some(v.as_str()) {
                    VersionRole::Previous
                } else {
                    VersionRole::Older
                };
                let exe = self.studio_exe(&v);
                (v, role, exe)
            })
            .collect()
    }

    /// Verify the active installation. Read-only: never modifies files.
    /// Returns Ok(report lines) on success, Err(reason) on failure.
    pub fn verify_active(&self) -> Result<Vec<String>, String> {
        let ptr = self
            .read_current()
            .map_err(|e| format!("current.json unreadable: {e}"))?
            .ok_or_else(|| "Studio is not installed".to_string())?;
        let exe = self.resolve_exe(&ptr.exe);
        if !exe.exists() {
            return Err("Studio executable is missing".into());
        }
        let mut report = vec![format!("executable present: {}", exe.display())];
        match self.read_install_manifest(&ptr.version) {
            Some(m) => {
                use sha2::{Digest, Sha256};
                let data = fs::read(&exe).map_err(|e| format!("cannot read exe: {e}"))?;
                let actual = hex::encode(Sha256::digest(&data));
                if actual.eq_ignore_ascii_case(&m.exe_sha256) {
                    report.push("integrity: exe hash matches install manifest ✓".into());
                } else {
                    return Err("exe hash does not match install manifest (modified or corrupted)".into());
                }
            }
            None => report.push("no install manifest for this version — basic check only".into()),
        }
        Ok(report)
    }

    /// Default per-user location (e.g. %APPDATA%/ProfileCustomizationStudio).
    pub fn default_appdata() -> PathBuf {
        dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("ProfileCustomizationStudio")
    }

    /// A layout rooted at `root`. Never creates anything on its own.
    pub fn new<P: Into<PathBuf>>(root: P) -> Self {
        Self { root: root.into() }
    }

    pub fn root(&self) -> &Path { &self.root }
    pub fn versions_dir(&self) -> PathBuf { self.root.join("studio").join("versions") }
    pub fn staging_dir(&self) -> PathBuf { self.root.join("staging") }
    pub fn logs_dir(&self) -> PathBuf { self.root.join("logs") }
    pub fn current_pointer(&self) -> PathBuf { self.root.join("studio").join("current.json") }

    /// Refuse unsafe versions and existing symlinks/junctions before writes or deletion.
    pub fn checked_version_dir(&self, version: &str) -> io::Result<PathBuf> {
        if !crate::manifest::valid_version(version) { return Err(io::Error::new(io::ErrorKind::InvalidInput, "unsafe version")); }
        let path = self.version_dir(version);
        reject_link_ancestors(&path)?;
        Ok(path)
    }

    pub fn version_dir(&self, version: &str) -> PathBuf {
        self.versions_dir().join(version)
    }

    pub fn studio_exe(&self, version: &str) -> PathBuf {
        self.version_dir(version).join("Profile Customization Studio.exe")
    }

    /// Read the active pointer. `Ok(None)` means Studio is not installed.
    pub fn read_current(&self) -> io::Result<Option<CurrentPointer>> {
        let path = self.current_pointer();
        if !path.exists() {
            return Ok(None);
        }
        let text = fs::read_to_string(path)?;
        let ptr: CurrentPointer = serde_json::from_str(&text)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;
        Ok(Some(ptr))
    }

    /// Atomically activate a version: write temp pointer, then rename over
    /// current.json. The previously active version (if any, and different)
    /// is recorded as `previousVersion` — the "last known good".
    pub fn activate(&self, ptr: &CurrentPointer) -> io::Result<()> {
        self.checked_version_dir(&ptr.version)?;
        let mut ptr = ptr.clone();
        ptr.activated_at = if ptr.activated_at.trim().is_empty() {
            iso8601_now()
        } else {
            ptr.activated_at.clone()
        };
        if let Ok(Some(old)) = self.read_current() {
            if old.version != ptr.version && !old.version.trim().is_empty() {
                ptr.previous_version = Some(old.version);
            }
        }
        fs::create_dir_all(self.versions_dir())?;
        let path = self.current_pointer();
        reject_link_ancestors(&path)?;
        let tmp = path.with_extension("json.tmp");
        fs::write(&tmp, serde_json::to_string_pretty(&ptr)?)?;
        fs::rename(&tmp, &path)
    }

    /// Simple health check: pointer exists, exe exists, healthy flag set.
    pub fn health_status(&self) -> InstallStatus {
        match self.read_current() {
            Ok(None) => InstallStatus::NotInstalled,
            Ok(Some(ptr)) => {
                let exe = self.resolve_exe(&ptr.exe);
                if exe.exists() && ptr.healthy {
                    InstallStatus::Healthy { version: ptr.version, exe }
                } else {
                    InstallStatus::Broken { version: ptr.version }
                }
            }
            Err(_) => InstallStatus::Broken { version: "?".into() },
        }
    }

    /// Record the result of a launch attempt (used for crash-loop detection later).
    pub fn record_launch_result(&self, ok: bool) -> io::Result<()> {
        let dir = self.logs_dir();
        fs::create_dir_all(&dir)?;
        let line = format!(
            "{} launch {}\n",
            chrono_like_now(),
            if ok { "ok" } else { "FAILED" }
        );
        use std::io::Write;
        let mut f = fs::OpenOptions::new().create(true).append(true)
            .open(dir.join("launch.log"))?;
        f.write_all(line.as_bytes())
    }
}

#[derive(Debug, Clone)]
pub enum InstallStatus {
    NotInstalled,
    Healthy { version: String, exe: PathBuf },
    Broken { version: String },
}

fn chrono_like_now() -> String {
    // Avoid pulling chrono for a log line: epoch seconds suffice for triage.
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ptr(version: &str, exe: &str) -> CurrentPointer {
        CurrentPointer {
            version: version.into(),
            exe: exe.into(),
            healthy: true,
            activated_at: "2026-10-06T00:00:00Z".into(),
            previous_version: None,
        }
    }

    fn seed(layout: &InstallLayout, version: &str) {
        let exe = layout.studio_exe(version);
        fs::create_dir_all(exe.parent().unwrap()).unwrap();
        fs::write(&exe, b"exe").unwrap();
    }

    #[test]
    fn pointer_validates_fields() {
        assert!(ptr("0.2.5-dev", "C:/x/Studio.exe").validate().is_ok());
        let mut bad = ptr("", "C:/x/Studio.exe");
        assert!(bad.validate().is_err());
        bad.version = "0.2.5-dev".into();
        bad.exe = "  ".into();
        assert!(bad.validate().is_err());
    }

    #[test]
    fn activate_writes_spec_keys_and_records_previous() {
        let tmp = tempfile::tempdir().unwrap();
        let layout = InstallLayout::new(tmp.path());
        layout.activate(&ptr("0.2.4-dev", layout.studio_exe("0.2.4-dev").to_string_lossy().as_ref())).unwrap();
        layout.activate(&ptr("0.2.5-dev", layout.studio_exe("0.2.5-dev").to_string_lossy().as_ref())).unwrap();

        let text = fs::read_to_string(layout.current_pointer()).unwrap();
        let v: serde_json::Value = serde_json::from_str(&text).unwrap();
        assert_eq!(v["version"], "0.2.5-dev");
        assert!(v["path"].is_string());
        assert_eq!(v["healthVerified"], true);
        assert!(v["activatedAt"].is_string());
        assert_eq!(v["previousVersion"], "0.2.4-dev");

        // Old key names are still readable (aliases).
        let legacy = r#"{"version":"0.2.1-dev","exe":"old.exe","healthy":true,"activated_at":"0"}"#;
        let p: CurrentPointer = serde_json::from_str(legacy).unwrap();
        assert_eq!(p.exe, "old.exe");
        assert!(p.healthy);
        assert_eq!(p.activated_at, "0");
    }

    #[test]
    fn load_validated_reports_missing_and_invalid() {
        let tmp = tempfile::tempdir().unwrap();
        let layout = InstallLayout::new(tmp.path());
        // Missing.
        assert_eq!(layout.load_current_validated().unwrap_err(), PointerError::Missing);

        // Invalid JSON.
        fs::create_dir_all(layout.versions_dir()).unwrap();
        fs::write(layout.current_pointer(), "{ not json").unwrap();
        assert!(matches!(layout.load_current_validated(), Err(PointerError::Invalid(_))));

        // Sane JSON but empty version.
        fs::write(layout.current_pointer(), r#"{"version":"","path":"x","activatedAt":"0","healthVerified":true}"#).unwrap();
        assert!(matches!(layout.load_current_validated(), Err(PointerError::Invalid(_))));

        // Sane JSON but exe missing on disk.
        fs::write(layout.current_pointer(), r#"{"version":"0.2.5-dev","path":"C:/nope/Studio.exe","activatedAt":"0","healthVerified":true}"#).unwrap();
        assert!(matches!(layout.load_current_validated(), Err(PointerError::Invalid(_))));
    }

    #[test]
    fn load_validated_accepts_relative_paths() {
        let tmp = tempfile::tempdir().unwrap();
        let layout = InstallLayout::new(tmp.path());
        seed(&layout, "0.2.5-dev");
        let rel = layout
            .studio_exe("0.2.5-dev")
            .strip_prefix(layout.root())
            .unwrap()
            .to_path_buf();
        layout.activate(&ptr("0.2.5-dev", rel.to_string_lossy().as_ref())).unwrap();
        let loaded = layout.load_current_validated().unwrap();
        assert_eq!(loaded.version, "0.2.5-dev");
        assert!(layout.resolve_exe(&loaded.exe).exists());
    }

    #[test]
    fn recovery_picks_newest_version_with_exe() {
        let tmp = tempfile::tempdir().unwrap();
        let layout = InstallLayout::new(tmp.path());
        assert!(layout.recover_current().is_none());
        seed(&layout, "0.2.4-dev");
        seed(&layout, "0.2.5-dev");
        fs::create_dir_all(layout.version_dir("0.2.6-dev")).unwrap(); // dir without exe
        // Corrupt the pointer so recovery is the only way out.
        fs::write(layout.current_pointer(), "garbage").unwrap();
        assert!(layout.load_current_validated().is_err());
        let rec = layout.recover_current().unwrap();
        assert_eq!(rec.version, "0.2.5-dev");
        layout.activate(&rec).unwrap();
        assert!(layout.load_current_validated().is_ok());
    }

    #[test]
    fn version_roles_current_previous_older() {
        let tmp = tempfile::tempdir().unwrap();
        let layout = InstallLayout::new(tmp.path());
        for v in ["0.2.3-dev", "0.2.4-dev", "0.2.5-dev"] {
            seed(&layout, v);
        }
        layout.activate(&ptr("0.2.5-dev", layout.studio_exe("0.2.5-dev").to_string_lossy().as_ref())).unwrap();
        let roles = layout.version_roles();
        assert_eq!(roles.len(), 3);
        for (v, role, exe) in &roles {
            match v.as_str() {
                "0.2.5-dev" => assert_eq!(*role, VersionRole::Current),
                "0.2.4-dev" => assert_eq!(*role, VersionRole::Previous),
                "0.2.3-dev" => assert_eq!(*role, VersionRole::Older),
                _ => panic!("unexpected version {v}"),
            }
            assert!(exe.ends_with("Profile Customization Studio.exe"));
        }

        // After rolling back, roles recompute: 0.2.4-dev is current,
        // the recorded previous is 0.2.5-dev (the version we left).
        layout.rollback_to("0.2.4-dev").unwrap();
        let roles = layout.version_roles();
        let role_of = |v: &str| roles.iter().find(|r| r.0 == v).unwrap().1;
        assert_eq!(role_of("0.2.4-dev"), VersionRole::Current);
        assert_eq!(role_of("0.2.5-dev"), VersionRole::Previous);
        assert_eq!(role_of("0.2.3-dev"), VersionRole::Older);
    }

    #[test]
    fn iso8601_formats_utc() {
        assert_eq!(iso8601_from_secs(0), "1970-01-01T00:00:00Z");
        assert_eq!(iso8601_from_secs(1_791_244_800), "2026-10-06T00:00:00Z");
        assert_eq!(iso8601_from_secs(951_782_400), "2000-02-29T00:00:00Z");
    }
}

pub(crate) fn reject_link_ancestors(path: &Path) -> io::Result<()> {
    for p in path.ancestors() {
        match fs::symlink_metadata(p) {
            Ok(m) => {
                #[cfg(windows)]
                let linked = { use std::os::windows::fs::MetadataExt; m.file_attributes() & 0x400 != 0 };
                #[cfg(not(windows))]
                let linked = m.file_type().is_symlink();
                if linked { return Err(io::Error::new(io::ErrorKind::PermissionDenied, "linked install/package paths are not allowed")); }
            }
            Err(e) if e.kind() == io::ErrorKind::NotFound => {},
            Err(e) => return Err(e),
        }
    }
    Ok(())
}
