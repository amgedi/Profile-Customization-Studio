import {describe,it,expect} from 'vitest';
import {motionTiming} from '../src/motionExport.js';
describe('motion export timebase',()=>{
 it('covers a partial last frame without extending duration',()=>{const frames=motionTiming(1.05,10);expect(frames).toHaveLength(11);expect(frames[10]!.time).toBe(1);expect(frames.reduce((s,f)=>s+f.duration,0)).toBeCloseTo(1.05);});
 it('samples beginning and excludes duplicate loop endpoint',()=>{const frames=motionTiming(2,15);expect(frames[0]!.time).toBe(0);expect(frames.at(-1)!.time).toBeCloseTo(29/15);});
 it('rejects unbounded and invalid export workloads',()=>{for(const d of [NaN,Infinity,0,-1,61])expect(()=>motionTiming(d,15)).toThrow();for(const f of [0,31,1.5,NaN])expect(()=>motionTiming(1,f)).toThrow();});
});
