import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
const FieldLabel = createContext("Value");

export function NumberField({
  value, onChange, step = 1, min, max, suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  const clamp = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
  const fieldLabel = useContext(FieldLabel);
  return (
    <span className="stepper">
      <input
        className="field-input"
        type="number"
        aria-label={fieldLabel}
        value={Number.isFinite(value) ? value : 0}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onChange(clamp(v));
        }}
      />
      <span className="step-btns">
        <button title={`+${step}${suffix ? " " + suffix : ""}`} onClick={() => onChange(clamp(value + step))}>▲</button>
        <button title={`-${step}${suffix ? " " + suffix : ""}`} onClick={() => onChange(clamp(value - step))}>▼</button>
      </span>
    </span>
  );
}

export function TextField({ value, onChange, multiline, placeholder }: {
  value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string;
}) {
  const fieldLabel = useContext(FieldLabel);
  if (multiline) {
    return <textarea className="field-input" aria-label={placeholder || fieldLabel} rows={2} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
  }
  return <input className="field-input" aria-label={placeholder || fieldLabel} type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16) / 255, g = parseInt(n.slice(2, 4), 16) / 255, b = parseInt(n.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return { h: ((h * 60) + 360) % 360, s: max === 0 ? 0 : d / max, v: max };
}
function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  const to = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

const RECENT_COLORS_KEY = "pcs-recent-colors";
function pushRecentColor(hex: string): string[] {
  try {
    const list: string[] = JSON.parse(localStorage.getItem(RECENT_COLORS_KEY) ?? "[]")
      .filter((c: string) => c !== hex);
    list.unshift(hex);
    const out = list.slice(0, 10);
    localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(out));
    return out;
  } catch { return [hex]; }
}
function loadRecentColors(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_COLORS_KEY) ?? "[]"); } catch { return []; }
}

const BRAND_PALETTE = ["#5b8cff", "#8a63ff", "#c08bff", "#38bdf8", "#4cc98a", "#e0a458", "#e5484d", "#f4f5f8", "#9ba4b3", "#171a1f"];

/** R47/R48 — primary color interaction is a visual field + hue slider +
 *  swatch rows; the hex input only appears in Advanced experience. */
export function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const safe = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
  const hsv = hexToHsv(safe);
  const [recent, setRecent] = useState<string[]>(loadRecentColors);
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const popRef = useRef<HTMLSpanElement | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node) && !popRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); setOpen(false); wrapRef.current?.querySelector<HTMLButtonElement>("button")?.focus(); } };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey, true); };
  }, [open]);

  const apply = (hex: string) => {
    onChange(hex);
    setRecent(pushRecentColor(hex));
  };

  return (
    <span className="color-field" ref={wrapRef}>
      <button
        type="button"
        className="color-swatch"
        style={{ background: safe }}
        onClick={() => { const r = wrapRef.current?.getBoundingClientRect(); if (r) setPosition({ left: Math.max(8, Math.min(window.innerWidth - 250, r.left)), top: Math.max(8, Math.min(window.innerHeight - 290, r.bottom + 8)) }); setOpen((o) => !o); }}
        aria-label="Pick color"
        aria-expanded={open}
      />
      {open && createPortal(
        <span ref={popRef} className="color-pop" style={{ position: "fixed", left: position.left, top: position.top, zIndex: "var(--z-confirm)" }} role="dialog" aria-label="Color picker">
          <span
            className="sv-area"
            style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hsvToHex(hsv.h, 1, 1)})` }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const rect = e.currentTarget.getBoundingClientRect();
              const move = (ev: PointerEvent | React.PointerEvent) => {
                const x = Math.min(1, Math.max(0, ((ev as PointerEvent).clientX - rect.left) / rect.width));
                const y = Math.min(1, Math.max(0, ((ev as PointerEvent).clientY - rect.top) / rect.height));
                apply(hsvToHex(hsv.h, x, 1 - y));
              };
              move(e);
              const mv = (ev: PointerEvent) => move(ev);
              const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
              window.addEventListener("pointermove", mv);
              window.addEventListener("pointerup", up);
            }}
          >
            <span className="sv-cursor" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
          </span>
          <input
            type="range" className="hue-slider" min={0} max={360}
            value={Math.round(hsv.h)}
            aria-label="Hue"
            onChange={(e) => apply(hsvToHex(Number(e.target.value), Math.max(0.08, hsv.s), Math.max(0.08, hsv.v)))}
          />
          <span className="swatch-row" aria-label="Suggested colors">
            {BRAND_PALETTE.map((c) => (
              <button key={c} type="button" className="swatch" style={{ background: c }} onClick={() => apply(c)} aria-label={`Color ${c}`} />
            ))}
          </span>
          {recent.length > 0 && (
            <span className="swatch-row" aria-label="Recent colors">
              {recent.slice(0, 8).map((c) => (
                <button key={c} type="button" className="swatch" style={{ background: c }} onClick={() => apply(c)} aria-label={`Recent ${c}`} />
              ))}
            </span>
          )}
        </span>, document.body
      )}
      <input
        className="field-input color-hex"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Color value"
        spellCheck={false}
      />
    </span>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      className={"toggle" + (on ? " on" : "")}
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
    />
  );
}

export function PropertyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="prop-row">
      <span className="prop-label">{label}</span>
      <span className="prop-control"><FieldLabel.Provider value={label}>{children}</FieldLabel.Provider></span>
    </div>
  );
}

export function InspectorSection({ title, children, defaultOpen = true }: {
  title: string; children: ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="inspector-section">
      <button className="section-header" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {title}
      </button>
      {open && <div className="section-body">{children}</div>}
    </section>
  );
}
