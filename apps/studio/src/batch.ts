import type { BannerSpecDocument } from '@pcs/bannerspec';
import { smartAdapt } from './targets/adapt.js';
import type { TargetDef } from './targets/registry.js';
import { isMasterAnimated } from './targets/convert.js';
export function batchAssessment(doc:BannerSpecDocument,target:TargetDef){const adapted=smartAdapt(doc,target);return {target,adapted,format:target.staticFormats.includes('png')?'png' as const:'jpg' as const,status:adapted.warnings.length?'REVIEW':'READY',warnings:adapted.warnings,motion:isMasterAnimated(doc)?(target.animationSupport==='none'?'Animation unsupported · still export':'Still export · GIF/video encoder unavailable'):'Static design'};}
/** Uncompressed ZIP: original small implementation, UTF-8 paths and CRC32. */
export function zipFiles(files:Record<string,Uint8Array>):Uint8Array {
 const chunks:Uint8Array[]=[],central:Uint8Array[]=[];let offset=0,centralSize=0;
 const enc=new TextEncoder();const crc=(data:Uint8Array)=>{let c=0xffffffff;for(const b of data){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
 for(const [name,data] of Object.entries(files)){
  if(name.startsWith('/')||name.split(/[\\/]/).some(s=>s==='..'))throw Error('Unsafe export filename');
  const n=enc.encode(name),sum=crc(data),h=new Uint8Array(30+n.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,sum,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,n.length,true);h.set(n,30);
  chunks.push(h,data);const c=new Uint8Array(46+n.length),cv=new DataView(c.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint32(16,sum,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,n.length,true);cv.setUint32(42,offset,true);c.set(n,46);central.push(c);centralSize+=c.length;offset+=h.length+data.length;
 }
 const end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,central.length,true);ev.setUint16(10,central.length,true);ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);
 const all=[...chunks,...central,end],result=new Uint8Array(offset+centralSize+22);let pos=0;for(const c of all){result.set(c,pos);pos+=c.length;}return result;
}
export function dataUrlBytes(url:string){const raw=atob(url.slice(url.indexOf(',')+1));return Uint8Array.from(raw,c=>c.charCodeAt(0));}

export function batchSummary(doc:BannerSpecDocument,target:TargetDef){const review=target.verification==='unverified'||target.animationSupport!=='native'&&isMasterAnimated(doc)||Math.abs(doc.canvas.width/doc.canvas.height-target.recommended.width/target.recommended.height)>.08;return {status:review?'REVIEW':'READY',format:target.staticFormats.includes('png')?'png':'jpg'};}
