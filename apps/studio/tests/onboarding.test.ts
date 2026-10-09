import { describe, it, expect, vi } from 'vitest';
const persistence=vi.hoisted(()=>({loadJSON:vi.fn(),saveJSON:vi.fn()}));
vi.mock('../src/storage.js',()=>persistence);
import { needsTutorial, rememberTutorial, validTutorialState } from '../src/onboarding.js';
describe('Startup tutorial persistence',()=>{
 it('offers a tutorial on first run and with malformed state',async()=>{for(const state of [null,{},true,{version:1,status:'unknown'},{version:2,status:'completed'}]){persistence.loadJSON.mockResolvedValue(state);expect(await needsTutorial()).toBe(true);}});
 it('respects completion and the expert skip choice on subsequent starts',async()=>{for(const status of ['completed','skipped']){persistence.loadJSON.mockResolvedValue({version:1,status});expect(await needsTutorial()).toBe(false);}});
 it('stores completion and skip separately through native-aware storage',async()=>{persistence.saveJSON.mockResolvedValue(true);for(const status of ['completed','skipped'] as const){expect(await rememberTutorial(status)).toBe(true);expect(persistence.saveJSON).toHaveBeenLastCalledWith('tutorial',{version:1,status});}});
 it('remembers an immediate reload even before a native file write finishes',async()=>{const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v)});persistence.saveJSON.mockResolvedValue(false);expect(await rememberTutorial('completed')).toBe(true);expect(await needsTutorial()).toBe(false);vi.unstubAllGlobals();});
 it('does not claim persistence when writing fails',async()=>{persistence.saveJSON.mockResolvedValue(false);expect(await rememberTutorial('completed')).toBe(false);expect(validTutorialState({version:1,status:'completed'})).toBe(true);});
});
