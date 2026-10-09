import {StudioSelect} from './StudioSelect.js';
import { TargetCapabilities } from "./TargetCapabilities.js";
import { getTarget, TARGET_REGISTRY } from "../targets/registry.js";
import { SceneSequence } from "./SceneSequence.js";
import { sceneGroup, sequenceScenes } from "../sequence.js";
import { useState } from "react";
import { ChevronRight, Plus, Trash2, Pause, Play, RotateCcw, Eye, EyeOff } from "lucide-react";
import type { Layer, LayerBehavior } from "@pcs/bannerspec";
import { BEHAVIOR_PRESETS, type BehaviorPreset } from "@pcs/scene-core";
import type { Editor } from "../editor.js";
import { Timeline } from "./Timeline.js";
import { SliderField } from "./SliderField.js";
import { CanvasWorkspace } from "./CanvasWorkspace.js";
import { AnimationBrowserModal, AnimationKeyframes, makeBehavior } from "./AnimationBrowser.js";
import { notify } from "./Toasts.js";
import "../styles/effects.css";

const D = 8; // scene duration base

const STACK_GROUPS: Array<{ id: string; label: string }> = [
  { id: "entrance", label: "Entrance" },
  { id: "loop", label: "Continuous" },
  { id: "color", label: "Color & Light" },
  { id: "lighting", label: "Color & Light" },
  { id: "text", label: "Text" },
  { id: "ambient", label: "Ambient" },
  { id: "exit", label: "Exit" },
];

function behaviorToTracks(preset: BehaviorPreset, l: Layer & { x: number; y: number; opacity: number }, speed: number, amount: number, duration: number) {
  return preset.make({ x: l.x ?? 0, y: l.y ?? 0, opacity: l.opacity ?? 1, duration, speed, amount });
}

export function AnimateWorkspace({ editor }: { editor: Editor }) {
  const { selected, store, doc, experience } = editor;
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const dur = doc.animation?.duration ?? D;

  const behaviors = (selected?.behaviors ?? []) as LayerBehavior[];

  const patchStack = (stack: LayerBehavior[]) => {
    if (!selected) return;
    store.updateLayer(selected.id, { behaviors: stack } as never);
    editor.setSaveState("unsaved");
  };

  // R31 — duplicates are never created. Adding a motion the element already
  // has opens that row's settings instead.
  const addBehavior = (p: BehaviorPreset) => {
    if (!selected || selected.locked) return;
    const existing = behaviors.find((b) => b.preset === p.id);
    if (existing) {
      setEditId(existing.id);
      notify("info", `${p.name} is already on this element`, "Adjusted its settings instead — no duplicate added.");
      return;
    }
    patchStack([...behaviors, makeBehavior(p)]);
  };

  const previewPreset = (p: BehaviorPreset) => {
    // Scrub the canvas through this behavior without touching the stack,
    // then leave playback running so the motion is visible.
    if (!selected || selected.locked) return;
    const tracks = behaviorToTracks(p, selected as Layer & { x: number; y: number; opacity: number }, 1, 60, dur);
    const t0 = tracks.flatMap((t) => t.keys.map((k) => k.t));
    const start = Math.min(...(t0.length ? t0 : [0]));
    editor.setPlaying(true);
    editor.setTime(Math.max(0, start));
  };

  const playing = editor.playing;
  const quick = experience !== "advanced";

  // R32 — the stack renders grouped: Entrance / Continuous / Color & Light /
  // Text / Ambient / Exit, instead of one long list.
  const groupedStack = STACK_GROUPS
    .map((g) => ({ ...g, rows: behaviors.map((b, i) => ({ b, i })).filter(({ b }) => b.category === g.id) }))
    .filter((g) => g.rows.length > 0);

  return (
    <div className="animate-workspace">
      <AnimationKeyframes />
      <div className="animate-side" style={{ width: editor.leftWidth }}>
        <header className="panel-header">
          <h2>Animate</h2>
        </header>
        <p className="animate-tagline">Animate a layer or the whole banner. Scene tabs play one after another.</p>
        <div className="panel-body">
          <button className="btn" onClick={()=>{
 const scenes=sequenceScenes(doc),scene=scenes.find(s=>editor.time>=(s.params.start??0)&&editor.time<(s.params.start??0)+(s.params.duration??8));
 if(scene){const existing=scene.children.find(l=>l.type==='group'&&l.name==='Whole scene');if(existing){editor.setSelectedId(existing.id);return;}const group=sceneGroup({...doc,canvas:{...doc.canvas,background:undefined},layers:scene.children});store.updateLayer(scene.id,{children:[group]} as never);editor.setSelectedId(group.id);}
 else {const existing=doc.layers.find(l=>l.type==='group'&&l.name==='Whole scene');if(existing){editor.setSelectedId(existing.id);return;}const group=sceneGroup(doc);store.replaceDocument({...doc,canvas:{...doc.canvas,background:undefined},layers:[group]},'Animate whole scene');editor.setSelectedId(group.id);}
 editor.setSaveState('unsaved');
}}>Animate whole banner</button><p className="paint-hint">Select a layer for individual motion, or use Animate whole banner for fades and transparency across everything.</p><details><summary>Where will this banner go?</summary><StudioSelect aria-label="Motion export target" value={editor.exportTargetId} onChange={e=>editor.setExportTargetId(e.target.value)}>{TARGET_REGISTRY.map(t=><option key={t.id} value={t.id}>{t.displayName}</option>)}</StudioSelect><TargetCapabilities target={getTarget(editor.exportTargetId)??TARGET_REGISTRY[0]!}/></details><SceneSequence editor={editor}/>
          {selected && (
            <>
              <p className="paint-hint">
                {behaviors.length === 0
                  ? "Not animated yet — pick a motion to add. You can stack several."
                  : `${behaviors.length} animation${behaviors.length > 1 ? "s" : ""} on this element.`}
              </p>

              {/* ---- the stack, grouped by behavior family (R32) ---- */}
              <div className="anim-stack">
                {groupedStack.map((g) => (
                  <div key={g.id} className="anim-stack-group">
                    <div className="anim-stack-group-label">{g.label}</div>
                    {g.rows.map(({ b, i }) => {
                      const p = BEHAVIOR_PRESETS.find((x) => x.id === b.preset);
                      const editing = editId === b.id;
                      return (
                        <div key={b.id} className="anim-stack-row" data-disabled={b.enabled ? undefined : "true"}>
                          <button className="icon-btn" title={b.enabled ? "Disable" : "Enable"} onClick={() => patchStack(behaviors.map((x, j) => (j === i ? { ...x, enabled: !x.enabled } : x)))}>
                            {b.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
                          </button>
                          <button className="anim-stack-name" onClick={() => setEditId(editing ? null : b.id)}>
                            <span style={{ opacity: b.enabled ? 1 : 0.5 }}>{p?.name ?? b.preset}</span>
                          </button>
                          <button className="icon-btn" title="Remove" onClick={() => patchStack(behaviors.filter((_, j) => j !== i))}>
                            <Trash2 size={12} />
                          </button>
                          {editing && (
                            <div className="anim-stack-edit">
                              <SliderField label="Speed" value={b.speed} min={0.25} max={3} step={0.05} defaultValue={1}
                                lowLabel="Slow" highLabel="Fast" format={(v) => `${v.toFixed(2)}×`}
                                onChange={(v) => patchStack(behaviors.map((x, j) => (j === i ? { ...x, speed: v } : x)))} />
                              <SliderField label="Strength" value={b.amount} min={10} max={200} step={5} defaultValue={60}
                                lowLabel="Subtle" highLabel="Strong" format={(v) => `${Math.round(v)}px`}
                                onChange={(v) => patchStack(behaviors.map((x, j) => (j === i ? { ...x, amount: v } : x)))} />
                              <SliderField label="Delay" value={b.delay ?? 0} min={0} max={dur} step={0.1} defaultValue={0}
                                lowLabel="Start" highLabel="Later" format={(v) => `${v.toFixed(1)}s`}
                                onChange={(v) => patchStack(behaviors.map((x, j) => (j === i ? { ...x, delay: v } : x)))} />
                              <SliderField label="Loop" value={b.loops ?? 0} min={0} max={10} step={1} defaultValue={0}
                                lowLabel="Always" highLabel="Few" format={(v) => (v === 0 ? "whole scene" : `${v}×`)}
                                onChange={(v) => patchStack(behaviors.map((x, j) => (j === i ? { ...x, loops: v === 0 ? undefined : v } : x)))} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              <button className="btn primary" style={{ width: "100%" }} onClick={() => setAddOpen(true)}>
                <Plus size={13} /> Add Animation
              </button>

              {quick && (
                <p className="paint-hint" style={{ marginTop: 8 }}>
                  Choose a motion card to preview it, then press <strong>Apply</strong>. You can stack entrance, continuous and exit motion.
                </p>
              )}

              {/* Advanced: precise keyframes — hidden behind a plain-language
                  disclosure in every mode so raw track counts never show. */}

            </>
          )}
        </div>
      </div>

      <div className="animate-canvas">
        <CanvasWorkspace editor={editor} svgOverride={undefined} />
        <div className="animate-transport"><strong role="status">{playing ? "Playing" : "Paused"}</strong><StudioSelect aria-label="Playback speed" value={editor.playbackRate} onChange={e=>editor.setPlaybackRate(Number(e.target.value))}>{[.25,.5,1,1.5,2].map(v=><option key={v} value={v}>{v}×</option>)}</StudioSelect>
          <button className="icon-btn" aria-label={playing ? "Pause" : "Play"} onClick={() => editor.setPlaying(!playing)}>
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button className="icon-btn" aria-label="Restart" onClick={() => { editor.setPlaying(false); editor.setTime(0); }}>
            <RotateCcw size={12} />
          </button>
          <input aria-label="Scrub animation" type="range" min="0" max={dur} step="0.01" value={editor.time} onChange={e=>{editor.setPlaying(false);editor.setTime(+e.target.value);}}/><span className="timeline-time">{editor.time.toFixed(2)}s / {dur}s</span>
        </div>
      </div>

      <section className="motion-bottom" aria-label="Animation timeline">
        <header><strong>Timeline</strong><label>Zoom <input aria-label="Timeline zoom" type="range" min="1" max="5" step=".25" value={timelineZoom} onChange={e=>setTimelineZoom(Number(e.target.value))}/></label><span>Select a layer to edit its keyframes. Scene tabs play in order.</span><button className="btn" aria-pressed={showAdvanced} onClick={()=>setShowAdvanced(!showAdvanced)}>{showAdvanced ? "Overview" : "Keyframe editor"}</button></header>
        <div className="motion-track-scroll"><div className="motion-track-list" style={{minWidth: `${timelineZoom*100}%`}}><div className="motion-ruler" onClick={e=>{const bounds=e.currentTarget.getBoundingClientRect();editor.setPlaying(false);editor.setTime(Math.max(0,Math.min(dur,(e.clientX-bounds.left)/bounds.width*dur)));}}>{Array.from({length:Math.min(41,Math.ceil(dur)+1)},(_,i)=><span key={i}>{(i*dur/Math.min(40,Math.ceil(dur))).toFixed(1)}s</span>)}<i style={{left:`${editor.time/dur*100}%`}}/></div>{doc.layers.map(layer=><button key={layer.id} className="motion-layer-track" aria-pressed={selected?.id===layer.id} onClick={()=>editor.setSelectedId(layer.id)}><strong>{layer.name || layer.type}</strong><span>{layer.behaviors?.length || 0} motions · {layer.tracks?.length || 0} tracks</span><div className="motion-key-strip">{(layer.tracks??[]).flatMap(track=>track.keys.map((key,i)=><i key={track.prop+i} title={`${track.prop}: ${key.value} at ${key.t}s`} style={{left:`${Math.max(0,Math.min(100,key.t/dur*100))}%`}}/>))}</div></button>)}</div></div>
        {showAdvanced && <Timeline editor={editor}/>}
      </section>
      {/* Floating frosted animation browser — hover previews, + applies. */}
      {addOpen && (
        <AnimationBrowserModal
          editor={editor}
          onAdd={(p) => { addBehavior(p); setAddOpen(false); }}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}

export function PlaybackBar({ editor }: { editor: Editor }) {
  const dur = editor.doc.animation?.duration ?? 8;
  return (
    <div className="playback-bar">
      <button className="icon-btn" aria-label={editor.playing ? "Pause" : "Play"} onClick={() => editor.setPlaying(!editor.playing)}>
        {editor.playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <button className="icon-btn" aria-label="Restart" onClick={() => { editor.setPlaying(false); editor.setTime(0); }}>
        <RotateCcw size={12} />
      </button>
      <input aria-label="Scrub animation" type="range" min="0" max={dur} step="0.01" value={editor.time} onChange={e=>{editor.setPlaying(false);editor.setTime(+e.target.value);}}/><span className="timeline-time">{editor.time.toFixed(2)}s / {dur}s</span>
    </div>
  );
}
