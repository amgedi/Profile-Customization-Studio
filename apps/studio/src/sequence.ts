import type { BannerSpecDocument, GroupLayer, Layer } from '@pcs/bannerspec';

type TimedScene=GroupLayer & {params:Record<string,number>};
const id=()=>crypto.randomUUID();
export const sequenceScenes=(doc:BannerSpecDocument)=>doc.layers.filter((l):l is TimedScene=>l.type==='group'&&l.params?.sequence===1);
/** Background travels with the scene, so fades apply to the whole artwork. */
export function sceneGroup(doc:BannerSpecDocument,name='Whole scene'):GroupLayer {
  const children:Layer[]=structuredClone(doc.layers);
  if(doc.canvas.background)children.unshift({id:id(),type:'rect',name:'Scene background',visible:true,locked:false,opacity:1,rotation:0,x:0,y:0,width:doc.canvas.width,height:doc.canvas.height,fill:doc.canvas.background});
  return {id:id(),type:'group',name,kind:'scene',visible:true,locked:false,opacity:1,rotation:0,params:{},children};
}
export function startSequence(doc:BannerSpecDocument):BannerSpecDocument {
  if(sequenceScenes(doc).length)return doc;
  const group=sceneGroup(doc,'Scene 1');group.params={sequence:1,start:0,duration:doc.animation?.duration??8};
  return {...doc,canvas:{...doc.canvas,background:undefined},layers:[group]};
}
export function arrangeSequence(doc:BannerSpecDocument,scenes:GroupLayer[]):BannerSpecDocument {
  let start=0;
  const layers=scenes.map(scene=>{const duration=Math.max(.5,scene.params?.duration??8);const next={...scene,params:{...scene.params,sequence:1,start,duration}};start+=duration;return next;});
  return {...doc,layers,animation:{duration:start,loop:doc.animation?.loop??true}};
}
export function duplicateScene(scene:GroupLayer):GroupLayer {
  const clone=structuredClone(scene);
  const walk=(l:Layer)=>{l.id=id();if(l.type==='group')l.children.forEach(walk);};walk(clone);
  clone.name=scene.name+' copy';return clone;
}
