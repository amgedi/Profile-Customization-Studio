import {FileDropZone} from './FileDropZone.js';
import { ColorField } from "./controls.js";
/**
 * Guide Me — the seller-feature creation wizard.
 *
 * Unlike a mock-up flow, every choice here operates ON THE REAL EDITOR
 * project: the chosen scene is generated into a baseline BannerSpec document,
 * and each later step (palette / ambience / details / animation) re-derives
 * that baseline and loads it into the live SceneStore. "Customize More" just
 * closes the wizard — the user is already looking at their real project in
 * the Design workspace. No separate fake renderer, no throwaway state.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { renderSvg, behaviorById } from "@pcs/scene-core";
import { insertAtmosphere } from "../atmosphere.js";
import { EFFECT_PRESETS } from "../effects.js";
import { PLATFORMS, canonicalTarget, getPlatform } from "../targets/platforms.js";
import { TargetCapabilities } from "./TargetCapabilities.js";
import { useReducedMotion } from "../useReducedMotion.js";
import { SCENE_LIBRARY, type SceneEntry } from "../sceneLibrary.js";
import { scenePoster, svgToInline } from "../thumbnails.js";
import type { Editor } from "../editor.js";
import type { BannerSpecDocument, Layer, LayerBehavior, SolidPaint } from "@pcs/bannerspec";
import type { GroupKind } from "@pcs/bannerspec";
import type { ReadmeModel, SectionType } from "../github/readme.js";

// ---------------------------------------------------------------- helpers (exported for tests)

export type VibeId =
  | "cozy" | "lofi" | "nature" | "dark" | "cyber" | "minimal"
  | "retro" | "cute" | "professional" | "edgy" | "animated" | "anime" | "cinematic" | "developer" | "gaming";

export interface Vibe {
  id: VibeId;
  label: string;
  blurb: string;
  swatches: [string, string, string];
}

export const VIBES: Vibe[] = [
 {id:'cinematic',label:'Cinematic',blurb:'Wide skies, depth and atmosphere',swatches:['#172035','#a77967','#fbd0a3']},
 {id:'developer',label:'Developer',blurb:'Terminal type and structured layouts',swatches:['#08150d','#39d353','#d7efde']},
 {id:'gaming',label:'Gaming',blurb:'Arcade shapes and neon contrast',swatches:['#130f29','#ed6fcb','#7dd3fc']},
  { id: "cozy", label: "Cozy", blurb: "Warm, rainy, homey", swatches: ["#3d2c52", "#e0704a", "#ffe9b0"] },
  { id: "lofi", label: "Lofi", blurb: "Chill night-desk moods", swatches: ["#0e1730", "#5b8cff", "#8b93a1"] },
  { id: "nature", label: "Nature", blurb: "Forests, lakes, skies", swatches: ["#122416", "#34d399", "#e7f5e1"] },
  { id: "dark", label: "Dark", blurb: "Deep, calm, moody", swatches: ["#060812", "#4c1d95", "#a9b4c7"] },
  { id: "cyber", label: "Cyber", blurb: "Neon grids and glow", swatches: ["#04070d", "#38bdf8", "#ff4fd8"] },
  { id: "minimal", label: "Minimal", blurb: "Clean and quiet", swatches: ["#0a0a0a", "#ffffff", "#8b93a1"] },
  { id: "retro", label: "Retro", blurb: "Terminals and arcade", swatches: ["#050a06", "#39d353", "#ffd88a"] },
  { id: "cute", label: "Cute", blurb: "Pastel and playful", swatches: ["#f9a8d4", "#c4b5fd", "#a5f3fc"] },
  { id: "professional", label: "Professional", blurb: "Polished and confident", swatches: ["#0a0c14", "#5b8cff", "#c4a5ff"] },
  { id: "edgy", label: "Edgy", blurb: "Sharp, bold, dramatic", swatches: ["#070404", "#ef4444", "#c084fc"] },
  { id: "animated", label: "Animated", blurb: "Things that move", swatches: ["#0c0e16", "#22d3ee", "#f472b6"] },
];

/** Non-experimental scenes matching a vibe, in a beginner-friendly order. */
export function vibeScenes(vibe: VibeId): SceneEntry[] {
  const pool = SCENE_LIBRARY.filter((s) => !s.experimental);
  const byIds = (ids: string[]) => ids.map((id) => pool.find((s) => s.id === id)).filter((s): s is SceneEntry => !!s);
  let out: SceneEntry[] = [];
  switch (vibe) {
    case 'anime': out=pool.filter(s=>s.tags.includes('anime'));break;
    case 'cinematic': out=pool.filter(s=>s.tags.includes('environment')||s.tags.includes('ocean'));break;
    case 'developer': out=byIds(['retro-terminal','editorial-black','glass-aurora']);break;
    case 'gaming': out=byIds(['illustrated-cyber','retro-terminal','illustrated-street']);break;
    case "cozy":
      out = pool.filter((s) => s.category === "Cozy" || s.tags.includes("cozy"));
      break;
    case "lofi":
      out = byIds(["lofi-rain-city-night", "lofi-night-train", "lofi-space-desk", "lofi-ocean-sunset", "lofi-snow-cabin"]);
      break;
    case "nature":
      out = pool.filter((s) => s.category === "Nature" || s.tags.includes("nature") || s.tags.includes("fog"));
      break;
    case "dark":
      out = pool.filter((s) => s.category === "Dark" || s.tags.includes("dark"));
      break;
    case "cyber":
      out = byIds(["glass-aurora", "retro-terminal", "northern-lights", "starry-night", "minimal-gradient"]);
      break;
    case "minimal":
      out = pool.filter((s) => s.category === "Modern" || s.tags.includes("minimal"));
      break;
    case "retro":
      out = byIds(["retro-terminal", "glass-aurora", "starry-night", "firefly-forest", "editorial-black"]);
      break;
    case "cute":
      out = pool.filter((s) => s.category === "Cute" || s.tags.includes("cute") || s.tags.includes("pastel"));
      break;
    case "professional":
      out = byIds(["editorial-black", "glass-aurora", "minimal-gradient", "northern-lights", "lofi-ocean-sunset"]);
      break;
    case "edgy":
      out = byIds(["purple-smoke", "starry-night", "editorial-black", "retro-terminal", "firefly-forest"]);
      break;
    case "animated":
      out = pool.filter((s) => s.animationLevel === "animated");
      break;
  }
  // Fallback: if the mapping is thin, show the first six non-experimental scenes.
  if (out.length < 3) {
    return [...out,...pool.filter(s=>!out.some(o=>o.id===s.id))].slice(0,6);
  }
  return out.slice(0, 5);
}

export type AnimLevel = "still" | "subtle" | "animated" | "lively";

export interface AnimStep {
  preset: string;
  category: "entrance" | "loop";
  speed: number;
  amount: number;
}

/**
 * Curated beginner animation stacks (real LayerBehavior preset ids from
 * scene-core's behavior library):
 *   still → none; subtle → fade+rise; animated → + float; lively → + glow pulse.
 */
export function animationStack(level: AnimLevel): AnimStep[] {
  switch (level) {
    case "still":
      return [];
    case "subtle":
      return [{ preset: "rise", category: "entrance", speed: 1, amount: 40 }];
    case "animated":
      return [
        { preset: "rise", category: "entrance", speed: 1, amount: 40 },
        { preset: "float", category: "loop", speed: 1, amount: 30 },
      ];
    case "lively":
      return [
        { preset: "rise", category: "entrance", speed: 1.2, amount: 50 },
        { preset: "float", category: "loop", speed: 1.2, amount: 40 },
        { preset: "glow-pulse", category: "loop", speed: 1, amount: 20 },
      ];
  }
}

export interface Palette {
  id: string;
  label: string;
  blurb: string;
  swatches: [string, string, string];
  text: string;
  accent: string;
  muted: string;
}

export const PALETTES: Palette[] = [
  { id: "warm-night", label: "Warm Night", blurb: "Browns and amber lamp light", swatches: ["#2b1d12", "#e0a458", "#f5e8d8"], text: "#f5e8d8", accent: "#e0a458", muted: "#b9a58f" },
  { id: "ocean", label: "Ocean", blurb: "Cool blues and sea foam", swatches: ["#0a1f33", "#5b8cff", "#eaf6ff"], text: "#eaf6ff", accent: "#5b8cff", muted: "#8fb8d8" },
  { id: "forest", label: "Forest", blurb: "Greens and moss", swatches: ["#122416", "#58b368", "#eef7ea"], text: "#eef7ea", accent: "#58b368", muted: "#9dc4a0" },
  { id: "neon-city", label: "Neon City", blurb: "Magenta and cyan glow", swatches: ["#0b0714", "#ff4fd8", "#4fd8ff"], text: "#ffffff", accent: "#ff4fd8", muted: "#4fd8ff" },
  { id: "paper", label: "Paper", blurb: "Light, minimal, ink text", swatches: ["#f4f1ea", "#26241f", "#8a6d3b"], text: "#26241f", accent: "#8a6d3b", muted: "#6b6459" },
  { id: "sunset", label: "Sunset", blurb: "Orange and pink horizon", swatches: ["#3d2c52", "#ff7a59", "#f472b6"], text: "#fff4ec", accent: "#ff7a59", muted: "#f472b6" },
];

export interface TargetOption {
  id: string;
  label: string;
  blurb: string;
  width: number | null;
  height: number | null;
}

export const TARGETS:TargetOption[]=PLATFORMS.map(p=>({id:p.id,label:p.name,blurb:`${p.target.recommended.width} × ${p.target.recommended.height} · ${p.level==='A'?'Connected':p.level==='B'?'Manual preview':'Placement preview'}`,width:p.id==='custom-target'?null:p.target.recommended.width,height:p.id==='custom-target'?null:p.target.recommended.height}));

export type AmbienceChoice = "none" | "rain" | "snow" | "fireflies" | "stars" | "bokeh";

/** Ambience choices map 1:1 to real procedural group kinds in scenegen. */
export const AMBIENCE_CHOICES: Array<{ id: AmbienceChoice; label: string }> = [
  { id: "none", label: "None" },
  { id: "rain", label: "Rain" },
  { id: "snow", label: "Snow" },
  { id: "fireflies", label: "Fireflies" },
  { id: "stars", label: "Stars" },
  { id: "bokeh", label: "Bokeh" },
];

export function ambienceKind(id: AmbienceChoice): GroupKind | null {
  return id === "none" ? null : id;
}

export type GoalId =
  | "github-profile" | "github-repo" | "banner" | "contribution-game" | "stats-graphic" | "other";

export const GOALS: Array<{ id: GoalId; label: string; blurb: string }> = [
  { id: "github-profile", label: "GitHub Profile", blurb: "A banner for your profile page" },
  { id: "github-repo", label: "GitHub Repository", blurb: "A social preview image" },
  { id: "banner", label: "Banner", blurb: "A wide banner for anywhere" },
  { id: "contribution-game", label: "Contribution Game", blurb: "A playable contribution graph" },
  { id: "stats-graphic", label: "Stats Graphic", blurb: "Your numbers, nicely shown" },
  { id: "other", label: "Other Platform", blurb: "Any site or chat app" },
];

// ---------------------------------------------------------------- doc derivations

const solidPaint = (color: string): SolidPaint => ({ type: "solid", color });

function isTextLayer(l: Layer): boolean {
  return l.type === "text";
}

/** Collect text layers, descending into groups (mutating the given doc's layers in place). */
function forEachTextLayer(layers: Layer[], fn: (l: Layer) => void): void {
  for (const l of layers) {
    if (isTextLayer(l)) fn(l);
    if (l.type === "group") forEachTextLayer(l.children, fn);
  }
}

/** Palette step: recolor text layers + document brand tokens. */
export function applyPalette(doc: BannerSpecDocument, palette: Palette): void {
  let seen = 0;
  forEachTextLayer(doc.layers, (l) => {
    // Title gets the main text color; secondary text gets the muted tone.
    (l as { fill?: unknown }).fill = solidPaint(seen === 0 ? palette.text : palette.muted);
    seen++;
  });
  doc.brand = {
    ...(doc.brand ?? {}),
    text: palette.text,
    accent: palette.accent,
    primary: palette.accent,
    muted: palette.muted,
  };
}

/** Ambience step: use the same effect definitions as the Effects panel. */
export function applyAmbience(
  doc: BannerSpecDocument,
  choice: AmbienceChoice,
  intensity: number,
): void {
  const ids: Record<string, string> = { rain: "window-rain", snow: "soft-snowfall", fireflies: "fireflies-fx", stars: "stars-fx", bokeh: "cinema-bokeh" };
  const preset = EFFECT_PRESETS.find(p => p.id === ids[choice]);
  if (preset) insertAtmosphere(doc, preset, intensity);
}

/** Details step: put the user's name/tagline into the scene's Title/Subtitle text. */
export function applyDetails(doc: BannerSpecDocument, name: string, tagline: string): void {
  const texts: Layer[] = [];
  forEachTextLayer(doc.layers, (l) => texts.push(l));
  const trimmedName = name.trim();
  const trimmedTagline = tagline.trim();
  if (texts[0] && trimmedName) (texts[0] as { text: string }).text = trimmedName;
  if (texts[1]) {
    (texts[1] as { text: string }).text = trimmedTagline || (texts[1] as { text: string }).text;
  } else if (texts[0] && trimmedTagline) {
    // Scene has a single text layer: append the tagline as a second one.
    const t0 = texts[0] as unknown as { x: number; y: number; fontSize: number };
    doc.layers.push({
      ...(texts[0] as unknown as Record<string, unknown>),
      id: `guideme-sub-${Math.random().toString(36).slice(2, 8)}`,
      y: t0.y + (t0.fontSize ?? 40) * 1.2,
      text: trimmedTagline,
    } as unknown as Layer);
  }
}

/** Animation step: attach the curated behavior stack to text layers. */
export function applyAnimation(doc: BannerSpecDocument, level: AnimLevel): void {
  const stack = animationStack(level);
  forEachTextLayer(doc.layers, (l) => {
    if (stack.length === 0) {
      delete (l as { behaviors?: unknown }).behaviors;
      return;
    }
    const behaviors: LayerBehavior[] = stack.map((s, i) => ({
      id: `guideme-${s.preset}-${i}`,
      preset: s.preset,
      category: s.category,
      enabled: true,
      speed: s.speed,
      amount: s.amount,
      ...(i > 0 && s.category === "entrance" ? { delay: i * 0.2 } : {}),
    }));
    // Sanity: every preset must exist in the behavior library.
    if (!behaviors.every((b) => behaviorById(b.preset))) return;
    (l as { behaviors?: LayerBehavior[] }).behaviors = behaviors;
  });
}

const EXTRAS: Array<{ id: SectionType; label: string; blurb: string }> = [
  { id: "stats", label: "Stats", blurb: "GitHub stat cards" },
  { id: "contribution", label: "Contribution Game", blurb: "A playable graph" },
  { id: "projects", label: "Projects", blurb: "Pinned work" },
  { id: "tech-stack", label: "Tech Stack", blurb: "Tools you use" },
  { id: "buttons", label: "Social Links", blurb: "Badges with links" },
];

/**
 * Extras step (GitHub Profile target): toggle README sections via the same
 * project readme model ProfileWorkspace edits (editor.setProjectMeta).
 */
export function applyExtras(
  model: ReadmeModel | undefined,
  enabled: SectionType[],
  username: string,
): ReadmeModel {
  const base: ReadmeModel = model ?? {
    sections: [
      { id: "banner", type: "banner" },
      { id: "intro", type: "intro" },
    ],
    username: username || "your-name",
    assetsPrefix: "assets",
  };
  const keep = new Set(enabled);
  const existing = base.sections.filter((s) => !EXTRAS.some((e) => e.id === s.type));
  const added = EXTRAS.filter((e) => keep.has(e.id)).map((e, i) => ({
    id: `guideme-${e.id}-${i}`,
    type: e.id,
  }));
  return { ...base, username: username || base.username, sections: [...existing, ...added] };
}

// ---------------------------------------------------------------- component

type StepId =
  | "goal" | "target" | "vibe" | "scene" | "details"
  | "palette" | "ambience" | "animation" | "extras" | "preview";

interface WizardState {
  goal: GoalId | null;
  target: string | null;
  vibe: VibeId | null;
  sceneId: string | null;
  name: string;
  tagline: string;
  githubUsername: string;
  paletteId: string | null;
  customColors?: [string, string, string];
  ambience: AmbienceChoice;
  ambienceIntensity: number;
  animLevel: AnimLevel;
  extras: SectionType[];
}

export function CreationWizard({ editor, onClose, onCustomizeMore, onFinish, onSetGithubUsername }: {
  editor: Editor;
  onClose: () => void;
  /** Close the wizard and leave the user in the normal Design workspace. */
  onCustomizeMore: () => void;
  /** Open the Export Studio after "Looks good — Export" (optional). */
  onFinish?: () => void;
  /** Persist the GitHub username if the host app tracks one (optional). */
  onSetGithubUsername?: (u: string) => void;
}) {
  const reduced=useReducedMotion();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>({
    goal: null, target: null, vibe: null, sceneId: null,
    name: "", tagline: "", githubUsername: "",
    paletteId: null, ambience: "none", ambienceIntensity: 50,
    animLevel: "subtle", extras: [],
  });
  const [transition, setTransition] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  // The scene baseline: the scene generator's doc before palette/ambience/
  // details/animation overlays. Going back and changing an earlier choice
  // re-derives from this, so choices stay cumulative and reversible.
  const baseline = useRef<BannerSpecDocument | null>(structuredClone(editor.doc));
  const stateRef = useRef(state);
  stateRef.current = state;

  const patch = (p: Partial<WizardState>) => setState((s) => ({ ...s, ...p }));

  const go = (next: number) => {
    if (document.documentElement.classList.contains("reduced-motion") || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setStep(next); return; }
    setTransition(true);
    window.setTimeout(() => {
      setStep(next);
      setTransition(false);
    }, 140);
  };

  /** Re-derive the live document from the scene baseline + all later choices. */
  const applyAll = (s: WizardState) => {
    const base = baseline.current;
    if (!base) return;
    const doc = structuredClone(base) as BannerSpecDocument;
    const palette = s.paletteId === "custom" ? { id: "custom", label: "Custom", blurb: "Your colors", swatches: s.customColors ?? ["#101820", "#9ee7ff", "#ffffff"], text: s.customColors?.[2] ?? "#ffffff", accent: s.customColors?.[1] ?? "#9ee7ff", muted: s.customColors?.[1] ?? "#9ee7ff" } satisfies Palette : PALETTES.find((p) => p.id === s.paletteId) ?? null;
    if (palette) applyPalette(doc, palette);
    if (s.paletteId === "custom" && s.customColors) doc.canvas.background = s.customColors[0];
    applyAmbience(doc, s.ambience, s.ambienceIntensity);
    applyDetails(doc, s.name, s.tagline);
    applyAnimation(doc, s.animLevel);
    editor.store.replaceDocument(doc, "Guide Me");
    editor.setSaveState("unsaved");
  };

  // Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector(".color-pop")) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const steps = useMemo<StepId[]>(() => {
    const base: StepId[] = ["goal", "target", "vibe", "scene", "details", "palette", "ambience", "animation"];
    if (canonicalTarget(state.target??undefined) === "github-profile-readme") base.push("extras");
    base.push("preview");
    return base;
  }, [state.target]);

  const current = steps[step]!;
  const total = steps.length;
  const stepLabel = `Step ${step + 1} of ${total}`;

  // ---------------------------------------------------------------- step handlers

  const chooseTarget = (t: TargetOption) => {
    patch({ target: t.id });
    editor.setExportTargetId(t.id);
    if (t.width && t.height) {
      editor.updateCanvas({ width: t.width, height: t.height });
    }
    // Remember the target in project metadata (PCSProject.settings.target).

    // If a scene is already chosen (user went back), regenerate at the new size.
    if (baseline.current) {
      const scene = SCENE_LIBRARY.find(s => s.id === stateRef.current.sceneId);
      baseline.current = scene ? scene.make(t.width ?? editor.doc.canvas.width, t.height ?? editor.doc.canvas.height) : { ...baseline.current, canvas: { ...baseline.current.canvas, width: t.width ?? editor.doc.canvas.width, height: t.height ?? editor.doc.canvas.height } };
      applyAll({ ...stateRef.current, target: t.id });
    }
    go(step + 1);
  };

  const regenerateBaseline = (sceneId: string | null): BannerSpecDocument | null => {
    const scene = SCENE_LIBRARY.find((s) => s.id === sceneId);
    if (!scene) return null;
    const { width, height } = editor.doc.canvas;
    return scene.make(width, height);
  };

  const chooseScene = (scene: SceneEntry) => {
    baseline.current = scene.make(editor.doc.canvas.width, editor.doc.canvas.height);
    const next = { ...stateRef.current, sceneId: scene.id };
    patch({ sceneId: scene.id });
    applyAll(next);
    go(step + 1);
  };

  const importBackground = async (file: File) => {
    try {
      if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type) || file.size > 20_000_000) throw Error("Choose a PNG, JPG, WebP or GIF up to 20 MB.");
      const src = await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error("Could not read image."));reader.readAsDataURL(file);});
      const img=new Image();await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(Error("Could not decode image."));img.src=src;});
      const base=structuredClone(baseline.current ?? editor.doc);
      base.layers=base.layers.filter(l=>l.name!=="Your background image" && !((l.type==="image"||l.type==="rect") && l.x===0 && l.y===0 && l.width>=base.canvas.width && l.height>=base.canvas.height));
      base.layers.unshift({id:crypto.randomUUID(),type:"image",name:"Your background image",visible:true,locked:false,opacity:1,rotation:0,x:0,y:0,width:base.canvas.width,height:base.canvas.height,src,fit:"cover"});
      baseline.current=base;applyAll(stateRef.current);setImportMessage(file.name+" loaded. GIF playback is browser controlled; Export Studio can encode timed GIF backgrounds into composited motion.");
    } catch(error) {setImportMessage(String(error));}
  };

  const choosePalette = (p: Palette) => {
    const next = { ...stateRef.current, paletteId: p.id };
    patch({ paletteId: p.id });
    applyAll(next);
    go(step + 1);
  };

  const chooseAmbience = (choice: AmbienceChoice, intensity: number) => {
    const next = { ...stateRef.current, ambience: choice, ambienceIntensity: intensity };
    patch({ ambience: choice, ambienceIntensity: intensity });
    applyAll(next);
  };

  const chooseAnimation = (level: AnimLevel) => {
    const next = { ...stateRef.current, animLevel: level };
    patch({ animLevel: level });
    applyAll(next);
    go(step + 1);
  };

  const setDetails = (p: { name?: string; tagline?: string; githubUsername?: string }) => {
    const next = { ...stateRef.current, ...p };
    patch(p);
    applyAll(next);
  };

  const toggleExtra = (id: SectionType) => {
    const has = state.extras.includes(id);
    const extras = has ? state.extras.filter((e) => e !== id) : [...state.extras, id];
    patch({ extras });
    editor.setProjectMeta({
      readme: applyExtras(editor.project.readme, extras, state.githubUsername),
    });
  };

  const customize=()=>{applyAll(stateRef.current);editor.setProjectMeta({readme:{...applyExtras(editor.project.readme,stateRef.current.extras,stateRef.current.githubUsername),displayName:stateRef.current.name || editor.project.readme?.displayName,bio:stateRef.current.tagline || editor.project.readme?.bio}});if(onSetGithubUsername&&stateRef.current.githubUsername.trim())onSetGithubUsername(stateRef.current.githubUsername.trim());editor.setPlaying(false);onCustomizeMore();};
  const finish = () => {
    applyAll(stateRef.current);
    editor.setProjectMeta({readme:{...applyExtras(editor.project.readme,stateRef.current.extras,stateRef.current.githubUsername),displayName:stateRef.current.name || editor.project.readme?.displayName,bio:stateRef.current.tagline || editor.project.readme?.bio}});
    if (onSetGithubUsername && state.githubUsername.trim()) {
      onSetGithubUsername(state.githubUsername.trim());
    }
    if (onFinish) onFinish();
    else onClose();
  };

  // ---------------------------------------------------------------- render helpers

  const previewSvg = useMemo(() => {
    try {
      return renderSvg(editor.store.getDocument(), { animate: !reduced, editable: false, ...(reduced?{time:(editor.doc.animation?.duration??8)*.5}:{}) });
    } catch {
      return null;
    }
  }, [current, editor.store, editor.doc,reduced]);

  const sceneOptions = useMemo(
    () => (state.vibe ? vibeScenes(state.vibe) : SCENE_LIBRARY.filter((s) => !s.experimental).slice(0, 6)),
    [state.vibe],
  );

  const back = () => { if (step > 0) go(step - 1); else onClose(); };

  return (
    <div className="dialog-overlay guide-overlay" onClick={onClose}>
      <style>{GUIDE_CSS}</style>
      <div
        className={"dialog guide-dialog" + (transition ? " guide-transition" : "")}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Guide Me wizard"
      >
        <header className="guide-header">
          <h2>Guide Me</h2>
          <span className="guide-progress">{stepLabel}</span>
          <button className="btn ghost" onClick={customize}>Customize more</button>
          <button className="btn ghost guide-close" onClick={onClose} aria-label="Close wizard">×</button>
        </header>
        <div className="guide-progress-bar" aria-hidden="true">
          <div className="guide-progress-fill" style={{ width: `${((step + 1) / total) * 100}%` }} />
        </div>

        <div className="guide-navigation" style={{ display: "flex", gap: 8 }}>
          <button className="btn" disabled={step === 0} onClick={back}>Back</button>
          <span style={{ flex: 1 }} />
          <button className="btn" disabled={step >= total - 1} onClick={() => go(Math.min(total-1, step+1))}>Skip this step</button>
        </div>
        <div className="guide-design-flow">
        <div className="guide-body">
          {current === "goal" && (
            <>
              <p className="guide-question">What do you want to make?</p><p className="guide-hint">Pick an editable starting direction, or build your own below.</p><div className="guide-cards">{[
 ['Professional GitHub profile','github-profile-readme','professional','editorial-black','Open-source builder','Thoughtful tools, shared openly'],
 ['Cozy Discord profile','discord-profile-banner','cozy','photo-rainy-city-night','Your corner of the internet','Make yourself at home'],
 ['Rainy YouTube banner','youtube-channel-banner','cozy','photo-rainy-city-night','Stories after dark','New ideas, one video at a time'],
 ['Nature aesthetic','custom-target','nature','photo-foggy-forest','Field notes','Exploring the living world'],
 ['Soft pastel','custom-target','cute','pastel-clouds','Create with care','Small ideas, beautiful beginnings']
 ].map(([label,target,vibe,scene,name,tagline])=><button className="guide-card" key={label} onClick={()=>{const t=TARGETS.find(t=>t.id===target)!;const entry=SCENE_LIBRARY.find(s=>s.id===scene)??SCENE_LIBRARY[0]!;baseline.current=entry.make(t.width??1200,t.height??350);const next={...stateRef.current,goal:'banner' as GoalId,target:target!,vibe:vibe as VibeId,sceneId:entry.id,name:name!,tagline:tagline!};patch(next);editor.setExportTargetId(target!);applyAll(next);go(4);}}><strong>{label}</strong><span>Editable scene, title and palette</span></button>)}</div><h3>Custom / advanced starting point</h3>
              <div className="guide-cards">
                {GOALS.map((g) => (
                  <button key={g.id} className="guide-card" onClick={() => { patch({ goal: g.id }); go(step + 1); }}>
                    <span className="guide-card-title">{g.label}</span>
                    <span className="guide-card-blurb">{g.blurb}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {current === "target" && (
            <>
              <p className="guide-question">Where will this be used?</p>
              <div className="guide-cards">
                {TARGETS.map((t) => (
                  <button key={t.id} className={"guide-card" + (state.target === t.id ? " selected" : "")} onClick={() => chooseTarget(t)}>
                    <span className="guide-card-title">{t.label}</span>
                    <span className="guide-card-blurb">{t.blurb}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {current === "vibe" && (
            <>
              <p className="guide-question">Pick a vibe</p>
              <div className="guide-cards">
                {VIBES.map((v) => (
                  <button key={v.id} className={"guide-card guide-vibe" + (state.vibe === v.id ? " selected" : "")}
                    onClick={() => { patch({ vibe: v.id }); go(step + 1); }}>
                    <span className="guide-swatches">
                      {v.swatches.map((c) => <span key={c} className="guide-swatch" style={{ background: c }} />)}
                    </span>
                    <span className="guide-card-title">{v.label}</span>
                    <span className="guide-card-blurb">{v.blurb}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {current === "scene" && (
            <>
              <div className="guide-import" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const file=e.dataTransfer.files[0];if(file)void importBackground(file);}}><FileDropZone label="Use your own background" hint="PNG · JPG · WEBP · GIF" accept="image/png,image/jpeg,image/webp,image/gif" onFiles={async files=>{if(files[0])await importBackground(files[0]);}}/><p role="status">{importMessage || "Drop an image or GIF here. Existing text and your wizard choices are retained."}</p><button className="btn" onClick={()=>go(step+1)}>Continue with current scene</button></div>
              <p className="guide-question">Choose a scene</p>
              <div className="guide-cards guide-scene-grid">
                {sceneOptions.map((s) => (
                  <button key={s.id} className={"guide-card guide-scene" + (state.sceneId === s.id ? " selected" : "")}
                    onClick={() => chooseScene(s)}>
                    <span className="guide-scene-thumb">
                      {scenePoster(s.id)
                        ? <span className="guide-scene-svg" dangerouslySetInnerHTML={{ __html: svgToInline(scenePoster(s.id)!) }} />
                        : null}
                    </span>
                    <span className="guide-card-title">{s.name}</span>
                    <span className="guide-card-blurb">{s.blurb}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {current === "details" && (
            <>
              <p className="guide-question">Your details</p>
              <div className="guide-fields">
                <label className="guide-field">
                  <span>Name</span>
                  <input className="field-input" value={state.name} placeholder="Your name"
                    onChange={(e) => setDetails({ name: e.target.value })} />
                </label>
                <label className="guide-field">
                  <span>Tagline <em className="guide-optional">optional</em></span>
                  <input className="field-input" value={state.tagline} placeholder="A short line about you"
                    onChange={(e) => setDetails({ tagline: e.target.value })} />
                </label>
                {canonicalTarget(state.target??undefined) === "github-profile-readme" && (
                  <label className="guide-field">
                    <span>GitHub username</span>
                    <input className="field-input" value={state.githubUsername} placeholder="octocat"
                      onChange={(e) => setDetails({ githubUsername: e.target.value })} />
                  </label>
                )}
              </div>
              <div className="guide-actions">
                <button className="btn" onClick={back}>Go Back</button>
                <button className="btn primary" onClick={() => go(step + 1)}>Continue</button>
              </div>
            </>
          )}

          {current === "palette" && (
            <>
              <p className="guide-question">Which palette feels right?</p><div className="guide-custom-colors"><strong>Or choose your own colors</strong>{(["Background", "Accent", "Text"] as const).map((label,i)=><label key={label}>{label}<ColorField value={(state.customColors ?? ["#101820", "#9ee7ff", "#ffffff"])[i]!} onChange={value=>{const colors: [string,string,string] = [...(state.customColors ?? ["#101820", "#9ee7ff", "#ffffff"])];colors[i]=value;const next={...state,paletteId:"custom",customColors:colors};setState(next);applyAll(next);}}/></label>)}<p className="paint-hint">Background color sits beneath existing photographs.</p><button className="btn primary" onClick={()=>go(step+1)}>Use these colors</button></div>
              <div className="guide-cards">
                {PALETTES.map((p) => (
                  <button key={p.id} className={"guide-card guide-vibe" + (state.paletteId === p.id ? " selected" : "")}
                    onClick={() => choosePalette(p)}>
                    <span className="guide-swatches">
                      {p.swatches.map((c) => <span key={c} className="guide-swatch" style={{ background: c }} />)}
                    </span>
                    <span className="guide-card-title">{p.label}</span>
                    <span className="guide-card-blurb">{p.blurb}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {current === "ambience" && (
            <>
              <p className="guide-question">Any ambience?</p>
              <div className="guide-cards guide-ambience">
                {AMBIENCE_CHOICES.map((a) => (
                  <button key={a.id} className={"guide-card" + (state.ambience === a.id ? " selected" : "")}
                    onClick={() => chooseAmbience(a.id, state.ambienceIntensity)}>
                    <span className="guide-card-title">{a.label}</span>
                  </button>
                ))}
              </div>
              {state.ambience !== "none" && (
                <div className="guide-field guide-slider">
                  <span>Intensity</span>
                  <input type="range" min={0} max={100} value={state.ambienceIntensity}
                    onChange={(e) => chooseAmbience(state.ambience, Number(e.target.value))} />
                </div>
              )}
              <div className="guide-actions">
                <button className="btn" onClick={back}>Go Back</button>
                <button className="btn primary" onClick={() => go(step + 1)}>Continue</button>
              </div>
            </>
          )}

          {current === "animation" && (
            <>
              <p className="guide-question">How animated do you want it?</p><TargetCapabilities target={getPlatform(state.target??undefined).target}/><p>Motion remains editable. Export Studio provides composited GIF and runtime-supported video. Static targets require your chosen still frame.</p>
              <div className="guide-cards">
                {([
                  { id: "still", label: "Still", blurb: "No movement at all" },
                  { id: "subtle", label: "Subtle", blurb: "Gently fades into place" },
                  { id: "animated", label: "Animated", blurb: "Fades in, then drifts" },
                  { id: "lively", label: "Lively", blurb: "Drifting and glowing" },
                ] as Array<{ id: AnimLevel; label: string; blurb: string }>).map((a) => (
                  <button key={a.id} className={"guide-card" + (state.animLevel === a.id ? " selected" : "")}
                    onClick={() => chooseAnimation(a.id)}>
                    <span className="guide-card-title">{a.label}</span>
                    <span className="guide-card-blurb">{a.blurb}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {current === "extras" && (
            <>
              <p className="guide-question">Extras for your profile</p>
              <p className="guide-hint">These set up sections in your README. You can change them later in Profile mode.</p>
              <div className="guide-cards guide-extras">
                {EXTRAS.map((e) => (
                  <button key={e.id} className={"guide-card" + (state.extras.includes(e.id) ? " selected" : "")}
                    onClick={() => toggleExtra(e.id)}>
                    <span className="guide-card-title">{e.label}</span>
                    <span className="guide-card-blurb">{e.blurb}</span>
                    <span className="guide-toggle">{state.extras.includes(e.id) ? "On" : "Off"}</span>
                  </button>
                ))}
              </div>
              <div className="guide-actions">
                <button className="btn" onClick={back}>Go Back</button>
                <button className="btn primary" onClick={() => go(step + 1)}>Continue</button>
              </div>
            </>
          )}

          {current === "preview" && (
            <>
              <p className="guide-question">Here it is — what do you think?</p>
              <div className="guide-preview">
                {previewSvg
                  ? <div className="guide-preview-svg" dangerouslySetInnerHTML={{ __html: svgToInline(previewSvg).replace("xMidYMid slice", "xMidYMid meet") }} />
                  : <p className="empty-hint">Preview unavailable.</p>}
              </div>
              <div className="guide-actions">
                <button className="btn" onClick={back}>Go Back</button>
                <button className="btn" onClick={customize}>Customize More</button>
                <button className="btn primary" onClick={finish}>Looks good — Export</button>
              </div>
            </>
          )}
        </div>
        {current !== "preview" && <aside className="guide-live-preview" aria-label="Your live design">
          <p className="studio-eyebrow">YOUR DESIGN, TAKING SHAPE</p>
          <div dangerouslySetInnerHTML={{ __html: previewSvg ? svgToInline(previewSvg).replace("xMidYMid slice", "xMidYMid meet") : "" }}/>
          <p className="paint-hint">Every choice edits your real project. Keep designing in Studio at any time.</p>
          <ol>{steps.map((s, i) => <li key={s} aria-current={current === s ? "step" : undefined}><button onClick={() => go(i)}>{i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}</button></li>)}</ol>
        </aside>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- scoped styles

const GUIDE_CSS = `
.guide-overlay { z-index: var(--z-dialog); }
.guide-dialog { width: min(1100px, 94vw); height: min(780px, 90vh); display: flex; flex-direction: column; gap: 10px; overflow: hidden; }
.guide-design-flow { display: flex; min-height: 0; flex: 1; gap: 28px; }
.guide-body { flex: 1; min-width: 0; }
.guide-live-preview { width: 300px; flex: none; padding: 14px; border-left: 1px solid var(--pcs-border-subtle); }
.guide-live-preview > div { width: 100%; aspect-ratio: 2; display: grid; align-items: center; border-radius: 10px; overflow: hidden; background: var(--pcs-bg-workspace); }
.guide-live-preview > div > svg { min-width: 0; max-width: 100%; max-height: 140px; }
.guide-live-preview ol { list-style: none; margin: 16px 0 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.guide-live-preview button { border: 0; color: var(--pcs-text-secondary); background: none; text-align: left; font: inherit; cursor: pointer; }
.guide-live-preview [aria-current="step"] button { color: var(--pcs-accent); }
@media(max-width:1000px) { .guide-live-preview { width: 230px; } }
.guide-dialog.guide-transition .guide-body { opacity: 0; transform: translateY(6px); }
.guide-body { transition: opacity 140ms ease, transform 140ms ease; overflow-y: auto; padding: 4px 2px; }
.guide-header { display: flex; align-items: center; gap: 12px; }
.guide-header h2 { margin: 0; flex: 0 0 auto; }
.guide-close { margin-left: auto; font-size: 18px; line-height: 1; padding: 2px 10px; }
.guide-progress { font-size: 12px; color: var(--pcs-text-muted, #8b93a1); }
.guide-progress-bar { height: 3px; border-radius: 2px; background: color-mix(in srgb, currentColor 12%, transparent); overflow: hidden; }
.guide-progress-fill { height: 100%; background: var(--pcs-accent, #5b8cff); transition: width 200ms ease; }
.guide-question { font-size: 17px; font-weight: 600; margin: 6px 0 10px; }
.guide-hint { font-size: 12px; color: var(--pcs-text-muted, #8b93a1); margin: -4px 0 10px; }
.guide-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; }
.guide-card {
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  padding: 14px; border-radius: 12px; text-align: left; cursor: pointer;
  border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
  background: color-mix(in srgb, currentColor 5%, transparent);
  backdrop-filter: blur(8px); color: inherit; font: inherit;
  transition: border-color 120ms ease, transform 120ms ease, background 120ms ease;
}
.guide-card:hover { transform: translateY(-2px); border-color: var(--pcs-accent, #5b8cff); }
.guide-card.selected { border-color: var(--pcs-accent, #5b8cff); background: color-mix(in srgb, var(--pcs-accent, #5b8cff) 12%, transparent); }
.guide-card-title { font-weight: 600; font-size: 14px; }
.guide-card-blurb { font-size: 12px; color: var(--pcs-text-muted, #8b93a1); }
.guide-swatches { display: flex; gap: 6px; margin-bottom: 4px; }
.guide-swatch { width: 22px; height: 22px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.25); }
.guide-scene-grid { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
.guide-scene-thumb { display: block; width: 100%; aspect-ratio: 2.6 / 1; border-radius: 8px; overflow: hidden; background: #0a0c14; margin-bottom: 6px; }
.guide-scene-svg { display: block; width: 100%; height: 100%; }
.guide-fields { display: flex; flex-direction: column; gap: 12px; max-width: 460px; }
.guide-field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
.guide-field > span { font-weight: 600; }
.guide-optional { font-style: normal; font-weight: 400; color: var(--pcs-text-muted, #8b93a1); margin-left: 6px; font-size: 11px; }
.guide-slider { margin-top: 14px; max-width: 380px; }
.guide-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
.guide-extras .guide-toggle { font-size: 11px; margin-top: 2px; color: var(--pcs-accent, #5b8cff); }
.guide-preview { border-radius: 12px; overflow: hidden; border: 1px solid color-mix(in srgb, currentColor 14%, transparent); background: #0a0c14; }
.guide-preview-svg { width: 100%; max-height: 46vh; }
`;


/** Persistent guidance navigates without changing the document or applying presets. */
export function GuideMe({editor,onClose,onCustomizeMore,onFinish,onNavigate}:{editor:Editor;onClose:()=>void;onCustomizeMore:()=>void;onFinish?:()=>void;onSetGithubUsername?:(u:string)=>void;onNavigate?:(mode:'design'|'animate'|'profile'|'preview',section?:'scenes'|'elements'|'atmosphere'|'background')=>void}) {
 const [task,setTask]=useState(''),[step,setStep]=useState(0),[minimized,setMinimized]=useState(false);
 const routes:Record<string,{title:string;mode:'design'|'animate'|'profile'|'preview';section?:'scenes'|'elements'|'atmosphere'|'background';selector:string;body:string}[]>={
 'Make a GitHub banner':[{title:'Choose a scene',mode:'design',section:'scenes',selector:'.scene-gallery',body:'Click a scene to apply it. Existing artwork is replaced only after confirmation; Undo brings it back.'},{title:'Personalize your text',mode:'design',section:'elements',selector:'.studio-library-body',body:'Add text, then edit its content, font and colour in the inspector.'}],
 'Animate text':[{title:'Select or add text',mode:'design',section:'elements',selector:'.studio-library-body',body:'Select your text on the canvas or add a text layer.'},{title:'Apply motion',mode:'animate',selector:'.animate-workspace',body:'Choose Add Animation and explicitly apply a card. Use Play to inspect the timing.'}],
 'Add rain':[{title:'Choose atmosphere',mode:'design',section:'atmosphere',selector:'.studio-library-body',body:'Choose rain and add it to your banner. Select the atmosphere layer to adjust its intensity and speed.'}],
 'Customize my profile':[{title:'Edit your profile',mode:'profile',selector:'.platform-workspace',body:'Choose GitHub, enter your username for real data, then add and arrange sections.'}],
 'Add a button':[{title:'Insert a button',mode:'profile',selector:'[data-guide="add-button"]',body:'Use + Button in the profile toolbar. The new button opens its label, URL, badge style, colour and alignment controls.'}],
 'Add an icon':[{title:'Insert an icon',mode:'profile',selector:'[data-guide="add-icon"]',body:'Use + Icon, choose a graphic in the searchable grid, then adjust its size, colour, label and alignment. The exported profile includes the actual icon SVG.'}],
 'Use my background':[{title:'Import your image',mode:'design',section:'elements',selector:'[data-tour="import-image"]',body:'Import an image or GIF from your device. Place it behind other layers in Layers; your original file stays unchanged.'}],
 'Organize local assets':[{title:'Open your local library',mode:'design',selector:'.pro-open',body:'Open Local studio for Identity Kits, Asset Library, Time Machine and Design Variants. Import images or fonts in Asset Library; originals stay on this device.'}],
 'Export this':[{title:'Inspect your preview',mode:'preview',selector:'.preview-workspace',body:'Inspect the banner and safe areas. Target crop and motion support are explained in Export Studio.'}]
 };
 const current=routes[task]?.[step];
 useEffect(()=>{if(!current)return;if(current.mode==='profile')editor.setExportTargetId('github-profile-readme');onNavigate?.(current.mode,current.section);if(!onNavigate)editor.setMode(current.mode);const timer=window.setTimeout(()=>{const el=document.querySelector<HTMLElement>(current.selector);el?.setAttribute('data-guide-highlight','true');},100);return()=>{clearTimeout(timer);document.querySelectorAll('[data-guide-highlight]').forEach(el=>el.removeAttribute('data-guide-highlight'));};},[task,step]);
 return <aside className={'context-guide'+(minimized?' minimized':'')} aria-label="Guide Me"><header><strong>Guide Me</strong><button className="btn" aria-label={minimized?'Expand Guide Me':'Minimize Guide Me'} onClick={()=>setMinimized(!minimized)}>{minimized?'+':'−'}</button><button className="btn" aria-label="Close Guide Me" onClick={onClose}>×</button></header>{!minimized&&<><small>{editor.mode==='animate'?'Motion':editor.mode} workspace</small>{current?<><h3>{current.title}</h3><p>{current.body}</p><div className="pro-actions"><button className="btn" onClick={()=>{if(step)setStep(step-1);else setTask('');}}>Back</button>{step+1<(routes[task]?.length??0)?<button className="btn primary" onClick={()=>setStep(step+1)}>Next</button>:<button className="btn primary" onClick={()=>{if(task==='Export this')onFinish?.();else setTask('');}}> {task==='Export this'?'Open Export':'Choose another task'}</button>}</div></>:<><h3>What would you like to do?</h3><p>Choose a task. Guidance opens the relevant workspace without changing your artwork.</p>{Object.keys(routes).map(t=><button className="guide-task" key={t} onClick={()=>{setTask(t);setStep(0);}}>{t}<span>→</span></button>)}<button className="btn" onClick={onCustomizeMore}>Continue in Design</button></>}</>}</aside>;
}
