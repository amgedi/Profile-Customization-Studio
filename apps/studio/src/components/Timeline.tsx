import { useCallback, useEffect, useRef } from "react";
import { Pause, Play, Plus, RotateCcw } from "lucide-react";
import type { AnimatableProp, Layer, Track } from "@pcs/bannerspec";
import type { Editor } from "../editor.js";

const PROPS: Array<{ id: AnimatableProp; label: string }> = [
  { id: "x", label: "X" },
  { id: "y", label: "Y" },
  { id: "rotation", label: "Rotation" },
  { id: "opacity", label: "Opacity" },
  { id: "width", label: "Width" },
  { id: "height", label: "Height" },
];

type Pose = Layer & { x: number; y: number; opacity: number };
const PRESETS: Array<{ label: string; make: (layer: Pose) => Track[] }> = [
  {
    label: "Fade In",
    make: (l: Pose) => [{ prop: "opacity", keys: [{ t: 0, value: 0 }, { t: 1.5, value: l.opacity }] }],
  },
  {
    label: "Slide In",
    make: (l) => [
      { prop: "x", keys: [{ t: 0, value: l.x - 120 }, { t: 1.2, value: l.x }] },
      { prop: "opacity", keys: [{ t: 0, value: 0 }, { t: 0.8, value: 1 }] },
    ],
  },
  {
    label: "Float",
    make: (l) => [{ prop: "y", keys: [{ t: 0, value: l.y }, { t: 2, value: l.y - 12 }, { t: 4, value: l.y }] }],
  },
  {
    label: "Pulse",
    make: (l) => [{ prop: "opacity", keys: [{ t: 0, value: l.opacity }, { t: 1, value: l.opacity * 0.6 }, { t: 2, value: l.opacity }] }],
  },
  {
    label: "Breathing Glow",
    make: (l) => [
      { prop: "opacity", keys: [{ t: 0, value: 0.75 }, { t: 1.5, value: 1 }, { t: 3, value: 0.75 }] },
    ],
  },
  {
    label: "Spin",
    make: (l) => [{ prop: "rotation", keys: [{ t: 0, value: l.rotation }, { t: 4, value: l.rotation + 360 }] }],
  },
];

export function Timeline({ editor }: { editor: Editor }) {
  const { doc, selected, setTime, time, playing, setPlaying, store } = editor;
  const duration = doc.animation?.duration ?? 8;
  const trackRef = useRef<HTMLDivElement>(null);
  const layer = selected;

  const timeFromEvent = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return time;
      const r = el.getBoundingClientRect();
      return Math.max(0, Math.min(duration, ((clientX - r.left) / r.width) * duration));
    },
    [duration, time],
  );

  const addTrack = (prop: AnimatableProp) => {
    if (!layer || layer.type === "group") return;
    const value = (layer as unknown as Record<string, number>)[prop] ?? 0;
    const track: Track = { prop, keys: [{ t: 0, value }, { t: duration, value }] };
    store.setTracks(layer.id, [...(layer.tracks ?? []), track]);
  };

  const updateKey = (trackIdx: number, keyIdx: number, patch: { t?: number; value?: number }) => {
    if (!layer) return;
    const tracks = (layer.tracks ?? []).map((t, ti) =>
      ti === trackIdx
        ? { ...t, keys: t.keys.map((k, ki) => (ki === keyIdx ? { ...k, ...patch } : k)) }
        : t,
    );
    store.setTracks(layer.id, tracks);
  };

  const removeKey = (trackIdx: number, keyIdx: number) => {
    if (!layer) return;
    const tracks = (layer.tracks ?? [])
      .map((t, ti) => (ti === trackIdx ? { ...t, keys: t.keys.filter((_, ki) => ki !== keyIdx) } : t))
      .filter((t) => t.keys.length > 0);
    store.setTracks(layer.id, tracks);
  };

  const px = (t: number) => `${(t / duration) * 100}%`;

  return (
    <div className="timeline" role="region" aria-label="Motion timeline">
      <div className="timeline-toolbar">
        <button className="icon-btn" title={playing ? "Pause" : "Play"} aria-label={playing ? "Pause" : "Play"}
          onClick={() => setPlaying(!playing)}>
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button className="icon-btn" title="Restart" aria-label="Restart" onClick={() => { setPlaying(false); setTime(0); }}>
          <RotateCcw size={13} />
        </button>
        <span className="timeline-time">{time.toFixed(2)}s / {duration}s</span>
        <span className="tb-sep" />
        <span className="timeline-label">Duration</span>
        <input
          className="field-input" type="number" min={0.5} step={0.5} disabled={doc.layers.some(l=>l.type==="group"&&l.params?.sequence===1)} style={{ width: 64 }}
          value={duration}
          onChange={(e) => { const v = parseFloat(e.target.value); if (v > 0) store.setAnimation({ duration: v }); }}
          aria-label="Animation duration"
        />
        <label className="timeline-label">
          <input type="checkbox" checked={doc.animation?.loop ?? true}
            onChange={(e) => store.setAnimation({ loop: e.target.checked })} /> Loop
        </label>
        <span className="spacer" />
        <span className="timeline-label">{layer ? `Editing: ${layer.name}` : "Select a layer to animate it"}</span>
      </div>

      {layer && (
        <div className="timeline-presets">
          <span className="timeline-label">Presets</span>
          {PRESETS.map((p) => (
            <button key={p.label} className="btn ghost" onClick={() => store.setTracks(layer.id, p.make(layer as Pose))}>
              {p.label}
            </button>
          ))}
        </div>
      )}

      <div className="timeline-body">
        <div className="timeline-ruler" role="slider" aria-label="Timeline playhead" tabIndex={0} aria-valuemin={0} aria-valuemax={duration} aria-valuenow={time} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();setPlaying(false);setTime(e.key==='Home'?0:e.key==='End'?duration:Math.max(0,Math.min(duration,time+(e.key==='ArrowRight'?.1:-.1))));}}}
          ref={trackRef}
          onPointerDown={(e) => {
            setPlaying(false);setTime(timeFromEvent(e.clientX));
            const move = (ev: PointerEvent) => setTime(timeFromEvent(ev.clientX));
            const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          }}
        >
          <span className="playhead" style={{ left: px(time) }} />
        </div>

        {(layer?.tracks ?? []).map((track, ti) => (
          <div key={track.prop} className="timeline-track">
            <span className="track-label">{PROPS.find((p) => p.id === track.prop)?.label ?? track.prop}</span>
            <div className="track-lane" onPointerDown={(e) => setTime(timeFromEvent(e.clientX))}>
              {track.keys.map((k, ki) => (
                <button
                  key={ki}
                  className="keyframe"
                  style={{ left: px(k.t) }}
                  title={`${track.prop} = ${k.value.toFixed(2)} @ ${k.t.toFixed(2)}s (drag to move, double-click to delete)`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const lane = (e.currentTarget as HTMLElement).parentElement!;
                    const move = (ev: PointerEvent) => {
                      const r = lane.getBoundingClientRect();
                      updateKey(ti, ki, { t: Math.max(0, Math.min(duration, ((ev.clientX - r.left) / r.width) * duration)) });
                    };
                    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
                    window.addEventListener("pointermove", move);
                    window.addEventListener("pointerup", up);
                  }}
                  onDoubleClick={(e) => { e.stopPropagation(); removeKey(ti, ki); }}
                />
              ))}
            </div>
            <span className="track-value">
              {(() => {
                const keys = [...track.keys].sort((a, b) => a.t - b.t);
                const k = keys.find((kk) => kk.t >= time) ?? keys[keys.length - 1];
                return k ? k.value.toFixed(1) : "—";
              })()}
            </span>
          </div>
        ))}

        {layer && (
          <div className="timeline-track add-track">
            <span className="track-label">Add</span>
            <div className="track-lane">
              {PROPS.filter((p) => !(layer.tracks ?? []).some((t) => t.prop === p.id)).map((p) => (
                <button key={p.id} className="btn ghost" onClick={() => addTrack(p.id)}>
                  <Plus size={11} /> {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {!layer && (
          <p className="empty-hint">Select a layer, then add tracks or use a motion preset.</p>
        )}
      </div>
    </div>
  );
}
