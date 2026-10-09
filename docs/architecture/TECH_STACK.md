# Current implementation

Studio uses React 18, TypeScript, Vite and Tauri 2. Launcher uses Rust and Slint; it does not require WebView2. Studio uses the Windows WebView2 runtime. The update helper is a separate Rust executable. BannerSpec, scene-core and contribution simulation are independent TypeScript workspaces. npm and Cargo lockfiles record exact dependency versions.
