import {parseAppearance,paletteContrast} from './appearance.js';
import { type AppPrefs } from './prefs.js';
export type StudioThemeId='graphite'|'midnight'|'oled'|'frost'|'cyber'|'forest'|'warm'|'studio-light'|'terminal'|'slate'|'plum'|'espresso';
export interface StudioTheme {id:StudioThemeId;name:string;root:string;panel:string;raised:string;canvas:string;text:string;muted:string;border:string;accent:string;light?:boolean}
export const STUDIO_THEMES:StudioTheme[]=[
{id:'slate',name:'Slate',root:'#141b21',panel:'#1d2830',raised:'#293944',canvas:'#0d1318',text:'#edf3f6',muted:'#a5b9c7',border:'#3c515f',accent:'#7cc8cf'},
{id:'plum',name:'Plum',root:'#1b1420',panel:'#281e2e',raised:'#392c41',canvas:'#110d15',text:'#f4edf6',muted:'#c4adc9',border:'#56405d',accent:'#d7a3dd'},
{id:'espresso',name:'Espresso',root:'#191512',panel:'#28211b',raised:'#3b3026',canvas:'#100d0b',text:'#f5ecde',muted:'#cab69a',border:'#574634',accent:'#daba8a'},
{id:'graphite',name:'Graphite',root:'#202124',panel:'#292b2f',raised:'#33363c',canvas:'#161719',text:'#eef0f3',muted:'#b0b5bf',border:'#40444c',accent:'#b6c6ff'},
{id:'midnight',name:'Midnight',root:'#111729',panel:'#18223a',raised:'#23304c',canvas:'#0a1020',text:'#e7edff',muted:'#a3b3d5',border:'#314363',accent:'#8dafff'},
{id:'oled',name:'OLED',root:'#050505',panel:'#0b0b0b',raised:'#191919',canvas:'#000000',text:'#f2f2f2',muted:'#ababab',border:'#303030',accent:'#efefef'},
{id:'frost',name:'Frost',root:'#e6edf1',panel:'#f4f8fa',raised:'#ffffff',canvas:'#d4e0e7',text:'#203340',muted:'#516c7c',border:'#bbced9',accent:'#176e9a',light:true},
{id:'cyber',name:'Cyber',root:'#151020',panel:'#21172e',raised:'#2f2240',canvas:'#0c0813',text:'#f3eaff',muted:'#bba6ce',border:'#483256',accent:'#eb78e0'},
{id:'forest',name:'Forest',root:'#17231e',panel:'#21322a',raised:'#2c4236',canvas:'#101a15',text:'#e6f4e9',muted:'#a5c2b1',border:'#405d4b',accent:'#9bd5ac'},
{id:'warm',name:'Warm Studio',root:'#28211e',panel:'#352b25',raised:'#44382f',canvas:'#1b1613',text:'#f6eee4',muted:'#c4ae99',border:'#5a493d',accent:'#e8bb88'},
{id:'studio-light',name:'Studio Light',root:'#eeeff2',panel:'#ffffff',raised:'#f5f5f8',canvas:'#dfe1e7',text:'#242731',muted:'#656b79',border:'#caced7',accent:'#5c51ba',light:true},
{id:'terminal',name:'Terminal',root:'#0c1712',panel:'#11241b',raised:'#193328',canvas:'#060e0a',text:'#d9f6df',muted:'#91b69d',border:'#2e5140',accent:'#70df98'}];
export function applyStudioTheme(p:AppPrefs) {
 const theme=STUDIO_THEMES.find(t=>t.id===p.appTheme)??STUDIO_THEMES[0]!;
 let light=p.theme==='light'||(p.theme==='system'?matchMedia('(prefers-color-scheme: light)').matches:theme.light);
 let t=light&&!theme.light?{...theme,root:'#edf0f3',panel:'#ffffff',raised:'#f4f6f8',canvas:'#dce1e7',text:'#202a34',muted:'#556473',border:'#c7d0da',accent:theme.id==='oled'?'#303030':'#3567a5'}:theme;
 const appearance=parseAppearance(p.customAppearance);
 if(appearance.enabled){const c=appearance.palette.colors;t={...t,root:c.root??t.root,panel:c.panel??t.panel,raised:c.panel??t.raised,canvas:c.root??t.canvas,text:c.text??t.text,border:c.border??t.border,accent:c.accent??t.accent};if(paletteContrast(t.text,t.panel)<4.5)t.text=paletteContrast('#ffffff',t.panel)>paletteContrast('#111111',t.panel)?'#ffffff':'#111111';if(paletteContrast(t.text,t.root)<4.5)t.root=t.panel;t.canvas=t.root;t.muted=t.text;light=paletteContrast("#111111",t.panel)>paletteContrast("#ffffff",t.panel);}
 const vars:Record<string,string>={'bg-root':t.root,'bg-panel':t.panel,'bg-raised':t.raised,'bg-workspace':t.canvas,'bg-hover':`color-mix(in srgb, ${t.raised} 85%, ${t.text})`,'bg-input':t.root,'text-primary':t.text,'text-secondary':t.muted,'text-muted':t.muted,'border-subtle':t.border,'border-strong':`color-mix(in srgb, ${t.border} 80%, ${t.text})`,'accent':p.accent||t.accent,'accent-hover':p.accent||t.accent,'accent-text':light?'#ffffff':'#111820','accent-soft':`color-mix(in srgb, ${p.accent||t.accent} 16%, transparent)`,'bg-selected':`color-mix(in srgb, ${p.accent||t.accent} 16%, transparent)`};
 if(p.contrast==='high'||p.highContrast){vars['border-subtle']=t.muted;vars['text-muted']=t.text;vars['text-secondary']=t.text;}
 if(p.contrast==='low')vars['border-subtle']=`color-mix(in srgb, ${t.border} 55%, ${t.panel})`;
 for(const [k,v] of Object.entries(vars)) document.documentElement.style.setProperty(`--pcs-${k}`,v);
 const root=document.documentElement,reduced=p.highContrast||appearance.reduceTransparency||matchMedia('(prefers-reduced-transparency: reduce)').matches;
 root.style.setProperty('--pcs-ui-glow',appearance.enabled?(appearance.palette.colors.glow??t.accent):t.accent);
 root.style.setProperty('--pcs-panel-opacity',String(reduced?1:appearance.opacity));root.style.setProperty('--pcs-panel-blur',`${appearance.blur}px`);
 const background=appearance.enabled&&appearance.palette.background&&!((p.reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches)&&appearance.palette.background.startsWith('data:image/gif'))?appearance.palette.background:'';
 root.dataset.studioBackground=background?'true':'false';
 root.style.setProperty('--pcs-studio-image',background?`url("${background}")`:'none');
 root.dataset.surface=reduced?'solid':appearance.surface==='acrylic'?'solid':appearance.surface;
 root.style.colorScheme=light?'light':'dark';
 const style=reduced?'solid':appearance.surface;
 if('__TAURI_INTERNALS__'in window){const key=style+':'+t.root;if(root.dataset.materialRequest!==key){root.dataset.materialRequest=key;void import('@tauri-apps/api/core').then(({invoke})=>invoke<string>('window_material',{style,tint:t.root})).then(result=>{if(root.dataset.materialRequest===key){root.dataset.surface=result==='acrylic'?'acrylic':style==='acrylic'?'solid':style;const el=document.getElementById('window-material-status');if(el)el.textContent=result==='acrylic'?'Windows acrylic active.':style==='acrylic'?'Native material unavailable; solid fallback active.':'Solid desktop window; panel styling applies inside Studio.';}}).catch(()=>{root.dataset.surface=style==='acrylic'?'solid':style;});}}

}
