import {StudioSelect} from './StudioSelect.js';
import { useEffect, useState } from "react";
import { linear, solid, type AnimatedPaint, type Paint, type Stop } from "@pcs/bannerspec";
import { shiftHue } from "@pcs/scene-core";
import { NumberField, Toggle } from "./controls.js";

// ---------------------------------------------------------------- color math

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 8) h = h.slice(0, 6);
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

const RECENT_KEY = "pcs-recent-colors";
function loadRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[]; } catch { return []; }
}
function pushRecent(color: string): void {
  const list = loadRecent().filter((c) => c !== color);
  list.unshift(color);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 10)));
}

// ---------------------------------------------------------------- solid editor

function SolidEditor({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const [rgb, setRgb] = useState<[number, number, number]>(() => hexToRgb(/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(color) ? color : "#5b8cff"));
  const [h, s, v] = rgbToHsv(...rgb);
  const setHSV = (nh: number, ns: number, nv: number) => {
    const [r, g, b] = hsvToRgb(nh, ns, nv);
    setRgb([r, g, b]);
    onChange(rgbToHex(r, g, b));
  };

  return (
    <div className="paint-editor">
      <div
        className="sv-area"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${h} 100% 50%))` }}
        onPointerDown={(e) => {
          const el = e.currentTarget;
          const pick = (ev: PointerEvent | React.PointerEvent) => {
            const r = el.getBoundingClientRect();
            const sx = Math.max(0, Math.min(1, ((ev as PointerEvent).clientX - r.left) / r.width));
            const sy = Math.max(0, Math.min(1, ((ev as PointerEvent).clientY - r.top) / r.height));
            setHSV(h, sx, 1 - sy);
          };
          pick(e);
          const move = (ev: PointerEvent) => pick(ev);
          const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); pushRecent(rgbToHex(...rgb)); };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
        }}
      >
        <div className="sv-cursor" style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }} />
      </div>
      <input
        className="hue-slider"
        type="range" min={0} max={360} value={h}
        style={{ background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}
        onChange={(e) => setHSV(parseFloat(e.target.value), s || 1, v || 1)}
        aria-label="Hue"
      />
      <div className="paint-row">
        <input className="field-input color-hex" value={color} onChange={(e) => onChange(e.target.value)} aria-label="Hex value" spellCheck={false} />
        <input
          className="field-input" type="text" readOnly
          value={`rgb(${rgb.map((x) => Math.round(x)).join(", ")})`}
          aria-label="RGB value"
          style={{ color: "var(--pcs-text-muted)", cursor: "copy" }}
          onClick={(e) => { (e.target as HTMLInputElement).select(); void document.execCommand?.("copy"); }}
        />
      </div>
      {loadRecent().length > 0 && (
        <div className="swatch-row">
          {loadRecent().map((c) => (
            <button key={c} className="swatch" style={{ background: c }} title={c} onClick={() => onChange(c)} aria-label={`Recent color ${c}`} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- gradient editor

function GradientEditor({ paint, onChange }: { paint: ReturnType<typeof linear>; onChange: (p: Paint) => void }) {
  const [selected, setSelected] = useState(0);
  const stops = paint.stops;
  const stop = stops[Math.min(selected, stops.length - 1)] ?? { color: "#ffffff", offset: 0.5 };

  const updateStops = (next: Stop[]) => onChange(linear(next, paint.angle));

  const moveStop = (index: number, offset: number) => {
    const next = stops.map((s, i) => (i === index ? { ...s, offset: Math.max(0, Math.min(1, offset)) } : s));
    updateStops(next.sort((a, b) => a.offset - b.offset));
  };

  return (
    <div className="paint-editor">
      <div
        className="gradient-bar"
        style={{ background: `linear-gradient(90deg, ${stops.map((st) => `${st.color} ${st.offset * 100}%`).join(", ")})` }}
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const offset = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
          // Click near an existing stop selects it; otherwise add a stop.
          const idx = stops.findIndex((st) => Math.abs(st.offset - offset) < 0.04);
          if (idx >= 0) setSelected(idx);
          else {
            const next = [...stops, { color: blendStops(stops, offset), offset }];
            updateStops(next.sort((a, b) => a.offset - b.offset));
            setSelected(next.findIndex((st) => st.offset === offset));
          }
        }}
      >
        {stops.map((st, i) => (
          <button
            key={i}
            className={"grad-stop" + (i === selected ? " selected" : "")}
            style={{ left: `${st.offset * 100}%`, background: st.color }}
            title={`${Math.round(st.offset * 100)}% — ${st.color}`}
            onPointerDown={(e) => {
              e.stopPropagation();
              setSelected(i);
              const bar = (e.currentTarget as HTMLElement).parentElement!;
              const move = (ev: PointerEvent) => {
                const r = bar.getBoundingClientRect();
                moveStop(i, (ev.clientX - r.left) / r.width);
              };
              const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (stops.length > 2) updateStops(stops.filter((_, j) => j !== i));
            }}
          />
        ))}
      </div>
      <p className="paint-hint">Drag stops · double-click a stop to remove</p>
      <div className="paint-row">
        <span className="prop-label">Stop color</span>
        <input className="field-input color-hex" value={stop.color} onChange={(e) => updateStops(stops.map((st, i) => (i === selected ? { ...st, color: e.target.value } : st)))} aria-label="Stop color" spellCheck={false} />
      </div>
      <div className="paint-row">
        <span className="prop-label">Angle</span>
        <NumberField value={paint.angle} onChange={(v) => onChange(linear(stops, v))} suffix="°" />
      </div>
      <div className="paint-row">
        <span className="prop-label">Preview</span>
        <div className="gradient-preview" style={{ background: `linear-gradient(${paint.angle + 90}deg, ${stops.map((st) => `${st.color} ${st.offset * 100}%`).join(", ")})` }} />
      </div>
    </div>
  );
}

function blendStops(stops: Stop[], offset: number): string {
  const sorted = [...stops].sort((a, b) => a.offset - b.offset);
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!, b = sorted[i + 1]!;
    if (offset >= a.offset && offset <= b.offset) {
      const f = (offset - a.offset) / (b.offset - a.offset || 1);
      const [r1, g1, b1] = hexToRgb(a.color);
      const [r2, g2, b2] = hexToRgb(b.color);
      return rgbToHex(r1 + (r2 - r1) * f, g1 + (g2 - g1) * f, b1 + (b2 - b1) * f);
    }
  }
  return sorted[0]?.color ?? "#ffffff";
}

// ---------------------------------------------------------------- animated editor

const ANIMATED_MODES: Array<{ id: AnimatedPaint["mode"]; label: string }> = [
  { id: "hue-cycle", label: "Hue Cycle" },
  { id: "gradient-drift", label: "Gradient Drift" },
  { id: "color-pulse", label: "Color Pulse" },
  { id: "aurora", label: "Aurora Shift" },
  { id: "light-sweep", label: "Light Sweep" },
  { id: "palette-cycle", label: "Palette Cycle" },
];

function AnimatedEditor({ paint, onChange }: { paint: AnimatedPaint; onChange: (p: Paint) => void }) {
  return (
    <div className="paint-editor">
      <div className="paint-row">
        <span className="prop-label">Mode</span>
        <StudioSelect
          className="field-input"
          value={paint.mode}
          onChange={(e) => onChange({ ...paint, mode: e.target.value as AnimatedPaint["mode"] })}
          aria-label="Animated paint mode"
        >
          {ANIMATED_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </StudioSelect>
      </div>
      <GradientEditor
        paint={paint.base}
        onChange={(p) => { if (p.type === "linear") onChange({ ...paint, base: p }); }}
      />
      <div className="paint-row">
        <span className="prop-label">Duration</span>
        <NumberField value={paint.duration} min={0.5} step={0.5} onChange={(v) => onChange({ ...paint, duration: v })} suffix="s" />
      </div>
      <div className="paint-row">
        <span className="prop-label">Live preview</span>
        <AnimatedPreview paint={paint} />
      </div>
      <p className="paint-hint">Exports render as animated SVG; static targets get a poster-frame fallback.</p>
    </div>
  );
}

function AnimatedPreview({ paint }: { paint: AnimatedPaint }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT((x) => (x + 0.05) % paint.duration), 50);
    return () => clearInterval(iv);
  }, [paint.duration]);
  const phase = (t / paint.duration) * 360;
  const colors = paint.base.stops.map((s) => shiftHue(s.color, phase)).join(", ");
  return <div className="gradient-preview" style={{ background: `linear-gradient(${paint.base.angle + 90}deg, ${colors})` }} />;
}

// ---------------------------------------------------------------- entry

export function PaintEditor({ paint, onChange, brandColors = [] }: {
  paint: Paint;
  onChange: (p: Paint) => void;
  brandColors?: Array<{ name: string; color: string }>;
}) {
  const [tab, setTab] = useState<"solid" | "gradient" | "animated">(paint.type === "solid" ? "solid" : paint.type === "animated" ? "animated" : "gradient");
  const effective: Paint =
    tab === "solid" ? (paint.type === "solid" ? paint : solid("#5b8cff"))
    : tab === "animated" ? (paint.type === "animated" ? paint : { type: "animated", mode: "hue-cycle", base: linear([{ color: "#5b8cff", offset: 0 }, { color: "#8a63ff", offset: 1 }], 0), duration: 6 })
    : (paint.type === "linear" ? paint : linear([{ color: "#5b8cff", offset: 0 }, { color: "#8a63ff", offset: 1 }], 0));

  return (
    <div className="paint-root">
      <div className="segmented" role="tablist" aria-label="Paint type">
        <button className={tab === "solid" ? "active" : ""} onClick={() => setTab("solid")}>Solid</button>
        <button className={tab === "gradient" ? "active" : ""} onClick={() => setTab("gradient")}>Gradient</button>
        <button className={tab === "animated" ? "active" : ""} onClick={() => setTab("animated")}>Animated</button>
      </div>
      {tab === "solid" && <SolidEditor color={(effective as { color: string }).color} onChange={(c) => onChange(solid(c))} />}
      {tab === "gradient" && <GradientEditor paint={effective as ReturnType<typeof linear>} onChange={onChange} />}
      {tab === "animated" && <AnimatedEditor paint={effective as AnimatedPaint} onChange={onChange} />}
      {brandColors.length > 0 && (
        <div className="swatch-row">
          {brandColors.map((b) => (
            <button key={b.name} className="swatch" style={{ background: b.color }} title={`Brand: ${b.name}`}
              onClick={() => onChange(solid(b.color))} aria-label={`Brand color ${b.name}`} />
          ))}
        </div>
      )}
    </div>
  );
}

export { Toggle };
