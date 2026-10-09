use std::{fs,io,path::{Path,PathBuf}};
use pcs_launcher_core::{install::InstallLayout,manifest::{UpdateManifest,valid_version},provider::{UpdateProvider,HttpProvider},transaction::{run_update_transaction,UpdateOutcome}};

struct MaliciousProvider { version: String }
impl UpdateProvider for MaliciousProvider {
    fn fetch_manifest(&self)->io::Result<UpdateManifest>{Ok(UpdateManifest{product:"profile-customization-studio".into(),channel:"dev".into(),version:self.version.clone(),minimum_launcher_version:None,download_url:"unused".into(),sha256:"0".repeat(64),size:0,release_notes:None})}
    fn fetch_artifact(&self,_:&UpdateManifest,_:&Path)->io::Result<PathBuf>{panic!("invalid manifest must fail before download")}
}
#[test]
fn rejects_versions_that_are_paths_before_any_mutation(){
    let tmp=tempfile::tempdir().unwrap(); let layout=InstallLayout::new(tmp.path().join("install"));
    let sentinel=tmp.path().join("keep.txt"); fs::write(&sentinel,"untouched").unwrap();
    for v in ["../escape","1.2.3-../../escape","C:\\escape","1.2.3/escape","1.2.3:stream","1.2.3-","1.2"] {
        assert!(!valid_version(v));
        assert!(matches!(run_update_transaction(&layout,&MaliciousProvider{version:v.into()},"0.1.0"),UpdateOutcome::Failed(_)));
        assert!(layout.checked_version_dir(v).is_err());
    }
    assert_eq!(fs::read_to_string(sentinel).unwrap(),"untouched"); assert!(!layout.root().exists());
    assert!(valid_version("0.3.3-dev")); assert!(valid_version("1.2.3-rc.1+build.4"));
}
#[test]
fn rejects_http_feed_and_artifact_before_network_or_filesystem(){
    let p=HttpProvider{base_url:"http://localhost:1".into()};
    assert_eq!(p.fetch_manifest().unwrap_err().kind(),io::ErrorKind::InvalidInput);
    let p=HttpProvider{base_url:"https://example.invalid".into()};
    let mut m=MaliciousProvider{version:"1.2.3".into()}.fetch_manifest().unwrap(); m.download_url="http://localhost:1/evil.exe".into();
    let tmp=tempfile::tempdir().unwrap(); let dest=tmp.path().join("download");
    assert_eq!(p.fetch_artifact(&m,&dest).unwrap_err().kind(),io::ErrorKind::InvalidInput); assert!(!dest.exists());
}
