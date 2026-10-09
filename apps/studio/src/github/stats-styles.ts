/**
 * Stats styles — GitHub-compatible Markdown stat layouts + real thumbnails.
 * Every generated snippet stays inside GitHub's Markdown capabilities
 * (bold/italic, fenced code, tables, emoji, unicode bars). No fake data:
 * values come from the project's stats fields (real public GitHub numbers
 * once a username is set).
 */

import { DEMO_STATS, type StatsField } from "./stats.js";

export type StatsStyleName =
  | "minimal"
  | "lofi"
  | "glass"
  | "terminal"
  | "editorial"
  | "hud"
  | "cards"
  | "inline"
  | "dark-neon"
  | "nature";

export interface StatsStyleMeta {
  id: StatsStyleName;
  label: string;
  blurb: string;
}

export const STATS_STYLES: StatsStyleMeta[] = [
  { id: "minimal", label: "Minimal", blurb: "Plain bold lines — quiet and readable." },
  { id: "lofi", label: "Lofi", blurb: "Lowercase dotted leaders in a soft code block." },
  { id: "glass", label: "Glass", blurb: "Values in a single sleek header table." },
  { id: "terminal", label: "Terminal", blurb: "Shell prompt with key = value output." },
  { id: "editorial", label: "Editorial", blurb: "One written sentence, magazine style." },
  { id: "hud", label: "HUD", blurb: "Uppercase labels with level bars." },
  { id: "cards", label: "Cards", blurb: "Icon + label + value table cells." },
  { id: "inline", label: "Inline", blurb: "Everything on one compact line." },
  { id: "dark-neon", label: "Dark Neon", blurb: "Glowing uppercase values with icons." },
  { id: "nature", label: "Nature", blurb: "Leafy, organic lowercase lines." },
];

const STAT_ICONS: Record<string, string> = {
  repos: "🗂️",
  stars: "⭐",
  followers: "👥",
  commits: "🔥",
  prs: "🔀",
  releases: "🚀",
};

export function statIcon(key: string): string {
  return STAT_ICONS[key] ?? "•";
}

export function formatStatValue(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(n);
}

/**
 * Unicode sparkline from a contribution/activity history series.
 * Returns null unless the caller actually supplies data — never faked.
 */
const SPARK = "▁▂▃▄▅▆▇█";
export function statsSparkline(history?: number[]): string | null {
  if (!history || history.length < 2 || history.every((v) => v === 0)) return null;
  const max = Math.max(...history, 1);
  return history.map((v) => SPARK[Math.min(SPARK.length - 1, Math.floor((v / max) * SPARK.length))]).join("");
}

interface Row {
  icon: string;
  label: string;
  value: string;
  raw: number;
}

function rowsOf(fields: StatsField[]): Row[] {
  return fields.map((f) => ({ icon: statIcon(f.key), label: f.label, value: formatStatValue(f.value), raw: f.value }));
}

function codeBlock(lines: string[]): string {
  return "```\n" + lines.join("\n") + "\n```";
}

function table(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
}

function hudBar(v: number, max: number): string {
  const n = 5;
  const filled = Math.max(1, Math.round((v / Math.max(1, max)) * n));
  return "▰".repeat(filled) + "▱".repeat(n - filled);
}

/**
 * Markdown for the stats section in the chosen style.
 * `history` (e.g. weekly contribution counts) is optional — when the data
 * provider supplies it a unicode sparkline is appended; otherwise omitted.
 */
export function statsSectionMarkdown(style: StatsStyleName, fields: StatsField[], history?: number[]): string {
  const rows = rowsOf(fields);
  if (!rows.length) return "";
  const spark = statsSparkline(history);
  const withSpark = (md: string): string => (spark ? `${md}\n\n\`${spark}\` recent activity` : md);

  let md: string;
  switch (style) {
    case "minimal":
      md = rows.map((r) => `**${r.label}:** ${r.value}`).join("\n");
      break;
    case "lofi":
      md = codeBlock(rows.map((r) => `${r.label.toLowerCase()} ${"·".repeat(Math.max(2, 20 - r.label.length))} ${r.value}`));
      break;
    case "glass":
      md = table(rows.map((r) => r.label), [rows.map((r) => `**${r.value}**`)]);
      break;
    case "terminal":
      md = codeBlock([`$ profile --stats`, ...rows.map((r) => `> ${r.label.toLowerCase().replace(/ /g, "_")} = ${r.value}`)]);
      break;
    case "editorial": {
      const parts = rows.map((r) => `**${r.value}** ${r.label.toLowerCase()}`);
      md = `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]} — live from my public GitHub profile.`;
      break;
    }
    case "hud": {
      const max = Math.max(...rows.map((r) => r.raw), 1);
      md = table(["Stat", "Level"], rows.map((r) => [r.label.toUpperCase(), `${hudBar(r.raw, max)} ${r.value}`]));
      break;
    }
    case "cards":
      md = table(["Stat", "Value"], rows.map((r) => [`${r.icon} ${r.label}`, `**${r.value}**`]));
      break;
    case "inline":
      md = rows.map((r) => `${r.label} **${r.value}**`).join(" · ");
      break;
    case "dark-neon":
      md = rows.map((r) => `**${r.icon === "•" ? "⚡" : r.icon} ${r.value} ${r.label.toUpperCase()}**`).join("\n");
      break;
    case "nature":
      md = rows.map((r) => `🌿 **${r.value}** ${r.label.toLowerCase()}`).join("\n");
      break;
  }
  return withSpark(md);
}

// ---------------------------------------------------------------- thumbnails

interface ThumbPalette {
  bg: string;
  text: string;
  accent: string;
  muted: string;
  font: string;
  border?: string;
  rounded?: boolean;
  glow?: boolean;
  pill?: boolean;
}

const THUMB_PALETTES: Record<StatsStyleName, ThumbPalette> = {
  minimal: { bg: "#ffffff", text: "#24292f", accent: "#0969da", muted: "#57606a", font: "'Segoe UI', sans-serif", border: "#d0d7de" },
  lofi: { bg: "#f6efdf", text: "#5b5142", accent: "#d9822b", muted: "#9c8f77", font: "monospace", border: "#e2d7bd", rounded: true },
  glass: { bg: "#dfe9ff", text: "#1f2430", accent: "#3d63dd", muted: "#5b6b8c", font: "'Segoe UI', sans-serif", border: "#aebfef", pill: true, rounded: true },
  terminal: { bg: "#0d1117", text: "#3fb950", accent: "#8bffb0", muted: "#2ea043", font: "monospace" },
  editorial: { bg: "#faf7f2", text: "#1a1a1a", accent: "#b3541e", muted: "#6b6b6b", font: "Georgia, serif", border: "#e5ded2" },
  hud: { bg: "#101418", text: "#9fb3c8", accent: "#00e5ff", muted: "#5c6b7a", font: "monospace" },
  cards: { bg: "#f6f8fa", text: "#24292f", accent: "#8250df", muted: "#57606a", font: "'Segoe UI', sans-serif", border: "#d0d7de", rounded: true },
  inline: { bg: "#ffffff", text: "#24292f", accent: "#5b8cff", muted: "#57606a", font: "'Segoe UI', sans-serif", border: "#d0d7de" },
  "dark-neon": { bg: "#0b0f1a", text: "#e6d9ff", accent: "#c77dff", muted: "#7a5fa8", font: "monospace", glow: true },
  nature: { bg: "#eef6ec", text: "#2f4a2c", accent: "#3e8e4d", muted: "#6b8a66", font: "'Segoe UI', sans-serif", border: "#cfe3cc", rounded: true },
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/&lt;/g, "&lt;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Real thumbnail of the style: a small inline SVG mock using that style's
 * actual colors, fonts and layout family (never a gray placeholder box).
 */
export function statsStyleThumbSvg(style: StatsStyleName, fields: StatsField[]): string {
  const W = 240;
  const H = 116;
  const p = THUMB_PALETTES[style];
  const safe = fields.length ? fields : DEMO_STATS;
  const rows = rowsOf(safe.slice(0, 4));
  const parts: string[] = [];

  const bgRect = p.rounded
    ? `<rect width="${W}" height="${H}" rx="10" fill="${p.bg}" stroke="${p.border ?? p.bg}"/>`
    : `<rect width="${W}" height="${H}" fill="${p.bg}"/>`;
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  if (p.glow) {
    parts.push(`<defs><filter id="neonGlow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`);
  }
  parts.push(bgRect);
  parts.push(`<text x="12" y="19" fill="${p.accent}" font-family="${p.font}" font-size="10" font-weight="700">GitHub Stats</text>`);

  const y0 = 40;
  const rowH = 19;
  const font = (size: number, weight?: number) =>
    `font-family="${p.font}" font-size="${size}"${weight ? ` font-weight="${weight}"` : ""}`;

  if (style === "minimal" || style === "nature" || style === "dark-neon") {
    rows.forEach((r, i) => {
      const y = y0 + i * rowH;
      const label = style === "dark-neon" ? r.label.toUpperCase() : style === "nature" ? `🌿 ${r.label.toLowerCase()}` : r.label;
      parts.push(`<text x="14" y="${y}" fill="${p.text}" ${font(11)}>${esc(label)}</text>`);
      const glow = p.glow ? ` filter="url(#neonGlow)"` : "";
      parts.push(`<text x="${W - 14}" y="${y}" fill="${p.accent}" ${font(12, 700)} text-anchor="end"${glow}>${esc(style === "dark-neon" ? `${r.icon} ${r.value}` : r.value)}</text>`);
    });
  } else if (style === "lofi" || style === "terminal") {
    const line = (s: string, y: number, color: string) =>
      parts.push(`<text x="14" y="${y}" fill="${color}" ${font(10)}>${esc(s)}</text>`);
    if (style === "terminal") line("$ profile --stats", y0 - 12, p.accent);
    rows.forEach((r, i) => {
      const y = y0 + i * rowH;
      if (style === "lofi") {
        const dots = "·".repeat(Math.max(2, 22 - r.label.length));
        line(`${r.label.toLowerCase()} ${dots} ${r.value}`, y, p.text);
      } else {
        line(`> ${r.label.toLowerCase().replace(/ /g, "_")} = ${r.value}`, y, p.text);
      }
    });
  } else if (style === "hud") {
    const max = Math.max(...rows.map((r) => r.raw), 1);
    const bx = 96;
    const bw = W - bx - 44;
    rows.forEach((r, i) => {
      const y = y0 + i * rowH;
      parts.push(`<text x="14" y="${y}" fill="${p.text}" ${font(9)}>${esc(r.label.toUpperCase())}</text>`);
      parts.push(`<rect x="${bx}" y="${y - 8}" width="${bw}" height="7" rx="3" fill="${p.muted}" opacity="0.3"/>`);
      parts.push(`<rect x="${bx}" y="${y - 8}" width="${Math.max(4, bw * (r.raw / max))}" height="7" rx="3" fill="${p.accent}"/>`);
      parts.push(`<text x="${bx + bw + 6}" y="${y}" fill="${p.accent}" ${font(9, 700)}>${esc(r.value)}</text>`);
    });
  } else if (style === "cards") {
    rows.forEach((r, i) => {
      const cx = 14 + (i % 2) * 110;
      const cy = y0 - 16 + Math.floor(i / 2) * 40;
      parts.push(`<rect x="${cx}" y="${cy}" width="102" height="32" rx="6" fill="${p.accent}" opacity="0.1" stroke="${p.border ?? p.accent}"/>`);
      parts.push(`<text x="${cx + 8}" y="${cy + 14}" ${font(11)}>${r.icon}</text>`);
      parts.push(`<text x="${cx + 26}" y="${cy + 14}" fill="${p.accent}" ${font(10, 700)}>${esc(r.value)}</text>`);
      parts.push(`<text x="${cx + 26}" y="${cy + 26}" fill="${p.muted}" ${font(8)}>${esc(r.label)}</text>`);
    });
  } else if (style === "glass") {
    rows.forEach((r, i) => {
      const cx = 14 + (i % 2) * 110;
      const cy = y0 - 16 + Math.floor(i / 2) * 40;
      parts.push(`<rect x="${cx}" y="${cy}" width="102" height="32" rx="16" fill="#ffffff" opacity="0.55" stroke="${p.border}"/>`);
      parts.push(`<text x="${cx + 12}" y="${cy + 20}" fill="${p.accent}" ${font(12, 700)}>${esc(r.value)}</text>`);
      parts.push(`<text x="${cx + 44}" y="${cy + 20}" fill="${p.muted}" ${font(9)}>${esc(r.label)}</text>`);
    });
  } else if (style === "inline") {
    const line1 = rows.slice(0, 2);
    const line2 = rows.slice(2, 4);
    const drawLine = (rs: Row[], y: number) => {
      let x = 14;
      rs.forEach((r) => {
        parts.push(`<text x="${x}" y="${y}" fill="${p.muted}" ${font(10)}>${esc(`${r.label} `)}</text>`);
        // width estimate keeps it simple — thumbnails are fixed-sample mocks
        x += r.label.length * 5.6 + 4;
        parts.push(`<text x="${x}" y="${y}" fill="${p.accent}" ${font(11, 700)}>${esc(r.value)}</text>`);
        x += r.value.length * 6.6 + 14;
      });
    };
    drawLine(line1, y0 + 4);
    drawLine(line2, y0 + 4 + rowH + 10);
  } else if (style === "editorial") {
    const sentence = `${rows[0]!.value} ${rows[0]!.label.toLowerCase()}, ${rows[1]!.value} ${rows[1]!.label.toLowerCase()}`;
    const sentence2 = `and ${rows[2]!.value} ${rows[2]!.label.toLowerCase()} — live from GitHub.`;
    parts.push(`<text x="14" y="${y0}" fill="${p.text}" ${font(11)} font-style="italic">${esc(sentence)}</text>`);
    parts.push(`<text x="14" y="${y0 + 20}" fill="${p.text}" ${font(11)} font-style="italic">${esc(sentence2)}</text>`);
    parts.push(`<rect x="14" y="${y0 + 32}" width="34" height="2" fill="${p.accent}"/>`);
  }

  parts.push(`</svg>`);
  return parts.join("\n");
}


export function renderStatsStyleSvg(style: StatsStyleName, fields: StatsField[], light = false): string {
 const palette=THUMB_PALETTES[style]??THUMB_PALETTES.minimal;
 const darkSurface=['minimal','editorial','cards','inline','nature'].includes(style);
 const bg=light?'#f6f8fa':darkSurface?(style==='nature'?'#13251c':'#111820'):palette.bg,text=light?'#1f2328':darkSurface?'#e8eef5':palette.text,muted=light?'#59636e':darkSurface?'#a8b6c5':palette.muted;
 const accents:Partial<Record<StatsStyleName,string>>={nature:'#2d8058',editorial:'#242424',terminal:'#197641',lofi:'#79548c','dark-neon':'#8750ca',glass:'#396e94',minimal:'#374151',inline:'#374151'};
 const accent=light?(accents[style]??'#355fa6'):style==='nature'?'#9bd5ac':style==='editorial'||style==='minimal'||style==='inline'?'#e8eef5':style==='cards'?'#bba6f3':palette.accent;
 const terminal=style==='terminal'||style==='lofi',plain=style==='minimal'||style==='editorial',inline=style==='inline';
 const columns=inline?Math.min(4,Math.max(1,fields.length)):plain||terminal?1:2;
 const cellW=600/columns,cellH=terminal?44:plain?56:inline?86:100;
 const height=64+Math.max(1,Math.ceil(fields.length/columns))*cellH;
 const body=fields.map((field,index)=>{
  const x=16+(index%columns)*cellW,y=54+Math.floor(index/columns)*cellH,value=esc(formatStatValue(field.value)),suffix=field.suffix?' '+esc(field.suffix):'';
  if(terminal)return `<g font-family="monospace"><text x="${x+12}" y="${y+26}" fill="${muted}" font-size="13">${style==='terminal'?'$':'·'} ${esc(field.label)}</text><text x="604" y="${y+26}" text-anchor="end" fill="${accent}" font-size="18">${value}${suffix}</text></g>`;
  if(plain)return `<g><path d="M${x+8} ${y+48}H608" stroke="${muted}" stroke-opacity=".2"/><text x="${x+8}" y="${y+28}" fill="${muted}" font-size="14">${esc(field.label)}</text><text x="604" y="${y+29}" text-anchor="end" fill="${text}" font-size="24" font-weight="${style==='editorial'?400:600}">${value}${suffix}</text></g>`;
  if(inline)return `<g><text x="${x+cellW/2}" y="${y+30}" text-anchor="middle" fill="${accent}" font-size="26" font-weight="700">${value}</text><text x="${x+cellW/2}" y="${y+55}" text-anchor="middle" fill="${muted}" font-size="11">${esc(field.label)}</text></g>`;
  const glass=style==='glass',neon=style==='dark-neon',hud=style==='hud';
  return `<g><rect x="${x}" y="${y}" width="${cellW-12}" height="88" rx="${hud?3:16}" fill="${glass?'url(#stats-glass)':accent}" fill-opacity="${glass?1:.06}" stroke="${accent}" stroke-opacity="${neon?.6:.18}"/>${neon?`<rect x="${x+12}" y="${y+14}" width="3" height="58" rx="1.5" fill="${accent}"/>`:''}<text x="${x+22}" y="${y+28}" fill="${muted}" font-size="12">${esc(field.label)}</text><text x="${x+22}" y="${y+65}" fill="${accent}" font-size="30" font-weight="650">${value}<tspan font-size="12">${suffix}</tspan></text></g>`;
 }).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="632" height="${height+16}" viewBox="0 0 632 ${height+16}"><defs><linearGradient id="stats-glass" x2="1" y2="1"><stop stop-color="${accent}" stop-opacity=".18"/><stop offset="1" stop-color="${accent}" stop-opacity=".03"/></linearGradient></defs><rect width="100%" height="100%" rx="${style==='editorial'?0:18}" fill="${bg}"/><g font-family="${palette.font}" fill="${text}"><text x="24" y="32" font-size="${style==='editorial'?19:14}" font-weight="600">${terminal?'~/github /': 'GitHub ·'} ${esc(style.replace('-',' '))}</text>${body}${fields.length?'':'<text x="24" y="88" font-size="14">No fetched metrics available</text>'}</g></svg>`;
}

/** Counts only consecutive dated calendar entries; gaps break a streak. */
export function calendarStreak(days: Array<{date:string;count:number}>, asOf: string): {current:number;longest:number} {
  const sorted = [...days].filter(d=>d.date<=asOf).sort((a,b)=>a.date.localeCompare(b.date));
  let longest=0,run=0,previous='';
  for(const day of sorted){const adjacent=previous && Date.parse(day.date+'T00:00:00Z')-Date.parse(previous+'T00:00:00Z')===86400000;run=day.count>0?(adjacent?run+1:1):0;longest=Math.max(longest,run);previous=day.date;}
  const map=new Map(sorted.map(d=>[d.date,d.count]));let cursor=new Date(asOf+'T00:00:00Z'),current=0;
  if(!map.get(asOf))cursor.setUTCDate(cursor.getUTCDate()-1);
  while((map.get(cursor.toISOString().slice(0,10))??0)>0){current++;cursor.setUTCDate(cursor.getUTCDate()-1);}
  return {current,longest};
}
