import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DiscoverySection } from './DiscoveryPanel.js';
import type { TutorialStatus } from '../onboarding.js';
export interface TourStep {
 selector:string;title:string;body:string;
 mode?:'design'|'animate'|'profile'|'preview';section?:DiscoverySection;text?:boolean;
}
function useTargetRect(selector:string,step:number) {
 const [rect,setRect]=useState<DOMRect|null>(null);
 useEffect(()=>{
  setRect(null);
  let last='',stopped=false;
  const update=()=>{
   if(stopped)return;
   const el=document.querySelector<HTMLElement>(selector);
   if(!el || !el.getClientRects().length){if(last!=='missing'){last='missing';setRect(null);}return;}
   const r=el.getBoundingClientRect(),key=[r.x,r.y,r.width,r.height].join(',');
   if(key!==last){last=key;setRect(r);}
  };
  // Panel routing can mount on the following render. Observe until it exists.
  const timer=window.setInterval(update,150);update();
  window.addEventListener('resize',update);window.addEventListener('scroll',update,true);
  return()=>{stopped=true;clearInterval(timer);window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true);};
 },[selector,step]);
 return rect;
}
export function SpotlightTour({steps,step,onStep,onDone}:{steps:TourStep[];step:number;onStep:(n:number)=>void;onDone:(status:TutorialStatus)=>void}){
 const current=steps[step]!,rect=useTargetRect(current.selector,step),card=useRef<HTMLDivElement>(null);
 const [pos,setPos]=useState<{left:number;top:number}|null>(null),[minimized,setMinimized]=useState(false);
 useEffect(()=>{setMinimized(false);const frame=requestAnimationFrame(()=>card.current?.focus());return()=>cancelAnimationFrame(frame);},[step]);
 useLayoutEffect(()=>{
  const node=card.current;if(!node)return;
  const w=node.offsetWidth,h=node.offsetHeight;
  const x=rect?rect.right+14:innerWidth-w-16;
  // Place beside the target, otherwise at the lower right. Minimize to try controls underneath.
  setPos({left:Math.max(12,Math.min(innerWidth-w-12,x)),top:Math.max(12,Math.min(innerHeight-h-12,rect?.top??innerHeight-h-16))});
 },[rect,step,minimized]);
 useEffect(()=>{
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();onDone('skipped');}};
  window.addEventListener('keydown',escape,true);return()=>window.removeEventListener('keydown',escape,true);
 },[onDone]);
 const tryControl=()=>{
  const target=document.querySelector<HTMLElement>(current.selector);
  const control=target?.matches('button,input,textarea,select,[tabindex]')?target:target?.querySelector<HTMLElement>('button:not(:disabled),input,textarea,select,[tabindex="0"]');
  if(control){setMinimized(true);control.scrollIntoView({block:'nearest',behavior:'instant'});control.focus();}
 };
 return <div className="tour-overlay">
  {!minimized && rect && <div aria-hidden="true" className="tour-spotlight" style={{left:rect.left-4,top:rect.top-4,width:rect.width+8,height:rect.height+8}}/>}
  <div className="tour-card" ref={card} tabIndex={-1} role="dialog" aria-modal="false" aria-labelledby="tour-title" aria-describedby="tour-body" style={pos??{right:16,bottom:16}} onKeyDown={e=>{
   if(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)return;
   if(e.key==='ArrowRight'&&step<steps.length-1){e.preventDefault();onStep(step+1);}
   if(e.key==='ArrowLeft'&&step>0){e.preventDefault();onStep(step-1);}
  }}>
   <p className="tour-progress" aria-live="polite">Step {step+1} of {steps.length}</p><h3 id="tour-title">{current.title}</h3>
   <p id="tour-body">{minimized?'Try the controls. Return here when you are ready.':current.body}</p>
   {!minimized&&<button className="btn" onClick={tryControl}>Try the highlighted controls</button>}
   <div className="tour-actions"><button className="btn ghost" onClick={()=>onDone('skipped')}>Skip</button><button className="btn" onClick={()=>setMinimized(!minimized)}>{minimized?'Show instructions':'Minimize'}</button><button className="btn" disabled={step===0} onClick={()=>onStep(step-1)}>Back</button>{step<steps.length-1?<button className="btn primary" onClick={()=>onStep(step+1)}>Next</button>:<button className="btn primary" onClick={()=>onDone('completed')}>Finish</button>}</div>
  </div>
 </div>;
}
