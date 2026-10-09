/**
 * Stats Studio — local, customizable stats visuals.
 * Data comes from demo values, manual entry (or future providers);
 * output is a standalone SVG in several layout families.
 */

export interface StatsField {
  key: string;
  label: string;
  value: number;
  suffix?: string;
}

export const DEMO_STATS: StatsField[] = [
  { key: "repos", label: "Repositories", value: 42 },
  { key: "stars", label: "Stars earned", value: 1280 },
  { key: "followers", label: "Followers", value: 318 },
  { key: "commits", label: "Commits (year)", value: 2147 },
  { key: "prs", label: "Pull requests", value: 96 },
  { key: "releases", label: "Releases", value: 14 },
];

export type StatsLayout = "minimal" | "card" | "terminal" | "hud" | "bars";

export interface StatsConfig {
  layout: StatsLayout;
  fields: StatsField[];
  accent: string;
  background: string;
  textColor: string;
  title: string;
  width?: number;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n);
}

export function renderStatsSvg(cfg: StatsConfig): string {
  const width = cfg.width ?? 640;
  const rowH = 34;
  const height = 60 + cfg.fields.length * rowH;
  const parts: string[] = [];

  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
  if (cfg.layout === "card") {
    parts.push(`<rect width="${width}" height="${height}" rx="12" fill="${cfg.background}"/>`);
  } else {
    parts.push(`<rect width="${width}" height="${height}" fill="${cfg.background}"/>`);
  }
  parts.push(`<text x="24" y="36" fill="${cfg.accent}" font-family="monospace" font-size="15" font-weight="700">${esc(cfg.title)}</text>`);

  cfg.fields.forEach((f, i) => {
    const y = 66 + i * rowH;
    const value = fmt(f.value);
    switch (cfg.layout) {
      case "minimal":
        parts.push(`<text x="24" y="${y}" fill="${cfg.textColor}" font-family="Segoe UI, sans-serif" font-size="14">${f.label}</text>`);
        parts.push(`<text x="${width - 24}" y="${y}" fill="${cfg.accent}" font-family="monospace" font-size="15" font-weight="700" text-anchor="end">${value}</text>`);
        break;
      case "card":
        parts.push(`<rect x="18" y="${y - 20}" width="${width - 36}" height="28" rx="6" fill="${cfg.textColor}" opacity="0.06"/>`);
        parts.push(`<text x="30" y="${y}" fill="${cfg.textColor}" font-family="Segoe UI, sans-serif" font-size="13">${f.label}</text>`);
        parts.push(`<text x="${width - 30}" y="${y}" fill="${cfg.accent}" font-family="monospace" font-size="14" font-weight="700" text-anchor="end">${value}</text>`);
        break;
      case "terminal":
        parts.push(`<text x="24" y="${y}" fill="${cfg.textColor}" font-family="monospace" font-size="13"><tspan fill="${cfg.accent}">&gt;</tspan> ${esc(f.label.toLowerCase().replace(/ /g, "_"))} = ${value}</text>`);
        break;
      case "hud": {
        const bx = 190, bw = width - bx - 40;
        parts.push(`<text x="24" y="${y}" fill="${cfg.textColor}" font-family="monospace" font-size="12">${esc(f.label.toUpperCase())}</text>`);
        parts.push(`<rect x="${bx}" y="${y - 11}" width="${bw}" height="8" rx="4" fill="${cfg.textColor}" opacity="0.12"/>`);
        parts.push(`<rect x="${bx}" y="${y - 11}" width="${bw * Math.min(1, f.value / 3000)}" height="8" rx="4" fill="${cfg.accent}"/>`);
        parts.push(`<text x="${bx + bw + 6}" y="${y - 2}" fill="${cfg.accent}" font-family="monospace" font-size="11">${value}</text>`);
        break;
      }
      case "bars": {
        const bx = 190, bw = width - bx - 60;
        parts.push(`<text x="24" y="${y}" fill="${cfg.textColor}" font-family="Segoe UI, sans-serif" font-size="13">${f.label}</text>`);
        parts.push(`<rect x="${bx}" y="${y - 10}" width="${bw}" height="10" rx="5" fill="${cfg.textColor}" opacity="0.1"/>`);
        parts.push(`<rect x="${bx}" y="${y - 10}" width="${bw * Math.min(1, f.value / 3000)}" height="10" rx="5" fill="${cfg.accent}"/>`);
        parts.push(`<text x="${bx + bw + 10}" y="${y}" fill="${cfg.accent}" font-family="monospace" font-size="12">${value}</text>`);
        break;
      }
    }
  });

  parts.push(`</svg>`);
  return parts.join("\n");
}
