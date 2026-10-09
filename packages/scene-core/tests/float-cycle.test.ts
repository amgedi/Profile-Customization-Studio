import { expect, it } from 'vitest';
import { compileTracks } from '../src/behaviors.js';
it('Float returns to its starting position without a half-cycle hold', () => {
 const [track] = compileTracks({y:64,behaviors:[{id:'test',preset:'float',category:'loop',enabled:true,speed:1,amount:60}]},4);
 expect(track?.keys).toEqual([{t:0,value:64},{t:2,value:43},{t:4,value:64}]);
});
