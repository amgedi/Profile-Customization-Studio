import { loadJSON, saveJSON } from './storage.js';
export type TutorialStatus = 'completed' | 'skipped';
export interface TutorialState { version: 1; status: TutorialStatus; }
export function validTutorialState(value: unknown): value is TutorialState {
 return !!value && typeof value === 'object' && (value as TutorialState).version === 1 && ['completed','skipped'].includes((value as TutorialState).status);
}
export async function needsTutorial() {
 // Synchronous mirror also covers a reload immediately after Finish/Skip.
 try { if(validTutorialState(JSON.parse(localStorage.getItem('pcs-tutorial') ?? 'null')))return false; } catch { /* native file remains authoritative fallback */ }
 return !validTutorialState(await loadJSON('tutorial'));
}
export async function rememberTutorial(status: TutorialStatus) {
 const state={version:1,status};let mirrored=false;
 try { localStorage.setItem('pcs-tutorial',JSON.stringify(state));mirrored=true; } catch { /* fall back to native app-data */ }
 return (await saveJSON('tutorial', state)) || mirrored;
}
