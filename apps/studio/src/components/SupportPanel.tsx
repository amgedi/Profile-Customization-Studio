import { Heart, Coffee, ExternalLink } from 'lucide-react';
import { useState } from 'react';
export const SUPPORT_DESTINATIONS = [
 {id:'github-sponsors',label:'GitHub Sponsors',url:'https://github.com/sponsors/amgedi'},
 {id:'ko-fi',label:'Ko-fi',url:'https://ko-fi.com/openfhs'},
 {id:'buy-me-a-coffee',label:'Buy Me a Coffee',url:'https://buymeacoffee.com/openfhs'},
] as const;
export function SupportPanel() {
 const [error,setError]=useState('');
 async function open(id:string,url:string){try{if('__TAURI_INTERNALS__' in window){const {invoke}=await import('@tauri-apps/api/core');await invoke('support_open',{destination:id});}else{const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.click();}}catch{setError('Could not open your browser. You can copy a support link below.');}}
 return <section className="pcs-support" aria-label="Optional project support"><h3><Heart size={19} aria-hidden="true"/> Support the project</h3><p>PCS is free and open source. Optional support helps fund development, testing, documentation, accessibility, and long-term maintenance. Every feature remains free.</p><div className="support-links">{SUPPORT_DESTINATIONS.map(d=><button className="btn" key={d.id} onClick={()=>void open(d.id,d.url)}>{d.id==='github-sponsors'?<Heart size={16} aria-hidden="true"/>:<Coffee size={16} aria-hidden="true"/>}{d.label}<ExternalLink size={12} aria-hidden="true"/></button>)}</div><small>Opens the selected page in your browser. Supporting PCS is always optional.</small>{error&&<div role="alert"><p>{error}</p>{SUPPORT_DESTINATIONS.map(d=><p key={d.id}>{d.label}: {d.url}</p>)}</div>}</section>;
}

