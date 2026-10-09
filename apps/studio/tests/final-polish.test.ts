import {describe,it,expect} from 'vitest';
import {renderSvg} from '@pcs/scene-core';
import {hasErrors,validateBannerSpec} from '@pcs/bannerspec';
import {SCENE_LIBRARY} from '../src/sceneLibrary.js';
import {applyAmbience} from '../src/components/GuideMe.js';
import {EFFECT_PRESETS} from '../src/effects.js';
import {insertAtmosphere} from '../src/atmosphere.js';
const document=()=>SCENE_LIBRARY.find(s=>s.id==='editorial-black')!.make(800,240);
describe('Final polish effect parity',()=>{
 for(const [choice,id] of [['rain','window-rain'],['snow','soft-snowfall'],['fireflies','fireflies-fx'],['stars','stars-fx'],['bokeh','cinema-bokeh']] as const){
  it(`${choice} uses the shared effect preset and keeps document validity`,()=>{
   const doc=document();applyAmbience(doc,choice,70);
   const preset=EFFECT_PRESETS.find(p=>p.id===id)!;
   const fx=doc.layers.flatMap(l=>l.effects??[]).find(f=>f.type===preset.type)!;
   expect(fx).toMatchObject({type:preset.type,params:{...preset.params,amount:70}});
   expect(hasErrors(validateBannerSpec(doc))).toBe(false);
   expect(renderSvg(doc,{time:1})).toContain('spatial-');
  });
 }
 it('leaves text above scene atmosphere without mutating the preset',()=>{
  const doc=document(),preset=EFFECT_PRESETS.find(p=>p.id==='window-rain')!,before=structuredClone(preset);
  const layer=insertAtmosphere(doc,preset,0);
  expect(doc.layers.indexOf(layer)).toBeLessThan(doc.layers.findIndex(l=>l.type==='text'));
  expect(preset).toEqual(before);
  expect(renderSvg({...doc,layers:[layer]},{time:0})).not.toContain('<ellipse');
 });
 it('new rain and snow controls alter real SVG output',()=>{
  for(const [id,key,a,b] of [['window-rain','trailLength',0,30],['soft-snowfall','flutter',0,60],['rolling-fog','layers',1,12],['ethereal-cool','sizeMax',1,8]] as const){
   const doc=document(),layer=insertAtmosphere(doc,EFFECT_PRESETS.find(p=>p.id===id)!);
   layer.effects![0]!.params[key]=a;const first=renderSvg(doc,{time:2});
   layer.effects![0]!.params[key]=b;expect(renderSvg(doc,{time:2}),key).not.toBe(first);
  }
 });
});
