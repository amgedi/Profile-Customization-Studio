/**
 * Detects whether the UI is running inside the Tauri shell.
 * When false (plain browser dev), file I/O falls back to browser downloads.
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
