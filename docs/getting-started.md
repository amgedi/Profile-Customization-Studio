# Windows setup

## Main app download

Extract the main-app Windows ZIP and open Profile Customization Studio.exe. Windows 10/11 and WebView2 Runtime are required. The startup tutorial is optional, and can be restarted from Help or Settings → Interface & startup. Guide Me opens the controls for the task you choose. Save a PCS file to keep editable work; Export saves images or a GitHub README package. See [tutorial](tutorial.md).

## Source development

Install Node 22.12+ / npm 10+, stable Rust MSVC, Visual Studio C++ Build Tools with Windows SDK, and WebView2. Run npm ci from the root. Browser: npm run dev -w @pcs/studio. Native: npm run tauri -w @pcs/studio -- dev. Checks: npm run typecheck, npm test, cargo test --workspace --locked. Build the main app: npm run build, then cargo build --release --locked -p pcs-studio. Run target/release/pcs-studio.exe directly.

The source retains Launcher/helper code and scripts/package-local.ps1 for maintainer development. That script is excluded from the normal-user packaging path. Public packages use scripts/package-public.mjs and contain no Launcher/update-helper executables. Keep user data outside the repository. PCS_SAFE_MODE=1 opens recovery mode. Browser/native capabilities differ; Windows is the release target.
