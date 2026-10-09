import type { BannerSpecDocument } from '@pcs/bannerspec';
import type { DesignCheckpoint } from './project.js';
export function appendCheckpoint(items:DesignCheckpoint[],document:BannerSpecDocument,name:string,limit=30,bytes=20_000_000):DesignCheckpoint[]{
 if(JSON.stringify(items[items.length-1]?.document)===JSON.stringify(document))return items;
 const next=[...items,{id:crypto.randomUUID(),name,createdAt:new Date().toISOString(),document:structuredClone(document)}].slice(-Math.max(1,Math.min(100,limit)));
 let size=JSON.stringify(next).length;while(next.length>1&&size>bytes){next.shift();size=JSON.stringify(next).length;}return size>bytes?items:next;
}
