import { describe, it, expect } from 'vitest';
import { emptyBannerSpec, isValidColor, validateBannerSpec } from '@pcs/bannerspec';
import { renderSvg } from '../src/render.js';
import { compileTracks } from '../src/behaviors.js';

const scene = () => ({...emptyBannerSpec(),layers:[{id:'rect',type:'rect' as const,name:'Rectangle',visible:true,locked:false,opacity:1,rotation:0,x:0,y:0,width:100,height:50,fill:'#ffffff'}]});
describe('untrusted scene boundaries',()=>{
  it('rejects functional colour markup before inline SVG rendering',()=>{
    const d=scene(); d.layers[0]!.fill='rgb(0,0,0)"/><script>alert(1)</script><g fill="rgb(0,0,0)';
    expect(isValidColor(d.layers[0]!.fill)).toBe(false);
    expect(()=>renderSvg(d)).toThrow('Invalid scene');
    expect(isValidColor('rgba(10, 20, 30, 0.5)')).toBe(true);
  });
  it('escapes arbitrary imported resource IDs and rejects numeric attribute payloads',()=>{
    const d=scene(); d.layers[0]!.id='x"/><script>alert(1)</script><g id="';
    Object.assign(d.layers[0]!,{effects:[{id:'glow',type:'glow',visible:true,params:{amount:10}}]});
    expect(renderSvg(d)).not.toContain('<script>');
    Object.assign(d.layers[0]!,{cornerRadius:'0" onload="alert(1)'});
    expect(()=>renderSvg(d)).toThrow('Invalid scene');
  });
  it('validates nested animated gradient colours and effect colours',()=>{
    const d=scene(); Object.assign(d.layers[0]!,{fill:{type:'animated',mode:'hue-cycle',duration:8,base:{type:'linear',angle:90,stops:[{offset:0,color:'#fff'},{offset:1,color:'bad" onload="x'}]}}});
    expect(()=>renderSvg(d)).toThrow('Invalid scene');
    d.layers[0]!.fill='#fff'; Object.assign(d.layers[0]!,{effects:[{id:'g',type:'glow',visible:true,color:'bad" onload="x',params:{amount:10}}]});
    expect(()=>renderSvg(d)).toThrow('Invalid scene');
  });
  it('rejects negative and nonfinite animation speeds without generating keys',()=>{
    const b={id:'x',preset:'float',category:'loop' as const,enabled:true,speed:-1,amount:20};
    expect(()=>compileTracks({behaviors:[b],x:0,y:0,opacity:1},8)).toThrow();
    expect(()=>compileTracks({behaviors:[{...b,speed:Infinity}],x:0,y:0,opacity:1},8)).toThrow();
  });
  it('rejects nonfinite geometry and malformed animation without crashing validation',()=>{
    const d=scene(); d.layers[0]!.width=Infinity;
    expect(validateBannerSpec(d).some(x=>x.severity==='error')).toBe(true);
    expect(()=>validateBannerSpec({...d,animation:null})).not.toThrow();
  });
});
