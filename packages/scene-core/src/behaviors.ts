/**
 * Animation behavior library — the beginner-facing motion model.
 * Each preset is a stackable behavior on a layer; `compileTracks` turns a
 * behavior stack into deterministic keyframe tracks with defined composition:
 *   - entrance occupies [0, e] of the scene timeline
 *   - loop behaviors cycle evenly across the whole duration
 *   - exit occupies the last portion of the timeline
 * When two behaviors animate the same property in the same window the later
 * behavior in the stack wins for that window (documented, never accidental).
 */
import type { BehaviorCategory, Keyframe, LayerBehavior, Track } from "@pcs/bannerspec";

export interface BehaviorPreset {
  id: string;
  name: string;
  category: BehaviorCategory;
  blurb: string;
  /** CSS keyframes used by animated preview tiles in the editor. */
  css: string;
  /** seconds an entrance takes at speed 1 (or loop cycle length). */
  baseDuration: number;
  make: (ctx: { x: number; y: number; opacity: number; duration: number; speed: number; amount: number }) => Track[];
}

const k = (t: number, value: number): Keyframe => ({ t, value });

export const BEHAVIOR_PRESETS: BehaviorPreset[] = [
  ...(['left','right','top','bottom'] as const).map(side => ({id:`wave-${side}`,name:`Wavy transparency · ${side}`,category:'loop' as const,blurb:`Soft animated transparency from the ${side} edge`,baseDuration:4,css:'',make:()=>[]})),
  // ---- entrance --------------------------------------------------------
  {
    id: "fade-in", name: "Fade In", category: "entrance", blurb: "Gently appears", baseDuration: 1.5,
    css: "@keyframes pcs-fade-in{from{opacity:0}to{opacity:1}}",
    make: ({ opacity, speed }) => [{ prop: "opacity", keys: [k(0, 0), k(1.5 / speed, opacity)] }],
  },
  {
    id: "rise", name: "Fade + Rise", category: "entrance", blurb: "Floats up into place", baseDuration: 1.3,
    css: "@keyframes pcs-rise{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:translateY(0)}}",
    make: ({ x, y, opacity, speed, amount }) => [
      { prop: "y", keys: [k(0, y + amount * 0.45), k(1.3 / speed, y)] },
      { prop: "opacity", keys: [k(0, 0), k(0.9 / speed, opacity)] },
    ],
  },
  {
    id: "slide-in", name: "Slide In", category: "entrance", blurb: "Slides in from the side", baseDuration: 1.2,
    css: "@keyframes pcs-slide-in{from{opacity:0;transform:translateX(-70px)}to{opacity:1;transform:translateX(0)}}",
    make: ({ x, opacity, speed, amount }) => [
      { prop: "x", keys: [k(0, x - amount * 1.2), k(1.2 / speed, x)] },
      { prop: "opacity", keys: [k(0, 0), k(0.7 / speed, opacity)] },
    ],
  },
  {
    id: "scale-in", name: "Scale In", category: "entrance", blurb: "Grows into place", baseDuration: 1.2,
    css: "@keyframes pcs-scale-in{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}",
    make: ({ opacity, speed }) => [{ prop: "opacity", keys: [k(0, 0), k(1.2 / speed, opacity)] }],
  },
  {
    id: "reveal", name: "Reveal", category: "entrance", blurb: "Fades in with a settle", baseDuration: 1.8,
    css: "@keyframes pcs-reveal{0%{opacity:0;transform:translateY(14px)}70%{opacity:1;transform:translateY(-5px)}100%{transform:translateY(0)}}",
    make: ({ y, opacity, speed }) => [
      { prop: "y", keys: [k(0, y + 16), k(1.3 / speed, y - 6), k(1.8 / speed, y)] },
      { prop: "opacity", keys: [k(0, 0), k(1 / speed, opacity)] },
    ],
  },
  // ---- loop -------------------------------------------------------------
  {
    id: "float", name: "Float", category: "loop", blurb: "Soft up-and-down drift", baseDuration: 4,
    css: "@keyframes pcs-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}",
    make: ({ y, speed, amount, duration }) => {
      const c = 4 / speed;
      const keys: Keyframe[] = [];
      for (let t = 0; t < duration; t += c)
        keys.push(k(t, y), k(Math.min(t + c / 2, duration), y - amount * 0.35), k(Math.min(t + c, duration), y));
      return [{ prop: "y", keys }];
    },
  },
  {
    id: "drift", name: "Drift", category: "loop", blurb: "Very gentle wandering", baseDuration: 6,
    css: "@keyframes pcs-drift{0%,100%{transform:translate(0,0)}33%{transform:translate(10px,-8px)}66%{transform:translate(-8px,6px)}}",
    make: ({ x, y, speed, amount, duration }) => {
      const c = 6 / speed;
      const tx: Keyframe[] = [], ty: Keyframe[] = [];
      for (let t = 0; t <= duration; t += c) {
        tx.push(k(t, x), k(Math.min(t + c / 3, duration), x + amount * 0.25));
        ty.push(k(t, y), k(Math.min(t + 2 * c / 3, duration), y - amount * 0.2));
      }
      return [{ prop: "x", keys: tx }, { prop: "y", keys: ty }];
    },
  },
  {
    id: "glow-pulse", name: "Glow Pulse", category: "loop", blurb: "Breathing brightness", baseDuration: 2,
    css: "@keyframes pcs-glow-pulse{0%,100%{opacity:1}50%{opacity:.55}}",
    make: ({ opacity, speed, duration }) => {
      const c = 2 / speed;
      const keys: Keyframe[] = [];
      for (let t = 0; t <= duration; t += c)
        keys.push(k(t, opacity), k(Math.min(t + c / 2, duration), Math.max(0.15, opacity * 0.5)));
      return [{ prop: "opacity", keys }];
    },
  },
  {
    id: "shimmer", name: "Shimmer", category: "loop", blurb: "Slow side-to-side shine", baseDuration: 3,
    css: "@keyframes pcs-shimmer{0%,100%{transform:translateX(0)}50%{transform:translateX(14px)}}",
    make: ({ x, speed, amount, duration }) => {
      const c = 3 / speed;
      const keys: Keyframe[] = [];
      for (let t = 0; t <= duration; t += c)
        keys.push(k(t, x), k(Math.min(t + c / 2, duration), x + amount * 0.2));
      return [{ prop: "x", keys }];
    },
  },
  {
    id: "wobble", name: "Wobble", category: "loop", blurb: "Gentle rocking tilt", baseDuration: 3,
    css: "@keyframes pcs-wobble{0%,100%{transform:rotate(0)}25%{transform:rotate(2deg)}75%{transform:rotate(-2deg)}}",
    make: ({ speed, duration }) => {
      const c = 3 / speed;
      const keys: Keyframe[] = [];
      for (let t = 0; t <= duration; t += c)
        keys.push(k(t, 0), k(Math.min(t + c / 4, duration), 2.5), k(Math.min(t + 3 * c / 4, duration), -2.5));
      return [{ prop: "rotation", keys }];
    },
  },
  // ---- exit ---------------------------------------------------------------
  {
    id: "fade-out", name: "Fade Out", category: "exit", blurb: "Slowly disappears", baseDuration: 1.5,
    css: "@keyframes pcs-fade-out{from{opacity:1}to{opacity:0}}",
    make: ({ opacity, speed, duration }) => [{ prop: "opacity", keys: [k(duration - 1.5 / speed, opacity), k(duration, 0)] }],
  },
  {
    id: "slide-out", name: "Slide Out", category: "exit", blurb: "Leaves to the side", baseDuration: 1.2,
    css: "@keyframes pcs-slide-out{from{transform:translateX(0)}to{transform:translateX(90px)}}",
    make: ({ x, speed, amount, duration }) => [{ prop: "x", keys: [k(duration - 1.2 / speed, x), k(duration, x + amount * 1.2)] }],
  },
  {
    id: "shrink-out", name: "Shrink", category: "exit", blurb: "Fades while leaving", baseDuration: 1.2,
    css: "@keyframes pcs-shrink-out{from{opacity:1}to{opacity:0;transform:scale(.8)}}",
    make: ({ opacity, speed, duration }) => [{ prop: "opacity", keys: [k(duration - 1.2 / speed, opacity), k(duration, 0)] }],
  },
  // ---- text ---------------------------------------------------------------
  {
    id: "typewriter", name: "Typewriter", category: "text", blurb: "Appears in steps, like being typed", baseDuration: 2,
    css: "@keyframes pcs-typewriter{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}",
    make: () => [],
  },
  {
    id: "wave", name: "Wave", category: "text", blurb: "Bobs up and down like a wave", baseDuration: 2.4,
    css: "@keyframes pcs-wave{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}",
    make: ({ y, speed, amount, duration }) => {
      const c = 2.4 / speed;
      const keys: Keyframe[] = [];
      for (let t = 0; t <= duration; t += c)
        keys.push(k(t, y), k(Math.min(t + c * 0.35, duration), y - amount * 0.2), k(Math.min(t + c * 0.7, duration), y + amount * 0.05));
      return [{ prop: "y", keys }];
    },
  },
  // ---- color --------------------------------------------------------------
  {
    id: "hue-cycle", name: "Hue Cycle", category: "color", blurb: "Colors slowly cycle through the rainbow", baseDuration: 8,
    css: "@keyframes pcs-hue-cycle{from{filter:hue-rotate(0)}to{filter:hue-rotate(360deg)}}",
    make: ({ speed, duration }) => {
      const c = 8 / speed;
      const keys: Keyframe[] = [];
      for (let t = 0, i = 0; t <= duration; t += c, i++)
        keys.push(k(t, i * 360), k(Math.min(t + c, duration), (i + 1) * 360));
      return [{ prop: "hue", keys }];
    },
  },
  {
    id: "color-pulse", name: "Color Pulse", category: "color", blurb: "Hue gently breathes back and forth", baseDuration: 3,
    css: "@keyframes pcs-color-pulse{0%,100%{filter:hue-rotate(0)}50%{filter:hue-rotate(40deg)}}",
    make: ({ speed, amount, duration }) => {
      const c = 3 / speed;
      const keys: Keyframe[] = [];
      for (let t = 0; t <= duration; t += c)
        keys.push(k(t, 0), k(Math.min(t + c / 2, duration), amount * 0.6), k(Math.min(t + c, duration), 0));
      return [{ prop: "hue", keys }];
    },
  },
  {
    id: "warm-shift", name: "Warm Shift", category: "color", blurb: "Drifts toward warm tones and back", baseDuration: 6,
    css: "@keyframes pcs-warm-shift{0%,100%{filter:hue-rotate(0)}50%{filter:hue-rotate(-25deg)}}",
    make: ({ speed, duration }) => {
      const c = 6 / speed;
      const keys: Keyframe[] = [];
      for (let t = 0; t <= duration; t += c)
        keys.push(k(t, 0), k(Math.min(t + c / 2, duration), -25), k(Math.min(t + c, duration), 0));
      return [{ prop: "hue", keys }];
    },
  },
  // ---- lighting -----------------------------------------------------------
  {
    id: "spotlight", name: "Spotlight", category: "lighting", blurb: "Brightens into focus, like a spotlight", baseDuration: 2,
    css: "@keyframes pcs-spotlight{from{opacity:.2}to{opacity:1}}",
    make: ({ opacity, speed, duration }) => {
      const t1 = Math.min(duration, 2 / speed);
      return [{ prop: "opacity", keys: [k(0, Math.min(opacity, 0.15)), k(t1, opacity), k(duration, opacity)] }];
    },
  },
  {
    id: "flicker", name: "Flicker", category: "lighting", blurb: "Irregular light flickers, like a neon tube", baseDuration: 2.5,
    css: "@keyframes pcs-flicker{0%,100%{opacity:1}10%{opacity:.4}20%{opacity:1}45%{opacity:.55}60%{opacity:1}75%{opacity:.7}}",
    make: ({ opacity, speed, duration }) => {
      const c = 2.5 / speed;
      const keys: Keyframe[] = [];
      for (let t = 0; t <= duration; t += c) {
        keys.push(
          k(t, opacity),
          k(Math.min(t + c * 0.15, duration), Math.max(0.2, opacity * 0.4)),
          k(Math.min(t + c * 0.35, duration), opacity),
          k(Math.min(t + c * 0.6, duration), Math.max(0.3, opacity * 0.6)),
          k(Math.min(t + c * 0.8, duration), opacity),
        );
      }
      return [{ prop: "opacity", keys }];
    },
  },
  {
    id: "pulse-glow", name: "Pulse Glow", category: "lighting", blurb: "Steady rhythmic brightening", baseDuration: 2,
    css: "@keyframes pcs-pulse-glow{0%,100%{opacity:1}50%{opacity:.6}}",
    make: ({ opacity, speed, duration }) => {
      const c = 2 / speed;
      const keys: Keyframe[] = [];
      for (let t = 0; t <= duration; t += c)
        keys.push(k(t, opacity), k(Math.min(t + c / 2, duration), Math.max(0.25, opacity * 0.55)), k(Math.min(t + c, duration), opacity));
      return [{ prop: "opacity", keys }];
    },
  },
  // ---- ambient ------------------------------------------------------------
  {
    id: "twinkle", name: "Twinkle", category: "ambient", blurb: "Sparkles softly on and off", baseDuration: 3,
    css: "@keyframes pcs-twinkle{0%,100%{opacity:.2}50%{opacity:1}}",
    make: ({ opacity, speed, duration }) => {
      const c = 3 / speed;
      const keys: Keyframe[] = [];
      for (let t = 0; t <= duration; t += c)
        keys.push(k(t, Math.min(opacity, 0.2)), k(Math.min(t + c * 0.5, duration), opacity), k(Math.min(t + c, duration), Math.min(opacity, 0.2)));
      return [{ prop: "opacity", keys }];
    },
  },
  {
    id: "sway", name: "Sway", category: "ambient", blurb: "Rocks gently like something in a breeze", baseDuration: 4,
    css: "@keyframes pcs-sway{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}",
    make: ({ speed, amount, duration }) => {
      const c = 4 / speed;
      const amp = Math.max(1.5, amount * 0.05);
      const keys: Keyframe[] = [];
      for (let t = 0; t <= duration; t += c)
        keys.push(k(t, -amp), k(Math.min(t + c / 2, duration), amp), k(Math.min(t + c, duration), -amp));
      return [{ prop: "rotation", keys }];
    },
  },
  {
    id: "breathe", name: "Breathe", category: "ambient", blurb: "A very slow calm scale of brightness", baseDuration: 7,
    css: "@keyframes pcs-breathe{0%,100%{opacity:1}50%{opacity:.75}}",
    make: ({ opacity, speed, duration }) => {
      const c = 7 / speed;
      const keys: Keyframe[] = [];
      for (let t = 0; t <= duration; t += c)
        keys.push(k(t, opacity), k(Math.min(t + c / 2, duration), Math.max(0.4, opacity * 0.75)), k(Math.min(t + c, duration), opacity));
      return [{ prop: "opacity", keys }];
    },
  },
];

export const behaviorById = (id: string): BehaviorPreset | undefined =>
  BEHAVIOR_PRESETS.find((b) => b.id === id);

/** Sample a keyframe list at time t (linear, clamped). */
function keysAt(keys: Keyframe[], t: number): number {
  const sorted = [...keys].sort((a, b) => a.t - b.t);
  if (sorted.length === 0) return 0;
  if (t <= sorted[0]!.t) return sorted[0]!.value;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!, b = sorted[i + 1]!;
    if (t >= a.t && t <= b.t) {
      const f = (t - a.t) / (b.t - a.t || 1);
      return a.value + (b.value - a.value) * f;
    }
  }
  return sorted[sorted.length - 1]!.value;
}

/**
 * Deterministic behavior-stack compiler.
 * Explicit hand-authored `tracks` always win; behaviors fill in the rest.
 * Later behaviors override earlier ones per (prop, time-window).
 */
export function compileTracks(layer: { tracks?: Track[]; behaviors?: LayerBehavior[]; x?: number; y?: number; opacity?: number }, duration: number): Track[] {
  if (!Number.isFinite(duration) || duration <= 0 || duration > 3600) throw new RangeError("Animation duration must be finite and at most one hour");
  const behaviors = (layer.behaviors ?? []).filter((b) => b.enabled !== false);
  for (const b of behaviors) if (!Number.isFinite(b.speed) || b.speed <= 0 || b.speed > 10 || duration * b.speed > 3600) throw new RangeError("Animation speed/key budget is out of bounds");
  if (behaviors.length === 0) return layer.tracks ?? [];
  // merge all behavior tracks; later entries win per prop (array order)
  const byProp = new Map<string, Track>();
  for (const b of behaviors) {
    const preset = behaviorById(b.preset);
    if (!preset) continue;
    for (const tr of preset.make({
      x: layer.x ?? 0, y: layer.y ?? 0, opacity: layer.opacity ?? 1,
      duration, speed: b.speed || 1, amount: b.amount ?? 60,
    })) {
      const delayed: Track = { ...tr };
      // delay: shift the whole behavior later in time
      const d = b.delay ?? 0;
      if (d > 0) delayed.keys = delayed.keys.map((key) => ({ ...key, t: key.t + d }));
      // loops: finite cycle count — hold the last value after the cutoff
      const loops = b.loops;
      if (loops !== undefined && Number.isFinite(loops) && loops > 0 && preset.category !== "entrance" && preset.category !== "exit") {
        const cutoff = d + loops * (preset.baseDuration / (b.speed || 1));
        if (cutoff < duration) {
          const held = keysAt(delayed.keys, cutoff);
          delayed.keys = [
            ...delayed.keys.filter((key) => key.t <= cutoff),
            k(cutoff, held),
          ];
        }
      }
      const earlier=byProp.get(delayed.prop);
      if(earlier&&delayed.prop==='opacity'&&preset.category==='exit'){
        const start=Math.min(...delayed.keys.map(k=>k.t));delayed.keys=[...earlier.keys.filter(k=>k.t<start),...delayed.keys];
      }else if(earlier&&delayed.prop==='opacity'&&preset.category==='entrance'){
        const end=Math.max(...delayed.keys.map(k=>k.t));delayed.keys=[...delayed.keys,...earlier.keys.filter(k=>k.t>end)];
      }
      byProp.set(delayed.prop, delayed);
    }
  }
  // explicit tracks are authoritative for props they touch
  const explicitProps = new Set<string>((layer.tracks ?? []).map((t) => t.prop));
  const compiled = [...byProp.entries()].filter(([prop]) => !explicitProps.has(prop)).map(([, t]) => t);
  // sort each track's keys and clamp to [0, duration]
  for (const t of compiled) {
    const keys=t.keys.map(key=>({...key,t:Math.max(0,Math.min(duration,key.t))}));
    t.keys=[...new Map(keys.map(key=>[key.t,key])).values()].sort((a,b)=>a.t-b.t);
  }
  return [...compiled, ...(layer.tracks ?? [])];
}
