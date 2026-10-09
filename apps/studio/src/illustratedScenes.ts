import { linear, type BannerSpecDocument, type Layer } from '@pcs/bannerspec';
import type { SceneEntry } from './sceneLibrary.js';
/** Original editable environment illustrations. No downloaded or franchise artwork. */
function environment(kind:string,W:number,H:number,seed=1):BannerSpecDocument {
 let serial=0;const night=!['hills','shrine','lake','rooftop'].includes(kind),snow=kind==='snow';
 const doc:BannerSpecDocument={specVersion:'0.3',canvas:{width:W,height:H,background:night?'#111e38':'#efb6ad'},layers:[],animation:{duration:12,loop:true}};
 const layer=(name:string,type:string,x:number,y:number,w:number,h:number,color:string,extra:object={})=>doc.layers.push({id:`illustration-${seed}-${serial++}`,name,type,visible:true,locked:false,opacity:1,rotation:0,x:x*W,y:y*H,width:w*W,height:h*H,fill:{type:'solid',color},...extra} as Layer);
 const rect=(name:string,x:number,y:number,w:number,h:number,c:string,extra:object={})=>layer(name,'rect',x,y,w,h,c,extra);
 const oval=(name:string,x:number,y:number,w:number,h:number,c:string,extra:object={})=>layer(name,'ellipse',x,y,w,h,c,extra);
 rect('Painted sky',0,0,1,1,'#141e38',{fill:linear([{offset:0,color:night?'#10162e':'#7d9ac6'},{offset:.65,color:night?'#35466b':'#efb5b4'},{offset:1,color:night?'#ac6d87':'#f9d3ae'}],90)});
 oval(night?'Moon':'Evening sun',.72,.12,.07,.14,night?'#f9e5bf':'#ffdeaf',{effects:[{id:'sun-glow',type:'glow',visible:true,color:'#f8ceaf',params:{amount:12}}]});
 for(let i=0;i<5;i++)oval('Long cloud',.05+i*.2,.15+(i%3)*.07,.2,.045,night?'#53627d':'#f3d5c8',{opacity:.45});
 if(['street','cyber','rooftop','bedroom'].includes(kind)){
  for(let i=0;i<13;i++){
   const x=i/12,h=.12+((i*17+seed)%7)*.035;
   rect('Distant building',x,.61-h,.085,h,night?'#24334e':'#776f8c');
   for(let j=0;j<4;j++)for(let k=0;k<3;k++)if((i+j+k)%3!==0)rect('Window light',x+.012+k*.02,.63-h+j*.045,.008,.012,kind==='cyber'?'#72e7f5':'#f3c383',{opacity:.65});
  }
 }else{
  for(let i=0;i<5;i++)oval('Distant rolling ridge',-.15+i*.27,.43+(i%2)*.05,.48,.55,i%2?'#5a7080':'#6b7f97');
  for(let i=0;i<4;i++)oval('Near hillside',-.18+i*.37,.61+(i%2)*.04,.6,.6,snow?'#c5d5df':kind==='hills'?'#516e59':'#354b54');
 }
 if(['street','cyber'].includes(kind)){
  rect('Wet street',0,.77,1,.23,'#172035');
  for(let side=0;side<2;side++){
   const x=side?.78:0;rect('Shop front',x,.32,.22,.48,side?'#344156':'#3b344c');
   rect('Lit shop window',x+.025,.46,.16,.25,kind==='cyber'?'#286c86':'#d39974');
   rect('Awning',x-.01,.39,.24,.055,kind==='cyber'?'#d45ba9':'#925e70');
   for(let j=0;j<4;j++)rect('Store reflection',x+.03+j*.04,.83,.025,.09,'#eab6a2',{opacity:.16});
   rect('Sign board',x+.04,.25,.12,.065,kind==='cyber'?'#7e347e':'#e4b188',{cornerRadius:4});
  }
  rect('Lamp post',.7,.3,.008,.5,'#142031');oval('Lantern',.674,.28,.06,.08,'#fbd0a3',{effects:[{id:'lamp-glow',type:'glow',visible:true,color:'#ffd5ae',params:{amount:16}}]});
 }else if(kind==='train'){
  rect('Train interior top',0,0,1,.12,'#29384a');rect('Window sill',0,.76,1,.08,'#a48675');rect('Train seat',0,.84,1,.16,'#323b53');
  for(const x of [0,.47,.96])rect('Window frame',x,.1,.04,.67,'#334054');
  rect('Hand rail',.1,.04,.8,.015,'#c7aa85');
 }else if(kind==='bedroom'){
  rect('Bedroom wall',0,0,.22,1,'#282940');rect('Window top',.22,0,.78,.08,'#292b40');rect('Window bottom',.22,.66,.78,.07,'#403644');rect('Window mullion',.62,.08,.014,.58,'#33364c');
  rect('Desk surface',.09,.77,.82,.045,'#a77967');rect('Desk leg',.14,.8,.025,.2,'#4e3d44');rect('Desk leg',.84,.8,.025,.2,'#4e3d44');
  rect('Monitor body',.38,.53,.22,.2,'#171e2e',{cornerRadius:8});rect('Monitor screen',.393,.547,.194,.17,'#527c8d');rect('Monitor stand',.48,.73,.025,.04,'#242d3c');
  rect('Bed',.72,.9,.28,.1,'#84728b');oval('Pillow',.76,.86,.18,.08,'#cdb8bf');
  rect('Lamp stem',.23,.58,.008,.18,'#d4ad83');oval('Warm lampshade',.185,.53,.1,.08,'#f2c091');
 }else if(kind==='shrine'){
  rect('Shrine path',.43,.72,.14,.28,'#c4aa94');
  for(const x of [.31,.67])rect('Torii upright',x,.36,.025,.4,'#a34e43');
  rect('Torii crossbeam',.27,.36,.46,.035,'#a34e43');rect('Torii crown',.24,.31,.52,.035,'#493b43',{rotation:-2});
  for(const x of [.13,.83]){rect('Tree trunk',x,.4,.028,.48,'#594954');for(let j=0;j<4;j++)oval('Cherry blossom canopy',x-.1+j*.03,.23+(j%2)*.06,.19,.22,'#dba6b2');}
 }else if(kind==='rooftop'){
  rect('Rooftop floor',0,.79,1,.21,'#4b4d61');rect('Roof ledge',0,.68,1,.035,'#796977');
  for(let i=0;i<12;i++)rect('Safety railing',i/11,.54,.006,.15,'#655c73');rect('Top rail',0,.54,1,.008,'#655c73');
  rect('Water tank',.08,.35,.13,.26,'#6b697e',{cornerRadius:12});for(const x of [.1,.18])rect('Tank support',x,.61,.012,.18,'#4b495c');
 }else if(kind==='lake'){
  rect('Still lake',0,.68,1,.32,'#5b7f91');for(let i=0;i<12;i++)rect('Water glimmer',.35+(i%4)*.06,.71+i*.02,.16,.003,'#dfc7bb',{opacity:.45});
  rect('Pier',.03,.91,.4,.035,'#64535c');for(const x of [.08,.34])rect('Pier post',x,.88,.015,.12,'#423f4c');
 }else if(kind==='snow'){
  rect('Cabin wall',.63,.58,.22,.24,'#71565a');rect('Snow roof',.6,.52,.28,.075,'#e6ebeb',{rotation:-5});rect('Warm cabin window',.69,.64,.08,.09,'#edbd86');
  rect('Chimney',.8,.44,.025,.1,'#72636a');
 }else if(kind==='hills'){
  rect('Country road',.05,.85,.9,.035,'#b7ab8a',{rotation:-5});rect('Fence rail',.05,.76,.8,.012,'#e1ccaa');for(let i=0;i<11;i++)rect('Fence post',.06+i*.076,.74,.008,.08,'#e1ccaa');
 }
 const weather=kind==='street'?'rain-fx':snow?'snow-fx':kind==='shrine'?'leaves-fx':'dust-fx';
 rect('Ambient atmosphere',0,0,1,1,'#00000000',{effects:[{id:'atmosphere',type:weather,visible:true,color:snow?'#f2f6ff':kind==='shrine'?'#f5cad9':'#d2bba6',params:{amount:kind==='street'?36:18,speed:.5,wind:.1,sizeMax:2}}]});
 return doc;
}
const definitions=[['street','Rain after Midnight','Rainy shopfronts and warm reflections'],['train','Last Train Home','Mountain views framed by a quiet carriage'],['rooftop','Rooftop at Dusk','Sunset skyline, water tank and railings'],['shrine','Sakura Courtyard','A torii gate beneath original blossom canopies'],['hills','Country Evening','Rolling green hills and a winding fence'],['bedroom','Blue Hour Bedroom','Window skyline, a warm desk and a resting space'],['cyber','Neon Side Street','Luminous storefronts in a futuristic lane'],['snow','Snowfall Cabin','Warm windows beneath a snowy roof'],['lake','Evening on the Lake','Quiet water, moonlight and a wooden pier']];
export const ILLUSTRATED_SCENES:SceneEntry[]=definitions.map(([kind,name,blurb])=>({id:`illustrated-${kind}`,name:name!,category:'Anime inspired',blurb:blurb!,tags:['illustrated','anime','environment',kind!,'lofi'],animationLevel:'subtle',supportsVariation:true,make:(W,H)=>environment(kind!,W,H),makeWithSeed:seed=>(W,H)=>environment(kind!,W,H,seed)}));
