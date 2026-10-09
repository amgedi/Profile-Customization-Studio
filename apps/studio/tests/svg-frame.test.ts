import {describe,it,expect,vi} from 'vitest';
import {createSvgFrame} from '../src/svgFrame.js';
describe('sampled SVG frame lifetime',()=>{
 it('releases each replaced frame and the last frame without retaining a playback history',()=>{
  const live=new Set<string>();let serial=0;
  const create=vi.spyOn(URL,'createObjectURL').mockImplementation(()=>{const url='blob:frame-'+serial++;live.add(url);return url;});
  const revoke=vi.spyOn(URL,'revokeObjectURL').mockImplementation(url=>{live.delete(url);});
  try{let previous:ReturnType<typeof createSvgFrame>|undefined;for(let i=0;i<1000;i++){previous?.dispose();previous=createSvgFrame('<svg><text>'+i+'</text></svg>');expect(live.size).toBe(1);}previous?.dispose();expect(live.size).toBe(0);expect(revoke).toHaveBeenCalledTimes(1000);}finally{create.mockRestore();revoke.mockRestore();}
 });
 it('owns an SVG image blob and permits duplicate cleanup without revoking another frame',()=>{
  const create=vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:owned-frame');const revoke=vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
  try{const f=createSvgFrame('<svg/>');expect(create.mock.calls[0]![0]).toBeInstanceOf(Blob);expect((create.mock.calls[0]![0] as Blob).type).toBe('image/svg+xml');f.dispose();f.dispose();expect(revoke).toHaveBeenCalledOnce();expect(revoke).toHaveBeenCalledWith('blob:owned-frame');}finally{create.mockRestore();revoke.mockRestore();}
 });
});
