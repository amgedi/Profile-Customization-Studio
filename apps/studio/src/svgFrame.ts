/** Own one rendered SVG frame; disposal removes its decoded WebView cache entry. */
export function createSvgFrame(svg:string):{src:string;dispose:()=>void}{
 const src=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));let disposed=false;
 return {src,dispose:()=>{if(!disposed){disposed=true;URL.revokeObjectURL(src);}}};
}
