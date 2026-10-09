import {beforeEach,describe,expect,it,vi} from 'vitest';
vi.mock('../src/github/connection.js',()=>({getToken:vi.fn(async()=>null)}));
import {GitHubDataProvider,profileStats} from '../src/github/provider.js';
import {getToken} from '../src/github/connection.js';
import {renderCalendarGame,DEFAULT_GAME} from '../src/github/games.js';
import {ILLUSTRATED_SCENES} from '../src/illustratedScenes.js';
import {validateBannerSpec,hasErrors} from '@pcs/bannerspec';
import {planConversion} from '../src/targets/convert.js';
import {getTarget} from '../src/targets/registry.js';
beforeEach(()=>{const m=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>m.set(k,v),removeItem:(k:string)=>m.delete(k)});vi.mocked(getToken).mockResolvedValue(null);});
const repo=(n:number)=>({name:'r'+n,full_name:'alice/r'+n,stargazers_count:2,html_url:'https://github.com/alice/r'+n});
it('paginates repository totals and caches by normalized account without inventing a calendar',async()=>{
 const urls:string[]=[];vi.stubGlobal('fetch',vi.fn(async(url:string)=>{urls.push(url);let data:unknown={login:'alice',name:'Alice',followers:7,public_repos:102};if(url.includes('/repos?'))data=new URL(url).searchParams.get('page')==='1'?Array.from({length:100},(_,i)=>repo(i)):[repo(100),repo(101)];if(url.includes('/events/'))data=[];if(url.includes('/search/'))data={total_count:3,incomplete_results:false};return {ok:true,json:async()=>data};}));
 const result=await GitHubDataProvider.fetchUser('Alice');expect(result.user?.starsTotal).toBe(204);expect(result.user?.reposComplete).toBe(true);expect(result.user?.calendar).toBeNull();expect(urls.some(u=>u.includes('page=2'))).toBe(true);expect((await GitHubDataProvider.fetchUser('alice')).status).toBe('cached');expect(urls).toHaveLength(5);
});
it('omits unavailable metrics instead of representing failures as zero',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>url.endsWith('/users/bob')?{ok:true,json:async()=>({login:'bob',public_repos:2,followers:4})}:{ok:false,status:403}));
 const r=await GitHubDataProvider.fetchUser('bob');expect(r.user).not.toBeNull();expect(r.user?.starsTotal).toBeNull();expect(profileStats(r.user!).map(f=>f.key)).toEqual(['repos','followers']);
});
it('uses authenticated contribution levels, rather than public event counts',async()=>{
 vi.mocked(getToken).mockResolvedValue('test-token');vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:true,json:async()=>url.endsWith('/graphql')?{data:{user:{contributionsCollection:{contributionCalendar:{weeks:[{contributionDays:[{date:'2026-10-01',weekday:4,contributionCount:8,contributionLevel:'THIRD_QUARTILE'}]}]}}}}}:url.includes('/repos?')||url.includes('/events/')?[]:url.includes('/search/')?{total_count:0}: {login:'carol',followers:0,public_repos:0}})));
 const r=await GitHubDataProvider.fetchUser('carol');expect(r.user?.calendar?.[0]).toEqual({date:'2026-10-01',weekday:4,count:8,level:3});
});
it('calendar rendering follows active data and samples the shared playback time',()=>{
 const levels=[0,1,0,4,0,2,0];const start=renderCalendarGame(levels,DEFAULT_GAME,'#161b22',false,0);expect(start).not.toEqual(renderCalendarGame(levels,DEFAULT_GAME,'#161b22',false,5));expect(renderCalendarGame(Array(7).fill(0),DEFAULT_GAME,'#161b22',true)).not.toContain('animateTransform');
});
it('illustrated environments validate and survive project serialization',()=>{for(const s of ILLUSTRATED_SCENES){const d=s.make(1280,640);expect(hasErrors(validateBannerSpec(JSON.parse(JSON.stringify(d)))),s.id).toBe(false);expect(d.layers.length).toBeGreaterThan(20);}});
it('framing overrides keep focal points inside the source and preserve the master',()=>{
 const d=ILLUSTRATED_SCENES[0]!.make(1280,640),snapshot=JSON.stringify(d);const t=getTarget('x-profile-header')!;
 const left=planConversion(d,t,{focalY:0}),right=planConversion(d,t,{focalY:1});expect(left.crop!.y).toBe(0);expect(right.crop!.y+right.crop!.height).toBeLessThanOrEqual(640);expect(planConversion(d,t,{scaleMode:'fit'}).crop).toBeUndefined();expect(JSON.stringify(d)).toBe(snapshot);
});

it('exports an operational calendar workflow using the same renderer',async()=>{
 const {generateWorkflowYaml}=await import('../src/github/readme.js');
 const yaml=generateWorkflowYaml('alice');expect(yaml).toContain('api.github.com/graphql');expect(yaml).toContain('secrets.GITHUB_TOKEN');expect(yaml).not.toContain('Placeholder hook');
 const script=yaml.split("node --input-type=module <<'PCS_NODE'\n")[1]!.split('          PCS_NODE')[0]!.split('\n').map(l=>l.slice(10)).join('\n').replace("import { mkdir, writeFile } from 'node:fs/promises';",'const mkdir=()=>{},writeFile=()=>{};');
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;expect(()=>new AsyncFunction(script)).not.toThrow();
});
