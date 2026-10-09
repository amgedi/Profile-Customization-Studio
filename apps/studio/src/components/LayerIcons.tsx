import { useMemo } from "react";
import {
  BarChart3, CloudFog, Bug, Building2, Lightbulb, CloudRain, Flag, Frame, Gamepad2, Group as GroupIcon,
  Image as ImageIcon, Mountain as Landscape, Link2, Minus, Palette, SlidersHorizontal,
  Snowflake, Sparkles, Square, Star, Sun, TreePine, Type as TypeIcon,
  AppWindow as Window, Circle,
} from "lucide-react";
import { isGroupLayer, type GroupKind, type Layer } from "@pcs/bannerspec";

/**
 * Central LayerIconResolver — the ONLY place that maps a layer to an icon.
 * Based on semantic layer type / component kind, never on implementation
 * details. No other component should duplicate this logic.
 */
export function layerIconFor(layer: Layer): typeof TypeIcon {
  if (isGroupLayer(layer)) {
    const kind = layer.kind as GroupKind | undefined;
    const map: Partial<Record<GroupKind, typeof TypeIcon>> = {
      rain: CloudRain,
      snow: Snowflake,
      fog: CloudFog,
      fireflies: Bug,
      stars: Star,
      leaves: TreePine,
      trees: TreePine,
      city: Building2,
      lights: Lightbulb,
      scene: Landscape,
    };
    if (kind && map[kind]) return map[kind]!;
    const byName = layer.name.toLowerCase();
    if (byName.includes("photo")) return ImageIcon;
    if (byName.includes("window")) return Window;
    if (byName.includes("rain")) return CloudRain;
    if (byName.includes("snow")) return Snowflake;
    if (byName.includes("bokeh") || byName.includes("firefl")) return Sparkles;
    if (byName.includes("glow") || byName.includes("light")) return Sun;
    if (byName.includes("border") || byName.includes("frame")) return Frame;
    if (byName.includes("grade") || byName.includes("color")) return Palette;
    if (byName.includes("stats")) return BarChart3;
    if (byName.includes("game") || byName.includes("snake") || byName.includes("contribution")) return Gamepad2;
    if (byName.includes("border")) return Frame;
    return GroupIcon;
  }
  switch (layer.type) {
    case "text": return TypeIcon;
    case "rect": {
      if(layer.effects?.some(e=>e.type==='rain-fx'))return CloudRain;
      if(layer.effects?.some(e=>e.type==='fog-fx'||e.type==='mist'))return CloudFog;
      if(layer.effects?.some(e=>e.type==='heavenly'))return Sparkles;
      if(/background|scrim|grade/i.test(layer.name))return Palette;
      return Square;
    }
    case "ellipse": return Circle;
    case "line": return Minus;
    case "image": return ImageIcon;
    default: return Square;
  }
}

const byNameExtra = (name: string, fallback: typeof TypeIcon): typeof TypeIcon => {
  const n = name.toLowerCase();
  if (n.includes("social") || n.includes("link")) return Link2;
  if (n.includes("button")) return SlidersHorizontal;
  if (n.includes("sponsor") || n.includes("footer")) return Flag;
  return fallback;
};

export function LayerIcon({ layer }: { layer: Layer }) {
  const Icon = useMemo(() => byNameExtra(layer.name, layerIconFor(layer)), [layer]);
  return <Icon size={15} strokeWidth={1.7} aria-hidden />;
}
