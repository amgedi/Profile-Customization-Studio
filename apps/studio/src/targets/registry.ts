/**
 * Platform target registry — first-party, versioned metadata for every
 * customization surface PCS can generate assets for (banners, headers,
 * README assets).
 *
 * Rules of the registry:
 *  - Only platforms where PCS has something useful to generate. No padding.
 *  - Every claim is either backed by a first-party source URL with a
 *    `sourceCheckedAt` date, or `verification: "unverified"`. We never
 *    guess silently — conversion planning surfaces unverified targets
 *    to the user before export.
 *  - `safeAreas` / `avatarOverlaps` are expressed in the coordinate space
 *    of `recommended` dimensions.
 */

export type TargetCategory = "code" | "social" | "creator" | "gaming" | "custom";
export type Verification = "verified" | "unverified";

export interface SafeArea {
  x: number;
  y: number;
  width: number;
  height: number;
  note?: string;
}

export interface TargetDef {
  id: string;
  displayName: string;
  category: TargetCategory;
  recommended: { width: number; height: number };
  minimum?: { width: number; height: number };
  safeAreas: SafeArea[];
  /** Regions covered by platform UI (avatar, buttons) — keep content out. */
  avatarOverlaps?: SafeArea[];
  /** e.g. ["png","jpg"] */
  staticFormats: string[];
  /** e.g. ["gif"] or [] */
  animatedFormats: string[];
  supportsAlpha: boolean;
  maxFileSizeMB?: number;
  animationSupport: "native" | "none" | "unverified" | "rasterize-only";
  /** Human description of how the platform crops/scales uploads. */
  cropBehavior: string;
  notes: string[];
  sourceUrl: string;
  /** ISO date the source was last checked, e.g. "2026-10-06". */
  sourceCheckedAt: string;
  verification: Verification;
  schemaVersion: 1;
}

export const TARGET_CATEGORIES: Array<{ id: TargetCategory; label: string; blurb: string }> = [
  { id: "code", label: "Code forges", blurb: "GitHub, GitLab, Codeberg — social previews and README-based profiles." },
  { id: "social", label: "Social", blurb: "Profile headers and banners on social networks." },
  { id: "creator", label: "Creator", blurb: "Channel art for video and creator platforms." },
  { id: "gaming", label: "Gaming", blurb: "Banners for gaming and streaming platforms." },
  { id: "custom", label: "Custom", blurb: "User-defined targets — you set the rules, PCS applies them as-is." },
];

const CHECKED = "2026-10-06";

export const TARGET_REGISTRY: TargetDef[] = [
  // ------------------------------------------------------------ code forges
  {
    id: "github-repo-social",
    displayName: "GitHub repository social preview",
    category: "code",
    recommended: { width: 1280, height: 640 },
    minimum: { width: 640, height: 320 },
    safeAreas: [],
    staticFormats: ["png", "jpg", "gif"],
    animatedFormats: ["gif"],
    supportsAlpha: true,
    maxFileSizeMB: 1,
    // GitHub docs list GIF as an accepted format, but animated playback in
    // social previews must not be assumed — treat as unverified.
    animationSupport: "unverified",
    cropBehavior: "GitHub stores the image as-is (2:1 recommended) and crops it for link unfurls; no user-facing crop UI.",
    notes: [
      "Uploaded per-repository under Settings > Social preview.",
      "Recommended 1280×640 (2:1) renders best; minimum 640×320.",
      "GIF is an accepted upload format, but whether it animates in unfurls is not documented — export static for reliability.",
    ],
    sourceUrl: "https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview",
    sourceCheckedAt: CHECKED,
    verification: "verified",
    schemaVersion: 1,
  },
  {
    id: "github-profile-readme",
    displayName: "GitHub profile README asset",
    category: "code",
    recommended: { width: 1280, height: 640 },
    minimum: { width: 640, height: 320 },
    safeAreas: [],
    staticFormats: ["png", "jpg", "gif", "svg"],
    animatedFormats: ["gif"],
    supportsAlpha: true,
    animationSupport: "native",
    cropBehavior: "README images render at their intrinsic size scaled to the content column width (~830px on desktop); the browser preserves aspect ratio.",
    notes: [
      "Not a banner — GitHub profiles are built from a repository README named after your username.",
      "PCS generates images/SVGs you embed in the README; GitHub serves them via camo (no alpha loss).",
      "Dark-mode readers: consider a semi-opaque background so the asset survives both themes.",
    ],
    sourceUrl: "https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/customizing-your-profile/managing-your-profile-readme",
    sourceCheckedAt: CHECKED,
    verification: "unverified",
    schemaVersion: 1,
  },
  {
    id: "gitlab-profile-readme",
    displayName: "GitLab profile README asset",
    category: "code",
    recommended: { width: 1280, height: 640 },
    minimum: { width: 640, height: 320 },
    safeAreas: [],
    staticFormats: ["png", "jpg", "gif", "svg"],
    animatedFormats: ["gif"],
    supportsAlpha: true,
    animationSupport: "native",
    cropBehavior: "README images render inline in the profile page content column; the browser scales them to fit.",
    notes: [
      "Not a banner — GitLab profiles are README-based (a project named after your username).",
      "No native profile banner surface exists; PCS generates README-embedded assets only.",
    ],
    sourceUrl: "https://docs.gitlab.com/ee/user/profile/",
    sourceCheckedAt: CHECKED,
    verification: "unverified",
    schemaVersion: 1,
  },
  {
    id: "codeberg-readme",
    displayName: "Codeberg README asset",
    category: "code",
    recommended: { width: 1280, height: 640 },
    minimum: { width: 640, height: 320 },
    safeAreas: [],
    staticFormats: ["png", "jpg", "gif", "svg"],
    animatedFormats: ["gif"],
    supportsAlpha: true,
    animationSupport: "native",
    cropBehavior: "README images render inline in the repository/organization page; the browser scales them to fit.",
    notes: [
      "Images are supported via repo README; PCS generates README-embedded assets only.",
      "No personal-profile banner surface is documented — do not assume banner support.",
    ],
    sourceUrl: "https://docs.codeberg.org/markdown/",
    sourceCheckedAt: CHECKED,
    verification: "unverified",
    schemaVersion: 1,
  },

  // ---------------------------------------------------------------- social
  {
    id: "discord-profile-banner",
    displayName: "Discord profile banner",
    category: "social",
    recommended: { width: 680, height: 240 },
    minimum: { width: 600, height: 240 },
    safeAreas: [
      { x: 0, y: 0, width: 680, height: 48, note: "Top strip can be overlaid by platform UI; keep it simple." },
    ],
    avatarOverlaps: [
      { x: 30, y: 148, width: 92, height: 92, note: "Avatar sits over the banner's lower-left on the profile card." },
    ],
    staticFormats: ["png", "jpg"],
    animatedFormats: ["gif"],
    supportsAlpha: false,
    maxFileSizeMB: 10,
    animationSupport: "unverified",
    cropBehavior: "Discord shows the banner at a fixed 17:6-ish card crop; wider images are scaled and center-cropped vertically.",
    notes: [
      "Profile banners require Discord Nitro.",
      "Animated GIF banners are widely reported to work with Nitro, but this is not confirmed in first-party documentation — review a live test before shipping.",
      "Values below (680×240 recommended, 10MB) come from community guides, not official docs.",
    ],
    sourceUrl: "https://support.discord.com/hc/en-us/articles/206346498-User-Settings",
    sourceCheckedAt: CHECKED,
    verification: "unverified",
    schemaVersion: 1,
  },
  {
    id: "discord-server-profile",
    displayName: "Discord server profile banner",
    category: "social",
    recommended: { width: 600, height: 240 },
    safeAreas: [],
    avatarOverlaps: [
      { x: 24, y: 150, width: 80, height: 80, note: "Server avatar overlaps the banner's lower-left." },
    ],
    staticFormats: ["png", "jpg"],
    animatedFormats: ["gif"],
    supportsAlpha: false,
    maxFileSizeMB: 10,
    animationSupport: "unverified",
    cropBehavior: "Server banner area is a fixed-height strip; wider images are scaled and center-cropped.",
    notes: [
      "Per-server profile banners (server-specific identity) use roughly 600×240.",
      "Availability depends on server boost tier / Nitro — not confirmed in first-party docs.",
    ],
    sourceUrl: "https://support.discord.com/hc/en-us/articles/206346498-User-Settings",
    sourceCheckedAt: CHECKED,
    verification: "unverified",
    schemaVersion: 1,
  },
  {
    id: "x-profile-header",
    displayName: "X profile header",
    category: "social",
    recommended: { width: 1500, height: 500 },
    safeAreas: [
      { x: 0, y: 100, width: 1500, height: 300, note: "Mobile/web crop the top and bottom; keep text within the middle band." },
    ],
    avatarOverlaps: [
      { x: 30, y: 300, width: 134, height: 134, note: "Profile photo overlaps the banner's lower-left." },
    ],
    staticFormats: ["jpg", "gif", "png"],
    animatedFormats: [],
    supportsAlpha: false,
    animationSupport: "none",
    cropBehavior: "X displays the 3:1 header as-is on desktop; mobile crops top/bottom aggressively.",
    notes: [
      "Animated GIF headers are not supported — upload a static image.",
      "Keep key content centered; mobile clients crop more aggressively than desktop.",
    ],
    sourceUrl: "https://help.x.com/en/using-x/profile-photo-and-header-image-size",
    sourceCheckedAt: CHECKED,
    verification: "verified",
    schemaVersion: 1,
  },
  {
    id: "linkedin-background",
    displayName: "LinkedIn profile background",
    category: "social",
    recommended: { width: 1584, height: 396 },
    safeAreas: [
      { x: 0, y: 0, width: 1584, height: 260, note: "Profile photo and action buttons overlay the lower-left region on desktop." },
    ],
    avatarOverlaps: [
      { x: 48, y: 200, width: 152, height: 152, note: "Profile photo overlaps the banner's lower-left." },
    ],
    staticFormats: ["png", "jpg"],
    animatedFormats: [],
    supportsAlpha: false,
    animationSupport: "none",
    cropBehavior: "LinkedIn displays the 4:1 background image as-is at desktop width and crops it on mobile.",
    notes: [
      "GIF is not supported — background images are static.",
      "Community-sourced dimensions (1584×396); LinkedIn does not publish an official spec page.",
    ],
    sourceUrl: "https://www.linkedin.com/help/linkedin/answer/29496",
    sourceCheckedAt: CHECKED,
    verification: "unverified",
    schemaVersion: 1,
  },
  {
    id: "bluesky-header",
    displayName: "Bluesky profile header",
    category: "social",
    recommended: { width: 1500, height: 500 },
    safeAreas: [],
    avatarOverlaps: [
      { x: 16, y: 350, width: 130, height: 130, note: "Avatar overlaps the banner's lower-left." },
    ],
    staticFormats: ["jpg", "png"],
    animatedFormats: [],
    supportsAlpha: false,
    animationSupport: "none",
    cropBehavior: "Bluesky displays the 3:1 header as-is; mobile scales it to screen width.",
    notes: [
      "3:1 header (1500×500) is the widely used spec, but Bluesky does not publish a first-party dimensions page — verify before release.",
    ],
    sourceUrl: "https://blueskyweb.zendesk.com/hc/en-us/articles/15820682583197",
    sourceCheckedAt: CHECKED,
    verification: "unverified",
    schemaVersion: 1,
  },

  // --------------------------------------------------------------- creator
  {
    id: "youtube-channel-banner",
    displayName: "YouTube channel banner",
    category: "creator",
    recommended: { width: 2560, height: 1440 },
    minimum: { width: 2048, height: 1152 },
    safeAreas: [
      { x: 662, y: 551, width: 1235, height: 338, note: "Official 'safe area' — all text and logos must fit here to survive TV/desktop/mobile crops." },
    ],
    staticFormats: ["png", "jpg"],
    animatedFormats: [],
    supportsAlpha: false,
    maxFileSizeMB: 6,
    animationSupport: "none",
    cropBehavior: "YouTube scales the single upload per device: TV shows nearly the full 2560×1440, desktop shows the 2560×423 strip, mobile the 1235×338 safe area.",
    notes: [
      "One upload renders everywhere; the 1235×338 safe area is the only region guaranteed visible.",
      "Maximum file size 6MB; static image only.",
    ],
    sourceUrl: "https://support.google.com/youtube/answer/2972003",
    sourceCheckedAt: CHECKED,
    verification: "verified",
    schemaVersion: 1,
  },

  // ---------------------------------------------------------------- gaming
  {
    id: "twitch-profile-banner",
    displayName: "Twitch profile banner",
    category: "gaming",
    recommended: { width: 1200, height: 480 },
    safeAreas: [],
    staticFormats: ["gif", "jpg", "png"],
    animatedFormats: [],
    supportsAlpha: false,
    maxFileSizeMB: 10,
    animationSupport: "unverified",
    cropBehavior: "Twitch scales the banner to a fixed-height strip on the channel page; wider images center-crop horizontally.",
    notes: [
      "Video Player Banner (the offline screen) is a distinct 1920×1080 asset — do not reuse this.",
      "Animated video player banners are not natively supported; profile-banner animation is unverified — treat as static.",
      "Community-sourced dimensions; Twitch's help center does not publish an official spec page.",
    ],
    sourceUrl: "https://help.twitch.tv/s/article/channel-page-customization",
    sourceCheckedAt: CHECKED,
    verification: "unverified",
    schemaVersion: 1,
  },
  {
    id: "reddit-community-banner",
    displayName: "Reddit community banner",
    category: "social",
    recommended: { width: 1920, height: 384 },
    minimum: { width: 1080, height: 128 },
    safeAreas: [],
    staticFormats: ["png", "jpg"],
    animatedFormats: [],
    supportsAlpha: false,
    animationSupport: "none",
    cropBehavior: "Reddit center-crops the uploaded banner to the subreddit's configured banner height per viewport.",
    notes: [
      "Desktop community banners historically allow very wide, short uploads (min 1072×128 desktop, 1080×128 mobile); current official numbers are not published — verify in mod tools before release.",
    ],
    sourceUrl: "https://support.reddithelp.com/hc/en-us/articles/360043032652",
    sourceCheckedAt: CHECKED,
    verification: "unverified",
    schemaVersion: 1,
  },

  // ---------------------------------------------------------------- custom
  {
    id: "custom-target",
    displayName: "Custom target",
    category: "custom",
    recommended: { width: 1280, height: 640 },
    safeAreas: [],
    staticFormats: ["png", "jpg", "webp", "gif", "svg"],
    animatedFormats: ["gif"],
    supportsAlpha: true,
    animationSupport: "native",
    cropBehavior: "No platform crop — PCS applies your chosen settings as-is.",
    notes: [
      "User-defined target; PCS applies your chosen settings as-is.",
    ],
    sourceUrl: "",
    sourceCheckedAt: CHECKED,
    verification: "unverified",
    schemaVersion: 1,
  },
];

// Upload surfaces checked against the linked platform documentation.
function addTarget(id: string, displayName: string, category: TargetCategory, width: number, height: number, sourceUrl: string, notes: string[], verified = true, maxFileSizeMB?: number): void {
 TARGET_REGISTRY.splice(TARGET_REGISTRY.length - 1, 0, {id, displayName, category, recommended:{width,height}, safeAreas:[], staticFormats:['png','jpg'], animatedFormats:[], supportsAlpha:false, animationSupport:'none', cropBehavior:'Responsive platform layout can crop the edges. Preview the upload on the platform before publishing.', notes, sourceUrl, sourceCheckedAt:'2026-10-08', verification:verified?'verified':'unverified', schemaVersion:1, maxFileSizeMB});
}
addTarget('discord-server-banner','Discord server banner','gaming',960,540,'https://support.discord.com/hc/en-us/articles/360028716472-Server-Banners',['Level 2 server boost required for static banners. Keep the top 48 pixels clear. Level 3 supports GIF; PCS exports a still image here.']);
addTarget('kofi-cover','Ko-fi cover','creator',1200,400,'https://help.ko-fi.com/hc/en-us/articles/360004243378-Make-your-page-stand-out-with-a-cover-image',['3:1 cover. Mobile crops the sides. Static JPG or PNG.'],true,8);
addTarget('patreon-cover','Patreon creator cover','creator',1600,400,'https://support.patreon.com/hc/en-us/articles/360026139111-Customize-your-creator-page',['Recommended creator page cover dimensions.']);
addTarget('behance-banner','Behance profile banner','creator',3200,410,'https://help.behance.net/hc/en-us/articles/360015540594-Guide-Profile-Banner',['Optimal profile banner size according to Behance.']);
addTarget('artstation-background','ArtStation profile background','creator',2560,720,'https://help.artstation.com/en/articles/16155203-how-do-i-change-my-background-profile-image',['ArtStation asks for PNG or JPG over 1920×640. This larger working canvas meets that guidance.']);
addTarget('dev-article-cover','DEV article cover','code',1000,420,'https://dev.to/p/editor_guide/',['Article cover, not a profile banner.']);
addTarget('hashnode-article-cover','Hashnode article cover','code',1200,630,'https://docs.hashnode.com/blogs/editor/writing-a-blog-post',['Blog article cover, not a profile header.']);
addTarget('itch-project-header','itch.io project header','gaming',960,320,'https://itch.io/docs/creators/design',['PCS working size: itch.io specifies no fixed header dimensions. Replaces the project title. PNG transparency supported.']);
addTarget('reddit-mobile-banner','Reddit mobile community banner','social',1080,128,'https://support.reddithelp.com/hc/en-us/articles/15484339588884-Banner',['Minimum mobile community banner dimensions.']);
addTarget('tiktok-profile-photo','TikTok profile photo','social',800,800,'https://support.tiktok.com/en/getting-started/setting-up-your-profile/adding-a-profile-photo-or-video',['PCS square working size. Current upload limits could not be verified. Profile photo only; TikTok does not offer a profile header.'],false);
addTarget('facebook-cover','Facebook cover','social',851,315,'https://www.facebook.com/help/125379114252045',['PCS working preset. Current official upload dimensions and crop rules could not be verified.'],false);
addTarget('steam-avatar','Steam avatar','gaming',184,184,'https://help.steampowered.com/',['PCS working preset. Confirm current upload limits in Steam profile settings.'],false);
const reddit=TARGET_REGISTRY.find(t=>t.id==='reddit-community-banner')!;
Object.assign(reddit,{recommended:{width:1072,height:128},minimum:{width:1072,height:128},notes:['Minimum desktop community banner dimensions. Mobile uses a separate 1080×128 upload.'],sourceUrl:'https://support.reddithelp.com/hc/en-us/articles/15484339588884-Banner',sourceCheckedAt:'2026-10-08',verification:'verified'});
const discord=TARGET_REGISTRY.find(t=>t.id==='discord-profile-banner')!;
Object.assign(discord,{minimum:{width:680,height:240},maxFileSizeMB:10,sourceUrl:'https://support.discord.com/hc/en-us/articles/4403147417623-Custom-Profiles',sourceCheckedAt:'2026-10-08',notes:['Nitro required. Minimum 680×240. PNG, JPG or animated GIF under 10 MB; this exporter creates a still image.']});
const itch=TARGET_REGISTRY.find(t=>t.id==='itch-project-header')!;itch.supportsAlpha=true;
const custom=TARGET_REGISTRY.find(t=>t.id==='custom-target')!;custom.animatedFormats=['svg'];custom.staticFormats=custom.staticFormats.filter(f=>f!=='gif');

const youtube=TARGET_REGISTRY.find(t=>t.id==='youtube-channel-banner')!;
youtube.safeAreas=[{x:508,y:509,width:1544,height:423,note:'1235×338 safe area at the 2048×1152 minimum, scaled proportionally to this 2560×1440 working canvas.'}];
youtube.sourceUrl='https://support.google.com/youtube/answer/10456525?hl=en';youtube.sourceCheckedAt='2026-10-08';
const server=TARGET_REGISTRY.find(t=>t.id==='discord-server-banner')!;server.safeAreas=[{x:0,y:48,width:960,height:492,note:'Keep the top 48 pixels unbusy for the server title.'}];
discord.safeAreas=[];
const linkedin=TARGET_REGISTRY.find(t=>t.id==='linkedin-background')!;linkedin.sourceUrl='https://www.linkedin.com/help/linkedin/answer/a568217/';linkedin.sourceCheckedAt='2026-10-08';

export function getTarget(id: string): TargetDef | undefined {
  return TARGET_REGISTRY.find((t) => t.id === id);
}

/** Group targets by category. Returns a plain object keyed by TargetCategory. */
export function targetsByCategory(): Record<TargetCategory, TargetDef[]> {
  const out = {} as Record<TargetCategory, TargetDef[]>;
  for (const c of TARGET_CATEGORIES) out[c.id] = [];
  for (const t of TARGET_REGISTRY) {
    (out[t.category] ??= []).push(t);
  }
  return out;
}
