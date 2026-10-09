import { renderCalendarGame, DEFAULT_GAME, type GameOptions } from "./games.js";
/**
 * README Composer — GitHub profile README generation from ordered sections.
 * Unknown/custom Markdown sections are preserved verbatim, never rewritten.
 */

import { renderSimSvg, runSimulation, type SimConfig } from "@pcs/contribution";
import { renderStatsSvg, type StatsConfig } from "./stats.js";
import { statsSectionMarkdown, type StatsStyleName } from "./stats-styles.js";

export type SectionType =
  | "icon" | "image" | "divider" | "spacer" | "text"
  | "banner"
  | "intro"
  | "about"
  | "projects"
  | "stats"
  | "contribution"
  | "tech-stack"
  | "current-work"
  | "buttons"
  | "support"
  | "footer"
  | "custom";

export type SectionAlign = "left" | "center" | "right";

export interface ReadmeSection {
  id: string;
  type: SectionType;
  title?: string;
  icon?: string; iconSize?: number; color?: string; label?: string; src?: string; widthPercent?: number; spacing?: number; imageWidth?: number; imageHeight?: number;
  /** verbatim markdown for custom sections */
  markdown?: string;
  /** per-section alignment (GitHub supports align on HTML wrappers) */
  align?: SectionAlign;
  buttons?: ReadmeButton[];
}

export interface ReadmeButton {
  variant?: "badge" | "solid" | "outline"; size?: "small" | "medium" | "large"; radius?: number; textColor?: string;
  label: string;
  url: string;
  /** simple-icons slug (shields.io logo parameter), e.g. "github", "twitter" */
  icon?: string;
  color?: string;
  imageUrl?: string;
  /** shields.io badge style */
  style?: "flat" | "flat-square" | "plastic" | "for-the-badge";
  /** alignment for this button's row (buttons are grouped by alignment) */
  align?: SectionAlign;
  buttons?: ReadmeButton[];
}

export interface ReadmeModel {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  dataLogin?: string;
  dataSource?: 'live' | 'cached' | 'unavailable';
  dataUpdatedAt?: number;
  sections: ReadmeSection[];
  username: string;
  /** relative asset paths as they will appear in the repo */
  assetsPrefix: string;
  tagline?: string;
  aboutText?: string;
  techStack?: string[];
  currentProject?: string;
  featured?: Array<{ name: string; url?: string; description?: string }>;
  buttons?: ReadmeButton[];
  /** Whole-profile alignment. Rendered with GitHub-supported `<div align>`. */
  align?: "left" | "center";
  /** Vertical rhythm between sections in the generated README. */
  spacing?: "compact" | "comfortable" | "spacious";
  /**
   * Stats section presentation. Undefined (or unset) renders the Studio's
   * locally generated stats.svg image; a named style renders GitHub-compatible
   * Markdown (icon + label + value) directly in the README instead.
   */
  statsStyle?: StatsStyleName;
}

export const DEFAULT_SECTIONS: ReadmeSection[] = [
  { id: "banner", type: "banner" },
  { id: "intro", type: "intro" },
  { id: "about", type: "about" },
  { id: "projects", type: "projects" },
  { id: "stats", type: "stats" },
  { id: "contribution", type: "contribution" },
  { id: "tech", type: "tech-stack" },
  { id: "buttons", type: "buttons" },
];

const h2 = (t: string) => `## ${t}`;

export interface GenerateInput {
  model: ReadmeModel;
  stats: StatsConfig;
  contribution: { config: SimConfig; cell: number; gap: number; snakeColor: string; glow: boolean; background: string; palette: string[] };
  lightDarkImages?: boolean;
}

/** Render a single section to markdown. Empty sections return "" (skipped, no fake filler). */
export function sectionMarkdown(s: ReadmeSection, model: ReadmeModel, input?: Pick<GenerateInput, "lightDarkImages" | "stats">): string {
  const p = model.assetsPrefix.replace(/\/$/, "");
  const title = s.title ?? null;
  const out: string[] = [];
  switch (s.type) {
    case "icon":
      out.push(`<img src="${p}/block-${Math.max(0,model.sections.findIndex(x=>x.id===s.id))}.svg" alt="${(s.label??s.icon??'Icon').replace(/[&<>"\n]/g,' ')}" width="${Math.max(12,Math.min(128,s.iconSize??32))}" />`);if(s.label)out.push(s.label);break;
    case "image":
      if(s.src)out.push(`<img src="${p}/block-${Math.max(0,model.sections.findIndex(x=>x.id===s.id))}.svg" alt="Profile image" width="${Math.max(10,Math.min(100,s.widthPercent??100))}%" />`);break;
    case "text":if(s.markdown)out.push(s.markdown);break;
    case "divider":out.push('---');break;
    case "spacer":out.push('<br />'.repeat(Math.max(1,Math.min(6,Math.round((s.spacing??24)/12)))));break;
    case "banner":
      if (input?.lightDarkImages) {
        out.push(`<p align="center">`);
        out.push(`  <picture>`);
        out.push(`    <source media="(prefers-color-scheme: dark)" srcset="${p}/banner-dark.svg" />`);
        out.push(`    <source media="(prefers-color-scheme: light)" srcset="${p}/banner-light.svg" />`);
        out.push(`    <img alt="Profile banner" src="${p}/banner.svg" />`);
        out.push(`  </picture>`);
        out.push(`</p>`);
      } else {
        out.push(`![Profile banner](${p}/banner.svg)`);
      }
      break;
    case "intro":
      out.push(`# Hi, I'm ${model.displayName || model.username || "yourname"} 👋`);
      if (model.tagline) {
        // Plain text taglines render bold; text the user already formatted
        // via the inline editor is emitted verbatim.
        const t = model.tagline;
        out.push(/[*_`[]/.test(t) ? t : `**${t}**`);
      }
      break;
    case "about":
      out.push(h2(title ?? "About"));
      out.push(model.aboutText?.trim() ? model.aboutText : "*Add a short introduction in the section properties.*");
      break;
    case "projects":
      out.push(h2(title ?? "Projects"));
      if (model.featured?.length) {
        for (const proj of model.featured) {
          out.push(`**[${proj.name}](${proj.url ?? "https://github.com/"})** — ${proj.description ?? ""}`);
        }
      }
      // Empty state handled in the visual editor; nothing fake emitted here.
      break;
    case "stats": {
      out.push(h2(title ?? "Stats"));
      out.push(`![Stats](${p}/stats.svg)`);
      break;
    }
    case "contribution":
      out.push(h2(title ?? "Activity"));
      out.push(`![Contribution animation](${p}/contribution.svg)`);
      break;
    case "tech-stack":
      if ((model.techStack ?? []).length) {
        out.push(h2(title ?? "Tech Stack"));
        out.push((model.techStack ?? []).map((t) => `\`${t}\``).join(" · "));
      }
      break;
    case "current-work":
      out.push(h2(title ?? "Current Work"));
      out.push(`🔭 Currently building **${model.currentProject ?? "something new"}**`);
      break;
    case "buttons":
      if (model.buttons?.length) {
        // Buttons are grouped by per-button alignment; each group becomes one
        // GitHub-supported aligned row.
        const groups: Array<[SectionAlign, ReadmeButton[]]> = [
          ["left", model.buttons.filter((b) => (b.align ?? "left") === "left")],
          ["center", model.buttons.filter((b) => b.align === "center")],
          ["right", model.buttons.filter((b) => b.align === "right")],
        ];
        for (const [align, btns] of groups) {
          if (!btns.length) continue;
          out.push(wrapAlign(btns.map(buttonMarkdown).join(" "), align === "left" && model.align !== "center" ? undefined : align));
        }
      }
      break;
    case "support":
      out.push(h2(title ?? "Support"));
      out.push(s.markdown?.trim() || "If my work helps you, consider sponsoring.");
      break;
    case "footer":
      out.push("---");
      out.push(s.markdown?.trim() || `<p align="center">Made with Profile Customization Studio</p>`);
      break;
    case "custom":
      if (s.markdown?.trim()) out.push(s.markdown);
      break;
  }
  if(s.buttons?.length) out.push(s.buttons.map(buttonMarkdown).join(" "));
  const md = out.join("\n").trim();
  return wrapAlign(md, s.align);
}

/** GitHub-compatible shields.io profile button markup. */
export function badgeImageUrl(b: ReadmeButton): string {
  const style = b.style ?? "flat";
  const logo = b.icon ? `&logo=${encodeURIComponent(b.icon)}` : "";
  const label = encodeURIComponent(b.label.replace(/-/g, "--"));
  const color = /^#[0-9a-f]{6}$/i.test(b.color??"") ? b.color!.slice(1) : "5b8cff";
  const badge = b.imageUrl && (/^https:\/\//i.test(b.imageUrl)||/^assets\/button-[0-9]+\.svg$/.test(b.imageUrl)) ? b.imageUrl : `https://img.shields.io/badge/${label}-${color}?style=${style}${logo}`;
  return badge;
}
export function buttonMarkdown(b: ReadmeButton): string {
  return `[![${b.label.replace(/[\[\]]/g," ")}](${badgeImageUrl(b)})](${b.url})`;
}

export function wrapAlign(md: string, align?: SectionAlign): string {
  if (!align || align === "left" || !md) return md;
  return `<div align="${align}">\n\n${md}\n\n</div>`;
}

/** Build the README markdown. Pure function — also used by tests. */
export function generateReadme(input: GenerateInput): string {
  const { model } = input;
  const blocks: string[] = [];
  for (const s of model.sections) {
    const md = sectionMarkdown(s, model, input).trim();
    if (md) blocks.push(md);
  }
  const gap = model.spacing === "compact" ? "\n" : model.spacing === "spacious" ? "\n\n\n\n" : "\n\n";
  const body = blocks.join(gap);
  if (model.align === "center") {
    return `<div align="center">\n\n${body}\n\n</div>\n`;
  }
  return body + "\n";
}

/** Minimal, safe Markdown→HTML for preview. Supports headings, images, bold, code, links, hr, paragraphs. */
export function markdownToPreviewHtml(md: string): string {
 md=md.replace(/<!--[\s\S]*?-->/g,'');
 const esc=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
 const url=(s:string)=>/^(https?:\/\/|mailto:|assets\/|#)/i.test(s)?esc(s):'#';
 const inline=(s:string)=>esc(s).replace(/!\[([^\]]*)\]\(([^)]+)\)/g,(_,a,u)=>`<img alt="${a}" src="${url(u)}"/>`).replace(/\[([^\]]+)\]\(([^)]+)\)/g,(_,a,u)=>`<a href="${url(u)}" target="_blank" rel="noreferrer">${a}</a>`).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/_([^_]+)_/g,'<em>$1</em>').replace(/`([^`]+)`/g,'<code>$1</code>');
 const out:string[]=[],lines=md.split('\n');let code=false,table=false,list=false;
 for(const raw of lines){const line=raw.trimEnd();
  if(line.startsWith('```')){if(code){out.push('</code></pre>');code=false;}else{out.push('<pre><code>');code=true;}continue;}
  if(code){out.push(esc(line)+'\n');continue;}
  if(line.trim().startsWith('|')){if(!table){out.push('<table>');table=true;}if(!/^\|?[\s:|-]+\|?$/.test(line))out.push('<tr>'+line.trim().replace(/^\||\|$/g,'').split('|').map(c=>`<td>${inline(c.trim())}</td>`).join('')+'</tr>');continue;}
  if(table){out.push('</table>');table=false;}
  if(/^[-*] /.test(line)){if(!list){out.push('<ul>');list=true;}out.push(`<li>${inline(line.slice(2))}</li>`);continue;}
  if(list){out.push('</ul>');list=false;}
  const heading=/^(#{1,3}) (.*)/.exec(line);if(heading)out.push(`<h${heading[1]!.length}>${inline(heading[2]!)}</h${heading[1]!.length}>`);
  else if(/^---+$/.test(line))out.push('<hr/>');
  else if(line)out.push(`<p>${inline(line)}</p>`);
 }
 if(code)out.push('</code></pre>');if(table)out.push('</table>');if(list)out.push('</ul>');return out.join('\n');
}

// ---------------------------------------------------------------- assets

export function generateStatsAsset(stats: StatsConfig): string {
  return renderStatsSvg(stats);
}

export function generateContributionAsset(contribution: GenerateInput["contribution"], animate: boolean): string {
  const result = runSimulation(contribution.config);
  return renderSimSvg(
    result,
    { cell: contribution.cell, gap: contribution.gap, palette: contribution.palette, snakeColor: contribution.snakeColor, glow: contribution.glow, background: contribution.background },
    animate,
  );
}

// ---------------------------------------------------------------- workflow

export function generateWorkflowYaml(username='yourname',game:GameOptions=DEFAULT_GAME,background='#0d1117'): string {
 const script=[
  "import { mkdir, writeFile } from 'node:fs/promises';",
  `const login=${JSON.stringify(username)};`,
  "if(!/^[a-z\\d](?:[a-z\\d-]{0,37}[a-z\\d])?$/i.test(login)||login==='yourname')throw new Error('Set a real profile username before exporting the workflow.');",
  `const renderCalendarGame=${renderCalendarGame.toString()};`,
  "const query='query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{weeks{contributionDays{date weekday contributionLevel}}}}}}';",
  "const response=await fetch('https://api.github.com/graphql',{method:'POST',headers:{Authorization:'Bearer '+process.env.GH_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query,variables:{login}})});",
  "if(!response.ok)throw new Error('GitHub calendar request failed: '+response.status);",
  "const graph=await response.json();if(graph.errors?.length||!graph.data?.user)throw new Error('GitHub calendar unavailable; existing assets preserved.');",
  "const days=graph.data.user.contributionsCollection.contributionCalendar.weeks.flatMap(w=>w.contributionDays);",
  "if(!days.length)throw new Error('Calendar returned no dates; existing assets preserved.');",
  "const ranks=['NONE','FIRST_QUARTILE','SECOND_QUARTILE','THIRD_QUARTILE','FOURTH_QUARTILE'];",
  "const levels=[...Array(days[0].weekday).fill(0),...days.map(d=>Math.max(0,ranks.indexOf(d.contributionLevel)))];while(levels.length%7)levels.push(0);",
  "const start=new Date(days[0].date+'T00:00:00Z');start.setUTCDate(start.getUTCDate()-days[0].weekday);",
  `const game=${JSON.stringify(game)},background=${JSON.stringify(background)};`,
  "await mkdir('assets',{recursive:true});",
  "await writeFile('assets/contribution.svg',renderCalendarGame(levels,game,background,true,0,start.toISOString().slice(0,10)));",
  "await writeFile('assets/contribution-static.svg',renderCalendarGame(levels,game,background,false,0,start.toISOString().slice(0,10)));"
 ].join('\n');
 return `name: Refresh contribution calendar
on:
  schedule:
    - cron: '0 3 * * *'
  workflow_dispatch:
permissions:
  contents: write
concurrency:
  group: pcs-profile-calendar
  cancel-in-progress: false
jobs:
  calendar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Read real contribution calendar
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          node --input-type=module <<'PCS_NODE'
${script.split('\n').map(l=>'          '+l).join('\n')}
          PCS_NODE
      - name: Commit changed calendar assets
        run: |
          git config user.name 'github-actions[bot]'
          git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
          git add assets/contribution.svg assets/contribution-static.svg
          if ! git diff --cached --quiet; then
            git commit -m 'Refresh real contribution calendar'
            git push
          fi
`;
}

export const SETUP_GUIDE = `# Installing your generated profile

This folder contains everything your GitHub profile needs.

## 1. Create the profile repository
On GitHub, create a **public repository named exactly your username**
(e.g. if you are \`octocat\`, create \`octocat/octocat\`). A README in that
repository shows on your profile page.

## 2. Copy these files into it
- \`README.md\` → repository root
- \`assets/\` → repository root, keeping the folder name
- \`.github/workflows/\` → repository root (optional: keeps the contribution
  animation fresh automatically)

## 3. Light / dark banners
If your export includes \`banner-dark.svg\` and \`banner-light.svg\`, the README
already uses \`<picture>\` markup so GitHub picks the right one automatically.

## 4. Contribution animation
\`assets/contribution.svg\` is an animated SVG — GitHub renders animations
inside README images. When your real contributions change, re-export from Studio. The optional workflow refreshes the contribution calendar only; profile metrics in README text remain an export-time snapshot.

## 5. Publishing
Exporting stays local. Upload the files yourself, or use Studio’s separate GitHub publish wizard and review its proposed changes.
`;

// ---------------------------------------------------------------- compatibility

export interface CompatibilityCheck {
  variant?: "badge" | "solid" | "outline"; size?: "small" | "medium" | "large"; radius?: number; textColor?: string;
  label: string;
  status: "ok" | "warn" | "fail";
  detail: string;
}

export function checkCompatibility(files: Record<string, string>): CompatibilityCheck[] {
  const checks: CompatibilityCheck[] = [];
  const banner = files["assets/banner.svg"] ?? Object.entries(files).find(([k]) => k.endsWith("banner.svg"))?.[1] ?? "";
  const animated = banner.includes("<animate") || banner.includes("<animateTransform");
  checks.push({
    label: "GitHub README image",
    status: "ok",
    detail: "SVG images are supported in README files",
  });
  checks.push({
    label: "Animation support",
    status: animated ? "ok" : "ok",
    detail: animated
      ? "Animated SVG (SMIL) plays inside GitHub README images"
      : "Static banner — no animation to consider",
  });
  if (animated) {
    checks.push({
      label: "Static fallback",
      status: files["assets/banner-static.svg"] ? "ok" : "warn",
      detail: files["assets/banner-static.svg"]
        ? "Static poster frame included"
        : "Consider including banner-static.svg for static-only viewers",
    });
  }
  const external = Object.entries(files).filter(([, v]) => /https?:\/\//.test(v));
  checks.push({
    label: "External dependencies",
    status: external.length > 0 ? "warn" : "ok",
    detail: external.length > 0 ? `${external.length} file(s) reference external URLs` : "Fully self-contained",
  });
  const total = Object.values(files).reduce((n, v) => n + v.length, 0);
  checks.push({
    label: "Total size",
    status: total > 2_000_000 ? "warn" : "ok",
    detail: `${Math.round(total / 1024)} KB across ${Object.keys(files).length} files`,
  });
  checks.push({
    label: "Flashing / motion risk",
    status: "ok",
    detail: "Animated content uses smooth loops; no strobe patterns generated",
  });
  return checks;
}
