# Isolated native smoke checks

Do not attach automated tests to your everyday Studio session. On Windows, changing APPDATA alone does not redirect native known-folder APIs.

Build a separate QA identity so draft, preference and WebView storage have separate application directories. Keep the tracked product identifier unchanged:

```powershell
npm ci
npm run build
$env:TAURI_CONFIG = '{"identifier":"dev.pcs.publicationqa"}'
cargo build --release --workspace --locked
Remove-Item Env:TAURI_CONFIG
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9523'
Start-Process target/release/pcs-studio.exe
Remove-Item Env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
```

Install optional Playwright tooling separately (`npm install --no-save --package-lock=false playwright`) and run `node scripts/native-smoke.cjs`. The script verifies the QA app-data identity before changing project state. Screenshots and results go into ignored `artifacts/native-smoke`. Close the QA instance afterward and rebuild without TAURI_CONFIG before packaging the normal product. Never expose a debugging port beyond localhost or enable it on an everyday session with personal credentials.

The smoke check covers native navigation, representative window sizes and document overflow. It does not replace manual dialog, accessibility, DPI, multi-monitor or sustained performance testing. Launcher UI requires separate manual inspection; unit tests cover update/rollback and install integrity.
