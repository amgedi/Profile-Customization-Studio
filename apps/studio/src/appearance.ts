export const PALETTE_KEYS=['root','panel','accent','text','border','glow'] as const;
export type PaletteKey=typeof PALETTE_KEYS[number];
export interface CustomPalette {name:string;colors:Partial<Record<PaletteKey,string>>;background:string}
export interface Appearance {enabled:boolean;palette:CustomPalette;saved:CustomPalette[];surface:'solid'|'frosted'|'translucent'|'acrylic';opacity:number;blur:number;reduceTransparency:boolean}
export const DEFAULT_APPEARANCE:Appearance={enabled:false,palette:{name:'My theme',colors:{},background:''},saved:[],surface:'solid',opacity:.92,blur:12,reduceTransparency:false};
export function validBackground(v:unknown):v is string{return typeof v==='string'&&v.length<=7000000&&/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v);}
export function parsePalette(value:unknown):CustomPalette {
 const o=(value&&typeof value==='object'?value:{}) as Record<string,unknown>,raw=(o.colors&&typeof o.colors==='object'?o.colors:{}) as Record<string,unknown>,colors:CustomPalette['colors']={};
 for(const k of PALETTE_KEYS)if(typeof raw[k]==='string'&&/^#[0-9a-f]{6}$/i.test(raw[k] as string))colors[k]=raw[k] as string;
 return {name:typeof o.name==='string'?o.name.slice(0,80):'My theme',colors,background:validBackground(o.background)?o.background:''};
}
export function parseAppearance(value:unknown):Appearance {
 try{const o=(typeof value==='string'?JSON.parse(value):value) as Partial<Appearance>;if(!o||typeof o!=='object')return structuredClone(DEFAULT_APPEARANCE);
 return {enabled:o.enabled===true,palette:parsePalette(o.palette),saved:Array.isArray(o.saved)?o.saved.slice(0,20).map(parsePalette):[],surface:['solid','frosted','translucent','acrylic'].includes(o.surface??'')?o.surface!:'solid',opacity:typeof o.opacity==='number'&&Number.isFinite(o.opacity)?Math.max(.75,Math.min(1,o.opacity)):.92,blur:typeof o.blur==='number'&&Number.isFinite(o.blur)?Math.max(0,Math.min(30,o.blur)):12,reduceTransparency:o.reduceTransparency===true};
 }catch{return structuredClone(DEFAULT_APPEARANCE);}
}
export function paletteContrast(a:string,b:string):number{const luminance=(hex:string)=>{const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]!*.2126+rgb[1]!*.7152+rgb[2]!*.0722;};const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
