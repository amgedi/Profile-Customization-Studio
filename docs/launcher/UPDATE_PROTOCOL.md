# Update protocol

The update manifest contains `product`, `channel`, `version`, `download_url`, `sha256`, `size` and optional `minimum_launcher_version` / `release_notes`. Parsing rejects unknown fields. Versions must be safe semantic-version path components. An official remote feed is not configured by default.

Local filesystem feeds support directory packages. The core Studio transaction verifies a deterministic SHA-256 stream of sorted relative paths and file bytes, checks the Studio executable, records an install manifest and activates a versioned pointer. Existing installs are preserved. Linked/junction paths are refused before package traversal or install mutations.

HTTPS feeds reject HTTP, embedded credentials and redirects. The core Studio updater currently cannot install single-file/ZIP remote packages; it returns an explicit unsupported-package failure. Launcher self-update follows a separate helper path. Checksums detect corruption; they are not independent publisher signatures. Signed release manifests and official feed provisioning remain future release work.
