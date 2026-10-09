//! Provider-agnostic update manifest. Never hardwired to a hosting service.

use std::fmt;

use serde::{Deserialize, Serialize};

/// Known channels. Unknown strings are preserved (forward compatibility).
pub const CHANNEL_STABLE: &str = "stable";
pub const CHANNEL_BETA: &str = "beta";
pub const CHANNEL_DEV: &str = "dev";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UpdateManifest {
    pub product: String,
    pub channel: String,
    pub version: String,
    #[serde(default)]
    pub minimum_launcher_version: Option<String>,
    pub download_url: String,
    pub sha256: String,
    pub size: u64,
    #[serde(default)]
    pub release_notes: Option<String>,
}

impl UpdateManifest {
    pub fn parse(json: &str) -> Result<Self, ManifestError> {
        let m: UpdateManifest = serde_json::from_str(json)?;
        m.validate()?;
        Ok(m)
    }

    pub fn validate(&self) -> Result<(), ManifestError> {
        if self.product.is_empty() {
            return Err(ManifestError::Invalid("product must not be empty".into()));
        }
        if !valid_version(&self.version) {
            return Err(ManifestError::Invalid("version must be a safe semantic version".into()));
        }
        if self.download_url.is_empty() {
            return Err(ManifestError::Invalid("download_url must not be empty".into()));
        }
        let h = self.sha256.trim().to_lowercase();
        if h.len() != 64 || !h.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(ManifestError::Invalid("sha256 must be 64 hex characters".into()));
        }
        Ok(())
    }
}

#[derive(Debug)]
pub enum ManifestError {
    Parse(String),
    Invalid(String),
}

impl fmt::Display for ManifestError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ManifestError::Parse(s) => write!(f, "manifest parse error: {s}"),
            ManifestError::Invalid(s) => write!(f, "invalid manifest: {s}"),
        }
    }
}
impl std::error::Error for ManifestError {}

impl From<serde_json::Error> for ManifestError {
    fn from(e: serde_json::Error) -> Self {
        ManifestError::Parse(e.to_string())
    }
}

/// Compare simple semver-ish versions (major.minor.patch), ignoring pre-release tags
/// beyond ordering `0.1.0 > 0.1.0-rc1`. Sufficient for launcher decisions in 0.x.
pub fn version_is_newer(candidate: &str, current: &str) -> bool {
    fn key(v: &str) -> Vec<u64> {
        v.split(['-', '+'])
            .next()
            .unwrap_or("")
            .split('.')
            .map(|p| p.parse().unwrap_or(0))
            .collect()
    }
    let (a, b) = (key(candidate), key(current));
    for i in 0..3 {
        let av = a.get(i).copied().unwrap_or(0);
        let bv = b.get(i).copied().unwrap_or(0);
        if av != bv {
            return av > bv;
        }
    }
    false
}

/// A version is a single safe path component, never a filesystem path.
pub fn valid_version(v: &str) -> bool {
    if v.len() > 96 || v.is_empty() || !v.bytes().all(|c| c.is_ascii_alphanumeric() || b".-+".contains(&c)) { return false; }
    let core = v.split(['-', '+']).next().unwrap_or("");
    let parts: Vec<_> = core.split('.').collect();
    if parts.len() != 3 || !parts.iter().all(|p| !p.is_empty() && p.bytes().all(|c| c.is_ascii_digit()) && p.parse::<u64>().is_ok()) { return false; }
    v[core.len()..].split(['-', '+']).skip(1).all(|p| !p.is_empty() && p.split('.').all(|s| !s.is_empty()))
}
