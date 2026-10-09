# PCS project format 1

A `.pcsproj` file is JSON with `formatVersion: 1`, `application: "profile-customization-studio"`, name, timestamps and a `bannerSpec` scene. Current scenes use BannerSpec 0.3; migrations accept supported older scenes without altering the original file. Project-format, scene-format and application versions are independent.

Optional fields carry README/statistics/contribution configuration, asset rights, design variants, history, platform profiles and target overrides. Unknown future properties are preserved where supported. Unsupported project versions are rejected. Native saving writes a temporary file and renames it. Browser mode downloads a new file. App preferences, recents and recovery use app data/localStorage and are separate from project files.

The authoritative interfaces and parser are `apps/studio/src/project.ts`; migrations and validation are in `packages/bannerspec`.
