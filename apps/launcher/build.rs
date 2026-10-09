fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        embed_resource::compile("icons/launcher.rc", embed_resource::NONE).manifest_required().unwrap();
    }
    slint_build::compile("ui/launcher.slint").unwrap();
}
