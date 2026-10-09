/**
 * Central product identity — the ONLY place UI reads versions from.
 * App version mirrors package.json/tauri.conf.json (kept in sync by release scripts);
 * BannerSpec version comes from the actual schema package.
 */
import { BANNERSPEC_VERSION } from "@pcs/bannerspec";

export const APP_VERSION = "0.3.3";
export const PRODUCT_NAME = "Profile Customization Studio";
export const TAGLINE = "Make your profile yours.";
export const CHANNEL = "stable";
export { BANNERSPEC_VERSION };
