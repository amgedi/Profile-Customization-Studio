import {profileIconSvg} from '../profileIcons.js';
import type {ReadmeButton} from './readme.js';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export function buttonGraphic(b:ReadmeButton):string {
 const font=b.size==='small'?12:b.size==='large'?18:14,height=font*2.8,icon=b.icon?font+4:0,width=Math.min(600,Math.max(90,b.label.slice(0,80).length*font*.65+36+(icon?icon+10:0))),fill=/^#[0-9a-f]{6}$/i.test(b.color??'')?b.color!:'#6ed7bf',text=/^#[0-9a-f]{6}$/i.test(b.textColor??'')?b.textColor!:b.variant==='outline'?fill:'#101820',radius=Math.max(0,Math.min(height/2,b.radius??10));
 const glyph=icon?profileIconSvg(b.icon!,icon,text).replace('<svg ',`<svg x="14" y="${(height-icon)/2}" `):'';
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(width)}" height="${Math.ceil(height)}" viewBox="0 0 ${Math.ceil(width)} ${Math.ceil(height)}"><rect x="1" y="1" width="${Math.ceil(width)-2}" height="${Math.ceil(height)-2}" rx="${radius}" fill="${b.variant==='outline'?'none':fill}" stroke="${fill}" stroke-width="1.5"/>${glyph}<text x="${icon?icon+24:width/2}" y="${height/2}" dominant-baseline="central" text-anchor="${icon?'start':'middle'}" font-family="Segoe UI,Arial,sans-serif" font-size="${font}" font-weight="600" fill="${text}">${esc(b.label.slice(0,80))}</text></svg>`;
}
