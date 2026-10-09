import type { Layer, LayerEffect } from '@pcs/bannerspec';
export const SPATIAL_EFFECTS = new Set(['rain-fx','snow-fx','fog-fx','mist','smoke','steam','condensation','dust-fx','bokeh-fx','stars-fx','fireflies-fx','embers-fx','leaves-fx','clouds','vignette','light-leak','lens-glow','grad-overlay','scanlines','crt','grid','hud','rays','heavenly']);
function random(seed:number){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
const n=(fx:LayerEffect,key:string,fallback:number)=>Number.isFinite(fx.params[key])?fx.params[key]!:fallback;
const color=(s:string|undefined,defaultColor:string)=>s&&/^#[0-9a-f]{3,8}$/i.test(s)?s:defaultColor;
export function spatialEffects(layer:Layer,box:{x:number;y:number;w:number;h:number},time:number,animate:boolean):string {
 const {x,y,w,h}=box;if(w<=0||h<=0)return '';
 const effects=(layer.effects??[]).filter(e=>e.visible!==false&&SPATIAL_EFFECTS.has(e.type));
 return effects.map((fx,index)=>{
  const id=`spatial-${layer.id.replace(/[&<>"\']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","\'":"&apos;"}[c]!))}-${index}`,rand=random(8128+index*431),amount=Math.max(0,Math.min(100,n(fx,'amount',50))),speed=n(fx,'speed',1),wind=n(fx,'wind',.15),opacity=Math.max(0,Math.min(1,n(fx,'opacity',.8))),c=color(fx.color,fx.type==='bokeh-fx'?'#ffcd8a':fx.type==='fireflies-fx'?'#d6f588':'#dfeafa');
  const clip=`<clipPath id="${id}-clip"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>`;
  let defs='',body='';
  if(['fog-fx','mist','smoke','steam','clouds','condensation'].includes(fx.type)){
    const turbulence=Math.max(0,Math.min(2,n(fx,'turbulence',.6))),density=Math.max(0,Math.min(1,n(fx,'density',amount/100))),softness=n(fx,'softness',.65),height=n(fx,'height',fx.type==='mist'?.28:.65),scale=n(fx,'noiseScale',1),direction=n(fx,'direction',1);
    defs=`<filter id="${id}-soft"><feTurbulence type="fractalNoise" baseFrequency="${.006*scale} ${.016*scale}" numOctaves="3" seed="12" result="noise">${animate?`<animate attributeName="baseFrequency" values="${.006*scale} ${.016*scale};${.009*scale} ${.012*scale};${.006*scale} ${.016*scale}" dur="${25/Math.max(.1,speed)}s" repeatCount="indefinite"/>`:""}</feTurbulence><feDisplacementMap in="SourceGraphic" in2="noise" scale="${h*.15*turbulence}"/><feGaussianBlur stdDeviation="${Math.max(1,h*softness*.06)}"/></filter><radialGradient id="${id}-haze"><stop stop-color="${c}" stop-opacity="${density}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
    body=Array.from({length:Math.max(1,Math.min(12,Math.round(n(fx,'layers',7))))},(_,i)=>{const sx=x+rand()*w,sy=y+h*(1-height)+rand()*h*height,rx=w*(.22+rand()*.28),ry=h*height*(.25+rand()*.3),dx=Math.sin(time*speed*.3+i)*w*.15*direction;return `<ellipse cx="${sx+dx}" cy="${sy}" rx="${rx}" ry="${ry}" fill="url(#${id}-haze)" opacity="${opacity}" filter="url(#${id}-soft)">${animate?`<animateTransform attributeName="transform" type="translate" values="${-w*.1*direction},0;${w*.1*direction},${-h*.06};${-w*.1*direction},0" dur="${18/Math.max(.1,speed)}s" begin="-${i*2}s" repeatCount="indefinite"/>`:''}</ellipse>`;}).join('');
  }else if(['vignette','lens-glow','light-leak','grad-overlay'].includes(fx.type)){
    const vignette=fx.type==='vignette';
    defs=`<radialGradient id="${id}-wash" cx="${fx.type==='light-leak'?0:50}%" cy="50%" r="75%"><stop offset="${vignette?'20':'0'}%" stop-color="${vignette?'#000':c}" stop-opacity="${vignette?0:amount/100}"/><stop offset="100%" stop-color="${vignette?'#000':c}" stop-opacity="${vignette?amount/100:0}"/></radialGradient>`;
    body=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${id}-wash)"/>`;
  }else if(['scanlines','crt','grid','hud'].includes(fx.type)){
    const spacing=Math.max(2,n(fx,'spacing',fx.type==='grid'?20:4));
    for(let dy=0;dy<h;dy+=spacing)body+=`<path d="M${x},${y+dy}h${w}" stroke="${fx.type==='crt'?'#000':c}" stroke-width="${n(fx,'thickness',1)}" opacity="${amount/100*.6}"/>`;
    if(fx.type==='grid')for(let dx=0;dx<w;dx+=spacing)body+=`<path d="M${x+dx},${y}v${h}" stroke="${c}" opacity="${amount/100*.5}"/>`;
   }else if(fx.type==='heavenly'){
    const strength=amount/100,count=Math.max(0,Math.min(150,n(fx,'count',48)));
    defs=`<radialGradient id="${id}-aura"><stop stop-color="${c}" stop-opacity="${strength*.4}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient><filter id="${id}-glow"><feGaussianBlur stdDeviation="${n(fx,'blur',2)}"/></filter>`;
    body=`<ellipse cx="${x+w*.5}" cy="${y+h*.75}" rx="${w*.55}" ry="${h*.5}" fill="url(#${id}-aura)" filter="url(#${id}-glow)"/>`;
    for(let i=0;i<count;i++){
      const px=x+rand()*w,z=rand(),initial=rand(),r=Math.max(.2,n(fx,'sizeMin',.6)+z*(n(fx,'sizeMax',2.1)-n(fx,'sizeMin',.6))),cycle=6/Math.max(.1,speed),progress=((time/cycle+initial)%1+1)%1,py=y+h*(1-progress),alpha=Math.sin(progress*Math.PI)*strength*opacity;
      body+=`<circle cx="${px+Math.sin(time+initial*8)*8}" cy="${py}" r="${r}" fill="${c}" opacity="${alpha}">${animate?`<animateTransform attributeName="transform" type="translate" values="0,0;${Math.sin(i)*12},${-h}" dur="${cycle}s" begin="-${initial*cycle}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;${strength};0" dur="${cycle}s" begin="-${initial*cycle}s" repeatCount="indefinite"/>`:''}</circle>`;
    }
  }else if(fx.type==='rain-fx'){
    const count=Math.min(260,Math.max(0,Math.round(n(fx,'count',160)*amount/100))),minimum=n(fx,'sizeMin',1.4),maximum=n(fx,'sizeMax',5),depth=n(fx,'depth',.6);
    defs=`<radialGradient id="${id}-drop" cx="32%" cy="26%"><stop stop-color="#ffffff" stop-opacity=".7"/><stop offset=".28" stop-color="${c}" stop-opacity=".03"/><stop offset=".72" stop-color="#081220" stop-opacity=".3"/><stop offset="1" stop-color="${c}" stop-opacity=".5"/></radialGradient><linearGradient id="${id}-trail" x2="0" y2="1"><stop stop-color="${c}" stop-opacity="0"/><stop offset="1" stop-color="${c}" stop-opacity=".3"/></linearGradient>`;
    const distant=Math.min(90,Math.round(count*.4));
    for(let i=0;i<distant;i++){const px=x+rand()*w,start=rand(),v=(80+rand()*90)*Math.max(.1,speed),length=3+rand()*8,py=y+((time*v+start*h)%h+h)%h;body+=`<path d="M${px},${py}l${wind*length*.3},${length}" stroke="${c}" stroke-width="${.3+rand()*.4}" opacity="${(.07+rand()*.12)*opacity}" stroke-linecap="round"/>`;}
    for(let i=0;i<count;i++){
      const z=rand(),r=Math.max(.3,minimum+z*(maximum-minimum))*(.6+depth*z),initial=rand(),px=x+rand()*w,velocity=Math.max(.1,speed)*(12+z*z*105),cycle=(h+30)/velocity,phase=(((z>.38?time/cycle:0)+initial)%1+1)%1,py=y-15+phase*(h+30),stretch=1+z*.55;
      const moving=z>.38,alpha=Math.min(1,(.3+z*.6)*opacity*n(fx,'brightness',1));
      const motion=animate&&moving?`<animateTransform attributeName="transform" type="translate" from="0,${-h}" to="${wind*30},${h+30}" dur="${cycle*2}s" begin="-${initial*cycle*2}s" repeatCount="indefinite"/>`:'';
      body+=`<g opacity="${alpha}"${n(fx,'blur',0)>0?` filter="url(#${id}-soft-drop)"`:""}>${moving?`<path d="M${px},${py-r*2}q${-wind*5},${-r*6} ${-wind*8},${-r*n(fx,'trailLength',14)}" fill="none" stroke="url(#${id}-trail)" stroke-width="${r*n(fx,'trailWidth',.45)}"/>`:''}<ellipse cx="${px}" cy="${py}" rx="${r}" ry="${r*stretch}" fill="url(#${id}-drop)" stroke="${c}" stroke-opacity=".22" stroke-width=".55"/><path d="M${px-r*.55},${py}q${-r*.1},${-r*.8} ${r*.65},${-r*.75}" fill="none" stroke="white" stroke-opacity=".65" stroke-width="${Math.max(.4,r*.17)}" stroke-linecap="round"/>${motion}</g>`;
    }
    defs+=`<filter id="${id}-soft-drop"><feGaussianBlur stdDeviation="${n(fx,'blur',0)}"/></filter>`;
  }else if(fx.type==='rays'){
    defs=`<filter id="${id}-blur"><feGaussianBlur stdDeviation="${h*.035}"/></filter>`;
    for(let i=0;i<6;i++){const sx=x+w*(.1+i*.18);body+=`<path d="M${sx},${y}l${w*.08},0 ${w*.2},${h} -${w*.24},0Z" fill="${c}" opacity="${amount/100*.18}" filter="url(#${id}-blur)"/>`;}
  }else{
    const count=Math.round(n(fx,'count',amount*2)),blur=n(fx,'blur',fx.type==='bokeh-fx'?4:fx.type==='dust-fx'?1:0),depth=n(fx,'depth',.6),sizeMin=n(fx,'sizeMin',fx.type==='bokeh-fx'?4:.6),sizeMax=n(fx,'sizeMax',fx.type==='bokeh-fx'?18:fx.type==='snow-fx'?3.5:1.8);
    defs=`<filter id="${id}-blur"><feGaussianBlur stdDeviation="${blur}"/></filter><radialGradient id="${id}-light"><stop stop-color="${c}" stop-opacity=".8"/><stop offset=".55" stop-color="${c}" stop-opacity=".35"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
    for(let i=0;i<Math.min(400,count);i++){
      const z=rand(),r=sizeMin+z*(sizeMax-sizeMin),initialX=rand()*w,initialY=rand()*h,particleSpeed=(.25+z*1.6)*speed,travel=time*particleSpeed,fall=fx.type==='snow-fx'?22:fx.type==='embers-fx'?-20:fx.type==='stars-fx'?0:5;
      const flutter=fx.type==='snow-fx'?Math.sin(time*particleSpeed*(1+n(fx,'turbulence',.4))+i)*n(fx,'flutter',14)*(1-z*.4):0;
      const px=x+((initialX+travel*wind*30+flutter)%w+w)%w,py=y+((initialY+travel*fall)%h+h)%h,alpha=(.2+z*.8)*opacity*n(fx,'brightness',1);
      const duration=h/Math.max(1,Math.abs(fall)*particleSpeed),animation=animate&&fall?`<animateTransform attributeName="transform" type="translate" from="0,${-h}" to="${wind*w*.3},${h}" dur="${duration*2}s" begin="-${rand()*duration*2}s" repeatCount="indefinite"/>`:'';
      if(fx.type==='stars-fx'&&i%9===0)body+=`<path d="M${px-3},${py}h6 M${px},${py-3}v6" stroke="${c}" stroke-width=".6" opacity="${alpha}"/>`;
      else body+=`<circle cx="${px}" cy="${py}" r="${r*(1-depth*.3+z*depth*.3)}" fill="${fx.type==='bokeh-fx'?`url(#${id}-light)`:c}" opacity="${alpha}"${blur>0?` filter="url(#${id}-blur)"`:''}>${animation}${animate&&fx.type==='fireflies-fx'?`<animate attributeName="opacity" values=".15;${alpha};.15" dur="${3+z*3}s" repeatCount="indefinite"/>`:''}</circle>`;
    }
  }
  return `<defs>${clip}${defs}</defs><g pointer-events="none" clip-path="url(#${id}-clip)">${body}</g>`;
 }).join('');
}
