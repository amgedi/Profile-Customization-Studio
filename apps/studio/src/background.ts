import {asPaint,type BannerSpecDocument,type Paint,type Layer} from '@pcs/bannerspec';
import {sequenceScenes} from './sequence.js';
export function backgroundLayers(doc:BannerSpecDocument,time:number):Layer[]{
 const active=sequenceScenes(doc).find(s=>time>=(s.params.start??0)&&time<(s.params.start??0)+(s.params.duration??8));
 let layers=active?.children??doc.layers;
 const whole=layers.find(l=>l.type==='group'&&l.name==='Whole scene');
 if(whole?.type==='group')layers=whole.children;
 return layers;
}
export function backgroundPaint(doc:BannerSpecDocument,time:number):Paint {
 const layers=backgroundLayers(doc,time),managed=layers.find(l=>l.name==='Background paint')??layers.find(l=>l.type==='rect'&&l.x===0&&l.y===0&&l.width===doc.canvas.width&&l.height===doc.canvas.height&&l.fill&&l.fill!=='#00000000');
 return asPaint(managed?.fill??doc.canvas.background??'#0f1420');
}
export function withBackgroundPaint(doc:BannerSpecDocument,time:number,paint:Paint):BannerSpecDocument {
 const next=structuredClone(doc),layers=backgroundLayers(next,time),photoIndex=layers.findIndex(l=>l.type==='image'&&l.name==='Background Photo'),managed=layers.find(l=>l.name==='Background paint')??(photoIndex<0?layers.find(l=>l.type==='rect'&&l.x===0&&l.y===0&&l.width===doc.canvas.width&&l.height===doc.canvas.height&&l.fill&&l.fill!=='#00000000'):undefined);
 if(managed)managed.fill=paint;
 else {
  const layer:Layer={id:crypto.randomUUID(),type:'rect',name:'Background paint',visible:true,locked:false,opacity:1,rotation:0,x:0,y:0,width:doc.canvas.width,height:doc.canvas.height,fill:paint};
  layers.splice(photoIndex<0?0:photoIndex+1,0,layer);
 }
 return next;
}
