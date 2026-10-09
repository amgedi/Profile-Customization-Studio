//! Headless updater CLI — runs the same update transaction as the launcher.
//! Used for automated QA and scripting:
//!   pcs-updater-cli --feed <dir-or-url> [--root <appdata-root>]

fn main() {
    let mut feed = String::new();
    let mut root = pcs_launcher_core::install::InstallLayout::default_appdata();
    let mut args = std::env::args().skip(1);
    while let Some(a) = args.next() {
        match a.as_str() {
            "--feed" => feed = args.next().unwrap_or_default(),
            "--root" => root = std::path::PathBuf::from(args.next().unwrap_or_default()),
            _ => {}
        }
    }
    if feed.is_empty() {
        eprintln!("usage: pcs-updater-cli --feed <dir> [--root <appdata>]");
        std::process::exit(2);
    }
    let layout = pcs_launcher_core::install::InstallLayout::new(root);
    let current = match layout.health_status() {
        pcs_launcher_core::install::InstallStatus::Healthy { version, .. } => version,
        _ => "0.0.0".into(),
    };
    let url = feed.trim_end_matches('/');
    let provider: Box<dyn pcs_launcher_core::provider::UpdateProvider> =
        if url.starts_with("http") {
            Box::new(pcs_launcher_core::provider::HttpProvider { base_url: url.to_string() })
        } else {
            Box::new(pcs_launcher_core::provider::FileSystemProvider::new(url))
        };
    match pcs_launcher_core::transaction::run_update_transaction(&layout, provider.as_ref(), &current) {
        pcs_launcher_core::transaction::UpdateOutcome::Installed { version } => {
            println!("installed {version}");
            match layout.verify_active() {
                Ok(lines) => {
                    for l in lines {
                        println!("verify: {l}");
                    }
                }
                Err(e) => {
                    println!("verify FAILED: {e}");
                    std::process::exit(1);
                }
            }
        }
        pcs_launcher_core::transaction::UpdateOutcome::UpToDate => println!("up-to-date"),
        pcs_launcher_core::transaction::UpdateOutcome::Failed(e) => {
            println!("failed: {e}");
            std::process::exit(1);
        }
    }
}
