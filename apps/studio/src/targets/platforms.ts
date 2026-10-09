import { TARGET_REGISTRY, getTarget, type TargetDef, type SafeArea } from './registry.js';
export type Access = 'OFFICIAL_PUBLIC_API'|'OFFICIAL_OAUTH'|'USER_AUTHORIZED'|'PUBLIC_SUPPORTED'|'MANUAL_ONLY'|'UNAVAILABLE'|'UNVERIFIED';
export type PreviewKind = 'github'|'discord'|'youtube'|'twitch'|'x'|'linkedin'|'bluesky'|'facebook'|'creator'|'portfolio'|'readme'|'reddit'|'avatar'|'article'|'placement';
export interface PlatformDefinition {
 id:string; name:string; icon:string; target:TargetDef; level:'A'|'B'|'C'; renderer:PreviewKind;
 designTypes:('banner'|'avatar'|'readme'|'article'|'placement')[]; avatar:boolean; banner:boolean;
 structure:string[]; modes:('desktop'|'mobile'|'tv'|'card')[]; importAccess:Access; importMechanism:string;
 video:'UNAVAILABLE'|'UNVERIFIED'; svg:'SUPPORTED'|'UNAVAILABLE'|'UNVERIFIED'; gif:'SUPPORTED'|'UNAVAILABLE'|'UNVERIFIED';
 durationSeconds:number|null; maximumDimensions:{width:number;height:number}|null; help:string;
}
const ALIASES:Record<string,string>={'github-profile':'github-profile-readme','github-repo':'github-repo-social',discord:'discord-profile-banner',youtube:'youtube-channel-banner',x:'x-profile-header',twitch:'twitch-profile-banner',custom:'custom-target'};
export function canonicalTarget(id?:string){return id?(ALIASES[id]??id):'github-repo-social';}
function definition(t:TargetDef):PlatformDefinition {
 const id=t.id;let renderer:PreviewKind='placement',level:'A'|'B'|'C'='C';
 if(id==='github-profile-readme'){renderer='github';level='A';}
 else if(/profile-photo|avatar/.test(id)){renderer='avatar';}
 else if(id==='discord-profile-banner'||id==='discord-server-profile'){renderer='discord';level='B';}
 else if(id==='youtube-channel-banner'){renderer='youtube';level='B';}
 else if(id==='twitch-profile-banner'){renderer='twitch';level='B';}
 else if(id==='x-profile-header'){renderer='x';level='B';}
 else if(id==='linkedin-background'){renderer='linkedin';level='B';}
 else if(id==='bluesky-header'){renderer='bluesky';level='B';}
 else if(id==='facebook-cover'){renderer='facebook';level='B';}
 else if(id==='kofi-cover'||id==='patreon-cover'){renderer='creator';level='B';}
 else if(id==='behance-banner'||id==='artstation-background'){renderer='portfolio';level='B';}
 else if(id.includes('readme')){renderer='readme';}
 else if(id.startsWith('reddit')){renderer='reddit';}
 else if(id.includes('article')){renderer='article';}
 const gif=t.animatedFormats.includes('gif')?(t.animationSupport==='native'?'SUPPORTED':'UNVERIFIED'):'UNAVAILABLE';
 return {id,name:t.displayName,icon:renderer,target:t,level,renderer,designTypes:[renderer==='avatar'?'avatar':renderer==='readme'||renderer==='github'?'readme':renderer==='article'?'article':level==='C'?'placement':'banner'],avatar:level!=='C'||renderer==='avatar',banner:renderer!=='avatar',structure:renderer==='discord'?['name','handle','pronouns','bio','featured']:renderer==='youtube'?['name','handle','bio','links','featured']:level==='B'?['name','handle','bio','links']:[],modes:renderer==='youtube'?['desktop','mobile','tv']:renderer==='discord'?['card','mobile']:renderer==='avatar'?['card']:['desktop','mobile'],importAccess:level==='A'?'OFFICIAL_PUBLIC_API':'MANUAL_ONLY',importMechanism:level==='A'?'GitHub official REST API; optional user token for contribution calendar. GitHub has no native banner API.':'User-entered profile fields and user-selected local images. No automatic account import.',video:'UNAVAILABLE',svg:t.staticFormats.includes('svg')?'UNVERIFIED':'UNAVAILABLE',gif,durationSeconds:null,maximumDimensions:null,help:level==='C'?'Placement/format illustration; not a full account reconstruction.':level==='A'?'Connected GitHub profile README. Banner is your current PCS design, not a fetched native GitHub banner.':'Manual profile approximation. Platform layout, badges and crops may change; verify the uploaded result.'};
}
export const PLATFORMS:PlatformDefinition[]=TARGET_REGISTRY.map(definition);
export function getPlatform(id?:string){const key=canonicalTarget(id);return PLATFORMS.find(p=>p.id===key)??PLATFORMS.find(p=>p.id==='custom-target')!;}
export function visibleArea(p:PlatformDefinition,mode:string):SafeArea {
 const {width:w,height:h}=p.target.recommended;
 if(p.renderer==='youtube'&&mode!=='tv'){const safe=p.target.safeAreas[0];if(safe)return mode==='mobile'?safe:{x:0,y:safe.y,width:w,height:safe.height};}
 return {x:0,y:0,width:w,height:h};
}
export function registryProblems(){return PLATFORMS.flatMap(p=>!getTarget(p.id)||!p.renderer||!p.level||!p.importMechanism?[p.id]:[]);}
