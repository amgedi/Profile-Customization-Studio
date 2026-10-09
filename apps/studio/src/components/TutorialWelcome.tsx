import { useEffect } from "react";
import { SupportPanel } from './SupportPanel.js';
export function TutorialWelcome({onStart,onSkip}:{onStart:()=>void;onSkip:()=>void}){
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();onSkip();}};window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);},[onSkip]);
 return <div className="dialog-overlay"><section className="dialog tutorial-welcome" role="dialog" aria-label="Welcome to PCS"><h2>Make your profile yours.</h2><p>New to PCS? Take a guided walk through the real controls, from your first image to export. You can try the controls as you go, or leave at any time.</p><div className="dialog-actions"><button className="btn primary" onClick={onStart}>Start tutorial</button><button className="btn" onClick={onSkip}>Skip — I know my way around</button></div><p>Want help with a particular task? Guide Me opens the relevant controls and stays alongside your design. Restart this tutorial anytime from Help or Settings → Interface & startup.</p><SupportPanel/></section></div>;
}
