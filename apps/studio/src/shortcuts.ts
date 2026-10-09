import type { CommandDef } from './commands.js';
const KEY='pcs-shortcuts-v1';
export function readBindings():Record<string,string> {try {const o=JSON.parse(localStorage.getItem(KEY)||'{}'); return Object.fromEntries(Object.entries(o).filter(([k,v])=>typeof v==='string'&&v.length<50)) as Record<string,string>;}catch{return{};}}
export function saveBindings(bindings:Record<string,string>){localStorage.setItem(KEY,JSON.stringify(bindings));window.dispatchEvent(new Event('pcs-shortcuts-changed'));}
export function shortcutFor(c:CommandDef):string {return readBindings()[c.id]??c.shortcut??'';}
export function eventChord(e:KeyboardEvent|React.KeyboardEvent):string {
 const key=e.key===' '?'Space':e.key==='Delete'?'Del':e.key.length===1?e.key.toUpperCase():e.key;
 return [...(e.ctrlKey||e.metaKey?['Ctrl']:[]),...(e.altKey?['Alt']:[]),...(e.shiftKey&&e.key!=='+'?['Shift']:[]),key].join('+');
}
export function commandForEvent(e:KeyboardEvent,commands:CommandDef[]):CommandDef|undefined {
 const chord=eventChord(e).toLowerCase();
 return commands.find(c=>shortcutFor(c).toLowerCase()===chord||(c.id==='edit.redo'&&chord==='ctrl+y'&&!readBindings()[c.id]));
}
export function bindingConflict(chord:string,id:string,commands:CommandDef[]):CommandDef|undefined {return commands.find(c=>c.id!==id&&shortcutFor(c).toLowerCase()===chord.toLowerCase());}
