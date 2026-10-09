//! Update transaction: DOWNLOAD → VERIFY → STAGE → INSTALL → HEALTH CHECK → ACTIVATE.
//! Any failure leaves the current install untouched.

use std::fs;
use std::io;
use std::path::PathBuf;

use sha2::{Digest, Sha256};

use crate::install::{CurrentPointer, InstallLayout};
use crate::manifest::version_is_newer;
use crate::provider::UpdateProvider;

#[derive(Debug)]
pub enum UpdateOutcome {
    UpToDate,
    Installed { version: String },
    Failed(String),
}

pub fn run_update_transaction(
    layout: &InstallLayout,
    provider: &dyn UpdateProvider,
    current_version: &str,
) -> UpdateOutcome {
    let manifest = match provider.fetch_manifest() {
        Ok(m) => m,
        Err(e) => return UpdateOutcome::Failed(format!("manifest: {e}")),
    };
    if let Err(e) = manifest.validate() { return UpdateOutcome::Failed(format!("manifest: {e}")); }
    if manifest.product != "profile-customization-studio" { return UpdateOutcome::Failed("wrong update product".into()); }
    if !version_is_newer(&manifest.version, current_version) {
        return UpdateOutcome::UpToDate;
    }

    // 1. Download into staging.
    let staging = layout.staging_dir();
    if let Err(e) = crate::install::reject_link_ancestors(&staging) { return UpdateOutcome::Failed(e.to_string()); }
    let artifact = match provider.fetch_artifact(&manifest, &staging) {
        Ok(a) => a,
        Err(e) => return UpdateOutcome::Failed(format!("download: {e}")),
    };

    // 2. Verify SHA-256.
    if let Err(e) = verify_sha256(&artifact, &manifest.sha256) {
        let _ = fs::remove_file(&artifact);
        return UpdateOutcome::Failed(format!("verify: {e}"));
    }

    // 3. Install into versioned dir.
    if !artifact.is_dir() { return UpdateOutcome::Failed("single-file update packages are not supported".into()); }
    let version_dir = match layout.checked_version_dir(&manifest.version) { Ok(p) => p, Err(e) => return UpdateOutcome::Failed(e.to_string()) };
    if version_dir.exists() { return UpdateOutcome::Failed("version already installed; refusing to overwrite it".into()); }
    if let Err(e) = install_artifact(&artifact, &version_dir) {
        return UpdateOutcome::Failed(format!("install: {e}"));
    }
    let _ = fs::remove_file(&artifact);

    // 4. Health check: the artifact is a folder containing the Studio exe.
    let exe = version_dir.join("Profile Customization Studio.exe");
    if !exe.is_file() {
        let _ = fs::remove_dir_all(&version_dir);
        return UpdateOutcome::Failed("health check: Studio exe missing from package".into());
    }

    // 5. Write install manifest (enables later Verify), activate atomically;
    //    previous versions stay on disk for rollback.
    let exe_sha256 = {
        let data = fs::read(&exe).unwrap_or_default();
        use sha2::{Digest, Sha256};
        hex::encode(Sha256::digest(&data))
    };
    let _ = layout.write_install_manifest(&crate::install::InstallManifest {
        version: manifest.version.clone(),
        exe_sha256,
        installed_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs().to_string())
            .unwrap_or_default(),
    });
    let ptr = CurrentPointer {
        version: manifest.version.clone(),
        exe: exe.to_string_lossy().into_owned(),
        healthy: true,
        activated_at: crate::install::iso8601_now(),
        previous_version: None, // activate() records the outgoing version
    };
    if let Err(e) = layout.activate(&ptr) {
        return UpdateOutcome::Failed(format!("activate: {e}"));
    }

    let _ = crate::appdata::append_log(
        &layout.root(),
        "update.log",
        &format!("epoch {} installed {}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0), manifest.version),
    );

    UpdateOutcome::Installed { version: manifest.version }
}

/// Verify SHA-256 of a staged artifact.
/// Single-file artifacts hash their bytes; directory artifacts hash a
/// deterministic stream of `<relative-path>\0<file-bytes>` over files sorted by
/// path, so the manifest hash is stable across platforms.
pub fn verify_sha256(path: &std::path::Path, expected: &str) -> Result<(), String> {
    crate::install::reject_link_ancestors(path).map_err(|e| e.to_string())?;
    let hash = if path.is_dir() {
        hash_directory(path).map_err(|e| e.to_string())?
    } else {
        let data = fs::read(path).map_err(|e| e.to_string())?;
        hex::encode(Sha256::digest(&data))
    };
    if !hash.eq_ignore_ascii_case(expected) {
        return Err(format!("hash mismatch: expected {expected}, got {hash}"));
    }
    Ok(())
}

fn hash_directory(dir: &std::path::Path) -> io::Result<String> {
    let mut paths: Vec<PathBuf> = Vec::new();
    collect_files(dir, dir, &mut paths)?;
    paths.sort();
    let mut hasher = Sha256::new();
    for p in paths {
        let rel = p.strip_prefix(dir).map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;
        hasher.update(rel.to_string_lossy().as_bytes());
        hasher.update([0u8]);
        hasher.update(fs::read(&p)?);
    }
    Ok(hex::encode(hasher.finalize()))
}

fn collect_files(root: &std::path::Path, dir: &std::path::Path, out: &mut Vec<PathBuf>) -> io::Result<()> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        crate::install::reject_link_ancestors(&entry.path())?;
        if entry.file_type()?.is_dir() {
            collect_files(root, &entry.path(), out)?;
        } else {
            out.push(entry.path());
        }
    }
    Ok(())
}

/// Install an artifact (a directory, or a zip later) into the version dir.
fn install_artifact(artifact: &std::path::Path, version_dir: &std::path::Path) -> io::Result<()> {
    if artifact.is_dir() {
        fs::create_dir_all(version_dir)?;
        copy_dir_recursive(artifact, version_dir)
    } else {
        // Zip support arrives with real packaging; today's fixtures use folders.
        Err(io::Error::new(
            io::ErrorKind::Unsupported,
            "single-file artifacts are not supported yet; use a directory package",
        ))
    }
}

fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        crate::install::reject_link_ancestors(&entry.path())?;
        let to = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_recursive(&entry.path(), &to)?;
        } else {
            fs::copy(entry.path(), to)?;
        }
    }
    Ok(())
}
