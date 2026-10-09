import {describe,it,expect} from 'vitest';
import {renderSvg,SceneStore} from '@pcs/scene-core';
import {hasErrors,validateBannerSpec,type BannerSpecDocument} from '@pcs/bannerspec';
import {SCENE_LIBRARY} from '../src/sceneLibrary.js';
import {startSequence,arrangeSequence,duplicateScene,sequenceScenes,sceneGroup} from '../src/sequence.js';
import {withBackgroundPaint} from '../src/background.js';
import {renderStatsStyleSvg,calendarStreak} from '../src/github/stats-styles.js';
import {buildExportPackage,inlinePhotos} from '../src/github/export.js';
import {newProject} from '../src/project.js';
const document=():BannerSpecDocument=>({specVersion:'0.3',canvas:{width:400,height:180,background:'#121212'},animation:{duration:4,loop:true},layers:[{id:'title',type:'text',name:'Title',visible:true,locked:false,opacity:1,rotation:0,x:20,y:70,fontFamily:'Consolas',fontSize:24,text:'abcdef',fill:'#ffffff',behaviors:[{id:'typing',preset:'typewriter',category:'text',enabled:true,speed:.25,amount:60}]}]});
describe('PCS repair regression contracts',()=>{
 it('preserves approved foundations and restored real-photo scenes without Night City or fake anime',()=>{
  expect(SCENE_LIBRARY.map(s=>s.name).sort()).toEqual(['Aurora Night','Coffee Shop Night','Editorial','Forest Mist','Library Warm Light','Night Skyline','Ocean Sunset','Pastel Dreams','Rainy City Window','Retro Terminal','Snow Forest','Starry Desert'].sort());
 });
 it('all retained scene documents validate',()=>{for(const scene of SCENE_LIBRARY)expect(hasErrors(validateBannerSpec(scene.make(1200,350))),scene.name).toBe(false);});
 it('typing reveals characters instead of fading the entire label',()=>{
  const early=renderSvg(document(),{time:.35}),late=renderSvg(document(),{time:2});expect(early).toContain('>ab</tspan>');expect(early).not.toContain('>abcdef</tspan>');expect(late).toContain('>abcdef</tspan>');
 });
 it('animated typing uses discrete character visibility with an inline cursor',()=>{const svg=renderSvg(document(),{animate:true});expect(svg).toContain('calcMode="discrete"');expect(svg).toContain('▌');expect(svg).not.toContain('NaN');});
 it('scene tabs retain backgrounds and show only the active scene on scrubbing',()=>{
  const sequence=startSequence(document()),first=sequenceScenes(sequence)[0]!,second=duplicateScene(first);second.children=second.children.map(l=>l.type==='text'?{...l,text:'SECOND'}:l);
  const doc=arrangeSequence(sequence,[first,second]);expect(doc.animation?.duration).toBe(8);expect(renderSvg(doc,{time:2})).not.toContain('SECOND');expect(renderSvg(doc,{time:6})).toContain('SECOND');expect(renderSvg(doc,{time:6})).not.toContain('abcdef');expect(renderSvg(doc,{time:8})).toContain('SECOND');
 });
 it('exported sequence restarts child animations using the shared sequence clock',()=>{
  const doc=startSequence(document()),first=sequenceScenes(doc)[0]!;const svg=renderSvg(arrangeSequence(doc,[first,duplicateScene(first)]),{animate:true});expect(svg).toContain('pcs-sequence-clock');expect(svg).toContain('repeatEvent+4s');expect(svg).not.toContain('NaN');
 });
 it('scene grouping fades the background and all children together',()=>{
  const doc=document(),group=sceneGroup(doc);group.behaviors=[{id:'fade',preset:'fade-in',category:'entrance',enabled:true,speed:1,amount:60}];const svg=renderSvg({...doc,canvas:{...doc.canvas,background:undefined},layers:[group]},{time:0});expect(svg).toMatch(/<g opacity="0"/);expect(group.children[0]!.fill).toBe('#121212');
 });
 it('undo restores the original scene after grouping or replacing',()=>{
  const doc=document(),store=new SceneStore(doc),before=JSON.stringify(store.getDocument());store.replaceDocument(startSequence(doc),'Sequence');store.undo();expect(JSON.stringify(store.getDocument())).toBe(before);store.redo();expect(sequenceScenes(store.getDocument())).toHaveLength(1);
 });
 it('animated background paint survives project serialization and renders differently over time',()=>{
  const doc=withBackgroundPaint(document(),0,{type:'animated',mode:'hue-cycle',duration:6,base:{type:'linear',angle:0,stops:[{color:'#ff0000',offset:0},{color:'#0000ff',offset:1}]}});expect(hasErrors(validateBannerSpec(JSON.parse(JSON.stringify(doc))))).toBe(false);expect(renderSvg(doc,{time:0})).not.toBe(renderSvg(doc,{time:3}));
 });
 it('full-size styled stats never substitute demo counts when metrics are absent',()=>{
  expect(renderStatsStyleSvg('cards',[])).toContain('No fetched metrics');expect(renderStatsStyleSvg('editorial',[{key:'repos',label:'Only real metric',value:7}])).toContain('Only real metric');expect(renderStatsStyleSvg('cards',[],true)).toContain('#f6f8fa');
 });
 it('streaks count dated observations, handle today with zero and stop at gaps',()=>{
  expect(calendarStreak([{date:'2026-10-05',count:1},{date:'2026-10-06',count:2},{date:'2026-10-07',count:3},{date:'2026-10-08',count:0}],'2026-10-08')).toEqual({current:3,longest:3});expect(calendarStreak([{date:'2026-10-05',count:1},{date:'2026-10-07',count:2}],'2026-10-08')).toEqual({current:1,longest:1});
 });
 it('embedded preset media reaches the banner package and styled stats are image assets',()=>{
  const project=newProject(),photo=SCENE_LIBRARY.find(s=>s.name==='Rainy City Window')!;project.bannerSpec=photo.make(400,180);const data={'photos/rainy-city-night.jpg':'data:image/jpeg;base64,AA=='};expect(JSON.stringify(inlinePhotos(project.bannerSpec,data))).toContain(data['photos/rainy-city-night.jpg']);const files=buildExportPackage({project,photoData:data,lightDark:false,includeWorkflow:false,animatedContribution:true});expect(files['assets/banner.svg']).toContain(data['photos/rainy-city-night.jpg']);expect(files['README.md']).toContain('![Stats](assets/stats.svg)');
 });
});

it('changing a procedural background replaces its visible base rather than hiding under it',()=>{
 const doc=document();doc.layers.unshift({id:'bg',type:'rect',name:'Background',visible:true,locked:false,opacity:1,rotation:0,x:0,y:0,width:400,height:180,fill:'#123456'});
 const next=withBackgroundPaint(doc,0,{type:'solid',color:'#ab1234'});
 expect(renderSvg(next)).toContain('#ab1234');expect(next.layers.length).toBe(doc.layers.length);
});
it('fade in and fade out remain visible in the middle when stacked',()=>{
 const doc=document();doc.layers[0]!.behaviors=[{id:'in',preset:'fade-in',category:'entrance',enabled:true,speed:1,amount:60},{id:'out',preset:'fade-out',category:'exit',enabled:true,speed:1,amount:60}];
 expect(renderSvg(doc,{time:0})).toContain('opacity="0"');expect(renderSvg(doc,{time:2})).toContain('opacity="1"');const final=renderSvg(doc,{time:4});expect(Number(final.match(/<g opacity="([0-9.]+)"/)?.[1])).toBeLessThan(.001);
});

it('centered animated SVG has valid separated text attributes',()=>{const doc=document();doc.layers[0]={...doc.layers[0]!,align:'middle'} as never;expect(renderSvg(doc,{animate:true})).toContain('font-weight="600" text-anchor="middle"');expect(renderSvg(doc,{animate:true})).not.toMatch(/"[a-z-]+=/);});

it('SMIL entrances hold the end frame and use relative motion offsets',()=>{const doc=document();doc.layers[0]!.behaviors=[{id:'rise',preset:'rise',category:'entrance',enabled:true,speed:1,amount:60}];const svg=renderSvg(doc,{animate:true});expect(svg).toContain('values="0 27;0 0;0 0"');expect(svg).toContain('keyTimes="0.000;0.325;1.000"');});
it('exported hue and scale behaviors have actual animated rendering',()=>{const doc=document();doc.layers[0]!.behaviors=[{id:'hue',preset:'hue-cycle',category:'color',enabled:true,speed:1,amount:60},{id:'scale',preset:'scale-in',category:'entrance',enabled:true,speed:1,amount:60}];const svg=renderSvg(doc,{animate:true});expect(svg).toContain('animated-hue-title');expect(svg).toContain('type="scale"');expect(svg).not.toContain('NaN');});
