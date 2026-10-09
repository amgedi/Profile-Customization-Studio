# Privacy and network behaviour

PCS stores project files where you choose. Native app preferences/recovery use OS-resolved application data; recents, GitHub caches and some preference state also use browser localStorage. Identity Kits, imported assets, history and variants can contain names, biographies, links, embedded images and local paths. Back up these files deliberately; they are excluded from the source repository.

Optional GitHub integration requests public user/repository/activity data from `https://api.github.com`. Contribution-calendar GraphQL requires an optional token. Native credentials use the OS keyring; a token enters frontend memory for authorised API calls and is not intended to be saved in projects. Explicit GitHub publication writes generated README/assets/workflow files after review; ordinary source tests do not authenticate or publish.

Custom image/avatar URLs and generated badge URLs can contact their selected hosts (including GitHub avatar servers and `img.shields.io`). README content may generate requests when rendered on GitHub. Export packages include selected content and attribution, not keyring credentials. Review custom URLs and exports before sharing.

Launcher contacts a configured update feed only through its update workflow; no official feed is bundled. Local filesystem feeds are for development. Remote feeds require HTTPS after publication hardening; checksums are integrity checks, not publisher signatures. External documentation links open in the user's browser.

No analytics SDK or telemetry endpoint was found in first-party source. This does not imply external APIs/media hosts collect no request data. Diagnostics can include executable paths, configured feed URLs and operational log tails: redact them before sharing. Repair resets preferences, not your project files.

Native filesystem permissions are broad to support user-selected import/export locations; they are granted to the main local window, not arbitrary remote windows. Imported content must remain inert. Project parsers/migrations are preserved during publication cleanup.

Support buttons open only the maintainer's existing GitHub Sponsors, Ko-fi and Buy Me a Coffee destinations in the system browser, after your click. No payment information is collected by PCS. Tutorial completion/skip is stored in native app-data with a local-storage mirror for immediate reloads. There is no support reminder timer.
