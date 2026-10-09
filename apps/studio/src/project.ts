import { emptyBannerSpec, BANNERSPEC_VERSION, SUPPORTED_SPEC_VERSIONS, type BannerSpecDocument } from "@pcs/bannerspec";
import type { ReadmeModel } from "./github/readme.js";
import type { StatsConfig } from "./github/stats.js";
import type { SimConfig } from "@pcs/contribution";

export interface PlatformProfile {name?:string;handle?:string;pronouns?:string;bio?:string;avatar?:string;links?:string;featured?:string;accent?:string;}
export interface DesignVariant {id:string;name:string;targetId:string;parentId:string;createdAt:string;document:BannerSpecDocument;}
export interface DesignCheckpoint {id:string;name:string;createdAt:string;document:BannerSpecDocument;}
export interface PCSProject {
  formatVersion: 1;
  application: "profile-customization-studio";
  name: string;
  createdAt: string;
  updatedAt: string;
  bannerSpec: BannerSpecDocument;
  readme?: ReadmeModel;
  stats?: StatsConfig;
  contribution?: { config: SimConfig; cell: number; gap: number; snakeColor: string; glow: boolean; background: string; game?: import("./github/games.js").GameOptions; source?: "demo" | "github" | "unavailable"; login?: string; calendarStart?: string };
  assetRights?: Array<{id:string;title:string;creator?:string;source?:string;license?:string;attribution?:string}>;
  variants?: DesignVariant[];
  history?: DesignCheckpoint[];
  platformProfiles?: Record<string,PlatformProfile>;
  /** Studio-side optional target metadata (never mixed into scene). */
  settings?: { target?: string; targetOverrides?: Record<string,{scaleMode:"fit"|"cover-crop";focalX:number;focalY:number}> };
}

export function newProject(name = "Untitled Project"): PCSProject {
  const now = new Date().toISOString();
  return {
    formatVersion: 1,
    application: "profile-customization-studio",
    name,
    createdAt: now,
    updatedAt: now,
    bannerSpec: emptyBannerSpec(),
  };
}

export function serializeProject(project: PCSProject): string {
  return JSON.stringify({ ...project, updatedAt: new Date().toISOString() }, null, 2);
}

export interface LoadResult {
  project: PCSProject;
  /** Non-fatal issues (e.g. unsupported spec version) surfaced to the UI. */
  warnings: string[];
}

/** Parse + validate loaded text. Never mutates the source file. */
export function parseProject(text: string): LoadResult {
  const warnings: string[] = [];
  const data = JSON.parse(text) as Partial<PCSProject>;
  if (data.application !== "profile-customization-studio") {
    throw new Error("Not a Profile Customization Studio project.");
  }
  if (data.formatVersion !== 1) {
    throw new Error(
      `Unsupported project formatVersion ${JSON.stringify(data.formatVersion)}. This build reads format 1.`,
    );
  }
  if (!data.bannerSpec || typeof data.bannerSpec !== "object") {
    throw new Error("Project is missing its bannerSpec document.");
  }
  const spec = data.bannerSpec as BannerSpecDocument;
  if (!(SUPPORTED_SPEC_VERSIONS as readonly string[]).includes(spec.specVersion)) {
    throw new Error(`Unsupported BannerSpec version ${spec.specVersion}.`);
  }
  if (spec.specVersion !== BANNERSPEC_VERSION) {
    warnings.push(
      `Scene uses BannerSpec ${spec.specVersion}; Studio will migrate a copy to ${BANNERSPEC_VERSION}. The original file stays unchanged.`,
    );
  }
  return {
    project: {
      ...(data as PCSProject),
      createdAt: data.createdAt ?? new Date().toISOString(),
      updatedAt: data.updatedAt ?? new Date().toISOString(),
    },
    warnings,
  };
}
