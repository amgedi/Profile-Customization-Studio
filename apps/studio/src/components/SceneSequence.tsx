import type { Editor } from '../editor.js';
import { arrangeSequence, duplicateScene, sequenceScenes, startSequence } from '../sequence.js';
export function SceneSequence({editor}:{editor:Editor}) {
 const scenes=sequenceScenes(editor.doc),current=scenes.find(s=>editor.time>=(s.params.start??0)&&editor.time<(s.params.start??0)+(s.params.duration??8))??scenes[0];
 const commit=(doc:Editor['doc'])=>{editor.store.replaceDocument(doc,'Edit scene sequence');editor.setSaveState('unsaved');};
 return <div className="scene-sequence" aria-label="Scene sequence">
  {!scenes.length?<button className="btn" onClick={()=>commit(startSequence(editor.doc))}>+ Create scene tabs</button>:<>
   <div className="scene-sequence-tabs" role="tablist" aria-label="Timeline scenes">{scenes.map(scene=><button role="tab" aria-selected={scene.id===current?.id} key={scene.id} onClick={()=>{editor.setPlaying(false);editor.setTime(scene.params.start??0);editor.setSelectedId(scene.id);}}>{scene.name} · {scene.params.duration}s</button>)}</div>
   {current&&<><label>Name <input aria-label="Scene name" value={current.name} onChange={e=>commit(arrangeSequence(editor.doc,scenes.map(s=>s.id===current.id?{...s,name:e.target.value}:s)))}/></label><label>Duration <input aria-label="Scene duration" type="number" min=".5" max="120" step=".5" value={current.params.duration} onChange={e=>{const duration=Math.max(.5,Math.min(120,Number(e.target.value)||.5));commit(arrangeSequence(editor.doc,scenes.map(s=>s.id===current.id?{...s,params:{...s.params,duration}}:s)));editor.setTime(current.params.start??0);}}/></label><button className="btn" onClick={()=>{const next=arrangeSequence(editor.doc,[...scenes,duplicateScene(current)]);commit(next);const last=sequenceScenes(next).slice(-1)[0]!;editor.setTime(last.params.start??0);editor.setSelectedId(last.id);}}>+ Duplicate scene</button><button className="btn" disabled={scenes.indexOf(current)===0} onClick={()=>{const list=[...scenes],i=list.indexOf(current);[list[i-1],list[i]]=[list[i]!,list[i-1]!];commit(arrangeSequence(editor.doc,list));editor.setTime(0);}}>Move earlier</button><button className="btn" disabled={scenes.length===1} onClick={()=>{commit(arrangeSequence(editor.doc,scenes.filter(s=>s.id!==current.id)));editor.setTime(0);editor.setSelectedId(null);}}>Remove scene</button></>}
  </>}
 </div>;
}
