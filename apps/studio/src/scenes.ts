/**
 * Starter scenes — a small set of good, fully editable scenes that exercise
 * different BannerSpec systems. Built from real primitives, not baked images.
 */
import {
  linear,
  type BannerSpecDocument,
  type Layer,
} from "@pcs/bannerspec";
import { defaultLevels, renderSimSvg, runSimulation, type SimConfig } from "@pcs/contribution";

let n = 0;
const id = () => `sc-${Date.now().toString(36)}-${(n++).toString(36)}`;

interface Ctx {
  W: number;
  H: number;
  add: (l: Record<string, unknown>) => void;
}

function base(W: number, H: number, bg: string, animation?: Partial<BannerSpecDocument["animation"]>): { doc: BannerSpecDocument; ctx: Ctx } {
  const doc: BannerSpecDocument = {
    specVersion: "0.2",
    canvas: { width: W, height: H, background: bg },
    layers: [],
    brand: { primary: "#5b8cff", secondary: "#8a63ff", accent: "#3ecf8e", text: "#ffffff", muted: "#8b93a1" },
    animation: { duration: 8, loop: true, ...animation },
  };
  const ctx: Ctx = { W, H, add: (l) => doc.layers.push({ ...l, id: id() } as unknown as Layer) };
  return { doc, ctx };
}

function rect(c: Ctx, x: number, y: number, w: number, h: number, fill: string | Layer["fill"], extra: Partial<Layer> = {}): void {
  c.add({ type: "rect", name: "Rect", visible: true, locked: false, opacity: 1, rotation: 0, x, y, width: w, height: h, fill, cornerRadius: 6, ...extra });
}

function text(c: Ctx, x: number, y: number, t: string, size: number, fill: string | Layer["fill"], extra: Partial<Layer> = {}): void {
  c.add({ type: "text", name: "Text", visible: true, locked: false, opacity: 1, rotation: 0, x, y, text: t, fontFamily: "Segoe UI, sans-serif", fontSize: size, fill, ...extra });
}

function rain(c: Ctx, count: number, color: string, x0: number, y0: number, x1: number, y1: number, seedOffset = 1): void {
  for (let i = 0; i < count; i++) {
    const x = x0 + ((i * 97 * seedOffset) % (x1 - x0));
    const y = y0 + ((i * 53 * seedOffset) % (y1 - y0));
    const len = 10 + ((i * 31) % 14);
    c.add({
      type: "line", name: "Rain", visible: true, locked: false, opacity: 0.35, rotation: 8,
      x, y, x2: -3, y2: len, strokeWidth: 1.5,
      fill: { type: "solid", color },
      tracks: [{ prop: "y", keys: [{ t: 0, value: y }, { t: 1 + (i % 5) * 0.2, value: y1 }] }],
    });
  }
}

// ---------------------------------------------------------------- scenes

export function sceneRainyCodingRoom(): BannerSpecDocument {
  const { doc, ctx } = base(1200, 350, "#0b1020", { duration: 6, loop: true });
  // room wall gradient
  rect(ctx, 0, 0, 1200, 350, linear([{ color: "#0c1226", offset: 0 }, { color: "#131c33", offset: 1 }], 90), { name: "Wall" });
  // window with city
  rect(ctx, 620, 40, 520, 270, { type: "solid", color: "#0a0f1e" }, { name: "Window glass", cornerRadius: 10, effects: [{ id: id(), type: "glow", visible: true, params: { amount: 6 } }] });
  // city buildings
  for (let i = 0; i < 9; i++) {
    const bh = 60 + ((i * 67) % 140);
    rect(ctx, 640 + i * 55, 310 - bh, 40, bh, { type: "solid", color: "#1a2a4a" }, { name: "Building", cornerRadius: 2 });
    // lit windows
    for (let j = 0; j < 3; j++) {
      if ((i * 7 + j * 3) % 4 < 2) {
        rect(ctx, 650 + i * 55 + (j % 2) * 18, 320 - bh + j * 26, 8, 10, { type: "solid", color: "#ffe9b0" }, { name: "City light", opacity: 0.95, tracks: [{ prop: "opacity", keys: [{ t: 0, value: 0.85 }, { t: 2 + (i % 3), value: 0.4 }, { t: 4 + (i % 3), value: 0.85 }] }] });
      }
    }
  }
  // window frame + rain
  ctx.add({ type: "rect", name: "Window frame", visible: true, locked: false, opacity: 1, rotation: 0, x: 612, y: 32, width: 536, height: 286, fill: { type: "solid", color: "#1b2438" }, cornerRadius: 12 });
  rain(ctx, 26, "#9fc0ff", 630, 40, 1130, 300);
  // desk glow + headline
  rect(ctx, 60, 240, 420, 70, linear([{ color: "#5b8cff33", offset: 0 }, { color: "#5b8cff00", offset: 1 }], 90), { name: "Monitor glow", cornerRadius: 14 });
  text(ctx, 70, 130, "Rainy Coding Room", 52, { type: "solid", color: "#ffffff" }, { name: "Title", effects: [{ id: id(), type: "glow", visible: true, params: { amount: 14 } }], tracks: [{ prop: "opacity", keys: [{ t: 0, value: 0 }, { t: 1.5, value: 1 }] }] });
  text(ctx, 72, 170, "late-night builds & lo-fi rain", 20, { type: "solid", color: "#8b93a1" }, { name: "Subtitle" });
  // border
  rect(ctx, 8, 8, 1184, 334, { type: "solid", color: "#00000000" }, { name: "Frame border", cornerRadius: 14, border: { paint: linear([{ color: "#5b8cff", offset: 0 }, { color: "#8a63ff", offset: 0.5 }, { color: "#5b8cff", offset: 1 }], 0), width: 2 } });
  return doc;
}

export function sceneMidnightGlass(): BannerSpecDocument {
  const { doc, ctx } = base(1200, 350, "#0a0c14", { duration: 8, loop: true });
  rect(ctx, 0, 0, 1200, 350, linear([{ color: "#0a0c14", offset: 0 }, { color: "#141b2e", offset: 1 }], 60), { name: "Background" });
  // aurora glass panels
  for (let i = 0; i < 4; i++) {
    ctx.add({
      type: "rect", name: "Glass panel", visible: true, locked: false, opacity: 0.35, rotation: -8,
      x: 120 + i * 240, y: 40 + (i % 2) * 30, width: 220, height: 260,
      fill: linear([{ color: "#5b8cff", offset: 0 }, { color: "#8a63ff", offset: 1 }], 45),
      cornerRadius: 18,
      effects: [{ id: id(), type: "blur", visible: true, params: { amount: 2 } }],
      tracks: [{ prop: "y", keys: [{ t: 0, value: 40 + (i % 2) * 30 }, { t: 4, value: 55 + (i % 2) * 30 }, { t: 8, value: 40 + (i % 2) * 30 }] }],
    });
  }
  text(ctx, 90, 185, "Midnight Glass", 54, { type: "animated", mode: "aurora", base: linear([{ color: "#9fc0ff", offset: 0 }, { color: "#c4a5ff", offset: 1 }], 0), duration: 7 }, { name: "Title", effects: [{ id: id(), type: "glow", visible: true, params: { amount: 18 } }] });
  text(ctx, 92, 225, "frosted · calm · deep", 18, { type: "solid", color: "#8b93a1" }, { name: "Subtitle" });
  rect(ctx, 6, 6, 1188, 338, { type: "solid", color: "#00000000" }, { name: "Border", cornerRadius: 16, border: { paint: { type: "animated", mode: "light-sweep", base: linear([{ color: "#5b8cff", offset: 0 }, { color: "#c4a5ff", offset: 1 }], 0), duration: 5 }, width: 2 } });
  return doc;
}

export function sceneForestResearch(): BannerSpecDocument {
  const { doc, ctx } = base(1200, 350, "#0d1510");
  rect(ctx, 0, 0, 1200, 350, linear([{ color: "#0d1510", offset: 0 }, { color: "#16281c", offset: 1 }], 90), { name: "Background" });
  // tree silhouettes
  for (let i = 0; i < 12; i++) {
    const th = 80 + ((i * 83) % 150);
    ctx.add({
      type: "ellipse", name: "Canopy", visible: true, locked: false, opacity: 0.9, rotation: 0,
      x: 40 + i * 96, y: 330 - th - 30, width: 90, height: 120,
      fill: { type: "solid", color: "#1e3a29" },
    });
    rect(ctx, 78 + i * 96, 330 - th, 14, th, { type: "solid", color: "#152a1e" }, { name: "Trunk", cornerRadius: 3 });
  }
  // fireflies
  for (let i = 0; i < 10; i++) {
    const fx = 100 + ((i * 173) % 1000);
    const fy = 80 + ((i * 97) % 180);
    ctx.add({
      type: "ellipse", name: "Firefly", visible: true, locked: false, opacity: 0.9, rotation: 0,
      x: fx, y: fy, width: 5, height: 5,
      fill: { type: "solid", color: "#d9f99d" },
      effects: [{ id: id(), type: "glow", visible: true, params: { amount: 6 } }],
      tracks: [
        { prop: "x", keys: [{ t: 0, value: fx }, { t: 4, value: fx + 30 }, { t: 8, value: fx }] },
        { prop: "opacity", keys: [{ t: 0, value: 0.2 }, { t: 2, value: 1 }, { t: 4, value: 0.2 }, { t: 6, value: 1 }, { t: 8, value: 0.2 }] },
      ],
    });
  }
  text(ctx, 70, 140, "Forest Research", 50, { type: "solid", color: "#e7f5e1" }, { name: "Title" });
  text(ctx, 72, 180, "field notes & open data", 20, { type: "solid", color: "#9db8a2" }, { name: "Subtitle" });
  return doc;
}

export function sceneRetroTerminal(): BannerSpecDocument {
  const { doc, ctx } = base(1200, 350, "#050a06");
  rect(ctx, 14, 14, 1172, 322, { type: "solid", color: "#071108" }, { name: "Screen", cornerRadius: 8, border: { paint: { type: "solid", color: "#1d3a22" }, width: 3 } });
  // scanlines
  for (let y = 16; y < 336; y += 6) {
    ctx.add({ type: "rect", name: "Scanline", visible: true, locked: false, opacity: 0.12, rotation: 0, x: 16, y, width: 1168, height: 2, fill: { type: "solid", color: "#0f2416" } });
  }
  text(ctx, 50, 90, "octocat@studio:~$", 26, { type: "solid", color: "#39d353" }, { name: "Prompt", fontFamily: "Cascadia Code, Consolas, monospace", fontWeight: 400 });
  text(ctx, 320, 90, "whoami", 26, { type: "solid", color: "#c9ffb0" }, { name: "Command", fontFamily: "Cascadia Code, Consolas, monospace", fontWeight: 400, tracks: [{ prop: "opacity", keys: [{ t: 0, value: 0 }, { t: 0.5, value: 1 }] }] });
  text(ctx, 50, 150, "open-source builder", 34, { type: "solid", color: "#39d353" }, { name: "Output", fontFamily: "Cascadia Code, Consolas, monospace", fontWeight: 400, effects: [{ id: id(), type: "glow", visible: true, params: { amount: 12 } }], tracks: [{ prop: "opacity", keys: [{ t: 1, value: 0 }, { t: 2, value: 1 }] }] });
  // blinking cursor
  ctx.add({
    type: "rect", name: "Cursor", visible: true, locked: false, opacity: 1, rotation: 0,
    x: 520, y: 130, width: 14, height: 26, fill: { type: "solid", color: "#39d353" },
    tracks: [{ prop: "opacity", keys: [{ t: 0, value: 1 }, { t: 0.5, value: 0 }, { t: 1, value: 1 }] }],
  });
  return doc;
}

export function sceneMinimalAurora(): BannerSpecDocument {
  const { doc, ctx } = base(1200, 350, "#0c0e16", { duration: 10, loop: true });
  ctx.add({
    type: "rect", name: "Aurora", visible: true, locked: false, opacity: 0.8, rotation: 0,
    x: -100, y: 0, width: 1400, height: 350,
    fill: { type: "animated", mode: "aurora", base: linear([{ color: "#22d3ee", offset: 0 }, { color: "#8a63ff", offset: 0.5 }, { color: "#f472b6", offset: 1 }], 0), duration: 10 },
    effects: [{ id: id(), type: "blur", visible: true, params: { amount: 30 } }],
  });
  text(ctx, 600, 185, "Minimal Aurora", 56, { type: "solid", color: "#ffffff" }, { name: "Title", align: "middle", effects: [{ id: id(), type: "glow", visible: true, params: { amount: 16 } }] });
  text(ctx, 600, 230, "design once · adapt everywhere", 19, { type: "solid", color: "#a9b4c7" }, { name: "Subtitle", align: "middle" });
  return doc;
}

export function scenePixelArcade(): BannerSpecDocument {
  const { doc, ctx } = base(1200, 350, "#0b0b12");
  // pixel grid background
  for (let x = 0; x < 40; x++) {
    for (let y = 0; y < 12; y++) {
      if ((x * 7 + y * 13) % 5 === 0) {
        rect(ctx, x * 30, y * 30, 26, 26, { type: "solid", color: "#141425" }, { name: "Pixel", cornerRadius: 0 });
      }
    }
  }
  // coin arc
  for (let i = 0; i < 7; i++) {
    ctx.add({
      type: "ellipse", name: "Coin", visible: true, locked: false, opacity: 1, rotation: 0,
      x: 640 + i * 44, y: 150 - Math.sin((i / 6) * Math.PI) * 60, width: 22, height: 22,
      fill: { type: "solid", color: "#ffd88a" },
      effects: [{ id: id(), type: "glow", visible: true, params: { amount: 8 } }],
    });
  }
  text(ctx, 70, 150, "PIXEL ARCADE", 48, { type: "solid", color: "#ffd88a" }, { name: "Title", fontFamily: "Cascadia Code, Consolas, monospace", effects: [{ id: id(), type: "glow", visible: true, params: { amount: 10 } }] });
  text(ctx, 72, 195, "insert coin to continue", 20, { type: "solid", color: "#8f8fb0" }, { name: "Subtitle", fontFamily: "Cascadia Code, Consolas, monospace" });
  // contribution mini-grid as decoration
  const sim: SimConfig = { mode: "snake-classic", seed: 99, weeks: 12, duration: 6, fps: 10, levels: defaultLevels(12, 99) };
  const simSvg = renderSimSvg(runSimulation(sim), { cell: 12, gap: 3, palette: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"], snakeColor: "#39d353", glow: true, background: "#0b0b12" });
  ctx.add({
    type: "image", name: "Mini snake", visible: true, locked: false, opacity: 1, rotation: 0,
    x: 620, y: 220, width: 520, height: 80,
    src: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(simSvg)))}`,
    fit: "contain",
  });
  return doc;
}

export interface SceneEntry {
  id: string;
  name: string;
  blurb: string;
  make: () => BannerSpecDocument;
}

export const STARTER_SCENES:SceneEntry[]=[{id:'terminal',name:'Retro Terminal',blurb:'scanlines · typing animation',make:sceneRetroTerminal}];
