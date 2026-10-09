import {PCSSelect} from './PCSSelect.js';
import { useEffect, useMemo, useState } from 'react';
import { renderSvg } from '@pcs/scene-core';
import type { Editor } from '../editor.js';
import { PLATFORMS, getPlatform } from '../targets/platforms.js';
import { collectPhotoData,inlinePhotos } from '../github/export.js';
import { importImage } from '../io.js';
import { TargetPreview } from './TargetPreview.js';
import { TargetCapabilities } from './TargetCapabilities.js';
import { ProfileWorkspace } from './ProfileWorkspace.js';
import type { PlatformProfile } from '../project.js';
import { smartAdapt } from '../targets/adapt.js';
export function PlatformWorkspace({editor}:{editor:Editor}){
 const p=getPlatform(editor.exportTargetId),[zoom,setZoom]=useState(100),[photos,setPhotos]=useState<Record<string,string>>({}),[error,setError]=useState('');
 useEffect(()=>{let alive=true;void collectPhotoData(editor.currentProject()).then(v=>{if(alive)setPhotos(v);});return()=>{alive=false;};},[editor.doc]);
 const profile=editor.project.platformProfiles?.[p.id]??{};
 const patch=(v:Partial<PlatformProfile>)=>editor.setProjectMeta({platformProfiles:{...editor.project.platformProfiles,[p.id]:{...profile,...v}}});
 const motionAllowed=p.target.animationSupport==='native'||p.target.animationSupport==='rasterize-only';
 const frame=motionAllowed?Math.floor(editor.time*24)/24:(editor.doc.animation?.duration??8)*.5;
 const src=useMemo(()=> 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(renderSvg(inlinePhotos(smartAdapt(editor.doc,p.target).document,photos),{time:frame})),[editor.doc,p.id,photos,frame]);
 return <section className="platform-workspace"><div className="platform-workspace-bar"><label>Platform <PCSSelect label="Profile platform" value={p.id} onChange={value=>{editor.setExportTargetId(value);setZoom(100);}} options={PLATFORMS.map(t=>({value:t.id,label:t.name+" · "+t.level}))}/></label><button className="btn" onClick={()=>editor.setMode('design')}>Change / edit banner</button>{p.renderer!=='github'&&<><button className="btn" aria-label="Zoom platform out" onClick={()=>setZoom(z=>Math.max(50,z-10))}>−</button><span>{zoom}%</span><button className="btn" aria-label="Zoom platform in" onClick={()=>setZoom(z=>Math.min(150,z+10))}>+</button></>}</div>
 {p.renderer==='github'?<ProfileWorkspace editor={editor}/>:<div className="platform-workspace-body"><aside className="platform-manual"><h2>{p.level==='B'?'Your manual profile':'Placement details'}</h2><p>{p.importMechanism}</p>{(p.structure.length?p.structure:['name','featured']).map(key=><label key={key}>{p.renderer==='discord'&&key==='featured'?'Connections':key}<input aria-label={'Platform '+key} value={profile[key as keyof PlatformProfile]??''} onChange={e=>patch({[key]:e.target.value})}/></label>)}{p.avatar&&<button className="btn" onClick={()=>void importImage().then(img=>{if(img)patch({avatar:img.dataUrl});}).catch(e=>setError(String(e)))}>Import avatar from device</button>}<label>Profile accent<input type="color" aria-label="Platform accent" value={profile.accent??'#8b9dff'} onChange={e=>patch({accent:e.target.value})}/></label>{error&&<p role="alert">{error}</p>}<TargetCapabilities target={p.target}/></aside><div className="platform-scroll">{!motionAllowed&&<p className="profile-notice" role="note">{p.target.animationSupport==='none'?'This target uses a still banner. Motion is shown as a poster frame.':'Target playback is unverified. Showing a still frame; inspect motion in Design or Preview.'}</p>}<div className="platform-scaled" style={{width:Math.max(320,800*zoom/100),maxWidth:zoom<=100?'100%':undefined}}><TargetPreview key={p.id} target={p.target} src={src} profile={profile} live={motionAllowed&&editor.playing}/></div></div></div>}
 </section>;
}
