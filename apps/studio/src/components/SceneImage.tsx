import {createSvgFrame} from '../svgFrame.js';
import {useLayoutEffect,useRef,useState,type CSSProperties} from 'react';
/** Renderer-generated SVG only. Preserve live GIF image nodes across sampled scene frames. */
export function SceneImage({src,alt,style,className,live=false}:{src:string;alt:string;style?:CSSProperties;className?:string;live?:boolean}){
 const host=useRef<HTMLDivElement>(null);
 const svg=src.startsWith('data:image/svg+xml;charset=utf-8,')?decodeURIComponent(src.slice('data:image/svg+xml;charset=utf-8,'.length)):'';
 const animated=live&&svg.includes('data:image/gif');
 const [imageSrc,setImageSrc]=useState('');
 // Revocation releases the WebView image-cache entry for every sampled frame.
 // Unique SVG data URLs otherwise retain decoded images during long playback.
 useLayoutEffect(()=>{if(animated||!svg)return;const frame=createSvgFrame(svg);setImageSrc(frame.src);return frame.dispose;},[svg,animated]);
 useLayoutEffect(()=>{if(!animated||!host.current)return;const parsed=new DOMParser().parseFromString(svg,'image/svg+xml').documentElement;if(parsed.localName!=='svg'||parsed.querySelector('script,foreignObject'))return;
 const previous=[...host.current.querySelectorAll('image')];for(const image of [...parsed.querySelectorAll('image')]){const href=image.getAttribute('href')??image.getAttribute('xlink:href');if(!href?.startsWith('data:image/gif'))continue;const existing=previous.find(node=>(node.getAttribute('href')??node.getAttribute('xlink:href'))===href);if(existing){for(const attribute of [...image.attributes])existing.setAttributeNS(attribute.namespaceURI,attribute.name,attribute.value);image.replaceWith(existing);}}
 parsed.style.width='100%';parsed.style.height='auto';parsed.style.display='block';host.current.replaceChildren(parsed);
 },[src,animated]);
 return animated?<div ref={host} className={className} role="img" aria-label={alt} style={style}/>:<img src={svg?imageSrc:src} alt={alt} style={style} className={className}/>;
}
