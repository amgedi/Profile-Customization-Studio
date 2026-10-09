/**
 * Effect library — visual presets over BannerSpec effect primitives.
 * Every card shows a real rendered thumbnail (see thumbnails.effectPoster),
 * a plain-language blurb, and applies to the selected layer's effect stack.
 * Categories: Light / Material / Color / Atmosphere / Retro / Edge.
 */
import type { EffectType, LayerEffect } from "@pcs/bannerspec";

export type EffectCategory = "Light" | "Material" | "Color" | "Atmosphere" | "Retro" | "Edge" | "Basics";

export interface EffectPreset {
  id: string;
  name: string;
  category: EffectCategory;
  blurb: string;
  params: Record<string, number>;
  type: EffectType;
  /** Optional accent color baked into the applied effect. */
  color?: string;
}

export const EFFECT_PRESETS: EffectPreset[] = [
  {id:'window-rain',name:'Window Droplets',category:'Atmosphere',blurb:'Beaded glass, highlights and slowly sliding drops.',type:'rain-fx',params:{amount:75,speed:.5,sizeMin:1.5,sizeMax:6,depth:.8,opacity:.85}},
  {id:'storm-rain',name:'Heavy Rain',category:'Atmosphere',blurb:'Dense, fast droplets with wind and trails.',type:'rain-fx',params:{amount:95,speed:2,wind:.6,sizeMin:.8,sizeMax:3}},
  {id:'fine-drizzle',name:'Fine Drizzle',category:'Atmosphere',blurb:'Small, quiet raindrops on glass.',type:'rain-fx',params:{amount:45,speed:.3,sizeMin:.5,sizeMax:2}},
  {id:'valley-mist',name:'Valley Mist',category:'Atmosphere',blurb:'Low, layered drifting mist.',type:'mist',params:{density:.45,height:.35,softness:.7,speed:.4}},
  {id:'rolling-fog',name:'Rolling Fog',category:'Atmosphere',blurb:'Wide translucent banks with changing detail.',type:'fog-fx',params:{density:.5,height:1,softness:.4,speed:.7}},
  {id:'ethereal-cool',name:'Celestial Particles',category:'Light',blurb:'Cool light particles rising through an ethereal aura.',type:'heavenly',params:{amount:65,count:70,speed:.6,blur:2},color:'#c4e8ff'},
  {id:'golden-motes',name:'Golden Motes',category:'Light',blurb:'Warm floating points of light.',type:'heavenly',params:{amount:50,count:40,speed:.4},color:'#ffe5b4'},
  {id:'soft-snowfall',name:'Soft Snowfall',category:'Atmosphere',blurb:'Layered slow snow with soft foreground flakes.',type:'snow-fx',params:{amount:55,sizeMin:.8,sizeMax:5,blur:.5,depth:1,speed:.4}},
  {id:'cinema-bokeh',name:'Cinematic Bokeh',category:'Atmosphere',blurb:'Large soft warm defocused lights.',type:'bokeh-fx',params:{amount:20,sizeMin:8,sizeMax:26,blur:3,depth:1},color:'#ffcca0'},
  {id:'cool-dust',name:'Moonlit Dust',category:'Atmosphere',blurb:'Subtle cool airborne specks.',type:'dust-fx',params:{amount:40,sizeMin:.3,sizeMax:1.2,speed:.3},color:'#c4e8ff'},
  {id:'vignette',name:'Vignette',category:'Color',blurb:'A soft falloff toward the edges.',type:'vignette',params:{amount:65}},
  {id:'clouds',name:'Clouds',category:'Atmosphere',blurb:'Layered, drifting cloud banks.',type:'clouds',params:{amount:70,height:1,softness:.5,density:.7}},
  {id:'lens-glow',name:'Lens Glow',category:'Light',blurb:'A warm optical glow across the frame.',type:'lens-glow',params:{amount:45},color:'#ffd9a0'},
  {id:'light-leak',name:'Light Leak',category:'Light',blurb:'An off-axis film light wash.',type:'light-leak',params:{amount:65},color:'#ff8a62'},
  {id:'motion-blur',name:'Motion Blur',category:'Basics',blurb:'Directional horizontal or vertical blur.',type:'motion-blur',params:{amount:10,vertical:1}},
  {id:'inner-glow',name:'Inner Glow',category:'Edge',blurb:'Light along the inside edge.',type:'inner-glow',params:{amount:5,blur:3},color:'#a8dcff'},
  {id:'outline',name:'Outline',category:'Edge',blurb:'A crisp colored contour.',type:'outline',params:{amount:2},color:'#ffffff'},
  // ---------------------------------------------------------------- Light
  { id: "glow-subtle", name: "Soft Glow", category: "Light", blurb: "A gentle halo of light around the element.", type: "glow", params: { amount: 8 } },
  { id: "bloom", name: "Bloom", category: "Light", blurb: "A soft bright halo around the brightest areas.", type: "bloom", params: { amount: 18 } },
  { id: "neon", name: "Neon", category: "Light", blurb: "A bright tube-of-light outline, like a neon sign.", type: "neon", params: {} },
  { id: "glow-halo", name: "Halo", category: "Light", blurb: "A wide, dreamy ring of light behind the element.", type: "halo", params: { amount: 24 } },
  { id: "rim", name: "Rim Light", category: "Light", blurb: "A thin edge light tracing the outline, like backlighting.", type: "rim", params: { amount: 60 }, color: "#cfe4ff" },
  { id: "film-glow", name: "Film Glow", category: "Light", blurb: "A warm cinematic bloom, like vintage film stock.", type: "film-glow", params: { amount: 14 } },
  { id: "heavenly", name: "Heavenly Glow", category: "Light", blurb: "Ethereal aura with clean, rising light particles.", type: "heavenly", params: { amount: 45 } },
  { id: "light-sweep", name: "Light Sweep", category: "Light", blurb: "A shine that passes over the element.", type: "light-sweep", params: {} },
  { id: "rays", name: "Light Rays", category: "Light", blurb: "Sharper beams of light cutting across the scene.", type: "rays", params: { amount: 40 } },
  { id: "electric", name: "Electric", category: "Light", blurb: "A crackling electric arc hugging the edges.", type: "electric", params: { amount: 60 }, color: "#7fe4ff" },
  // ---------------------------------------------------------------- Material
  { id: "frost", name: "Frosted Glass", category: "Material", blurb: "Softens and mutes, like looking through frosted glass.", type: "frost", params: { amount: 6 } },
  { id: "glass", name: "Clear Glass", category: "Material", blurb: "A crisp glossy sheen, like clean pane glass.", type: "glass", params: { amount: 20 } },
  { id: "tinted-glass", name: "Tinted Glass", category: "Material", blurb: "A colored glass wash over the element.", type: "tinted-glass", params: { amount: 2 }, color: "#9fc0ff" },
  { id: "chrome", name: "Chrome", category: "Material", blurb: "A mirror-bright metallic finish.", type: "chrome", params: {} },
  { id: "holo", name: "Holographic", category: "Material", blurb: "An iridescent hologram foil shimmer.", type: "holo", params: {}, color: "#7fe4ff" },
  { id: "plastic", name: "Soft Plastic", category: "Material", blurb: "A smooth matte plastic sheen.", type: "plastic", params: {} },
  // ---------------------------------------------------------------- Color
  { id: "grad-overlay", name: "Gradient Overlay", category: "Color", blurb: "A luminous color wash blended over the element.", type: "grad-overlay", params: { amount: 35 }, color: "#5b8cff" },
  { id: "duotone", name: "Duotone", category: "Color", blurb: "Two-tone print look — shadows and highlights recolored.", type: "duotone", params: {}, color: "#5b8cff" },
  { id: "grade", name: "Color Grade", category: "Color", blurb: "A cinematic teal-orange color grade.", type: "grade", params: {} },
  { id: "gradmap", name: "Gradient Map", category: "Color", blurb: "Brightness mapped onto a dark-to-color gradient.", type: "gradmap", params: {}, color: "#5b8cff" },
  { id: "tint", name: "Tint", category: "Color", blurb: "A light color cast over everything.", type: "tint", params: { amount: 25 }, color: "#5b8cff" },
  { id: "contrast", name: "Contrast", category: "Color", blurb: "Deepens shadows and lifts highlights.", type: "contrast", params: { amount: 60 } },
  { id: "saturation", name: "Saturation", category: "Color", blurb: "Pushes colors richer and more vivid.", type: "saturation", params: { amount: 60 } },
  // ---------------------------------------------------------------- Atmosphere
  { id: "rain-fx", name: "Rain", category: "Atmosphere", blurb: "Fine falling rain streaks over the element.", type: "rain-fx", params: { amount: 45 } },
  { id: "snow-fx", name: "Snow", category: "Atmosphere", blurb: "Soft snowfall drifting across the element.", type: "snow-fx", params: { amount: 55 } },
  { id: "fog-fx", name: "Fog", category: "Atmosphere", blurb: "A soft bank of fog rolling through.", type: "fog-fx", params: { amount: 45 } },
  { id: "mist", name: "Mist", category: "Atmosphere", blurb: "A thinner, lighter haze than fog.", type: "mist", params: { amount: 30 } },
  { id: "dust-fx", name: "Dust", category: "Atmosphere", blurb: "Fine motes drifting in the air.", type: "dust-fx", params: { amount: 40 } },
  { id: "bokeh-fx", name: "Bokeh", category: "Atmosphere", blurb: "Soft out-of-focus light dots.", type: "bokeh-fx", params: { amount: 45 } },
  { id: "stars-fx", name: "Stars", category: "Atmosphere", blurb: "Tiny pinprick stars scattered over the area.", type: "stars-fx", params: { amount: 55 } },
  { id: "fireflies-fx", name: "Fireflies", category: "Atmosphere", blurb: "Warm glowing specks that wander.", type: "fireflies-fx", params: { amount: 50 } },
  { id: "embers-fx", name: "Embers", category: "Atmosphere", blurb: "Warm sparks floating upward.", type: "embers-fx", params: { amount: 50 } },
  { id: "leaves-fx", name: "Leaves", category: "Atmosphere", blurb: "Autumn leaves carried on the wind.", type: "leaves-fx", params: { amount: 45 } },
  { id: "smoke", name: "Smoke", category: "Atmosphere", blurb: "Slow gray smoke curling through.", type: "smoke", params: { amount: 40 } },
  { id: "steam", name: "Steam", category: "Atmosphere", blurb: "Rising wisps of white steam.", type: "steam", params: { amount: 35 } },
  { id: "condensation", name: "Condensation", category: "Atmosphere", blurb: "A fogged, damp glass with droplets.", type: "condensation", params: { amount: 30 } },
  // ---------------------------------------------------------------- Retro
  { id: "grain", name: "Grain", category: "Retro", blurb: "Fine film-grain noise, like old stock.", type: "grain", params: {} },
  { id: "noise", name: "Noise", category: "Retro", blurb: "Heavier analog static, like a detuned TV.", type: "noise", params: {} },
  { id: "scanlines", name: "Scanlines", category: "Retro", blurb: "Horizontal CRT scanlines across the element.", type: "scanlines", params: { amount: 30 } },
  { id: "crt", name: "CRT", category: "Retro", blurb: "Full old-monitor look — scanlines, glow, vivid colors.", type: "crt", params: { amount: 30 } },
  { id: "chromatic", name: "Chromatic Edge", category: "Retro", blurb: "Color channels pulled apart at the edges.", type: "chromatic", params: {} },
  { id: "rgb-split", name: "RGB Split", category: "Retro", blurb: "A glitchy red/blue channel offset.", type: "rgb-split", params: {} },
  { id: "pixel-glow", name: "Pixel Glow", category: "Retro", blurb: "A chunky pixel-art halo of light.", type: "pixel-glow", params: {}, color: "#4fd8ff" },
  { id: "hud", name: "HUD lines", category: "Retro", blurb: "Thin sci-fi interface lines and accents.", type: "hud", params: { amount: 40 }, color: "#39d353" },
  { id: "grid", name: "Grid", category: "Retro", blurb: "A faint retro tech grid over the element.", type: "grid", params: { amount: 35 }, color: "#39d353" },
  // ---------------------------------------------------------------- Edge
  { id: "soft-border", name: "Soft Border", category: "Edge", blurb: "A gentle halo edge around the element.", type: "soft-border", params: { amount: 6 }, color: "#5b8cff" },
  { id: "neon-border", name: "Neon Border", category: "Edge", blurb: "A glowing neon outline around the edges.", type: "neon-border", params: {}, color: "#4fd8ff" },
  { id: "aurora-border", name: "Aurora Border", category: "Edge", blurb: "A two-color aurora shimmer along the border.", type: "aurora-border", params: {} },
  { id: "grad-border", name: "Gradient Border", category: "Edge", blurb: "A colored gradient-toned edge glow.", type: "grad-border", params: {}, color: "#8a63ff" },
  { id: "chase", name: "Chasing Light", category: "Edge", blurb: "A bright light that appears to run the border.", type: "chase", params: {}, color: "#ffffff" },
  { id: "electric-edge", name: "Electric Edge", category: "Edge", blurb: "A crackling electric outline.", type: "electric-edge", params: {}, color: "#7fe4ff" },
  { id: "pixel-border", name: "Pixel Border", category: "Edge", blurb: "A blocky pixel-art border.", type: "pixel-border", params: { amount: 8 }, color: "#4fd8ff" },
  { id: "breath", name: "Breathing Glow", category: "Edge", blurb: "A wide glow that pulses softly over time.", type: "breath", params: { amount: 14 }, color: "#5b8cff" },
  // ---------------------------------------------------------------- Basics
  { id: "shadow-soft", name: "Drop Shadow", category: "Basics", blurb: "Lifts the element off the background.", type: "shadow", params: { dx: 0, dy: 6, blur: 10 } },
  { id: "shadow-ambient", name: "Ambient Shadow", category: "Basics", blurb: "A soft all-around darkness.", type: "shadow", params: { dx: 0, dy: 2, blur: 18 } },
  { id: "shadow-long", name: "Long Shadow", category: "Basics", blurb: "A dramatic angled shadow.", type: "shadow", params: { dx: 14, dy: 14, blur: 6 } },
  { id: "blur", name: "Soft Blur", category: "Basics", blurb: "Pushes the element out of focus.", type: "blur", params: { amount: 6 } },
];

/** Display order of categories in the effect browser. */
export const EFFECT_CATEGORY_ORDER: EffectCategory[] = [
  "Light", "Material", "Color", "Atmosphere", "Retro", "Edge", "Basics",
];

export const effectPresetById = (id: string): EffectPreset | undefined =>
  EFFECT_PRESETS.find((p) => p.id === id);

export function makeEffect(preset: EffectPreset): LayerEffect {
  return {
    id: `fx-${Math.random().toString(36).slice(2, 10)}`,
    type: preset.type,
    visible: true,
    params: { ...preset.params },
    ...(preset.color ? { color: preset.color } : {}),
  };
}

const GENERIC_NAMES: Record<string, string> = {
  glow: "Glow", shadow: "Shadow", blur: "Blur", grain: "Grain",
  "light-sweep": "Light Sweep", bloom: "Bloom", neon: "Neon", frost: "Frost",
  halo: "Halo", rim: "Rim Light", "film-glow": "Film Glow", heavenly: "Heavenly Glow",
  rays: "Light Rays", electric: "Electric", glass: "Clear Glass", "tinted-glass": "Tinted Glass",
  chrome: "Chrome", holo: "Holographic", plastic: "Soft Plastic", "grad-overlay": "Gradient Overlay",
  duotone: "Duotone", grade: "Color Grade", gradmap: "Gradient Map", tint: "Tint",
  contrast: "Contrast", saturation: "Saturation", "rain-fx": "Rain", "snow-fx": "Snow",
  "fog-fx": "Fog", mist: "Mist", "dust-fx": "Dust", "bokeh-fx": "Bokeh", "stars-fx": "Stars",
  "fireflies-fx": "Fireflies", "embers-fx": "Embers", "leaves-fx": "Leaves", smoke: "Smoke",
  steam: "Steam", condensation: "Condensation", noise: "Noise", scanlines: "Scanlines",
  crt: "CRT", chromatic: "Chromatic Edge", "rgb-split": "RGB Split", "pixel-glow": "Pixel Glow",
  hud: "HUD lines", grid: "Grid", "soft-border": "Soft Border", "neon-border": "Neon Border",
  "aurora-border": "Aurora Border", "grad-border": "Gradient Border", chase: "Chasing Light",
  "electric-edge": "Electric Edge", "pixel-border": "Pixel Border", breath: "Breathing Glow",
};

/** Friendly name for an effect instance (closest preset or generic label). */
export function effectName(e: LayerEffect): string {
  const match = EFFECT_PRESETS.find(
    (p) => p.type === e.type && JSON.stringify(p.params) === JSON.stringify(e.params),
  );
  if (match) return match.name;
  return GENERIC_NAMES[e.type] ?? e.type;
}
