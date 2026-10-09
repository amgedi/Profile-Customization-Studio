import {useEffect,useRef,useState,type SelectHTMLAttributes} from 'react';
import {PCSSelect} from './PCSSelect.js';
/** Keep native form/event semantics while presenting the shared searchable PCS menu. */
export function StudioSelect(props:SelectHTMLAttributes<HTMLSelectElement>) {
 const select=useRef<HTMLSelectElement>(null),[options,setOptions]=useState<{value:string;label:string}[]>([]),[value,setValue]=useState(String(props.value??props.defaultValue??''));
 useEffect(()=>{const el=select.current;if(!el)return;setOptions(Array.from(el.options).filter(o=>!o.disabled).map(o=>({value:o.value,label:o.parentElement?.tagName==='OPTGROUP'?`${o.parentElement.getAttribute('label')} · ${o.text}`:o.text})));setValue(el.value);},[props.children,props.value]);
 const label=props['aria-label']??props.title??'Select option';
 return <span className={'studio-select '+(props.className??'')} style={props.style}><select {...props} style={{display:'none'}} ref={select} tabIndex={-1} aria-hidden="true" onChange={e=>{setValue(e.target.value);props.onChange?.(e);}}/><span style={props.disabled?{pointerEvents:'none',opacity:.5}:undefined}><PCSSelect disabled={props.disabled} label={label} value={value} options={options} onChange={v=>{const el=select.current;if(el&&!props.disabled){el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}));setValue(v);}}}/></span></span>;
}
