# Security

PCS 0.3.3 is the current stable release. Security fixes target the current release/source; older development builds are unsupported. No automatic update feed is configured.

Report vulnerabilities privately through the repository's **Security → Report a vulnerability** interface when private vulnerability reporting has been enabled. Use private reporting when available. No security email is designated; do not post exploit details, credentials or private project files in public issues. If private reporting is unavailable, wait for the owner to provide a private channel.

Include the affected version, operating system, reproduction steps using fictional data, expected security boundary, impact and a minimal sample. Redact tokens, usernames, private URLs and local paths. Do not use real credentials to demonstrate a finding.

Important boundaries include imported project/media content, SVG rendering, native filesystem/keyring permissions, GitHub publication and update executable integrity. The native main window needs filesystem access for user-selected projects/exports and local data. Dialog selection does not replace the native capability boundary. Read [privacy](docs/privacy.md) and [dependency policy](docs/dependencies.md).
