import { getToken } from './connection.js';
import type { StatsField } from './stats.js';
export type DataStatus = 'live' | 'cached' | 'preview' | 'manual' | 'error';
export interface ContributionDay { date: string; count: number; level: number; weekday: number }
export interface GitHubRepo { name: string; fullName: string; description: string | null; stars: number; language: string | null; htmlUrl: string; updatedAt: string; fork: boolean }
export interface GitHubUser {
  login: string; name: string | null; bio: string | null; avatarUrl: string | null;
  followers: number; publicRepos: number; starsTotal: number | null; repos: GitHubRepo[];
  reposComplete: boolean; publicEvents: number | null; pullRequests: number | null;
  calendar: ContributionDay[] | null; calendarError?: string; fetchedAt: number;
}
const CACHE_KEY = 'pcs-gh-cache-v2', TTL = 600000;
function read(): Record<string, GitHubUser> { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; } }
export function profileStats(user: GitHubUser): StatsField[] {
  const languages=new Map<string,number>();for(const repo of user.repos)if(repo.language)languages.set(repo.language,(languages.get(repo.language)??0)+1);
  return [ {key:'repos',label:'Public repositories',value:user.publicRepos},
    {key:'followers',label:'Followers',value:user.followers},
    ...(user.starsTotal === null ? [] : [{key:'stars',label:user.reposComplete ? 'Stars across public repositories' : 'Stars in loaded repositories',value:user.starsTotal}]),
    ...(user.pullRequests === null ? [] : [{key:'prs',label:'Public pull requests authored',value:user.pullRequests}]),
    ...[...languages].sort((a,b)=>b[1]-a[1]).slice(0,4).map(([name,count])=>({key:'language-'+name,label:name+' · loaded repos',value:count})),
    ...(user.publicEvents === null ? [] : [{key:'activity',label:'Recent public events (up to 100)',value:user.publicEvents}]) ];
}
export const GitHubDataProvider = {
  cachedFor(username: string): GitHubUser | null { return read()[username.trim().replace(/^@/,'').toLowerCase()] ?? null; },
  clearCache() { localStorage.removeItem(CACHE_KEY); localStorage.removeItem('pcs-gh-cache'); },
  async fetchUser(username: string, opts: {refresh?: boolean} = {}): Promise<{user: GitHubUser | null; status: DataStatus; error?: string}> {
    const login = username.trim().replace(/^@/,'');
    if (!login || login === 'yourname') return {user:null,status:'preview'};
    if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(login)) return {user:null,status:'error',error:'Enter a valid GitHub username.'};
    const hit = this.cachedFor(login);
    if (hit && !opts.refresh && Date.now()-hit.fetchedAt<TTL) return {user:hit,status:'cached'};
    const token = await getToken();
    const headers: Record<string,string> = {Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28', ...(token ? {Authorization:`Bearer ${token}`} : {})};
    async function api(path: string, body?: object) {
      const response = await fetch(`https://api.github.com/${path}`, {headers, signal:AbortSignal.timeout(20000), ...(body ? {method:'POST',body:JSON.stringify(body)} : {})});
      if (!response.ok) throw new Error(response.status===404 ? 'GitHub account not found.' : response.status===403||response.status===429 ? 'GitHub rate limit reached. Try again later.' : `GitHub returned ${response.status}.`);
      return response.json();
    }
    try {
      const j = await api(`users/${login}`);
      const repos: GitHubRepo[] = []; let complete = false, repoError = false;
      try {
        for(let page=1;page<=10;page++) {
          const list = await api(`users/${login}/repos?per_page=100&sort=full_name&type=owner&page=${page}`) as any[];
          repos.push(...list.map(r=>({name:r.name,fullName:r.full_name,description:r.description,stars:r.stargazers_count,language:r.language,htmlUrl:r.html_url,updatedAt:r.updated_at,fork:r.fork})));
          if(list.length<100) { complete=true; break; }
        }
      } catch { repoError=true; }
      let publicEvents: number|null=null, pullRequests: number|null=null;
      const optional = await Promise.allSettled([api(`users/${login}/events/public?per_page=100`),api(`search/issues?q=${encodeURIComponent(`is:pr author:${login}`)}&per_page=1`)]);
      if(optional[0].status==='fulfilled') publicEvents=optional[0].value.length;
      if(optional[1].status==='fulfilled' && !optional[1].value.incomplete_results) pullRequests=optional[1].value.total_count;
      let calendar: ContributionDay[]|null=null, calendarError='Connect an optional GitHub token in Settings → GitHub to read the contribution calendar. Public events are not a calendar.';
      if(token) {
        try {
          const graph = await api('graphql',{query:'query($login:String!) { user(login:$login) { contributionsCollection { contributionCalendar { weeks { contributionDays { date contributionCount contributionLevel weekday } } } } } }',variables:{login}});
          if(graph.errors?.length || !graph.data?.user) throw new Error('GitHub did not grant calendar access. Check token permissions.');
          const levels=['NONE','FIRST_QUARTILE','SECOND_QUARTILE','THIRD_QUARTILE','FOURTH_QUARTILE'];
          calendar=graph.data.user.contributionsCollection.contributionCalendar.weeks.flatMap((w:any)=>w.contributionDays.map((d:any)=>({date:d.date,count:d.contributionCount,level:Math.max(0,levels.indexOf(d.contributionLevel)),weekday:d.weekday})));
          calendarError='';
        } catch(e) { calendarError=(e as Error).message; }
      }
      const user:GitHubUser={login:j.login,name:j.name,bio:j.bio,avatarUrl:j.avatar_url,followers:j.followers,publicRepos:j.public_repos,starsTotal:repoError?null:repos.reduce((s,r)=>s+r.stars,0),repos,reposComplete:complete&&!repoError,publicEvents,pullRequests,calendar,calendarError,fetchedAt:Date.now()};
      try { const cache=read(); cache[login.toLowerCase()]=user; localStorage.setItem(CACHE_KEY,JSON.stringify(cache)); } catch { /* live data still usable */ }
      return {user,status:'live',...(repoError?{error:'Repository totals are unavailable; profile data loaded.'}:{})};
    } catch(e) { return hit ? {user:hit,status:'cached',error:`${(e as Error).message} Showing saved data.`} : {user:null,status:'error',error:(e as Error).message}; }
  }
};
export function formatCount(n:number):string { return n>=1000?`${(n/1000).toFixed(n>=10000?0:1)}k`:String(n); }
