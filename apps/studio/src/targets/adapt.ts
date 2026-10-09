import type { BannerSpecDocument, Layer } from '@pcs/bannerspec';
import type { TargetDef, SafeArea } from './registry.js';
import { isMasterAnimated } from './convert.js';
export interface AdaptResult {document:BannerSpecDocument;warnings:string[];changes:string[];targetId:string;}
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
/** Original geometry-based adaptation: background cover; foreground uniform fit and safe placement. */
export function smartAdapt(source:BannerSpecDocument,target:TargetDef,focal={x:.5,y:.5}):AdaptResult {
 const doc=structuredClone(source),w=source.canvas.width,h=source.canvas.height,W=target.recommended.width,H=target.recommended.height;
 const sx=W/w,sy=H/h,fit=Math.min(sx,sy),ox=(W-w*fit)/2,oy=(H-h*fit)/2;
 const safe=target.safeAreas.reduce<SafeArea>((a,b)=>b.width*b.height<a.width*a.height?b:a,{x:W*.04,y:H*.06,width:W*.92,height:H*.88});
 const warnings:string[]=[],changes=['Backgrounds cover the destination without stretching image pixels.','Foreground geometry scales uniformly; key content moves inside the safe region.'];
 if(Math.abs(W/H-w/h)>.08)warnings.push('Background crop adjustment recommended: destination aspect ratio differs.');
 const visit=(l:Layer)=>{
  const a=l as unknown as Record<string,any>;
  if(l.type==='group'){l.children.forEach(visit);if(a.x!=null)a.x*=fit;if(a.y!=null)a.y*=fit;return;}
  const background=(l.type==='rect'||l.type==='image')&&(a.width>=w*.9&&a.height>=h*.9);
  if(background){a.x=0;a.y=0;a.width=W;a.height=H;if(l.type==='image'){a.fit='cover';a.focalX=clamp(focal.x,0,1);a.focalY=clamp(focal.y,0,1);}return;}
  const oldX=a.x??0,oldY=a.y??0;a.x=oldX*fit+ox;a.y=oldY*fit+oy;
  for(const key of ['width','height','fontSize','cornerRadius','x2','y2'])if(typeof a[key]==='number')a[key]*=fit;
  if(l.type==='text'){
   const estimate=(a.text?.length??1)*a.fontSize*.56;
   if(estimate>safe.width)a.fontSize*=safe.width/estimate;
   const width=Math.min(safe.width,(a.text?.length??1)*a.fontSize*.56),left=a.align==='middle'?width/2:a.align==='end'?width:0;
   a.x=clamp(a.x,safe.x+left,safe.x+safe.width-(width-left));a.y=clamp(a.y,safe.y+a.fontSize,safe.y+safe.height);
   for(const overlap of target.avatarOverlaps??[]){const x=a.x-left,y=a.y-a.fontSize;if(x<overlap.x+overlap.width&&x+width>overlap.x&&y<overlap.y+overlap.height&&a.y>overlap.y){a.y=Math.max(safe.y+a.fontSize,overlap.y-a.fontSize*.25);warnings.push('Text moved above estimated avatar obstruction.');}}
  }
  if(l.type==='image'){
   const f=Math.min(1,safe.width/a.width,safe.height/a.height);a.width*=f;a.height*=f;a.x=clamp(a.x,safe.x,safe.x+safe.width-a.width);a.y=clamp(a.y,safe.y,safe.y+safe.height-a.height);
   for(const overlap of target.avatarOverlaps??[])if(a.x<overlap.x+overlap.width&&a.x+a.width>overlap.x&&a.y<overlap.y+overlap.height&&a.y+a.height>overlap.y){a.x=clamp(overlap.x+overlap.width+W*.02,safe.x,safe.x+safe.width-a.width);warnings.push('Logo/image moved away from estimated avatar obstruction.');}
  }
  for(const track of a.tracks??[])for(const key of track.keys??[]){if(track.prop==='x')key.value=key.value*fit+(a.x-oldX*fit);else if(track.prop==='y')key.value=key.value*fit+(a.y-oldY*fit);else if(['fontSize','width','height'].includes(track.prop))key.value*=fit;}
  for(const fx of a.effects??[])for(const key of ['radius','sizeMin','sizeMax','blur','distance'])if(typeof fx.params?.[key]==='number')fx.params[key]*=fit;
 };
 doc.layers.forEach(visit);doc.canvas={...doc.canvas,width:W,height:H};
 if(isMasterAnimated(source))warnings.push(target.animationSupport==='none'?'Animation unsupported: this target needs a still image.':'Motion delivery unverified or requires a separate encoder; batch export produces still images.');
 if(target.verification!=='verified')warnings.push('Platform capability UNVERIFIED: working dimensions are not a verified upload guarantee.');
 if(target.safeAreas.length)changes.push('Text constrained to the registry safe region; inspect overlapping headings and custom artwork.');
 if(doc.layers.some(l=>l.type==='group'))warnings.push('Grouped/rotated content requires visual inspection; semantic relationships and every logo cannot be inferred.');
 return {document:doc,warnings:[...new Set(warnings)],changes,targetId:target.id};
}
export function variantRecord(name:string,targetId:string,document:BannerSpecDocument,parentId:string){return {id:crypto.randomUUID(),name,targetId,parentId,createdAt:new Date().toISOString(),document:structuredClone(document)};}
