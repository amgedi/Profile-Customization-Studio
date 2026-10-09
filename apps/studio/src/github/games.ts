export const GAME_STYLES = ['snake','garden','rain','particles','wave','pixel-trail','orbit','fireflies','constellation'] as const;
export type GameStyle = typeof GAME_STYLES[number];
export interface GameOptions { style: GameStyle; speed: number; trail: number; density: number; rounded: boolean; loop: boolean; intensity: number; palette: string[] }
export const DEFAULT_GAME: GameOptions = {style:'snake',speed:1,trail:8,density:.6,rounded:true,loop:true,intensity:.8,palette:['#161b22','#0e4429','#006d32','#26a641','#39d353']};
/** Shared by the editor and exported SVG. Actors only originate from active calendar cells. */
export function renderCalendarGame(levels: number[], options: GameOptions, background: string, animate: boolean, time = 0, calendarStart?: string): string {
  const cols=Math.ceil(levels.length/7), cell=10, step=13, left=28, top=24, width=left+cols*step+8, height=top+7*step+26;
  const safe=(s:string)=>/^#[0-9a-f]{3,8}$/i.test(s)?s:'#39d353';
  const palette=options.palette.map(safe), dur=12/Math.max(.2,options.speed), active=levels.map((l,i)=>l>0?i:-1).filter(i=>i>=0);
  const rects=levels.map((l,i)=>`<rect x="${left+Math.floor(i/7)*step}" y="${top+(i%7)*step}" width="10" height="10" rx="${options.rounded?2:0}" fill="${palette[Math.min(4,l)]??palette[0]}"/>`).join('');
  const snake=options.style==='snake'||options.style==='garden'||options.style==='pixel-trail';
  let actors='';
  if(snake && active.length) {
    const count=Math.min(options.trail,active.length);
    actors=Array.from({length:count},(_,n)=>{
      const i=active[(n+Math.floor(time/dur*active.length))%active.length]!, values=active.map(i=>`${left+Math.floor(i/7)*step},${top+(i%7)*step}`).join(';');
      return `<g opacity="${options.intensity*(1-n/(count+1))}" transform="translate(${left+Math.floor(i/7)*step},${top+(i%7)*step})"><rect width="10" height="10" rx="${options.style==='garden'?5:2}" fill="${palette[4]}"/>${animate?`<animateTransform attributeName="transform" type="translate" values="${values};${values.split(';')[0]}" dur="${dur}s" begin="-${n*dur/active.length}s" repeatCount="${options.loop?'indefinite':1}"/>`:''}</g>`;
    }).join('');
  } else {
    actors=active.filter((_,n)=>n%Math.max(1,Math.round(1/Math.max(.1,options.density)))===0).map((i,n)=>{
      const x=left+Math.floor(i/7)*step+5,y=top+i%7*step+5;
      let dx=0,dy=0;
      if(options.style==='rain')dy=18;
      if(options.style==='wave')dy=-5;
      if(options.style==='orbit'){dx=5;dy=-5;}
      if(options.style==='particles'){dx=(n%3-1)*8;dy=-12;}
      const line=options.style==='constellation'&&n>0?`<path d="M${x},${y} L${left+Math.floor(active[n-1]!/7)*step+5},${top+active[n-1]!%7*step+5}" stroke="${palette[4]}" opacity=".25"/>`:'';
      const phase=(Math.sin(time*options.speed*2+n*.13)+1)/2;
      return `${line}<circle cx="${x+dx*phase}" cy="${y+dy*phase}" r="${options.style==='fireflies'?2:3}" fill="${palette[4]}" opacity="${options.intensity*(.25+.75*phase)}">${animate?`<animate attributeName="opacity" values=".15;${options.intensity};.15" dur="${dur/3}s" begin="-${n*.13}s" repeatCount="${options.loop?'indefinite':1}"/><animateTransform attributeName="transform" type="translate" values="0,0;${dx},${dy};0,0" dur="${dur/3}s" begin="-${n*.13}s" repeatCount="${options.loop?'indefinite':1}"/>`:''}</circle>`;
    }).join('');
  }
  let months='';
  if(calendarStart){let previous=-1;for(let col=0;col<cols;col++){const date=new Date(calendarStart+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+col*7);if(date.getUTCMonth()!==previous){previous=date.getUTCMonth();months+=`<text x="${left+col*step}" y="14">${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][previous]}</text>`;}}}
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${safe(background)}"/><g font-family="Segoe UI,sans-serif" font-size="9" fill="#8b949e">${months}<text x="0" y="${top+20}">Mon</text><text x="0" y="${top+46}">Wed</text><text x="0" y="${top+72}">Fri</text><text x="${width-150}" y="${height-5}">Less</text><text x="${width-28}" y="${height-5}">More</text></g>${rects}${actors}${palette.map((c,i)=>`<rect x="${width-120+i*13}" y="${height-14}" width="10" height="10" rx="2" fill="${c}"/>`).join('')}</svg>`;
}
