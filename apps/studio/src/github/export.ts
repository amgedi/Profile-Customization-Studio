import { LICENSES } from '../photoLicenses.js';
/**
 * Export package builder — assembles the local GitHub profile package.
 * File overwrite decisions belong to the caller (Studio shows a diff/confirm).
 */

import {buttonGraphic} from './button-graphic.js';
import {profileIconSvg} from '../profileIcons.js';
import { renderSvg } from "@pcs/scene-core";
import { renderCalendarGame, DEFAULT_GAME } from "./games.js";
import { newProject, type PCSProject } from "../project.js";
import { renderStatsSvg } from "./stats.js";
import { renderStatsStyleSvg } from "./stats-styles.js";
import {
  DEFAULT_SECTIONS,
  generateContributionAsset,
  generateReadme,
  generateWorkflowYaml,
  SETUP_GUIDE,
  type ReadmeModel,
} from "./readme.js";
import type { SimConfig } from "@pcs/contribution";

export const DEFAULT_CONTRIBUTION = {
  config: {
    mode: "snake-long",
    seed: 424242,
    weeks: 53,
    duration: 8,
    fps: 12,
    levels: Array(53 * 7).fill(0),
  } as SimConfig,
  cell: 11,
  gap: 3,
  snakeColor: "#39d353",
  glow: true,
  source: "unavailable" as const,
  background: "#0d1117",
};

export const DEFAULT_README_MODEL: ReadmeModel = {
  sections: DEFAULT_SECTIONS,
  username: "yourname",
  assetsPrefix: "assets",
  tagline: "",
  aboutText: "",
  techStack: [],
  currentProject: "",
  buttons: [],
};

export function ensureProjectDefaults(p: PCSProject): PCSProject {
  return {
    ...p,
    readme: p.readme ?? DEFAULT_README_MODEL,
    stats: p.stats ?? {
      layout: "card",
      fields: [],
      accent: "#5b8cff",
      background: "#0d1117",
      textColor: "#e6edf3",
      title: "GitHub Stats",
    },
    contribution: p.contribution ?? DEFAULT_CONTRIBUTION,
  };
}

export interface ExportInput {
  project: PCSProject;
  /** light/dark banner pair from the current scene */
  lightDark: boolean;
  includeWorkflow: boolean;
  animatedContribution: boolean;
  /** bundled photo src → data URL, so photo scenes export self-contained */
  photoData?: Record<string, string>;
}

/** Collect bundled photo references ("photos/x.jpg") as data URLs. */
export async function collectPhotoData(project: PCSProject): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const walk = (layers: { type: string; src?: string; children?: any[] }[]): void => {
    for (const l of layers) {
      if (l.children) walk(l.children);
      if (l.type === "image" && l.src && l.src.startsWith("photos/") && !out[l.src]) out[l.src] = "";
    }
  };
  walk(project.bannerSpec.layers as never);
  await Promise.all(Object.keys(out).map(async (rel) => {
    try {
      const res = await fetch(rel);
      if (!res.ok) return;
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.readAsDataURL(blob);
      });
      out[rel] = dataUrl;
    } catch { /* leave blank — renderer falls back */ }
  }));
  return out;
}

export function inlinePhotos(spec: PCSProject["bannerSpec"], photoData: Record<string, string> | undefined): PCSProject["bannerSpec"] {
  if (!photoData || Object.keys(photoData).length === 0) return spec;
  const doc = structuredClone(spec);
  const walk = (layers: { type: string; src?: string; children?: any[] }[]): void => {
    for (const l of layers) {
      if (l.children) walk(l.children);
      if (l.type === "image" && l.src && photoData[l.src]) l.src = photoData[l.src]!;
    }
  };
  walk(doc.layers as never);
  return doc;
}

export type ExportFileMap = Record<string, string>;

export function buildExportPackage(input: ExportInput): ExportFileMap {
  const p = ensureProjectDefaults(input.project);
  if (p.readme?.username && p.readme.username !== 'yourname' && p.readme.dataLogin?.toLowerCase() !== p.readme.username.toLowerCase()) {
    p.stats = { ...p.stats!, fields: [], title: 'GitHub data unavailable — refresh in Profile' };
    p.contribution = { ...p.contribution!, source: 'unavailable', config: { ...p.contribution!.config, levels: Array(371).fill(0), weeks: 53 } };
  }
  if (p.contribution?.source !== 'github') {
    p.contribution = { ...p.contribution!, config: { ...p.contribution!.config, levels: Array(371).fill(0), weeks: 53 } };
  }
  const files: ExportFileMap = {};

  const spec = inlinePhotos(p.bannerSpec, input.photoData);
  const bannerSvg = renderSvg(spec, { animate: true });
  files["assets/banner.svg"] = bannerSvg;
  if (input.lightDark) {
    files["assets/banner-dark.svg"] = bannerSvg;
    const light = structuredClone(spec);
    light.canvas.background = "#f6f8fa";
    // naive auto-derivation; user can fine-tune both scenes
    for (const l of light.layers) {
      if (typeof l.fill === "object" && l.fill?.type === "solid" && l.fill.color === "#ffffff") continue;
    }
    files["assets/banner-light.svg"] = renderSvg(light, {animate:true});
  }
  files["assets/banner-static.svg"] = renderSvg(spec, { time: (spec.animation?.duration ?? 8) / 2 });

  files["assets/stats.svg"] = p.stats ? renderStatsStyleSvg(p.readme?.statsStyle ?? "cards", p.stats.fields) : "";
  files["assets/contribution.svg"] = generateContributionAsset(
    { ...(p.contribution ?? DEFAULT_CONTRIBUTION), palette: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"] },
    input.animatedContribution,
  );
  files["assets/contribution-static.svg"] = generateContributionAsset(
    { ...(p.contribution ?? DEFAULT_CONTRIBUTION), palette: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"] },
    false,
  );

  if (p.contribution) {
    const c = p.contribution;
    const game = c.game ?? DEFAULT_GAME;
    files['assets/contribution.svg'] = renderCalendarGame(c.config.levels, game, c.background, input.animatedContribution,0,c.calendarStart);
    files['assets/contribution-static.svg'] = renderCalendarGame(c.config.levels, game, c.background, false,0,c.calendarStart);
  }
  for(const [index,section] of (p.readme?.sections??[]).entries()){
    if(section.type==='icon')files[`assets/block-${index}.svg`]=profileIconSvg(section.icon??'star',section.iconSize,section.color);
    if(section.type==='image'&&section.src&&/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(section.src)){const w=Math.max(1,Math.min(20000,section.imageWidth??800)),h=Math.max(1,Math.min(20000,section.imageHeight??400));files[`assets/block-${index}.svg`]=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><image width="${w}" height="${h}" href="${section.src}"/></svg>`;}
  }
  if(p.readme){p.readme=structuredClone(p.readme);let index=0;for(const list of [p.readme.buttons??[],...p.readme.sections.map(s=>s.buttons??[])])for(const b of list)if(b.variant&&b.variant!=='badge'){const path=`assets/button-${index++}.svg`;files[path]=buttonGraphic(b);b.imageUrl=path;}}
  files["README.md"] = generateReadme({
    model: p.readme ?? DEFAULT_README_MODEL,
    stats: p.stats!,
    contribution: { ...(p.contribution ?? DEFAULT_CONTRIBUTION), palette: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"] },
    lightDarkImages: input.lightDark,
  });

  if (input.includeWorkflow) {
    files[".github/workflows/profile-assets.yml"] = generateWorkflowYaml(p.readme!.username,{...DEFAULT_GAME,...p.contribution!.game},p.contribution!.background);
  }
  const used=new Set<string>();
  const collect=(layers:PCSProject['bannerSpec']['layers'])=>{for(const l of layers){if(l.type==='image'&&l.src.startsWith('photos/'))used.add(l.src.slice(7));if(l.type==='group')collect(l.children);}};
  collect(p.bannerSpec.layers);
  const credits=LICENSES.filter(l=>used.has(l.file)).map(l=>`- ${l.title} — ${l.creator}. [Source](${l.sourceUrl}) · [${l.license}](${l.licenseUrl}). ${l.modified}. ${l.license.includes('BY-SA')?'Adaptations retain the same or a compatible share-alike license.':''}`).join('\n');
  if(credits){files['ATTRIBUTIONS.md']='# Background asset credits\n\n'+credits+'\n';files['README.md']+='\n\n[Background image credits and licenses](ATTRIBUTIONS.md)\n';}
  files["SETUP.md"] = SETUP_GUIDE;
  if(p.assetRights?.length){files['ATTRIBUTIONS.md']=(files['ATTRIBUTIONS.md']??'# Asset credits\n')+'\n## User-supplied assets\n'+p.assetRights.map(a=>`- ${a.title} — ${a.creator??'creator not recorded'} — ${a.license??'rights unverified'} — ${a.source??'local source'}${a.attribution?' — '+a.attribution:''}`).join('\n')+'\n';}
  if(p.readme?.sections.some(s=>s.type==='icon')||p.readme?.buttons?.some(b=>b.variant&&b.variant!=='badge'&&b.icon))files['ATTRIBUTIONS.md']=(files['ATTRIBUTIONS.md']??'# Asset credits\n')+'\n## Vector icons\nProfile icons use Lucide (ISC license): https://github.com/lucide-icons/lucide/blob/main/LICENSE\n';
  return files;
}
