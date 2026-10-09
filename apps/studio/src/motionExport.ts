/** Local deterministic motion export. No screen recording or network encoder. */
import { renderSvg } from '@pcs/scene-core';
import type { BannerSpecDocument } from '@pcs/bannerspec';
export type MotionFormat = 'gif'|'webm'|'mp4';
export interface MotionOptions {format:MotionFormat;width:number;height:number;duration:number;fps:number;loop:boolean;background:string;crop?:{x:number;y:number;width:number;height:number};signal?:AbortSignal;onProgress?:(fraction:number)=>void;}
export function motionTiming(duration:number,fps:number){
 if(!Number.isFinite(duration)||duration<=0||duration>60||!Number.isInteger(fps)||fps<1||fps>30)throw Error('Choose 0–60 seconds and 1–30 FPS.');
 const frames=Math.ceil(duration*fps);return Array.from({length:frames},(_,i)=>({time:i/fps,duration:Math.min(1/fps,duration-i/fps)}));
}
export async function videoSupported(format:MotionFormat,width:number,height:number,fps:number){
 if(format==='gif')return true;
 const {canEncodeVideo}=await import('mediabunny');
 return canEncodeVideo(format==='mp4'?'avc':'vp9',{width,height,frameRate:fps});
}
type DecodedFrame={image:VideoFrame};
interface GifDecoder {tracks:{ready:Promise<void>;selectedTrack:{frameCount:number}};decode(o:{frameIndex:number}):Promise<DecodedFrame>;close():void;}
type DecoderConstructor={new(o:{data:ArrayBuffer;type:string}):GifDecoder};
/** Decode GIF frames by timestamp instead of relying on wall-clock image playback. */
async function gifSampler(uri:string){
 const Decoder=(globalThis as unknown as {ImageDecoder?:DecoderConstructor}).ImageDecoder;
 if(!Decoder)throw Error('This runtime cannot decode animated GIF backgrounds for export. Update WebView2 or use a static background.');
 const data=Uint8Array.from(atob(uri.slice(uri.indexOf(',')+1)),c=>c.charCodeAt(0)).buffer;
 const decoder=new Decoder({data,type:'image/gif'});
 try{
  await decoder.tracks.ready;const count=decoder.tracks.selectedTrack.frameCount;
  if(count>2000)throw Error('GIF background has too many frames (maximum 2000).');
  const ends:number[]=[];let total=0;
  for(let i=0;i<count;i++){const {image}=await decoder.decode({frameIndex:i});total+=Math.max(.01,(image.duration??100000)/1e6);ends.push(total);image.close();}
  let last=-1,cached='';
  return {close:()=>decoder.close(),at:async(time:number)=>{
   const phase=time%total,index=ends.findIndex(end=>phase<end);if(index===last)return cached;
   const {image}=await decoder.decode({frameIndex:Math.max(0,index)});
   try{const c=document.createElement('canvas');c.width=image.displayWidth;c.height=image.displayHeight;c.getContext('2d')!.drawImage(image,0,0);cached=c.toDataURL('image/png');last=index;return cached;}finally{image.close();}
  }};
 }catch(e){decoder.close();throw e;}
}
export async function encodeMotion(doc:BannerSpecDocument,o:MotionOptions):Promise<Blob>{
 const timing=motionTiming(o.duration,o.fps);
 if(!Number.isInteger(o.width)||!Number.isInteger(o.height)||o.width<16||o.height<16||o.width>4096||o.height>4096||o.width*o.height>4194304)throw Error('Motion output supports 16–4096 pixels per side, up to 4 megapixels.');
 if(o.width*o.height*timing.length>1200000000)throw Error('This export is too large. Reduce dimensions, duration or frame rate.');
 if(o.format!=='gif'&&(o.width%2||o.height%2))throw Error('Video dimensions must be even numbers.');
 const abort=()=>{if(o.signal?.aborted)throw new DOMException('Export cancelled','AbortError');};
 abort();await document.fonts.ready;
 const canvas=document.createElement('canvas');canvas.width=o.width;canvas.height=o.height;
 const ctx=canvas.getContext('2d',{willReadFrequently:o.format==='gif'});if(!ctx)throw Error('Canvas unavailable');
 const initial=JSON.stringify(doc);
 const uris=[...new Set(initial.match(/data:image\/gif;base64,[A-Za-z0-9+/=]+/g)??[])];
 const samplers=new Map<string,Awaited<ReturnType<typeof gifSampler>>>();
 let output:import('mediabunny').Output<import('mediabunny').OutputFormat,import('mediabunny').BufferTarget>|undefined;
 try{
  for(const uri of uris){abort();samplers.set(uri,await gifSampler(uri));}
  let gif:ReturnType<typeof import('gifenc').GIFEncoder>|undefined,video:import('mediabunny').CanvasSource|undefined;
  let gifLib:typeof import('gifenc')|undefined;
  if(o.format==='gif'){gifLib=await import('gifenc');gif=gifLib.GIFEncoder();}
  else{
   const m=await import('mediabunny');if(!await videoSupported(o.format,o.width,o.height,o.fps))throw Error(o.format.toUpperCase()+' encoding is unavailable in this runtime. Choose GIF or another video format.');
   output=new m.Output({target:new m.BufferTarget(),format:o.format==='mp4'?new m.Mp4OutputFormat():new m.WebMOutputFormat()});
   video=new m.CanvasSource(canvas,{codec:o.format==='mp4'?'avc':'vp9',quality:new m.Quality({bitrate:Math.max(500000,o.width*o.height*o.fps*.15)})});
   output.addVideoTrack(video,{frameRate:o.fps});await output.start();
  }
  let gifElapsed=0;
  for(let i=0;i<timing.length;i++){
   abort();const frame=timing[i]!;let svg=renderSvg(doc,{animate:false,editable:false,time:frame.time});
   for(const [uri,sampler]of samplers)svg=svg.split(uri).join(await sampler.at(frame.time));
   const crop=o.crop??{x:0,y:0,width:doc.canvas.width,height:doc.canvas.height};
   const inner=svg.replace(/^[\s\S]*?<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
   svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${o.width}" height="${o.height}" viewBox="${crop.x} ${crop.y} ${crop.width} ${crop.height}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
   const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await image.decode();abort();
   ctx.clearRect(0,0,o.width,o.height);ctx.fillStyle=o.background;ctx.fillRect(0,0,o.width,o.height);ctx.drawImage(image,0,0);
   if(gif&&gifLib){const rgba=ctx.getImageData(0,0,o.width,o.height).data,palette=gifLib.quantize(rgba,256),indexed=gifLib.applyPalette(rgba,palette);const end=Math.round((frame.time+frame.duration)*100);gif.writeFrame(indexed,o.width,o.height,{palette,delay:(end-gifElapsed)*10,repeat:o.loop?0:-1});gifElapsed=end;}
   else await video!.add(frame.time,frame.duration);
   o.onProgress?.((i+1)/timing.length);await new Promise(resolve=>setTimeout(resolve,0));
  }
  abort();if(gif){gif.finish();return new Blob([gif.bytes() as BlobPart],{type:'image/gif'});}
  video!.close();await output!.finalize();return new Blob([output!.target.buffer!],{type:o.format==='mp4'?'video/mp4':'video/webm'});
 }finally{for(const sampler of samplers.values())sampler.close();if(output&&output.state!=='finalized'&&output.state!=='canceled')await output.cancel();canvas.width=canvas.height=0;}
}


