import {availablePackagePath} from './exportPaths.js';
/**
 * File I/O with two backends:
 *  - Tauri (production): native dialogs via plugin-dialog + plugin-fs
 *  - Browser (dev/preview): file input / download fallback
 */
import { runtimePrefs } from "./prefs.js";
import { isTauri } from "./tauri.js";
import { serializeProject, type PCSProject } from "./project.js";

export async function pickOpenProject(): Promise<PCSProject | null> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await open({
      filters: [{ name: "PCS Project", extensions: ["pcsproj", "json"] }],
    });
    if (typeof path !== "string") return null;
    const text = await readTextFile(path);
    const { parseProject } = await import("./project.js");
    const { project, warnings } = parseProject(text);
    (project as PCSProject & { __path?: string }).__path = path;
    void warnings;
    return project;
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pcsproj,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const { parseProject } = await import("./project.js");
      try {
        const { project } = parseProject(await file.text());
        resolve(project);
      } catch (e) {
        alert(`Could not open project: ${(e as Error).message}`);
        resolve(null);
      }
    };
    input.click();
  });
}

export async function writeProject(project: PCSProject, path?: string): Promise<string | null> {
  const text = serializeProject(project);
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const target =
      path ??
      (await save({
        defaultPath: `${project.name.replace(/[\\/:*?"<>|]/g, "_")}.pcsproj`,
        filters: [{ name: "PCS Project", extensions: ["pcsproj"] }],
      }));
    if (typeof target !== "string") return null;
    await writeTextFile(target, text);
    return target;
  }
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.name.replace(/[\\/:*?"<>|]/g, "_")}.pcsproj`;
  a.click();
  URL.revokeObjectURL(url);
  return "browser-download";
}

export async function exportSvg(svg: string, suggestedName: string): Promise<string | null> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const target = await save({
      defaultPath: runtimePrefs().exportFolder ? `${runtimePrefs().exportFolder.replace(/[\\/]$/, "")}/${suggestedName}` : suggestedName,
      filters: [{ name: "SVG image", extensions: ["svg"] }],
    });
    if (typeof target !== "string") return null;
    const destination=await freshExportPath(target);
    await writeTextFile(destination, svg);
    await revealExport(destination);
    return destination;
  }
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(url);
  return "browser-download";
}

// ---------------------------------------------------------------- image export

export interface RasterizeOptions {
  /** Source-space crop rect (cover-crop for a target). Default: whole SVG. */
  crop?: { x: number; y: number; width: number; height: number };
  /** Flatten transparency onto this CSS color before encoding (jpg/no-alpha). */
  flattenBackground?: string;
  format?: "png" | "jpg" | "webp";
  /** 0..1, used by jpg/webp. */
  quality?: number;
}

/**
 * Rasterize an SVG string to a data URL at exact output dimensions.
 * Used by the Export Studio to produce the ACTUAL converted output
 * (target dimensions, cover-crop, optional flatten) — never the master.
 */
export async function rasterizeSvg(svg: string, outW: number, outH: number, opts: RasterizeOptions = {}): Promise<string> {
  const fmt = opts.format ?? "png";
  const crop = opts.crop ?? { x: 0, y: 0, width: 0, height: 0 };
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const vb = crop.width > 0 && crop.height > 0
    ? `viewBox="${crop.x} ${crop.y} ${crop.width} ${crop.height}"`
    : (svg.match(/\bviewBox="[^"]*"/)?.[0] ?? `viewBox="0 0 ${Number(svg.match(/<svg[^>]*\bwidth="([\d.]+)"/)?.[1] ?? outW)} ${Number(svg.match(/<svg[^>]*\bheight="([\d.]+)"/)?.[1] ?? outH)}"`);
  // Standalone SVG (no external refs) rasterizes fine from a data URL.
  const wrapped =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${outW}" height="${outH}" ${vb}>` +
    inner +
    `</svg>`;
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(wrapped);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("SVG rasterization failed"));
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  if (opts.flattenBackground) {
    ctx.fillStyle = opts.flattenBackground;
    ctx.fillRect(0, 0, outW, outH);
  }
  ctx.drawImage(img, 0, 0, outW, outH);
  const mime = fmt === "jpg" ? "image/jpeg" : fmt === "webp" ? "image/webp" : "image/png";
  return canvas.toDataURL(mime, opts.quality ?? 0.92);
}

/** Save a data URL (rasterized image) to disk — native file dialog or download. */
export async function saveDataUrl(dataUrl: string, suggestedName: string): Promise<string | null> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const ext = suggestedName.split(".").pop()?.toLowerCase() ?? "png";
    const target = await save({
      defaultPath: runtimePrefs().exportFolder ? `${runtimePrefs().exportFolder.replace(/[\\/]$/, "")}/${suggestedName}` : suggestedName,
      filters: [{ name: ext.toUpperCase() + " image", extensions: [ext] }],
    });
    if (typeof target !== "string") return null;
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const destination=await freshExportPath(target);
    await writeFile(destination, bytes);
    await revealExport(destination);
    return destination;
  }
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = suggestedName;
  a.click();
  return "browser-download";
}

// ---------------------------------------------------------------- package export

export interface PackageExportResult {
  dir: string;
  written: string[];
  /** files that already existed and were NOT overwritten */
  preserved: string[];
  /** where the new content went instead */
  alternatives: Record<string, string>;
}

/**
 * Write the export package to a chosen directory.
 * Never silently overwrites: existing files are preserved and the new
 * content is written next to them as `<name>.pcs-new<ext>`.
 * An existing README.md gets the generated version as README.pcs.md
 * (diffable, mergeable) per the file-safety rules.
 */
export async function exportPackage(files: Record<string, string>): Promise<PackageExportResult | null> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile, mkdir, exists } = await import("@tauri-apps/plugin-fs");
    const dir = await open({ directory: true });
    if (typeof dir !== "string") return null;
    const written: string[] = [];
    const preserved: string[] = [];
    const alternatives: Record<string, string> = {};

    for (const [rel, content] of Object.entries(files)) {
      const target = `${dir}/${rel}`.replace(/\\/g, "/");
      const folder = target.slice(0, target.lastIndexOf("/"));
      await mkdir(folder, { recursive: true });
      const finalTarget=await availablePackagePath(target,rel==='README.md',exists);
      if(finalTarget!==target){preserved.push(rel);alternatives[rel]=finalTarget.slice(dir.length+1);}
      await writeTextFile(finalTarget, content);
      written.push(finalTarget.slice(dir.length + 1));
    }
    return { dir, written, preserved, alternatives };
  }
  // Browser fallback: download a single README + alert about full export.
  const blob = new Blob([files["README.md"] ?? ""], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "README.md";
  a.click();
  URL.revokeObjectURL(url);
  return { dir: "browser-download", written: ["README.md"], preserved: [], alternatives: {} };
}

// ---------------------------------------------------------------- image import

export async function importImage(): Promise<{ dataUrl: string; name: string; bytes: number } | null> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const path = await open({
      filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp", "gif", "svg"] }],
    });
    if (typeof path !== "string") return null;
    const bytes = await readFile(path);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const ext = path.split(".").pop()?.toLowerCase() ?? "png";
    const mime = ext === "svg" ? "image/svg+xml" : ext === "jpg" ? "image/jpeg" : `image/${ext}`;
    return { dataUrl: `data:${mime};base64,${btoa(binary)}`, name: path.split(/[\\/]/).pop() ?? "image", bytes: bytes.length };
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve({ dataUrl: reader.result as string, name: file.name, bytes: file.size });
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

// ---------------------------------------------------------------- recents

export interface RecentEntry {
  name: string;
  path: string;
  lastOpened: string;
}

const RECENTS_KEY = "pcs-recent-projects";

export async function recordRecent(name: string, path: string | undefined): Promise<void> {
  if (!path || path === "browser-download") return;
  const list = await loadRecents();
  const filtered = list.filter((r) => r.path !== path);
  filtered.unshift({ name, path, lastOpened: new Date().toISOString() });
  localStorage.setItem(RECENTS_KEY, JSON.stringify(filtered.slice(0, 10)));
  if (isTauri()) {
    try {
      const { appDataDir } = await import("@tauri-apps/api/path");
      const { writeTextFile, mkdir, exists } = await import("@tauri-apps/plugin-fs");
      const dir = await appDataDir();
      if (!(await exists(dir))) await mkdir(dir, { recursive: true });
      await writeTextFile(`${dir}/recent-projects.json`, JSON.stringify(filtered.slice(0, 10), null, 2));
    } catch {
      /* local-only recents are fine */
    }
  }
}

export async function loadRecents(): Promise<RecentEntry[]> {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]") as RecentEntry[];
  } catch {
    return [];
  }
}

export async function readProjectFile(path: string): Promise<string> {
  if (isTauri()) {
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    return readTextFile(path);
  }
  throw new Error("Opening by path requires the desktop app.");
}

export function parseProjectText(text: string): { project: import("./project.js").PCSProject; warnings: string[] } {
  const { parseProject } = require0();
  return parseProject(text);
}

function require0() {
  // static import cycle avoidance
  return parseModule;
}
import * as parseModule from "./project.js";

async function revealExport(path:string){
 if(!runtimePrefs().openFolderAfterExport)return;
 const parent=path.replace(/[\\/][^\\/]+$/,'');
 try {const {invoke}=await import('@tauri-apps/api/core');await invoke('open_path',{path:parent});}catch{/* Saving succeeded even if Explorer is unavailable. */}
}

export async function exportBinaryPackage(files:Record<string,Uint8Array>):Promise<PackageExportResult|null>{
 const names=Object.keys(files);if(names.some(n=>n.startsWith('/')||n.split(/[\\/]/).some(s=>s==='..')))throw Error('Unsafe export filename');
 if(isTauri()){
  const {open}=await import('@tauri-apps/plugin-dialog');const {writeFile,mkdir,exists}=await import('@tauri-apps/plugin-fs');const dir=await open({directory:true});if(typeof dir!=='string')return null;
  const written:string[]=[],preserved:string[]=[],alternatives:Record<string,string>={};
  for(const [rel,data] of Object.entries(files)){const base=dir.replace(/\\/g,'/')+'/'+rel;await mkdir(base.slice(0,base.lastIndexOf('/')),{recursive:true});let destination=base,count=0;while(await exists(destination)){const dot=base.lastIndexOf('.');destination=dot>base.lastIndexOf('/')?base.slice(0,dot)+'.pcs-'+(++count)+base.slice(dot):base+'.pcs-'+(++count);}if(destination!==base){preserved.push(rel);alternatives[rel]=destination.slice(dir.length+1);}await writeFile(destination,data);written.push(destination.slice(dir.length+1));}return {dir,written,preserved,alternatives};
 }
 const {zipFiles}=await import('./batch.js');const bytes=zipFiles(files),blob=new Blob([bytes as BlobPart],{type:'application/zip'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='PCS-Export-Everywhere.zip';a.click();URL.revokeObjectURL(url);return {dir:'browser-download',written:names,preserved:[],alternatives:{}};
}

/** Save encoded motion bytes without base64 expansion. */
export async function saveMotionBlob(blob:Blob,name:string):Promise<string|null>{
 if(isTauri()){
  const {save}=await import('@tauri-apps/plugin-dialog');const {writeFile}=await import('@tauri-apps/plugin-fs');const ext=name.split('.').pop()!;
  const path=await save({defaultPath:runtimePrefs().exportFolder?runtimePrefs().exportFolder.replace(/[\\/]$/,'')+'/'+name:name,filters:[{name:ext.toUpperCase()+' motion',extensions:[ext]}]});
  if(typeof path!=='string')return null;const destination=await freshExportPath(path);await writeFile(destination,new Uint8Array(await blob.arrayBuffer()));await revealExport(destination);return destination;
 }
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);return 'browser-download';
}

async function freshExportPath(path:string):Promise<string>{
 const {exists}=await import("@tauri-apps/plugin-fs");
 return availablePackagePath(path.replace(/\\/g,"/"),false,exists);
}
