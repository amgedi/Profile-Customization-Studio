#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

// The Studio shell intentionally stays thin: file dialogs come from the
// dialog/fs plugins, and all scene logic lives in the TypeScript layer.
// Heavier native work (raster export, GIF encode) will land in dedicated crates.

#[tauri::command]
fn window_material(window: tauri::WebviewWindow, style: String, tint: String) -> Result<String, String> {
    if !["solid", "frosted", "translucent", "acrylic"].contains(&style.as_str()) { return Err("Unknown surface style".into()); }
    if tint.len()!=7 || !tint.starts_with('#') || !tint[1..].bytes().all(|b| b.is_ascii_hexdigit()) { return Err("Invalid tint".into()); }
    if style=="acrylic" {
        #[cfg(target_os="windows")]
        {
            let channel=|start|u8::from_str_radix(&tint[start..start+2],16).unwrap_or(32);
            let config=tauri::window::EffectsBuilder::new().effect(tauri::window::Effect::Acrylic).color(tauri::window::Color(channel(1),channel(3),channel(5),225)).build();
            if window.set_effects(config).is_ok() { return Ok("acrylic".into()); }
        }
    }
    window.set_effects(None::<tauri::utils::config::WindowEffectsConfig>).map_err(|e|e.to_string())?;
    Ok("solid".into())
}

const KEYRING_SERVICE: &str = "Profile Customization Studio";

/// R91 — GitHub tokens live in the OS secure credential store
/// (Windows Credential Manager), never in project files, localStorage or logs.
#[tauri::command]
fn secure_set_secret(account: String, secret: String) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &account).map_err(|e| e.to_string())?;
    entry.set_password(&secret).map_err(|e| e.to_string())
}

#[tauri::command]
fn secure_get_secret(account: String) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &account).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(p) => Ok(Some(p)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn secure_delete_secret(account: String) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &account).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

/// Reveal a folder or file in the platform file manager (export results).
#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
    std::process::Command::new("explorer")
        .arg(&path)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

fn support_url(destination: &str) -> Result<&'static str, String> {
    match destination {
        "github-sponsors" => Ok("https://github.com/sponsors/amgedi"),
        "ko-fi" => Ok("https://ko-fi.com/openfhs"),
        "buy-me-a-coffee" => Ok("https://buymeacoffee.com/openfhs"),
        _ => Err("Unknown support destination".into()),
    }
}
#[tauri::command]
fn support_open(destination: String) -> Result<(), String> {
    let url = support_url(&destination)?;
    std::process::Command::new("explorer").arg(url).spawn().map(|_| ()).map_err(|e| e.to_string())
}
#[cfg(test)]
mod support_tests {
    #[test]
    fn destinations_are_allowlisted() {
        for id in ["github-sponsors", "ko-fi", "buy-me-a-coffee"] { assert!(super::support_url(id).unwrap().starts_with("https://")); }
        assert!(super::support_url("https://evil.example").is_err());
        assert!(super::support_url("file:///C:/").is_err());
    }
}

/// Boot info for the webview: Safe Mode is requested by the launcher
/// (PCS_SAFE_MODE=1) or by holding Shift at process start (emergency key).
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct StartupInfo {
    safe_mode: bool,
    version: String,
    project_path: Option<String>,
}

#[tauri::command]
fn startup_info() -> StartupInfo {
    let env_safe = std::env::var("PCS_SAFE_MODE").map(|v| v == "1").unwrap_or(false);
    StartupInfo {
        safe_mode: env_safe || shift_held_at_startup(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        project_path: std::env::args().skip_while(|arg| arg != "--project").nth(1),
    }
}

#[cfg(windows)]
fn shift_held_at_startup() -> bool {
    // Safe-mode emergency key (R43): Shift held while launching.
    #[link(name = "user32")]
    extern "system" {
        fn GetAsyncKeyState(vkey: i32) -> i16;
    }
    unsafe { ((GetAsyncKeyState(0x10 /* VK_SHIFT */) as u16) & 0x8000) != 0 }
}

#[cfg(not(windows))]
fn shift_held_at_startup() -> bool { false }

// ---- window bounds persistence (R21/R76/R77) ------------------------------
// Persisted bounds are sanitized against currently available monitors before
// restore: a saved window from a disconnected monitor is recentered instead
// of bricking the app off-screen.

#[derive(serde::Serialize, serde::Deserialize)]
struct WindowBounds { x: f64, y: f64, width: f64, height: f64, maximized: bool }

struct BoundsState { last_write: std::sync::Mutex<std::time::Instant> }

fn bounds_path(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    use tauri::Manager;
    app.path().app_data_dir().ok().map(|d| d.join("window-bounds.json"))
}

fn save_bounds(app: &tauri::AppHandle, win: &tauri::WebviewWindow) {
    let Some(path) = bounds_path(app) else { return };
    let is_max = win.is_maximized().unwrap_or(false);
    let (x, y) = win.outer_position().map(|p| (p.x as f64, p.y as f64)).unwrap_or((0.0, 0.0));
    let (w, h) = win.inner_size().map(|s| (s.width as f64, s.height as f64)).unwrap_or((1440.0, 900.0));
    let b = WindowBounds { x, y, width: w, height: h, maximized: is_max };
    if let Ok(json) = serde_json::to_string(&b) {
        if let Some(dir) = path.parent() { let _ = std::fs::create_dir_all(dir); }
        let _ = std::fs::write(&path, json);
    }
}

fn restore_bounds(app: &tauri::AppHandle, win: &tauri::WebviewWindow) {
    let Some(path) = bounds_path(app) else { return };
    let Ok(json) = std::fs::read_to_string(&path) else { return };
    let Ok(b) = serde_json::from_str::<WindowBounds>(&json) else { return };
    let monitors: Vec<(i32, i32, u32, u32)> = win
        .available_monitors()
        .map(|ms| ms.iter().map(|m| {
            let p = m.position(); let s = m.size();
            (p.x, p.y, s.width, s.height)
        }).collect())
        .unwrap_or_default();
    if monitors.is_empty() { return; }
    let w = (b.width.max(960.0)) as i32;
    let h = (b.height.max(640.0)) as i32;
    let visible_on = |x: i32, y: i32| monitors.iter().any(|(mx, my, mw, mh)| {
        x + w.min(120) > *mx && x < mx + (*mw as i32) - 40 && y + 40 > *my && y < my + (*mh as i32) - 60
    });
    let mut nx = b.x as i32;
    let mut ny = b.y as i32;
    if !visible_on(nx, ny) {
        // Recenter on the nearest monitor (never open off-screen).
        let cx = nx as f64 + w as f64 / 2.0;
        let cy = ny as f64 + h as f64 / 2.0;
        let mut best = monitors[0];
        let mut best_d = f64::INFINITY;
        for m in &monitors {
            let mcx = m.0 as f64 + m.2 as f64 / 2.0;
            let mcy = m.1 as f64 + m.3 as f64 / 2.0;
            let d = ((mcx - cx).powi(2) + (mcy - cy).powi(2)).sqrt();
            if d < best_d { best_d = d; best = *m; }
        }
        nx = best.0 + (((best.2 as i32) - w) / 2).max(0);
        ny = best.1 + (((best.3 as i32) - h) / 2).max(0);
    }
    let _ = win.set_position(tauri::PhysicalPosition::new(nx, ny));
    if !b.maximized {
        let _ = win.set_size(tauri::PhysicalSize::new(w.max(1) as u32, h.max(1) as u32));
    } else {
        let _ = win.maximize();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(BoundsState { last_write: std::sync::Mutex::new(std::time::Instant::now()) })
        .invoke_handler(tauri::generate_handler![
            secure_set_secret,
            secure_get_secret,
            secure_delete_secret,
            open_path,
            support_open,
            window_material,
            startup_info
        ])
        .setup(|app| {
            if let Some(win) = app.get_webview_window("main") {
                restore_bounds(app.handle(), &win);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // Debounced bounds persistence; always flushed on close request.
            if let tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) = event {
                let Some(win) = window.get_webview_window("main") else { return };
                let state = window.state::<BoundsState>();
                let mut last = state.last_write.lock().unwrap();
                if last.elapsed() > std::time::Duration::from_millis(800) {
                    save_bounds(window.app_handle(), &win);
                    *last = std::time::Instant::now();
                }
            }
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if let Some(win) = window.get_webview_window("main") {
                    save_bounds(window.app_handle(), &win);
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Profile Customization Studio");
}

fn main() {
    if std::env::args().any(|arg| arg == "--version-json") {
        println!("{}", serde_json::json!({"version": env!("CARGO_PKG_VERSION"), "product": "pcs-studio"}));
        return;
    }
    run();
}
