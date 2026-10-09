/**
 * Scene library — curated procedural scene foundations.
 * Every scene uses semantic groups; ambience (rain/snow/…) is procedural,
 * so beginners get Intensity/Speed controls instead of dozens of layers.
 * All art is original/vector/procedural — no copyrighted assets.
 */
import { linear, type BannerSpecDocument, type Layer } from "@pcs/bannerspec";
import { generateGroupChildren, makeGroup, uid } from "./scenegen.js";
import { PHOTO_SCENE_LIBRARY } from "./photoScenes.js";

export interface SceneEntry {
  id: string;
  name: string;
  category: string;
  blurb: string;
  tags: string[];
  mood?: string;
  description?: string;
  animationLevel?: "none" | "subtle" | "animated";
  supportsVariation?: boolean;
  /** Hidden from the default beginner gallery; shown under an Experimental chip. */
  experimental?: boolean;
  make: (W: number, H: number) => BannerSpecDocument;
  /** Deterministic re-generation with a different seed (New Variation). */
  makeWithSeed?: (seed: number) => (W: number, H: number) => BannerSpecDocument;
}

const P = (count: number, speed: number, intensity: number, seed: number) => ({ count, speed, intensity, seed });

function base(W: number, H: number, bg: string, animation?: Partial<BannerSpecDocument["animation"]>) {
  const doc: BannerSpecDocument = {
    specVersion: "0.3",
    canvas: { width: W, height: H, background: bg },
    layers: [],
    brand: { primary: "#5b8cff", secondary: "#8a63ff", accent: "#3ecf8e", text: "#ffffff", muted: "#8b93a1" },
    animation: { duration: 8, loop: true, ...animation },
  };
  const ctx = {
    W, H,
    add: (l: object) => doc.layers.push({ ...(l as Record<string, unknown>), id: uid() } as unknown as Layer),
    group: (g: Layer) => doc.layers.push(g),
  };
  return { doc, ctx };
}

function rect(c: ReturnType<typeof base>["ctx"], x: number, y: number, w: number, h: number, fill: Layer["fill"], extra: Record<string, unknown> = {}) {
  c.add({ type: "rect", name: "Rect", visible: true, locked: false, opacity: 1, rotation: 0, x, y, width: w, height: h, fill, cornerRadius: 6, ...extra });
}
function text(c: ReturnType<typeof base>["ctx"], x: number, y: number, t: string, size: number, fill: Layer["fill"], extra: Record<string, unknown> = {}) {
  c.add({ type: "text", name: "Text", visible: true, locked: false, opacity: 1, rotation: 0, x, y, text: t, fontFamily: "Segoe UI, sans-serif", fontSize: size, fill, ...extra });
}

// ------------------------------------------------------------------ lo-fi builder

export interface LofiOptions {
  view: "city" | "forest" | "snow" | "mountains" | "ocean" | "space";
  weather: "clear" | "rain" | "snow" | "fog";
  time: "day" | "sunset" | "night";
  lighting: "warm-lamp" | "monitor" | "moon" | "neon";
  decor: "plants" | "books" | "coffee" | "none";
}

const SKY: Record<LofiOptions["time"], [string, string]> = {
  day: ["#7fb2e5", "#cfe6f7"],
  sunset: ["#3d2c52", "#e0704a"],
  night: ["#0a1024", "#141d38"],
};
const VIEW_BY_KIND: Record<LofiOptions["view"], string> = {
  city: "#0e1730", forest: "#122416", snow: "#c7d8ea", mountains: "#26314a", ocean: "#0f2740", space: "#05060f",
};

export function lofiScene(o: LofiOptions, seedBase = 0): (W: number, H: number) => BannerSpecDocument {
  return (W, H) => {
    const sd = (k: number) => seedBase + k;
    const { doc, ctx } = base(W, H, SKY[o.time][0], { duration: 8, loop: true });
    // sky
    rect(ctx, 0, 0, W, H, linear([{ color: SKY[o.time][0], offset: 0 }, { color: SKY[o.time][1], offset: 1 }], 90), { name: "Sky" });

    // window view: semantic group
    const viewChildren: Layer[] = [];
    const vw = W * 0.42, vx = W - vw - 70, vy = 36, vh = H - 90;
    if (o.view === "city") {
      viewChildren.push(...generateGroupChildren("city", P(9, 1, 1, sd(77)), vw, vh));
      for (let i = 0; i < 9; i++) {
        const bh = 60 + ((i * 67) % (vh * 0.6));
        viewChildren.push({ id: uid(), type: "rect", name: "Building", visible: true, locked: false, opacity: 1, rotation: 0, x: i * (vw / 9), y: vh - bh, width: vw / 9 - 12, height: bh, fill: { type: "solid", color: VIEW_BY_KIND.city } } as unknown as Layer);
        for (let j = 0; j < 3; j++) {
          if ((i * 7 + j * 3) % 4 < 2) {
            viewChildren.push({ id: uid(), type: "rect", name: "City light", visible: true, locked: false, opacity: 0.9, rotation: 0, x: i * (vw / 9) + 6 + (j % 2) * 14, y: vh - bh + 10 + j * 24, width: 7, height: 9, fill: { type: "solid", color: "#ffe9b0" } } as unknown as Layer);
          }
        }
      }
    } else if (o.view === "forest") {
      viewChildren.push(...generateGroupChildren("trees", P(7, 1, 1, sd(21)), vw, vh));
      for (let i = 0; i < 7; i++) {
        const th = 70 + ((i * 53) % (vh * 0.55));
        viewChildren.push({ id: uid(), type: "ellipse", name: "Canopy", visible: true, locked: false, opacity: 1, rotation: 0, x: i * (vw / 7), y: vh - th - 46, width: vw / 6, height: 90, fill: { type: "solid", color: "#1c3a26" } } as unknown as Layer);
        viewChildren.push({ id: uid(), type: "rect", name: "Trunk", visible: true, locked: false, opacity: 1, rotation: 0, x: i * (vw / 7) + vw / 14 - 6, y: vh - th, width: 12, height: th, fill: { type: "solid", color: "#14261a" } } as unknown as Layer);
      }
    } else if (o.view === "snow") {
      for (let i = 0; i < 5; i++) {
        const mh = vh * (0.35 + (i % 3) * 0.15);
        viewChildren.push({ id: uid(), type: "rect", name: "Snow hill", visible: true, locked: false, opacity: 1, rotation: 0, x: -20 + i * (vw / 4), y: vh - mh, width: vw / 3 + 40, height: mh, fill: { type: "solid", color: i % 2 ? "#dfe9f5" : "#cdd9ea" }, cornerRadius: 40 } as unknown as Layer);
      }
    } else if (o.view === "mountains") {
      for (let i = 0; i < 4; i++) {
        const mh = vh * (0.4 + (i % 2) * 0.25);
        viewChildren.push({ id: uid(), type: "rect", name: "Mountain", visible: true, locked: false, opacity: 1, rotation: 45, x: i * (vw / 3.4), y: vh - mh + 40, width: mh, height: mh, fill: { type: "solid", color: i % 2 ? "#2c3a5c" : "#232f4c" }, cornerRadius: 6 } as unknown as Layer);
      }
    } else if (o.view === "ocean") {
      viewChildren.push({ id: uid(), type: "rect", name: "Sea", visible: true, locked: false, opacity: 1, rotation: 0, x: 0, y: vh * 0.45, width: vw, height: vh * 0.55, fill: linear([{ color: "#123a5c", offset: 0 }, { color: "#0a1f33", offset: 1 }], 90) } as unknown as Layer);
      for (let i = 0; i < 6; i++) {
        viewChildren.push({ id: uid(), type: "ellipse", name: "Wave glint", visible: true, locked: false, opacity: 0.5, rotation: 0, x: 10 + i * (vw / 6), y: vh * 0.55 + (i % 3) * 26, width: 26, height: 4, fill: { type: "solid", color: "#7fb2e5" } } as unknown as Layer);
      }
    } else {
      viewChildren.push(...generateGroupChildren("stars", P(26, 1, 0.9, sd(5)), vw, vh));
    }
    // window: ONE semantic group — view + glass + frame + bars edit together.
    // Furniture children get stable names so WindowControls can rebuild them.
    viewChildren.push(
      { id: uid(), type: "rect", name: "Glass", visible: true, locked: false, opacity: o.time === "night" ? 0.09 : 0.1, rotation: 0, x: vx, y: vy, width: vw, height: vh, fill: { type: "solid", color: o.time === "night" ? "#aebfd4" : "#ffffff" }, cornerRadius: 4 } as unknown as Layer,
      { id: uid(), type: "rect", name: "Window frame", visible: true, locked: false, opacity: 1, rotation: 0, x: vx - 10, y: vy - 10, width: vw + 20, height: vh + 20, fill: { type: "solid", color: "#1b2438" }, cornerRadius: 12 } as unknown as Layer,
      { id: uid(), type: "rect", name: "Frame bar", visible: true, locked: false, opacity: 1, rotation: 0, x: vx + vw / 2 - 4, y: vy, width: 8, height: vh, fill: { type: "solid", color: "#1b2438" }, cornerRadius: 0 } as unknown as Layer,
      { id: uid(), type: "rect", name: "Frame bar", visible: true, locked: false, opacity: 1, rotation: 0, x: vx, y: vy + vh / 2 - 4, width: vw, height: 8, fill: { type: "solid", color: "#1b2438" }, cornerRadius: 0 } as unknown as Layer,
    );
    ctx.group({
      id: uid(), type: "group", name: "Window view", kind: "scene",
      visible: true, locked: false, opacity: 1, rotation: 0,
      params: { window: 1, style: 0, glass: 0, transparency: 0.1, frost: 0, reflection: 0.2, droplets: 0, tint: 0xffffff, glassOpacity: 1, glassBlur: 0, noise: 0, highlight: 0.5, edge: 0.3, shadow: 0.4, scaleX: 1, scaleY: 1 },
      children: viewChildren,
    } as unknown as Layer);

    // weather (procedural group)
    if (o.weather === "rain") ctx.group(makeGroup("rain", "Rain", P(30, 1, 0.5, sd(11)), W, H));
    if (o.weather === "snow") ctx.group(makeGroup("snow", "Snow", P(26, 0.7, 0.9, sd(12)), W, H));
    if (o.weather === "fog") ctx.group(makeGroup("fog", "Fog", P(9, 0.5, 0.8, sd(13)), W, H));

    // lighting
    if (o.lighting === "monitor") {
      rect(ctx, 40, H - 150, W * 0.4, 120, linear([{ color: "#5b8cff33", offset: 0 }, { color: "#5b8cff00", offset: 1 }], 90), { name: "Monitor glow", cornerRadius: 16 });
    } else if (o.lighting === "warm-lamp") {
      ctx.add({ type: "ellipse", name: "Lamp glow", visible: true, locked: false, opacity: 0.5, rotation: 0, x: 60, y: 40, width: 200, height: 200, fill: { type: "solid", color: "#ffce7a" }, effects: [{ id: uid(), type: "blur", visible: true, params: { amount: 40 } }] } as unknown as Layer);
    } else if (o.lighting === "moon") {
      ctx.add({ type: "ellipse", name: "Moon", visible: true, locked: false, opacity: 0.9, rotation: 0, x: 90, y: 40, width: 60, height: 60, fill: { type: "solid", color: "#e8ecf5" }, effects: [{ id: uid(), type: "glow", visible: true, params: { amount: 20 } }] } as unknown as Layer);
    } else {
      rect(ctx, 0, 0, W, 8, linear([{ color: "#ff4fd8", offset: 0 }, { color: "#4fd8ff", offset: 1 }], 0), { name: "Neon strip" });
    }

    // desk + decor (silhouette)
    rect(ctx, 0, H - 60, W, 60, { type: "solid", color: "#101522" }, { name: "Desk", cornerRadius: 0 });
    if (o.decor === "plants") {
      ctx.add({ type: "ellipse", name: "Plant", visible: true, locked: false, opacity: 1, rotation: 0, x: 40, y: H - 118, width: 46, height: 62, fill: { type: "solid", color: "#1e4030" } } as unknown as Layer);
      rect(ctx, 52, H - 76, 22, 18, { type: "solid", color: "#5c3a28" }, { name: "Pot", cornerRadius: 3 });
    } else if (o.decor === "books") {
      rect(ctx, 44, H - 96, 16, 36, { type: "solid", color: "#7a3b47" }, { name: "Book", cornerRadius: 2 });
      rect(ctx, 62, H - 90, 14, 30, { type: "solid", color: "#3b5e7a" }, { name: "Book", cornerRadius: 2 });
    } else if (o.decor === "coffee") {
      rect(ctx, 48, H - 90, 22, 26, { type: "solid", color: "#d8d3c8" }, { name: "Mug", cornerRadius: 4 });
      ctx.add({ type: "ellipse", name: "Steam", visible: true, locked: false, opacity: 0.4, rotation: 0, x: 54, y: H - 116, width: 8, height: 22, fill: { type: "solid", color: "#ffffff" }, effects: [{ id: uid(), type: "blur", visible: true, params: { amount: 4 } }] } as unknown as Layer);
    }

    // headline text
    text(ctx, 56, H * 0.42, "Your Name", 52, { type: "solid", color: "#ffffff" }, { name: "Title", effects: [{ id: uid(), type: "glow", visible: true, params: { amount: 12 } }] });
    text(ctx, 58, H * 0.42 + 42, "make your profile yours", 20, { type: "solid", color: "#8b93a1" }, { name: "Subtitle" });

    // border
    rect(ctx, 6, 6, W - 12, H - 12, { type: "solid", color: "#00000000" }, { name: "Frame border", cornerRadius: 14, border: { paint: linear([{ color: "#5b8cff", offset: 0 }, { color: "#8a63ff", offset: 1 }], 0), width: 2 } });
    return doc;
  };
}

// ------------------------------------------------------------------ other generators

function auroraScene(name: string, colors: string[]): SceneEntry["make"] {
  return (W, H) => {
    const { doc, ctx } = base(W, H, "#0c0e16", { duration: 10, loop: true });
    doc.brand={primary:colors[0]??'#f9a8d4',secondary:colors[1]??'#c4b5fd',accent:colors[0]??'#f9a8d4',text:'#ffffff',muted:colors[2]??'#a5f3fc'};
    ctx.add({
      type: "group", name: "Aurora", kind: "scene", visible: true, locked: false, opacity: 0.85, rotation: 0,
      params: {}, children: [{
        id: uid(), type: "rect", name: "Aurora band", visible: true, locked: false, opacity: 1, rotation: 0,
        x: -W * 0.1, y: 0, width: W * 1.2, height: H,
        fill: { type: "animated", mode: "aurora", base: linear(colors.map((c, i) => ({ color: c, offset: i / (colors.length - 1) })), 0), duration: 10 },
        effects: [{ id: uid(), type: "blur", visible: true, params: { amount: 30 } }],
      }] as Layer[],
    } as unknown as Layer);
    text(ctx, W / 2, H * 0.52, name, 56, { type: "solid", color: "#ffffff" }, { name: "Title", align: "middle", effects: [{ id: uid(), type: "glow", visible: true, params: { amount: 16 } }] });
    text(ctx, W / 2, H * 0.52 + 44, "make your profile yours", 19, { type: "solid", color: "#a9b4c7" }, { name: "Subtitle", align: "middle" });
    return doc;
  };
}

function starScene(name: string, seedBase = 8): SceneEntry["make"] {
  return (W, H) => {
    const { doc, ctx } = base(W, H, "#060812");
    ctx.group(makeGroup("stars", "Stars", P(60, 0.6, 0.95, seedBase), W, H));
    ctx.add({ type: "ellipse", name: "Moon", visible: true, locked: false, opacity: 0.95, rotation: 0, x: W * 0.78, y: 36, width: 64, height: 64, fill: { type: "solid", color: "#e8ecf5" }, effects: [{ id: uid(), type: "glow", visible: true, params: { amount: 24 } }] } as unknown as Layer);
    text(ctx, W / 2, H * 0.55, name, 54, { type: "solid", color: "#e8ecf5" }, { name: "Title", align: "middle" });
    return doc;
  };
}

function neonScene(name: string, bg: string, glow1: string, glow2: string): SceneEntry["make"] {
  return (W, H) => {
    const { doc, ctx } = base(W, H, bg);
    // perspective grid
    for (let i = 0; i <= 12; i++) {
      ctx.add({ type: "line", name: "Grid", visible: true, locked: false, opacity: 0.5, rotation: 0, x: (i / 12) * W, y: H, x2: W / 2 - (i / 12) * W, y2: -H * 0.7, strokeWidth: 1.5, fill: { type: "solid", color: glow2 } } as unknown as Layer);
    }
    for (let i = 1; i <= 6; i++) {
      ctx.add({ type: "line", name: "Grid", visible: true, locked: false, opacity: 0.5, rotation: 0, x: 0, y: H - (H / 6) * i * 0.6, x2: W, y2: H - (H / 6) * i * 0.6, strokeWidth: 1.5, fill: { type: "solid", color: glow1 } } as unknown as Layer);
    }
    text(ctx, W / 2, H * 0.48, name, 58, { type: "animated", mode: "light-sweep", base: linear([{ color: glow1, offset: 0 }, { color: "#ffffff", offset: 0.5 }, { color: glow2, offset: 1 }], 0), duration: 4 }, { name: "Title", align: "middle", fontFamily: "Cascadia Code, Consolas, monospace", effects: [{ id: uid(), type: "glow", visible: true, params: { amount: 18 } }] });
    return doc;
  };
}

// ------------------------------------------------------------------ library

const VAR_SCENES = new Set(["lofi-rain-city-night","lofi-snow-cabin","lofi-night-train","lofi-ocean-sunset","lofi-space-desk","lofi-foggy-forest","firefly-forest","moonlit-lake","starry-night","sakura-night"]);

function enrich(entries: SceneEntry[]): SceneEntry[] {
  return entries.map((e) => ({
    ...e,
    mood: e.tags.slice(0, 3).join(" · "),
    description: e.blurb,
    animationLevel: /rain|snow|firefl|aurora|star|sakura|synth|cyber|smoke|petal|drift|flow/i.test(e.name + e.blurb) ? "animated" : "subtle",
    supportsVariation: e.supportsVariation ?? VAR_SCENES.has(e.id),
    makeWithSeed: e.makeWithSeed ?? (VAR_SCENES.has(e.id)
      ? (seed: number) => {
          if (e.id.startsWith("lofi-")) {
            const opts: LofiOptions = {
              "lofi-rain-city-night": { view: "city", weather: "rain", time: "night", lighting: "monitor", decor: "coffee" },
              "lofi-snow-cabin": { view: "snow", weather: "snow", time: "day", lighting: "warm-lamp", decor: "books" },
              "lofi-night-train": { view: "mountains", weather: "clear", time: "night", lighting: "moon", decor: "none" },
              "lofi-ocean-sunset": { view: "ocean", weather: "clear", time: "sunset", lighting: "warm-lamp", decor: "plants" },
              "lofi-space-desk": { view: "space", weather: "clear", time: "night", lighting: "monitor", decor: "books" },
              "lofi-foggy-forest": { view: "forest", weather: "fog", time: "day", lighting: "moon", decor: "plants" },
            }[e.id as "lofi-rain-city-night"] as LofiOptions;
            return lofiScene(opts, seed);
          }
          if (e.id === "firefly-forest") return fireflyForest(seed);
          if (e.id === "moonlit-lake") return starScene("Moonlit Lake", seed);
          if (e.id === "starry-night") return starScene("Starry Night", seed);
          return sakuraNight(seed);
        }
      : undefined),
  }));
}

/** Curated product library. Retired generators stay readable for old projects. */
export const SCENE_LIBRARY: SceneEntry[] = enrich([
 ...PHOTO_SCENE_LIBRARY.filter(p=>p.id!=='photo-mountain-morning').map(p=>({id:p.id,name:p.name,category:'Photo',blurb:p.blurb,tags:[...p.tags,'real photo'],make:p.make})),
 {id:'editorial-black',name:'Editorial',category:'Modern',blurb:'Confident type and clean space',tags:['modern','minimal'],make:editorial()},
 {id:'retro-terminal',name:'Retro Terminal',category:'Tech',blurb:'Scanlines and a typed command',tags:['tech','retro'],make:retroTerminal()},
 {id:'pastel-clouds',name:'Pastel Dreams',category:'Cute',blurb:'Soft pink drift and gentle glow',tags:['pastel','calm'],make:auroraScene('Pastel Dreams',['#f9a8d4','#c4b5fd','#a5f3fc'])},
]);

function fireflyForest(seedBase = 0): SceneEntry["make"] {
  return (W, H) => {
    const sd = (k: number) => seedBase + k;
    const { doc, ctx } = base(W, H, "#0d1510");
    // layered depth: distant ridge, mid trees, near trunks
    rect(ctx, 0, 0, W, H, linear([{ color: "#0d1510", offset: 0 }, { color: "#16281c", offset: 1 }], 90), { name: "Background" });
    const distant = generateGroupChildren("trees", P(10, 1, 0.5, sd(31)), W, H * 0.8).map((l) => ({ ...l, opacity: 0.35 }) as Layer);
    ctx.group({ id: uid(), type: "group", name: "Distant forest", kind: "trees", visible: true, locked: false, opacity: 0.4, rotation: 0, params: {}, children: distant } as unknown as Layer);
    const mid = generateGroupChildren("trees", P(7, 1, 1, sd(17)), W, H).map((l) => ({ ...l, y: (l as { y: number }).y + 30, opacity: 0.75 }) as Layer);
    ctx.group({ id: uid(), type: "group", name: "Forest", kind: "trees", visible: true, locked: false, opacity: 0.85, rotation: 0, params: {}, children: mid } as unknown as Layer);
    ctx.group(makeGroup("fireflies", "Fireflies", P(12, 1, 1, sd(8241)), W, H));
    ctx.group(makeGroup("fog", "Mist", P(6, 0.5, 0.5, sd(3)), W, H));
    text(ctx, 70, H * 0.4, "Forest Research", 50, { type: "solid", color: "#e7f5e1" }, { name: "Title", effects: [{ id: uid(), type: "glow", visible: true, params: { amount: 10 } }] });
    text(ctx, 72, H * 0.4 + 42, "field notes & open data", 20, { type: "solid", color: "#9db8a2" }, { name: "Subtitle" });
    return doc;
  };
}

function midnightGlass(): SceneEntry["make"] {
  return (W, H) => {
    const { doc, ctx } = base(W, H, "#0a0c14", { duration: 8, loop: true });
    rect(ctx, 0, 0, W, H, linear([{ color: "#0a0c14", offset: 0 }, { color: "#141b2e", offset: 1 }], 60), { name: "Background" });
    const panels: Layer[] = [];
    for (let i = 0; i < 4; i++) {
      panels.push({
        id: uid(), type: "rect", name: "Glass panel", visible: true, locked: false, opacity: 0.35, rotation: -8,
        x: 120 + i * 240, y: 40 + (i % 2) * 30, width: 220, height: 260,
        fill: linear([{ color: "#5b8cff", offset: 0 }, { color: "#8a63ff", offset: 1 }], 45),
        cornerRadius: 18,
        effects: [{ id: uid(), type: "blur", visible: true, params: { amount: 2 } }],
        tracks: [{ prop: "y", keys: [{ t: 0, value: 40 + (i % 2) * 30 }, { t: 4, value: 55 + (i % 2) * 30 }, { t: 8, value: 40 + (i % 2) * 30 }] }],
      } as unknown as Layer);
    }
    ctx.group({ id: uid(), type: "group", name: "Glass panels", kind: "scene", visible: true, locked: false, opacity: 1, rotation: 0, params: {}, children: panels } as unknown as Layer);
    text(ctx, 90, H * 0.52, "Midnight Glass", 54, { type: "animated", mode: "aurora", base: linear([{ color: "#9fc0ff", offset: 0 }, { color: "#c4a5ff", offset: 1 }], 0), duration: 7 }, { name: "Title", effects: [{ id: uid(), type: "glow", visible: true, params: { amount: 18 } }] });
    text(ctx, 92, H * 0.52 + 42, "frosted · calm · deep", 18, { type: "solid", color: "#8b93a1" }, { name: "Subtitle" });
    rect(ctx, 6, 6, W - 12, H - 12, { type: "solid", color: "#00000000" }, { name: "Border", cornerRadius: 16, border: { paint: { type: "animated", mode: "light-sweep", base: linear([{ color: "#5b8cff", offset: 0 }, { color: "#c4a5ff", offset: 1 }], 0), duration: 5 }, width: 2 } });
    return doc;
  };
}

function editorial(): SceneEntry["make"] {
  return (W, H) => {
    const { doc, ctx } = base(W, H, "#0a0a0a", { duration: 9, loop: true });
    doc.brand={primary:"#ffffff",secondary:"#bdbdbd",accent:"#d9d9d9",text:"#ffffff",muted:"#9e9e9e"};
    // Paper-white field with editorial hairlines and a film-grain plate.
    rect(ctx, 0, 0, W, H, { type: "solid", color: "#0a0a0a" }, { name: "Ground" });
    rect(ctx, 0, 0, W, H, { type: "solid", color: "#ffffff" }, { name: "Grain", opacity: 0.02, effects: [{ id: uid(), type: "grain", visible: true, params: { amount: 60 } }] });
    // Clean grid: top rule, bottom rule, folio marks.
    rect(ctx, 64, 54, W - 128, 2, { type: "solid", color: "#ffffff" }, { name: "Top rule" });
    rect(ctx, 64, H - 56, W - 128, 1, { type: "solid", color: "#3d3d3d" }, { name: "Bottom rule" });
    text(ctx, 64, 34, "ISSUE 01", 15, { type: "solid", color: "#bdbdbd" }, { name: "Folio left", fontFamily: "Georgia, 'Times New Roman', serif", letterSpacing: 4 });
    text(ctx, W - 64, 34, "PORTFOLIO", 15, { type: "solid", color: "#bdbdbd" }, { name: "Folio right", align: "end", fontFamily: "Georgia, 'Times New Roman', serif", letterSpacing: 4 });
    // Kicker + oversized serif display title with generous whitespace.
    text(ctx, 64, H * 0.34, "Works in Progress", 15, { type: "solid", color: "#9e9e9e" }, { name: "Kicker", fontFamily: "Georgia, 'Times New Roman', serif", letterSpacing: 8 });
    text(ctx, 60, H * 0.47, "SELECTED", 92, { type: "solid", color: "#ffffff" }, { name: "Title line 1", fontFamily: "Georgia, 'Times New Roman', serif", letterSpacing: 2 });
    text(ctx, 60, H * 0.47 + 96, "WORKS", 92, { type: "animated", mode: "light-sweep", base: linear([{ color: "#ffffff", offset: 0 }, { color: "#bdbdbd", offset: 0.5 }, { color: "#ffffff", offset: 1 }], 0), duration: 9 }, { name: "Title line 2", fontFamily: "Georgia, 'Times New Roman', serif", letterSpacing: 2 });
    // Byline + italic standfirst, right-aligned column.
    text(ctx, W - 64, H * 0.38, "developer — designer — writer", 20, { type: "solid", color: "#d9d9d9" }, { name: "Standfirst", align: "end", fontFamily: "Georgia, 'Times New Roman', serif" });
    text(ctx, W - 64, H - 40, "an ongoing index of things made", 14, { type: "solid", color: "#7a7a7a" }, { name: "Caption", align: "end", fontFamily: "Georgia, 'Times New Roman', serif" });
    return doc;
  };
}

function retroTerminal(): SceneEntry["make"] {
  return (W, H) => {
    const { doc, ctx } = base(W, H, "#050a06", { duration: 6, loop: true });
    doc.brand={primary:"#39d353",secondary:"#c9ffb0",accent:"#39d353",text:"#c9ffb0",muted:"#2ea043"};
    // Bezel + screen
    rect(ctx, 10, 10, W - 20, H - 20, { type: "solid", color: "#10160f" }, { name: "Bezel", cornerRadius: 14 });
    rect(ctx, 24, 24, W - 48, H - 48, { type: "solid", color: "#071108" }, { name: "Screen", cornerRadius: 8, border: { paint: { type: "solid", color: "#1d3a22" }, width: 3 } });
    // Phosphor wash + vignette glow for CRT feel
    rect(ctx, 24, 24, W - 48, H - 48, linear([{ color: "#0f3318", offset: 0 }, { color: "#071108", offset: 1 }], 90), { name: "Phosphor wash", opacity: 0.5 });
    ctx.add({ type: "ellipse", name: "CRT vignette", visible: true, locked: false, opacity: 0.16, rotation: 0, x: W / 2 - W * 0.6, y: H / 2 - H * 0.45, width: W * 1.2, height: H * 1.1, fill: { type: "solid", color: "#39d353" }, effects: [{ id: uid(), type: "blur", visible: true, params: { amount: 90 } }] } as unknown as Layer);
    // Scanlines
    const lines: Layer[] = [];
    for (let y = 26; y < H - 26; y += 6) {
      lines.push({ id: uid(), type: "rect", name: "Scanline", visible: true, locked: false, opacity: 0.10, rotation: 0, x: 26, y, width: W - 52, height: 2, fill: { type: "solid", color: "#04170a" } } as unknown as Layer);
    }
    ctx.group({ id: uid(), type: "group", name: "Scanlines", kind: "scene", visible: true, locked: false, opacity: 1, rotation: 0, params: {}, children: lines } as unknown as Layer);
    // Subtle noise plate
    rect(ctx, 24, 24, W - 48, H - 48, { type: "solid", color: "#ffffff" }, { name: "Noise", opacity: 0.02, effects: [{ id: uid(), type: "grain", visible: true, params: { amount: 40 } }] });
    // Session lines: prompt, typed command, output
    const mono = "Cascadia Code, Consolas, monospace";
    text(ctx, 64, 108, "octocat@studio:~$", 24, { type: "solid", color: "#39d353" }, { name: "Prompt", fontFamily: mono, fontWeight: 400 });
    text(ctx, 64 + 218, 108, "whoami", 24, { type: "solid", color: "#c9ffb0" }, { name: "Command", fontFamily: mono, fontWeight: 400, behaviors: [{id:uid(),preset:"typewriter",category:"text",enabled:true,speed:.4,amount:60}] });
    text(ctx, 64, H * 0.5, "open-source builder", 40, { type: "solid", color: "#39d353" }, { name: "Output", fontFamily: mono, fontWeight: 400, effects: [{ id: uid(), type: "glow", visible: true, params: { amount: 14 } }], tracks: [{ prop: "opacity", keys: [{ t: 0, value: 0 }, { t: 1.2, value: 0 }, { t: 1.201, value: 1 }] }] });
    text(ctx, 64, H * 0.5 + 52, "profiles · banners · tools — since 2019", 20, { type: "solid", color: "#2ea043" }, { name: "Output 2", fontFamily: mono, fontWeight: 400, tracks: [{ prop: "opacity", keys: [{ t: 0, value: 0 }, { t: 1.6, value: 0 }, { t: 1.601, value: 1 }] }] });
    text(ctx, 64, H - 62, "[ok] session established — tty1", 15, { type: "solid", color: "#1f6f33" }, { name: "Status line", fontFamily: mono, fontWeight: 400 });
    return doc;
  };
}

function pixelArcade(): SceneEntry["make"] {
  return (W, H) => {
    const { doc, ctx } = base(W, H, "#0b0b12");
    const pixels: Layer[] = [];
    for (let x = 0; x < 40; x++) {
      for (let y = 0; y < 12; y++) {
        if ((x * 7 + y * 13) % 5 === 0) {
          pixels.push({ id: uid(), type: "rect", name: "Pixel", visible: true, locked: false, opacity: 1, rotation: 0, x: x * 30, y: y * 30, width: 26, height: 26, fill: { type: "solid", color: "#141425" } } as unknown as Layer);
        }
      }
    }
    ctx.group({ id: uid(), type: "group", name: "Pixel grid", kind: "scene", visible: true, locked: false, opacity: 1, rotation: 0, params: {}, children: pixels } as unknown as Layer);
    const coins: Layer[] = [];
    for (let i = 0; i < 7; i++) {
      coins.push({ id: uid(), type: "ellipse", name: "Coin", visible: true, locked: false, opacity: 1, rotation: 0, x: 640 + i * 44, y: 150 - Math.sin((i / 6) * Math.PI) * 60, width: 22, height: 22, fill: { type: "solid", color: "#ffd88a" }, effects: [{ id: uid(), type: "glow", visible: true, params: { amount: 8 } }] } as unknown as Layer);
    }
    ctx.group({ id: uid(), type: "group", name: "Coins", kind: "scene", visible: true, locked: false, opacity: 1, rotation: 0, params: {}, children: coins } as unknown as Layer);
    text(ctx, 70, 150, "PIXEL ARCADE", 48, { type: "solid", color: "#ffd88a" }, { name: "Title", fontFamily: "Cascadia Code, Consolas, monospace", effects: [{ id: uid(), type: "glow", visible: true, params: { amount: 10 } }] });
    text(ctx, 72, 195, "insert coin to continue", 20, { type: "solid", color: "#8f8fb0" }, { name: "Subtitle", fontFamily: "Cascadia Code, Consolas, monospace" });
    return doc;
  };
}

function sakuraNight(seedBase = 0): SceneEntry["make"] {
  return (W, H) => {
    const { doc, ctx } = base(W, H, "#120a18", { duration: 10, loop: true });
    // Night sky with a pink-lit horizon
    rect(ctx, 0, 0, W, H, linear([{ color: "#0b0611", offset: 0 }, { color: "#241028", offset: 0.7 }, { color: "#3d1c38", offset: 1 }], 90), { name: "Night sky" });
    ctx.group(makeGroup("stars", "Stars", P(24, 0.5, 0.6, seedBase + 55), W, H * 0.7));
    // Moon with soft halo
    ctx.add({ type: "ellipse", name: "Moon", visible: true, locked: false, opacity: 0.9, rotation: 0, x: W * 0.76, y: 48, width: 58, height: 58, fill: { type: "solid", color: "#f3e9f5" }, effects: [{ id: uid(), type: "glow", visible: true, params: { amount: 26 } }] } as unknown as Layer);
    // Pink lantern haze rising from the bottom
    ctx.add({ type: "ellipse", name: "Lantern glow", visible: true, locked: false, opacity: 0.22, rotation: 0, x: -W * 0.15, y: H * 0.72, width: W * 1.3, height: H * 0.6, fill: { type: "solid", color: "#ff9ecb" }, effects: [{ id: uid(), type: "blur", visible: true, params: { amount: 100 } }] } as unknown as Layer);
    // Drifting haze band
    ctx.group(makeGroup("fog", "Haze", P(5, 0.5, 0.5, seedBase + 3), W, H));
    // Two depths of petals, bright foreground layer
    const far = generateGroupChildren("leaves", P(9, 0.5, 0.6, seedBase + 77), W, H).map((l) => ({ ...l, fill: { type: "solid", color: "#d98bb4" }, opacity: 0.55 }) as Layer);
    ctx.group({ id: uid(), type: "group", name: "Petals far", kind: "leaves", visible: true, locked: false, opacity: 1, rotation: 0, params: {}, children: far } as unknown as Layer);
    const petals: Layer[] = generateGroupChildren("leaves", P(12, 0.7, 0.9, seedBase + 78), W, H).map((l) => ({ ...l, fill: { type: "solid", color: "#fbcfe8" } }) as Layer);
    ctx.group({ id: uid(), type: "group", name: "Petal fall", kind: "leaves", visible: true, locked: false, opacity: 1, rotation: 0, params: {}, children: petals } as unknown as Layer);
    // Title sits inside the safe area with a soft pink glow
    text(ctx, W / 2, H * 0.52, "Sakura Night", 52, { type: "solid", color: "#fbcfe8" }, { name: "Title", align: "middle", effects: [{ id: uid(), type: "glow", visible: true, params: { amount: 16 } }] });
    text(ctx, W / 2, H * 0.52 + 40, "petals drift through lantern light", 18, { type: "solid", color: "#c99ab5" }, { name: "Subtitle", align: "middle" });
    return doc;
  };
}
