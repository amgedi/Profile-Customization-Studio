import {useEffect,useState} from 'react';
import {runtimePrefs} from './prefs.js';
export function useReducedMotion(){
 const [system,setSystem]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{const query=window.matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setSystem(query.matches);query.addEventListener('change',change);return()=>query.removeEventListener('change',change);},[]);
 return system||runtimePrefs().reducedMotion;
}
