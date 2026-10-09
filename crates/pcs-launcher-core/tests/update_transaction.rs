use std::fs;
use std::path::Path;

use pcs_launcher_core::install::{CurrentPointer, InstallLayout, InstallStatus};
use pcs_launcher_core::manifest::{UpdateManifest, version_is_newer};
use pcs_launcher_core::provider::FileSystemProvider;
use pcs_launcher_core::transaction::{UpdateOutcome, run_update_transaction, verify_sha256};

fn manifest_json(version: &str, url: &str, sha: &str) -> String {
    format!(
        r#"{{"product":"profile-customization-studio","channel":"dev","version":"{version}",
            "download_url":"{url}","sha256":"{sha}","size":123,"release_notes":"test"}}"#
    )
}

fn sha_of_file(path: &Path) -> String {
    use sha2::{Digest, Sha256};
    hex::encode(Sha256::digest(fs::read(path).unwrap()))
}

/// Directory-artifact hash matching transaction::verify_sha256's rule:
/// sha256 over "<relpath>\0<bytes>" for files sorted by path.
fn sha_of_dir(dir: &Path) -> String {
    use sha2::{Digest, Sha256};
    fn collect(dir: &Path, out: &mut Vec<std::path::PathBuf>) {
        for e in fs::read_dir(dir).unwrap() {
            let e = e.unwrap();
            if e.file_type().unwrap().is_dir() {
                collect(&e.path(), out);
            } else {
                out.push(e.path());
            }
        }
    }
    let mut files = Vec::new();
    collect(dir, &mut files);
    files.sort();
    let mut h = Sha256::new();
    for f in files {
        let rel = f.strip_prefix(dir).unwrap();
        h.update(rel.to_string_lossy().as_bytes());
        h.update([0u8]);
        h.update(fs::read(&f).unwrap());
    }
    hex::encode(h.finalize())
}

fn studio_pkg(source_root: &Path, name: &str) -> std::path::PathBuf {
    let pkg = source_root.join(name);
    fs::create_dir_all(&pkg).unwrap();
    fs::write(pkg.join("Profile Customization Studio.exe"), b"fake exe").unwrap();
    pkg
}

#[test]
fn manifest_parses_and_validates() {
    let good = manifest_json("0.2.0", "artifacts/0.2.0", &"a".repeat(64));
    let m = UpdateManifest::parse(&good).unwrap();
    assert_eq!(m.version, "0.2.0");

    let bad_sha = manifest_json("0.2.0", "artifacts/0.2.0", "nothex");
    assert!(UpdateManifest::parse(&bad_sha).is_err());
    assert!(UpdateManifest::parse("{\"product\":\"x\"}").is_err());
}

#[test]
fn version_comparison() {
    assert!(version_is_newer("0.2.0", "0.1.0"));
    assert!(version_is_newer("0.1.1", "0.1.0"));
    assert!(!version_is_newer("0.1.0", "0.1.0"));
    assert!(!version_is_newer("0.1.0", "0.2.0"));
}

#[test]
fn install_layout_roundtrip() {
    let tmp = tempfile::tempdir().unwrap();
    let layout = InstallLayout::new(tmp.path());
    assert!(matches!(layout.health_status(), InstallStatus::NotInstalled));

    let exe = layout.studio_exe("0.1.0");
    fs::create_dir_all(exe.parent().unwrap()).unwrap();
    fs::write(&exe, b"exe").unwrap();
    layout.activate(&CurrentPointer {
        version: "0.1.0".into(),
        exe: exe.to_string_lossy().into_owned(),
        healthy: true,
        activated_at: "0".into(),
        previous_version: None,
    }).unwrap();

    match layout.health_status() {
        InstallStatus::Healthy { version, .. } => assert_eq!(version, "0.1.0"),
        other => panic!("expected healthy, got {other:?}"),
    }

    fs::remove_file(&exe).unwrap();
    assert!(matches!(layout.health_status(), InstallStatus::Broken { .. }));
}

#[test]
fn hash_verification_file_and_directory() {
    let tmp = tempfile::tempdir().unwrap();
    let file = tmp.path().join("a.txt");
    fs::write(&file, b"hello").unwrap();
    assert!(verify_sha256(&file, &sha_of_file(&file)).is_ok());
    assert!(verify_sha256(&file, &"a".repeat(64)).is_err());

    let dir = tmp.path().join("pkg");
    fs::create_dir_all(dir.join("sub")).unwrap();
    fs::write(dir.join("sub").join("b.txt"), b"world").unwrap();
    assert!(verify_sha256(&dir, &sha_of_dir(&dir)).is_ok());
    assert!(verify_sha256(&dir, &sha_of_file(&file)).is_err());
}

#[test]
fn update_transaction_end_to_end() {
    let server = tempfile::tempdir().unwrap(); // mock update server
    let app = tempfile::tempdir().unwrap();    // app data root
    let layout = InstallLayout::new(app.path());
    let provider = FileSystemProvider::new(server.path());

    // Existing install: 0.1.0.
    let exe_v1 = layout.studio_exe("0.1.0");
    fs::create_dir_all(exe_v1.parent().unwrap()).unwrap();
    fs::write(&exe_v1, b"old exe").unwrap();
    layout.activate(&CurrentPointer {
        version: "0.1.0".into(),
        exe: exe_v1.to_string_lossy().into_owned(),
        healthy: true,
        activated_at: "0".into(),
        previous_version: None,
    }).unwrap();

    // Server offers 0.2.0 as a directory package.
    let pkg = studio_pkg(&server.path().join("artifacts"), "0.2.0");
    let sha = sha_of_dir(&pkg);
    fs::write(
        server.path().join("manifest.json"),
        manifest_json("0.2.0", "artifacts/0.2.0", &sha),
    ).unwrap();

    match run_update_transaction(&layout, &provider, "0.1.0") {
        UpdateOutcome::Installed { version } => assert_eq!(version, "0.2.0"),
        other => panic!("expected install, got {other:?}"),
    }

    match layout.health_status() {
        InstallStatus::Healthy { version, .. } => assert_eq!(version, "0.2.0"),
        other => panic!("expected healthy, got {other:?}"),
    }

    // Old version kept for rollback; staging cleaned up.
    assert!(exe_v1.exists());
    assert!(layout.read_current().unwrap().is_some());
}

#[test]
fn update_transaction_is_uptodate_when_same_version() {
    let server = tempfile::tempdir().unwrap();
    let app = tempfile::tempdir().unwrap();
    let layout = InstallLayout::new(app.path());
    let provider = FileSystemProvider::new(server.path());
    fs::write(server.path().join("manifest.json"),
        manifest_json("0.1.0", "nowhere", &"a".repeat(64))).unwrap();
    assert!(matches!(
        run_update_transaction(&layout, &provider, "0.1.0"),
        UpdateOutcome::UpToDate
    ));
}

#[test]
fn failed_update_leaves_install_untouched() {
    let server = tempfile::tempdir().unwrap();
    let app = tempfile::tempdir().unwrap();
    let layout = InstallLayout::new(app.path());
    let provider = FileSystemProvider::new(server.path());

    // Manifest points at a missing artifact and at a corrupted one.
    let pkg = studio_pkg(&server.path().join("artifacts"), "0.2.0");
    fs::write(pkg.join("extra.txt"), b"tamper").unwrap(); // hash will not match
    let sha = "b".repeat(64);
    fs::write(server.path().join("manifest.json"),
        manifest_json("0.2.0", "artifacts/0.2.0", &sha)).unwrap();

    match run_update_transaction(&layout, &provider, "0.1.0") {
        UpdateOutcome::Failed(msg) => assert!(msg.contains("verify"), "got: {msg}"),
        other => panic!("expected verify failure, got {other:?}"),
    }
    assert!(matches!(layout.health_status(), InstallStatus::NotInstalled));
}
