/**
 * Photo Scene system — real photographic backgrounds (bundled, properly
 * licensed — see public/photos/licenses.json) combined with PCS ambience,
 * text and frames. Photo + procedural = the signature look.
 *
 * Safe-area rule: title/subtitle default INSIDE the GitHub safe area;
 * overlays and ambience may extend beyond it.
 */
import { linear, type BannerSpecDocument, type Layer, type GroupKind } from "@pcs/bannerspec";
import { makeGroup, generateGroupChildren, uid } from "./scenegen.js";
import { LICENSES, licenseFor } from "./photoLicenses.js";

export interface PhotoSceneOptions {
  file: string;
  name: string;
  blurb: string;
  tags: string[];
  /** cover-fit crop focus, 0..1 (x,y of focal point) */
  focus?: { x: number; y: number };
  /** overall tone for legibility */
  scrim?: [string, string];
  /** ambient overlays to layer on top */
  ambience?: Array<"rain" | "snow" | "fog" | "stars" | "fireflies" | "bokeh" | "dust" | "embers">;
  /** gradient tint over the photo (mood grade) */
  tint?: { colors: string[]; opacity: number };
  vignette?: number;
  title: string;
  subtitle: string;
  titleGlow?: string;
  textAlignment?: "start" | "middle";
}

/** Photo layers: background image + darkening scrim + vignette + text. */
const PHOTO_SIZES:Record<string,number[]>={"aurora-sky.jpg": [1280, 352], "cafe-night.jpg": [1280, 857], "desert-stars.jpg": [1280, 1793], "foggy-forest.jpg": [1280, 960], "library-warm.jpg": [1280, 1700], "mountain-morning.jpg": [1280, 860], "night-skyline.jpg": [1280, 720], "ocean-sunset.jpg": [1280, 853], "rainy-city-night.jpg": [1280, 1920], "snowy-forest.jpg": [1280, 672]};
export function photoScene(o: PhotoSceneOptions, seedBase = 0): (W: number, H: number) => BannerSpecDocument {
  return (W, H) => {
    const sd = (k: number) => seedBase + k;
    // GitHub-safe default area for a 1500x500 README banner ≈ center band;
    // we keep title inside x:[W*0.08, W*0.6] and y:[H*0.28, H*0.72].
    const doc: BannerSpecDocument = {
      specVersion: "0.3",
      canvas: { width: W, height: H, background: "#0a0d14" },
      layers: [],
      brand: { primary: o.titleGlow ?? "#e5e7eb", secondary: o.titleGlow ?? "#c9d2e0", accent: o.titleGlow ?? "#e5e7eb", text: "#ffffff", muted: "#c9d2e0" },
      animation: { duration: 8, loop: true },
    };
    const push = (l: object) => doc.layers.push({ ...(l as Record<string, unknown>), id: uid() } as unknown as Layer);

    // Background photo (cover) — real, licensed, bundled.
    push({
      type: "image", name: "Background Photo", visible: true, locked: false, opacity: 1, rotation: 0,
      x: 0, y: 0, width: W, height: H,
      src: `photos/${o.file}`,
      fit: "cover",sourceWidth:PHOTO_SIZES[o.file]?.[0],sourceHeight:PHOTO_SIZES[o.file]?.[1],focalX:o.focus?.x??.5,focalY:o.focus?.y??.5,
      meta: { focal: o.focus ?? { x: 0.5, y: 0.5 } },
      license: licenseFor(o.file) ?? undefined,
    } as unknown as Layer);

    // Scrim for text legibility (left-weighted so the title zone is calm).
    push({
      type: "rect", name: "Scrim", visible: true, locked: false, opacity: 0.72, rotation: 0,
      x: 0, y: 0, width: W, height: H,
      fill: linear(o.scrim ? [
        { color: o.scrim[0], offset: 0 }, { color: o.scrim[0], offset: 0.55 }, { color: o.scrim[1], offset: 1 },
      ] : [
        { color: "#0a0d14", offset: 0 }, { color: "#0a0d14", offset: 0.55 }, { color: "#0a0d1400", offset: 1 },
      ], 0),
      cornerRadius: 0,
    } as unknown as Layer);

    // Mood tint (grade).
    if (o.tint) {
      push({
        type: "rect", name: "Color grade", visible: true, locked: false, opacity: o.tint.opacity, rotation: 0,
        x: 0, y: 0, width: W, height: H,
        fill: linear(o.tint.colors.map((c, i) => ({ color: c, offset: i / (o.tint!.colors.length - 1) })), 45),
      } as unknown as Layer);
    }

    // Vignette.
    if (o.vignette) {
      push({
        type: "rect", name: "Vignette", visible: true, locked: false, opacity: o.vignette, rotation: 0,
        x: 0, y: 0, width: W, height: H,
        fill: { type: "radial", stops: [{ color: "#00000000", offset: 0.55 }, { color: "#000000", offset: 1 }] },
        cornerRadius: 0,
      } as unknown as Layer);
    }

    // Ambience (procedural groups; seed-derived per scene).
    for (const a of o.ambience ?? []) {
      const kind = a as GroupKind;
      const P = (count: number, speed: number, intensity: number) => ({ count, speed, intensity, seed: sd(count) });
      switch (a) {
        case "rain": push({type:'rect',name:'Window raindrops',visible:true,locked:false,opacity:1,rotation:0,x:0,y:0,width:W,height:H,fill:'#00000000',effects:[{id:uid(),type:'rain-fx',visible:true,color:'#dbeafe',params:{amount:70,speed:.7,sizeMin:1.4,sizeMax:5,depth:.8,opacity:.8}}]}); break;
        case "snow": doc.layers.push(makeGroup("snow", "Snow", P(26, 0.7, 0.9), W, H)); break;
        case "fog": push({type:'rect',name:'Forest fog · controls in Effects',visible:true,locked:false,opacity:1,rotation:0,x:0,y:0,width:W,height:H,fill:'#00000000',effects:[{id:uid(),type:'fog-fx',visible:true,color:'#d9e5df',params:{density:.38,height:.85,softness:.5,speed:.6,direction:1,noiseScale:1}}]}); break;
        case "stars": doc.layers.push(makeGroup("stars", "Stars", P(34, 0.6, 0.8), W, H)); break;
        case "fireflies": doc.layers.push(makeGroup("fireflies", "Fireflies", P(12, 1, 1), W, H)); break;
        case "bokeh": doc.layers.push(makeGroup("bokeh", "Bokeh", P(14, 0.6, 0.8), W, H)); break;
        case "dust": doc.layers.push(makeGroup("dust", "Dust", P(18, 0.5, 0.6), W, H)); break;
        case "embers": doc.layers.push(makeGroup("embers", "Embers", P(16, 0.8, 0.9), W, H)); break;
        default: break;
      }
      void kind;
    }

    // Title + subtitle inside the safe area.
    push({
      type: "text", name: "Title", visible: true, locked: false, opacity: 1, rotation: 0,
      x: Math.round(W * (o.textAlignment==='start'?.08:.5)), align:o.textAlignment??"middle", y: Math.round(H * 0.47),
      text: o.title, fontFamily: "Segoe UI, sans-serif", fontSize: Math.round(H * 0.16),
      fill: { type: "solid", color: "#ffffff" },
      effects: [{ id: uid(), type: "glow", visible: true, color: o.titleGlow ?? "#ffffff", params: { amount: o.titleGlow ? 14 : 8 } }],
    } as unknown as Layer);
    push({
      type: "text", name: "Subtitle", visible: true, locked: false, opacity: 1, rotation: 0,
      x: Math.round(W * (o.textAlignment==='start'?.08:.5)), align:o.textAlignment??"middle", y: Math.round(H * 0.47) + Math.round(H * 0.13),
      text: o.subtitle, fontFamily: "Segoe UI, sans-serif", fontSize: Math.round(H * 0.062),
      fill: { type: "solid", color: "#c9d2e0" },
    } as unknown as Layer);

    // Frame border (animated optional).
    push({
      type: "rect", name: "Border", visible: true, locked: false, opacity: 1, rotation: 0,
      x: 4, y: 4, width: W - 8, height: H - 8, cornerRadius: 14,
      fill: { type: "solid", color: "#00000000" },
      border: { paint: linear([{ color: "#ffffff55", offset: 0 }, { color: "#ffffff11", offset: 1 }], 0), width: 1.5 },
    } as unknown as Layer);

    void generateGroupChildren;
    return doc;
  };
}

export interface PhotoSceneEntry {
  id: string;
  name: string;
  category: "Photo";
  blurb: string;
  tags: string[];
  make: (W: number, H: number) => BannerSpecDocument;
}

// ---------------------------------------------------------------- presets

export const PHOTO_OPTIONS: Record<string, PhotoSceneOptions> = {
  "rainy-city-night.jpg": {
    file: "rainy-city-night.jpg", name: "Rainy City Window", blurb: "Real rain-lit streets, warm glow", tags: ["photo", "rain", "night", "cozy"],
    scrim: ["#070a12", "#070a1200"], ambience: ["rain", "bokeh"], tint: { colors: ["#1a2b4a", "#0a0f1c"], opacity: 0.25 },
    vignette: 0.35, title: "Your Name", subtitle: "make your profile yours", titleGlow: "#ffd9a0",
  },
  "snowy-forest.jpg": {
    file: "snowy-forest.jpg", name: "Snow Forest", blurb: "Real winter trees, falling snow", tags: ["photo", "snow", "winter", "nature"],
    scrim: ["#0e1626", "#0e162600"], ambience: ["snow", "fog"], tint: { colors: ["#20344f", "#0d1524"], opacity: 0.2 },
    vignette: 0.3, title: "Your Name", subtitle: "make your profile yours", titleGlow: "#dfeaff",
  },
  "foggy-forest.jpg": {
    file: "foggy-forest.jpg", name: "Forest Mist", blurb: "Morning haze drifting through trees", tags: ["photo", "fog", "calm", "nature"],
    scrim: ["#0c1210", "#0c121000"], ambience: ["fog", "dust"], tint: { colors: ["#2a3d33", "#101a15"], opacity: 0.2 },
    vignette: 0.3, title: "Your Name", subtitle: "make your profile yours", titleGlow:"#a8c3b1",
  },
  "night-skyline.jpg": {
    file: "night-skyline.jpg", name: "Night Skyline", blurb: "City lights over the skyline", tags: ["photo", "night", "city"],
    scrim: ["#05070f", "#05070f00"], ambience: ["stars", "bokeh"], tint: { colors: ["#12233f", "#070b16"], opacity: 0.25 },
    vignette: 0.35, title: "Your Name", subtitle: "make your profile yours", titleGlow: "#9fc0ff",
  },
  "mountain-morning.jpg": {
    file: "mountain-morning.jpg", name: "Mountain Morning", blurb: "Alpine light over the peaks", tags: ["photo", "mountains", "morning"],
    scrim: ["#101623", "#10162300"], ambience: ["dust"], tint: { colors: ["#3d4d6b", "#161d2e"], opacity: 0.2 },
    vignette: 0.28, title: "Your Name", subtitle: "make your profile yours",
  },
  "library-warm.jpg": {
    file: "library-warm.jpg", name: "Library Warm Light", blurb: "Cozy shelves, lamplight mood", tags: ["photo", "cozy", "warm", "books"],
    scrim: ["#140e08", "#140e0800"], ambience: ["dust", "fireflies"], tint: { colors: ["#4a3418", "#1a120a"], opacity: 0.22 },
    vignette: 0.32, title: "Your Name", subtitle: "make your profile yours", titleGlow: "#ffce7a",
  },
  "cafe-night.jpg": {
    file: "cafe-night.jpg", name: "Coffee Shop Night", blurb: "Evening café warmth", tags: ["photo", "cozy", "cafe", "night"],
    scrim: ["#100b08", "#100b0800"], ambience: ["embers", "bokeh"], tint: { colors: ["#4a2c18", "#150e08"], opacity: 0.2 },
    vignette: 0.32, title: "Your Name", subtitle: "make your profile yours", titleGlow: "#ffce7a",
  },
  "desert-stars.jpg": {
    file: "desert-stars.jpg", name: "Starry Desert", blurb: "Real Milky Way over the dunes", tags: ["photo", "stars", "night", "space"],
    scrim: ["#03040c", "#03040c00"], ambience: ["stars"], tint: { colors: ["#141c38", "#05070f"], opacity: 0.2 },
    vignette: 0.3, title: "Your Name", subtitle: "make your profile yours", titleGlow: "#c4d2ff",
  },
  "ocean-sunset.jpg": {
    file: "ocean-sunset.jpg", name: "Ocean Sunset", blurb: "Golden hour over the sea", tags: ["photo", "ocean", "sunset"],
    scrim: ["#170d0a", "#170d0a00"], ambience: ["bokeh"], tint: { colors: ["#5c3418", "#1c100a"], opacity: 0.18 },
    vignette: 0.28, title: "Your Name", subtitle: "make your profile yours", titleGlow: "#ffcf9a",
  },
  "aurora-sky.jpg": {
    file: "aurora-sky.jpg", name: "Aurora Night", blurb: "Real northern lights", tags: ["photo", "aurora", "night", "nature"],
    scrim: ["#040a0e", "#040a0e00"], ambience: ["stars"], tint: { colors: ["#0e3a42", "#050c12"], opacity: 0.2 },
    vignette: 0.3, title: "Your Name", subtitle: "make your profile yours", titleGlow: "#7fe8d8",
  },
};

export const PHOTO_SCENE_LIBRARY: PhotoSceneEntry[] = LICENSES.map((lic) => {
  const opts = PHOTO_OPTIONS[lic.file];
  return {
    id: `photo-${lic.file.replace(/\.(jpg|png|jpeg)$/, "")}`,
    name: opts?.name ?? lic.title,
    category: "Photo" as const,
    blurb: opts?.blurb ?? `Photographic scene — ${lic.license}`,
    tags: opts?.tags ?? ["photo", "real"],
    make: photoScene(opts ?? {
      file: lic.file, name: lic.title, blurb: "", tags: [],
      title: "Your Name", subtitle: "make your profile yours",
    }),
  };
});

