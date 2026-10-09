//! Update providers. A provider is anything that can produce a manifest and
//! fetch an artifact. FilesystemProvider covers development + tests; the same
//! transaction code path will serve HTTP providers later.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use crate::manifest::UpdateManifest;

pub trait UpdateProvider {
    fn fetch_manifest(&self) -> io::Result<UpdateManifest>;
    fn fetch_artifact(&self, manifest: &UpdateManifest, dest_dir: &Path) -> io::Result<PathBuf>;
}

/// Local-directory provider. `download_url` is interpreted as a path relative
/// to the provider root (or an absolute path). Used with fixtures/update-server.
pub struct FileSystemProvider {
    pub root: PathBuf,
}

impl FileSystemProvider {
    pub fn new<P: Into<PathBuf>>(root: P) -> Self {
        Self { root: root.into() }
    }

    fn resolve(&self, url: &str) -> PathBuf {
        let p = Path::new(url);
        if p.is_absolute() {
            p.to_path_buf()
        } else {
            self.root.join(url)
        }
    }
}

impl UpdateProvider for FileSystemProvider {
    fn fetch_manifest(&self) -> io::Result<UpdateManifest> {
        let text = fs::read_to_string(self.root.join("manifest.json"))?;
        UpdateManifest::parse(&text).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))
    }

    fn fetch_artifact(&self, manifest: &UpdateManifest, dest_dir: &Path) -> io::Result<PathBuf> {
        let src = self.resolve(&manifest.download_url);
        crate::install::reject_link_ancestors(&src)?;
        crate::install::reject_link_ancestors(dest_dir)?;
        if !src.exists() {
            return Err(io::Error::new(io::ErrorKind::NotFound, format!("artifact missing: {}", src.display())));
        }
        fs::create_dir_all(dest_dir)?;
        let dest = dest_dir.join(src.file_name().ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "bad artifact name"))?);
        if src.is_dir() {
            copy_dir_recursive(&src, &dest)?;
        } else {
            fs::copy(&src, &dest)?;
        }
        Ok(dest)
    }
}

/// HTTP provider for a configurable update feed. Same transaction code path
/// as the filesystem provider; used when the user/config supplies a URL.
pub struct HttpProvider {
    pub base_url: String,
}

impl UpdateProvider for HttpProvider {
    fn fetch_manifest(&self) -> io::Result<UpdateManifest> {
        let url = format!("{}/manifest.json", self.base_url.trim_end_matches('/'));
        let url = checked_https(&url)?;
        let text = ureq::AgentBuilder::new().redirects(0).build().get(url.as_str())
            .timeout(std::time::Duration::from_secs(15))
            .call()
            .map_err(http_err)?
            .into_string()?;
        UpdateManifest::parse(&text).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))
    }

    fn fetch_artifact(&self, manifest: &UpdateManifest, dest_dir: &Path) -> io::Result<PathBuf> {
        let base = checked_https(&format!("{}/", self.base_url.trim_end_matches('/')))?;
        let url = base.join(&manifest.download_url).map_err(|e| io::Error::new(io::ErrorKind::InvalidInput,e))?;
        let url = checked_https(url.as_str())?;
        fs::create_dir_all(dest_dir)?;
        crate::install::reject_link_ancestors(dest_dir)?;
        let dest = dest_dir.join("download.artifact");
        crate::install::reject_link_ancestors(&dest)?;
        let mut reader = ureq::AgentBuilder::new().redirects(0).build().get(url.as_str())
            .timeout(std::time::Duration::from_secs(300))
            .call()
            .map_err(http_err)?
            .into_reader();
        let mut file = fs::File::create(&dest)?;
        std::io::copy(&mut reader, &mut file)?;
        Ok(dest)
    }
}

fn http_err(e: ureq::Error) -> io::Error {
    io::Error::new(io::ErrorKind::Other, e.to_string())
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        crate::install::reject_link_ancestors(&entry.path())?;
        let to = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_recursive(&entry.path(), &to)?;
        } else {
            fs::copy(entry.path(), to)?;
        }
    }
    Ok(())
}

fn checked_https(value: &str) -> io::Result<url::Url> {
    let url = url::Url::parse(value).map_err(|e| io::Error::new(io::ErrorKind::InvalidInput,e))?;
    if url.scheme() != "https" || url.host_str().is_none() || !url.username().is_empty() || url.password().is_some() {
        return Err(io::Error::new(io::ErrorKind::InvalidInput,"updates require HTTPS without embedded credentials"));
    }
    Ok(url)
}
