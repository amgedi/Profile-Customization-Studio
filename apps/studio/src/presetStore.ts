/**
 * Recency / favorites / saved custom presets — persisted in app storage
 * (localStorage under the Tauri webview; project data stays in project files).
 * Used by every preset browser so "Recent" and favorites follow the user
 * across scenes, backgrounds, effects, animations and palettes.
 */
import type { BannerSpecDocument } from "@pcs/bannerspec";

export type PresetKind =
  | "scene" | "background" | "effect" | "animation"
  | "palette" | "gradient" | "ambience" | "border" | "target";

interface StoreShape {
  recent: Partial<Record<PresetKind, string[]>>;
  favorites: Partial<Record<PresetKind, string[]>>;
  /** user-saved custom presets (full document snapshots or param sets) */
  custom: Array<{ id: string; kind: PresetKind; name: string; ts: number; payload: unknown }>;
}

const KEY = "pcs-preset-store";
const LIMIT = 12;

function load(): StoreShape {
  try {
    return { recent: {}, favorites: {}, custom: [], ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { recent: {}, favorites: {}, custom: [] };
  }
}
function save(s: StoreShape) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* non-fatal */ }
}

export function recentIds(kind: PresetKind): string[] {
  return load().recent[kind] ?? [];
}
export function favoriteIds(kind: PresetKind): string[] {
  return load().favorites[kind] ?? [];
}

export function recordRecent(kind: PresetKind, id: string): void {
  const s = load();
  const list = [id, ...(s.recent[kind] ?? []).filter((x) => x !== id)].slice(0, LIMIT);
  s.recent[kind] = list;
  save(s);
}
export function toggleFavorite(kind: PresetKind, id: string): boolean {
  const s = load();
  const cur = s.favorites[kind] ?? [];
  const has = cur.includes(id);
  s.favorites[kind] = has ? cur.filter((x) => x !== id) : [id, ...cur].slice(0, 40);
  save(s);
  return !has;
}

export interface CustomPreset {
  id: string; kind: PresetKind; name: string; ts: number; payload: unknown;
}
export function customPresets(kind: PresetKind): CustomPreset[] {
  return load().custom.filter((c) => c.kind === kind).sort((a, b) => b.ts - a.ts);
}
export function saveCustomPreset(kind: PresetKind, name: string, payload: unknown): CustomPreset {
  const s = load();
  const entry: CustomPreset = {
    id: `my-${kind}-${Date.now().toString(36)}`,
    kind, name: name || "My Preset", ts: Date.now(), payload,
  };
  s.custom = [entry, ...s.custom].slice(0, 60);
  save(s);
  return entry;
}
export function deleteCustomPreset(id: string): void {
  const s = load();
  s.custom = s.custom.filter((c) => c.id !== id);
  save(s);
}

/** Snapshot of the current document used for "scene" custom presets. */
export function snapshotDoc(doc: BannerSpecDocument): unknown {
  return structuredClone(doc);
}
