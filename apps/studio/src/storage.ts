/**
 * App-data persistence — important settings and the recovery draft live in
 * the Tauri app-data directory (atomic writes), with localStorage as the
 * browser/dev fallback. GitHub tokens must NEVER go through here.
 */
/** True when running inside the Tauri native shell. */
export const hasTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const PREFIX = "pcs-";

async function fileFor(name: string): Promise<{ dir: string; path: string }> {
  const { appDataDir, join } = await import("@tauri-apps/api/path");
  const dir = await appDataDir();
  return { dir, path: await join(dir, `${PREFIX}${name}.json`) };
}

/** Read a JSON document from app data (or localStorage when not native). */
export async function loadJSON<T>(name: string): Promise<T | null> {
  if (!hasTauri) {
    try {
      const raw = localStorage.getItem(`${PREFIX}${name}`);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }
  try {
    const { readTextFile, exists } = await import("@tauri-apps/plugin-fs");
    const { path } = await fileFor(name);
    if (!(await exists(path))) return null;
    return JSON.parse(await readTextFile(path)) as T;
  } catch {
    return null;
  }
}

/** Write a JSON document to app data atomically (tmp file + rename). */
export async function saveJSON(name: string, data: unknown): Promise<boolean> {
  if (!hasTauri) {
    try { localStorage.setItem(`${PREFIX}${name}`, JSON.stringify(data)); return true; } catch { return false; }
  }
  try {
    const { writeTextFile, rename, exists, mkdir, remove } = await import("@tauri-apps/plugin-fs");
    const { dir, path } = await fileFor(name);
    if (!(await exists(dir))) await mkdir(dir, { recursive: true });
    const tmp = `${path}.tmp`;
    await writeTextFile(tmp, JSON.stringify(data));
    if (await exists(path)) await remove(path);
    await rename(tmp, path);
    return true;
  } catch { return false; }
}

/** Remove a persisted document. */
export async function removeJSON(name: string): Promise<void> {
  if (!hasTauri) {
    try { localStorage.removeItem(`${PREFIX}${name}`); } catch { /* ignore */ }
    return;
  }
  try {
    const { remove, exists } = await import("@tauri-apps/plugin-fs");
    const { path } = await fileFor(name);
    if (await exists(path)) await remove(path);
  } catch { /* ignore */ }
}
