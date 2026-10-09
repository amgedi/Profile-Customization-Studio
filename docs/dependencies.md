# Dependency and development-server policy

Commit npm and Cargo lockfiles. Use `npm ci` and Cargo `--locked` for reproducible resolution. Ordinary source validation requires no personal secrets.

Publication audit found development-tool advisories affecting the current Vite/Vitest/tinypool/esbuild dependency tree. npm recommends major Vite/Vitest upgrades; this cleanup does not force those upgrades. The app does not bundle the development/test server, and CI uses `vitest run`, not the UI server. Do not expose development/test servers to untrusted networks or run untrusted test code. This limits exposure but is not a claim that advisories are fixed.

Run `npm audit` and `npm audit --omit=dev` to review current advisories. Rust advisories should be checked with `cargo audit` when installed; its absence is an audit gap, not a clean result. Dependency updates should be tested independently rather than hidden in unrelated formatting changes.

Distributions must carry dependency licence notices. `scripts/collect-node-notices.mjs` collects full installed production-package licence texts into local release staging. Rust licences and notice requirements must also be checked for the selected release dependency graph, including Slint's GPL/commercial licensing options. PCS uses the GPL-compatible open-source Slint option, not an asserted commercial licence.

The publication check with cargo-audit 0.22.2 found no vulnerability entries and four informational warnings: unmaintained bincode 2.0.1, proc-macro-error 1.0.4 and ttf-parser 0.25.1, plus glib 0.18.5 VariantStrIter unsoundness. glib is in the non-Windows dependency graph; Windows is the verified platform. These warnings remain open dependency maintenance work, not repaired claims.

## 0.3.3 release checks — 9 October 2026

The refreshed npm audit reports zero production dependency advisories. The development graph has six advisories: three moderate, one high, two critical, affecting Vite, Vitest, vite-node, @vitest/mocker, esbuild and tinypool. These tools are not bundled in the main app; upgrades remain separate maintenance work. Do not expose their servers or execute untrusted test code. This release does not claim those advisories are fixed.

The refreshed RustSec check reports zero vulnerabilities and the same four informational warnings in the complete native workspace. The release report records their scope and the database commit/date. Main-app Windows dependency license texts are shipped in RUST_LICENSES.txt; supplemental upstream texts are in SUPPLEMENTAL_LICENSES.txt. Source includes local Launcher code, while the main-app ZIP does not include Slint/Launcher executables.
