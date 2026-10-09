use std::fs;

use pcs_launcher_core::install::{CurrentPointer, InstallLayout, InstallStatus};

fn seed_install(layout: &InstallLayout, version: &str, bytes: &[u8]) {
    let exe = layout.studio_exe(version);
    fs::create_dir_all(exe.parent().unwrap()).unwrap();
    fs::write(&exe, bytes).unwrap();
    layout.write_install_manifest(&pcs_launcher_core::install::InstallManifest {
        version: version.into(),
        exe_sha256: {
            use sha2::{Digest, Sha256};
            hex::encode(Sha256::digest(bytes))
        },
        installed_at: "0".into(),
    }).unwrap();
    layout.activate(&CurrentPointer {
        version: version.into(),
        exe: exe.to_string_lossy().into_owned(),
        healthy: true,
        activated_at: "0".into(),
        previous_version: None,
    }).unwrap();
}

#[test]
fn verify_detects_tampering() {
    let tmp = tempfile::tempdir().unwrap();
    let layout = InstallLayout::new(tmp.path());
    seed_install(&layout, "1.0.0", b"original exe bytes");
    assert!(layout.verify_active().is_ok());
    // Tamper.
    fs::write(layout.studio_exe("1.0.0"), b"tampered bytes").unwrap();
    assert!(layout.verify_active().is_err());
}

#[test]
fn rollback_and_remove_versions() {
    let tmp = tempfile::tempdir().unwrap();
    let layout = InstallLayout::new(tmp.path());
    seed_install(&layout, "0.1.0", b"old");
    seed_install(&layout, "1.0.0-test.1", b"new");

    // Rollback to previous.
    layout.rollback_to("0.1.0").unwrap();
    assert!(matches!(layout.health_status(), InstallStatus::Healthy { version, .. } if version == "0.1.0"));

    // Remove non-active version; refuse removing active/last.
    layout.remove_version("1.0.0-test.1").unwrap();
    assert_eq!(layout.list_versions(), vec!["0.1.0".to_string()]);
    assert!(layout.remove_version("0.1.0").is_err());
    // Rollback to a removed version fails cleanly.
    assert!(layout.rollback_to("1.0.0-test.1").is_err());
}
