/**
 * Visual preset data — palettes, animated-color cards, ambience.
 * Appearance-driven choices use cards with live previews, never dropdowns.
 */
import { linear, type AnimatedPaint } from "@pcs/bannerspec";

export interface PaletteEntry {
  name: string;
  colors: [string, string, string];
}

export const PALETTES: PaletteEntry[] = [
  { name: "Forest", colors: ["#1e3a29", "#3ecf8e", "#d9f99d"] },
  { name: "Sunset", colors: ["#f59e0b", "#f472b6", "#8a63ff"] },
  { name: "Ocean", colors: ["#0f2740", "#22d3ee", "#a5f3fc"] },
  { name: "Aurora", colors: ["#22d3ee", "#34d399", "#8a63ff"] },
  { name: "Cyber", colors: ["#0b1020", "#38bdf8", "#f0abfc"] },
  { name: "Lavender", colors: ["#2e2a4a", "#a78bfa", "#ede9fe"] },
  { name: "Mono", colors: ["#111111", "#888888", "#eeeeee"] },
  { name: "Sakura", colors: ["#3d2033", "#f9a8d4", "#fbcfe8"] },
  { name: "Night Blue", colors: ["#0a1024", "#5b8cff", "#c7d8f5"] },
  { name: "Ember", colors: ["#1a0d08", "#f97316", "#ffd88a"] },
  { name: "Crimson", colors: ["#120608", "#ef4444", "#fca5a5"] },
  { name: "Pastel", colors: ["#2a2440", "#f9a8d4", "#a5f3fc"] },
];

export interface AnimatedColorCard {
  id: string;
  name: string;
  blurb: string;
  make: (duration?: number) => AnimatedPaint;
}

const grad = (a: string, b: string, c = a) => linear([{ color: a, offset: 0 }, { color: b, offset: 0.5 }, { color: c, offset: 1 }], 0);

export const ANIMATED_COLOR_CARDS: AnimatedColorCard[] = [
  { id: "aurora", name: "Aurora Flow", blurb: "Slow cool-color movement", make: (d = 10) => ({ type: "animated", mode: "aurora", base: grad("#22d3ee", "#8a63ff", "#f472b6"), duration: d }) },
  { id: "rainbow", name: "Rainbow Drift", blurb: "Colors slowly cycle through the rainbow", make: (d = 8) => ({ type: "animated", mode: "hue-cycle", base: grad("#ff5f6d", "#ffc371", "#7ee8fa"), duration: d }) },
  { id: "pulse", name: "Soft Pulse", blurb: "Gentle brightening and dimming", make: (d = 4) => ({ type: "animated", mode: "color-pulse", base: grad("#5b8cff", "#8a63ff", "#5b8cff"), duration: d }) },
  { id: "sunset", name: "Sunset Cycle", blurb: "Warm golden-hour tones", make: (d = 12) => ({ type: "animated", mode: "gradient-drift", base: grad("#f59e0b", "#f472b6", "#8a63ff"), duration: d }) },
  { id: "neon", name: "Neon Sweep", blurb: "A bright shine passes across", make: (d = 5) => ({ type: "animated", mode: "light-sweep", base: grad("#ff4fd8", "#4fd8ff", "#ff4fd8"), duration: d }) },
  { id: "ocean", name: "Ocean Flow", blurb: "Deep calm water tones", make: (d = 9) => ({ type: "animated", mode: "gradient-drift", base: grad("#0ea5e9", "#22d3ee", "#0f2740"), duration: d }) },
  { id: "fire", name: "Fire Glow", blurb: "Warm ember breathing", make: (d = 3) => ({ type: "animated", mode: "color-pulse", base: grad("#f97316", "#ffd88a", "#f97316"), duration: d }) },
  { id: "palette", name: "Palette Cycle", blurb: "Smooth rotation of your palette", make: (d = 14) => ({ type: "animated", mode: "palette-cycle", base: grad("#3ecf8e", "#5b8cff", "#c084fc"), duration: d }) },
];

export interface GradientPreset {
  name: string;
  blurb: string;
  make: () => ReturnType<typeof linear>;
}

export const GRADIENT_PRESETS: GradientPreset[] = [
  { name: "Dusk", blurb: "Blue into violet", make: () => linear([{ color: "#1e2a5e", offset: 0 }, { color: "#8a63ff", offset: 1 }], 90) },
  { name: "Sunrise", blurb: "Warm amber glow", make: () => linear([{ color: "#f59e0b", offset: 0 }, { color: "#f472b6", offset: 1 }], 30) },
  { name: "Deep Sea", blurb: "Dark ocean depth", make: () => linear([{ color: "#0a1f33", offset: 0 }, { color: "#0ea5e9", offset: 1 }], 90) },
  { name: "Forest Floor", blurb: "Earthy greens", make: () => linear([{ color: "#0d1510", offset: 0 }, { color: "#3ecf8e", offset: 1 }], 90) },
  { name: "Gunmetal", blurb: "Cool steel", make: () => linear([{ color: "#111418", offset: 0 }, { color: "#39424f", offset: 1 }], 45) },
  { name: "Sakura", blurb: "Soft pink bloom", make: () => linear([{ color: "#3d2033", offset: 0 }, { color: "#f9a8d4", offset: 1 }], 60) },
  { name: "Ember Dark", blurb: "Charcoal and flame", make: () => linear([{ color: "#1a0d08", offset: 0 }, { color: "#f97316", offset: 1 }], 90) },
  { name: "Nord", blurb: "Cold Scandinavian blue", make: () => linear([{ color: "#2e3440", offset: 0 }, { color: "#88c0d0", offset: 1 }], 90) },
];

/** Apply palette accents to a scene: recolors gradient/animated paints' stops. */
export function shiftScenePalette(doc: import("@pcs/bannerspec").BannerSpecDocument, palette: PaletteEntry): void {
  const walk = (layers: import("@pcs/bannerspec").Layer[]) => {
    for (const l of layers) {
      if (l.type === "group") { walk(l.children); continue; }
      const fill = l.fill;
      if (typeof fill === "object" && fill && (fill.type === "linear" || fill.type === "radial" || fill.type === "conic")) {
        const stops = fill.stops.map((s, i) => ({ ...s, color: palette.colors[i % palette.colors.length] ?? s.color }));
        (fill as { stops: typeof stops }).stops = stops;
      } else if (typeof fill === "object" && fill && fill.type === "animated") {
        const stops = fill.base.stops.map((s, i) => ({ ...s, color: palette.colors[i % palette.colors.length] ?? s.color }));
        fill.base.stops = stops;
      }
    }
  };
  walk(doc.layers);
}
