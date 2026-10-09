# Profile Customization Studio 0.3.3

Make your profile yours. PCS is a free, local-first Windows creative app for banners, motion and profile layouts.

## Download

**[Download PCS 0.3.3 for Windows x64](https://github.com/amgedi/Profile-Customization-Studio/releases/download/v0.3.3/PCS-0.3.3-Windows-x64.zip)**

Extract the whole ZIP and open **Profile Customization Studio.exe**. Windows 10/11 x64 and Microsoft Edge WebView2 Runtime are required. No developer tools or Launcher are needed. The portable app is unsigned, so Windows may show a publisher warning.

## Highlights

- A more cohesive Design, Motion, Profile and Preview workspace, with modern menus, scrollbars and accessible upload zones.
- Licensed photo scenes, scene-aware glows and improved layered rain, drifting fog, snow and particles.
- Animated Profile banners use the actual scene renderer and shared timeline. A frame-resource leak during animated Profile playback is fixed.
- Theme editing, saved custom palettes/backgrounds and supported translucent surfaces with readable fallbacks.
- A polished Local Studio for reusable assets, Identity Kits, history and design variants.

## Motion & export

Compose the whole scene as **GIF, WebM (VP9) or MP4 (H.264)**, with progress, cancellation and an encoded preview. GIF backgrounds are sampled by timestamp; video is silent and flattened onto the selected background. WebM/MP4 availability depends on runtime codec support.

Repeated saves preserve existing output by creating numbered companions such as name.pcs-new.gif and name.pcs-new-2.gif. GIF, WebM and PNG collision preservation and MP4 export/playback were verified in the Windows app.

Motion export limits: 60 seconds, 30 FPS, 4 megapixels and 4096 pixels per side. Video dimensions must be even. GIF uses per-frame 256-colour palettes and centisecond timing. Static exports remain static; Batch/Profile Package retain their static/SVG behaviour. File creation does not guarantee a platform will accept or animate the upload.

## Profile customization

Build GitHub README sections with optional public account data, repositories, badges and ten graphic statistics styles. Add actual buttons and searchable icons through visible insertion controls, then customize spacing, widths and alignment. Animated banner previews retain the designed scene.

Statistics use fetched data; unavailable metrics are omitted. Language summaries count primary languages in loaded repositories. Contribution calendars and streaks need a successful authenticated calendar fetch; that optional path was not exercised in this release QA.

## Easier to use

The thirteen-step startup tutorial follows real controls, including button/icon insertion, with Back, Next and Skip. Restart it from Help or Settings. Contextual **Guide Me** routes to useful actions across the workspaces. Keyboard navigation, reduced motion and local-first behaviour are preserved.

## Known notes

- Windows x64 is the verified platform. macOS/Linux builds are unverified.
- Platform previews are guidance; destination crops, SVG motion and GIF support vary.
- Interface GIF backgrounds are hidden when reduced motion is enabled. Custom Studio backgrounds do not enter exported artwork.
- No automatic update feed is configured. Development-tool advisories remain documented in [dependencies](https://github.com/amgedi/Profile-Customization-Studio/blob/v0.3.3/docs/dependencies.md).

## Support development

Optional support helps fund development, testing, documentation and accessibility. Every feature remains free.

[GitHub Sponsors](https://github.com/sponsors/amgedi) · [Ko-fi](https://ko-fi.com/openfhs) · [Buy Me a Coffee](https://buymeacoffee.com/openfhs)

## License

PCS source is **AGPL-3.0-only**. Third-party assets retain their licenses and attribution/share-alike requirements. The matching **PCS-0.3.3-public-source.zip** provides corresponding source and dependency notices; redistribute it with the Windows package. SHA256SUMS.txt verifies both archives.
