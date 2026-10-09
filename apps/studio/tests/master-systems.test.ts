import {describe,it,expect,beforeEach,vi} from 'vitest';
import {PLATFORMS,canonicalTarget,getPlatform,registryProblems,visibleArea} from '../src/targets/platforms.js';
import {TARGET_REGISTRY,getTarget} from '../src/targets/registry.js';
import {smartAdapt,variantRecord} from '../src/targets/adapt.js';
import {appendCheckpoint} from '../src/history.js';
import {cloneComponent,applyIdentity,emptyLibrary,saveLibrary,loadLibrary,type IdentityKit} from '../src/library.js';
import {zipFiles,batchAssessment,dataUrlBytes} from '../src/batch.js';
import {SCENE_LIBRARY} from '../src/sceneLibrary.js';
import {newProject,serializeProject,parseProject} from '../src/project.js';
import type {BannerSpecDocument} from '@pcs/bannerspec';
const scene=():BannerSpecDocument=>SCENE_LIBRARY.find(s=>s.name==='Editorial')!.make(1200,350);
describe('Master platform and local studio contracts',()=>{
 it('classifies every registered target exactly once',()=>{expect(PLATFORMS.map(p=>p.id)).toEqual(TARGET_REGISTRY.map(t=>t.id));expect(new Set(PLATFORMS.map(p=>p.id)).size).toBe(25);expect(registryProblems()).toEqual([]);});
 it.each(['discord','youtube','x','twitch'])('resolves legacy %s without a GitHub fallback',id=>{expect(getPlatform(id).id).toBe(canonicalTarget(id));expect(getPlatform(id).renderer).not.toBe('github');});
 it('unknown IDs resolve to a disclosed generic placement',()=>{expect(getPlatform('unknown-account').id).toBe('custom-target');expect(getPlatform('unknown-account').level).toBe('C');});
 it('claims account import only for the implemented official GitHub path',()=>{for(const p of PLATFORMS)expect(p.importAccess).toBe(p.id==='github-profile-readme'?'OFFICIAL_PUBLIC_API':'MANUAL_ONLY');});
 it('never invents a video encoder or unknown duration',()=>{for(const p of PLATFORMS){expect(p.video).toBe('UNAVAILABLE');expect(p.durationSeconds).toBeNull();}});
 it('YouTube mobile crop differs from the TV canvas',()=>{const p=getPlatform('youtube');expect(visibleArea(p,'mobile').width).toBeLessThan(visibleArea(p,'tv').width);});
 it.each(['discord-profile-banner','youtube-channel-banner','linkedin-background','x-profile-header'])('adapts %s into exact dimensions without mutating the master',id=>{const d=scene(),before=JSON.stringify(d),target=getTarget(id)!;const a=smartAdapt(d,target);expect(a.document.canvas.width).toBe(target.recommended.width);expect(a.document.canvas.height).toBe(target.recommended.height);expect(JSON.stringify(d)).toBe(before);expect(a.document.layers.map(l=>l.id)).toEqual(d.layers.map(l=>l.id));});
 it('preserves a photographic source and clamps focal coordinates',()=>{const d=SCENE_LIBRARY.find(s=>s.name==='Ocean Sunset')!.make(1200,350);const image=d.layers.find(l=>l.type==='image')!;const a=smartAdapt(d,getTarget('youtube-channel-banner')!,{x:3,y:-1});const adapted=a.document.layers.find(l=>l.type==='image')!;expect(adapted.type==='image'&&adapted.src).toBe(image.type==='image'&&image.src);expect(adapted.type==='image'&&adapted.focalX).toBe(1);expect(adapted.type==='image'&&adapted.focalY).toBe(0);});
 it('saved variants retain ancestry and independent geometry',()=>{const d=scene(),v=variantRecord('Mobile','discord-profile-banner',d,'master');v.document.canvas.width=22;expect(d.canvas.width).toBe(1200);expect(v.parentId).toBe('master');});
 it('capability checks warn about still conversion for animated masters',()=>{const d=scene();d.layers[0]!.behaviors=[{id:'b',preset:'fade-in',category:'entrance',enabled:true,speed:1,amount:1}];expect(batchAssessment(d,getTarget('linkedin-background')!).motion).toContain('still');});
 it('history coalesces identical states and keeps retained copies independent',()=>{const d=scene(),h=appendCheckpoint([],d,'First');expect(appendCheckpoint(h,d,'Same')).toBe(h);d.canvas.width=999;expect(h[0]!.document.canvas.width).toBe(1200);});
 it('history evicts oldest snapshots within the retention and byte limits',()=>{let h=appendCheckpoint([],scene(),'First',2);for(let i=0;i<3;i++){const d=scene();d.canvas.width+=i+1;h=appendCheckpoint(h,d,String(i),2);}expect(h.map(x=>x.name)).toEqual(['1','2']);expect(appendCheckpoint([],scene(),'Too big',30,10)).toEqual([]);});
 it('component instances have independent layer and animation IDs',()=>{const d=scene();d.layers[0]!.behaviors=[{id:'b',preset:'fade-in',category:'entrance',enabled:true,speed:1,amount:1}];const c=cloneComponent(d.layers);expect(c[0]!.id).not.toBe(d.layers[0]!.id);expect(c[0]!.behaviors![0]!.id).not.toBe('b');c[0]!.name='Changed';expect(d.layers[0]!.name).not.toBe('Changed');});
 it('identity application retains originals and changes typography',()=>{const d=scene(),before=JSON.stringify(d);const kit:IdentityKit={id:'k',name:'K',displayName:'Ada',handle:'ada',pronouns:'',bio:'',colors:['#112233','#445566','#ffffff'],font:'Consolas',links:'',footer:''};const applied=applyIdentity(d,kit);expect(applied.brand?.primary).toBe('#112233');expect(applied.layers.find(l=>l.type==='text')?.fontFamily).toBe('Consolas');expect(JSON.stringify(d)).toBe(before);});
 it('project round trips platform state, variants and checkpoints',()=>{const p=newProject();p.settings={target:'discord-profile-banner'};p.platformProfiles={'discord-profile-banner':{name:'Ada',bio:'Local'}};p.history=appendCheckpoint([],scene(),'Named');p.variants=[variantRecord('X','x-profile-header',scene(),'master')];const loaded=parseProject(serializeProject(p)).project;expect(loaded.settings?.target).toBe('discord-profile-banner');expect(loaded.platformProfiles).toEqual(p.platformProfiles);expect(loaded.history).toEqual(p.history);expect(loaded.variants).toEqual(p.variants);});
 it('ZIP records CRC, names and binary sizes without transforming bytes',()=>{const z=zipFiles({'assets/a.bin':new Uint8Array([0,255,1])});expect(new DataView(z.buffer).getUint32(0,true)).toBe(0x04034b50);expect(new TextDecoder().decode(z)).toContain('assets/a.bin');expect(z.slice(42,45)).toEqual(new Uint8Array([0,255,1]));});
 it('ZIP rejects traversal and absolute paths',()=>{expect(()=>zipFiles({'../x':new Uint8Array()})).toThrow();expect(()=>zipFiles({'/x':new Uint8Array()})).toThrow();});
 it('decodes raster data without text conversion',()=>expect(dataUrlBytes('data:image/png;base64,AP8B')).toEqual(new Uint8Array([0,255,1])));
});
describe('Local library persistence',()=>{
 beforeEach(()=>{const m=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>m.set(k,v),removeItem:(k:string)=>m.delete(k)});});
 it('persists kits and original image bytes and restores them',async()=>{const d=emptyLibrary();d.assets=[{id:'a',name:'Photo',kind:'image',tags:['photo'],favorite:true,data:'data:image/png;base64,AP8B'}];await saveLibrary(d);expect(await loadLibrary()).toEqual(d);});
 it('reports storage failure instead of pretending to save',async()=>{vi.stubGlobal('localStorage',{setItem:()=>{throw Error('full');}});await expect(saveLibrary(emptyLibrary())).rejects.toThrow('storage failed');});
});

