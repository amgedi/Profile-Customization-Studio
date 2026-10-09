//! pcs-update-helper
//!
//! Replaces the running launcher safely in two stages:
//!   launcher: download -> verify -> spawn helper -> exit
//!   helper:   wait for exit -> backup -> replace -> verify -> restart
//!             (restore backup on any failure)
//!
//! Usage:
//!   pcs-update-helper --current <launcher.exe> --staged <new.exe> --sha256 <hex> [--restart]

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, Instant};

struct Args {
    current: PathBuf,
    staged: PathBuf,
    sha256: String,
    restart: bool,
}

fn parse_args() -> Option<Args> {
    let mut it = std::env::args().skip(1);
    let (mut current, mut staged, mut sha256, mut restart) = (None, None, None, false);
    while let Some(a) = it.next() {
        match a.as_str() {
            "--current" => current = it.next().map(PathBuf::from),
            "--staged" => staged = it.next().map(PathBuf::from),
            "--sha256" => sha256 = it.next(),
            "--restart" => restart = true,
            _ => {}
        }
    }
    Some(Args { current: current?, staged: staged?, sha256: sha256?, restart })
}

fn sha256_of(p: &Path) -> Result<String, String> {
    let data = std::fs::read(p).map_err(|e| e.to_string())?;
    use sha2::{Digest, Sha256};
    Ok(hex::encode(Sha256::digest(&data)))
}

fn main() {
    let args = match parse_args() {
        Some(a) => a,
        None => {
            eprintln!("usage: pcs-update-helper --current <exe> --staged <exe> --sha256 <hex> [--restart]");
            std::process::exit(2);
        }
    };
    if let Err(e) = run(&args) {
        eprintln!("update failed: {e}");
        std::process::exit(1);
    }
}

fn run(args: &Args) -> Result<(), String> {
    // 1. Verify staged artifact before touching anything.
    let staged_hash = sha256_of(&args.staged)?;
    if !staged_hash.eq_ignore_ascii_case(&args.sha256) {
        return Err(format!("staged artifact hash mismatch ({staged_hash})"));
    }

    // 2. Wait for the launcher to exit (it exits right after spawning us).
    let deadline = Instant::now() + Duration::from_secs(30);
    let backup = args.current.with_extension("exe.bak");
    while args.current.exists() && !replaceable(&args.current) {
        if Instant::now() > deadline {
            return Err("launcher did not exit within 30s; aborting".into());
        }
        std::thread::sleep(Duration::from_millis(200));
    }

    // 3. Backup current, replace, verify.
    if args.current.exists() {
        std::fs::copy(&args.current, &backup).map_err(|e| format!("backup: {e}"))?;
    }
    if let Err(e) = std::fs::copy(&args.staged, &args.current) {
        // Restore.
        if backup.exists() {
            let _ = std::fs::copy(&backup, &args.current);
        }
        return Err(format!("replace: {e}"));
    }
    let new_hash = sha256_of(&args.current)?;
    if !new_hash.eq_ignore_ascii_case(&args.sha256) {
        if backup.exists() {
            let _ = std::fs::copy(&backup, &args.current);
        }
        return Err("replaced launcher failed verification; restored previous".into());
    }

    // 4. Restart and clean up.
    if args.restart {
        let _ = Command::new(&args.current).spawn();
    }
    let _ = std::fs::remove_file(&args.staged);
    let _ = std::fs::remove_file(&backup);
    Ok(())
}

#[cfg(windows)]
fn replaceable(p: &Path) -> bool {
    // Windows locks running executables; a rename probe tells us if it's free.
    let probe = p.with_extension("exe.probe");
    match std::fs::rename(p, &probe) {
        Ok(()) => {
            let _ = std::fs::rename(&probe, p);
            true
        }
        Err(_) => false,
    }
}

#[cfg(not(windows))]
fn replaceable(_p: &Path) -> bool { true }
