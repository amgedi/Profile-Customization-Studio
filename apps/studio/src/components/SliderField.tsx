import { useState } from "react";

/**
 * Creative-tool slider with live value, keyboard support, double-click
 * numeric entry, and optional human range labels (Light ──●── Heavy).
 */
export function SliderField({
  label, value, onChange, min = 0, max = 1, step = 0.01, defaultValue, lowLabel, highLabel, format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  lowLabel?: string;
  highLabel?: string;
  format?: (v: number) => string;
}) {
  const [editing, setEditing] = useState(false);
  const pct = ((value - min) / (max - min)) * 100;
  const display = format ? format(value) : (max - min <= 1 ? `${Math.round(value * 100)}%` : value.toFixed(1));

  return (
    <div className="slider-field">
      <div className="slider-head">
        <span className="slider-label">{label}</span>
        <span
          className="slider-value"
          title="Double-click to type an exact value"
          onDoubleClick={() => setEditing(true)}
        >
          {editing ? (
            <input
              className="field-input slider-num"
              autoFocus
              defaultValue={value}
              onBlur={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v))); setEditing(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            />
          ) : display}
        </span>
        {defaultValue !== undefined && Math.abs(value - defaultValue) > 1e-9 && (
          <button className="icon-btn slider-reset" title="Reset" aria-label={`Reset ${label}`}
            onClick={() => onChange(defaultValue)}>↺</button>
        )}
      </div>
      <div className="slider-lowhigh">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
      <input
        className="pcs-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ ["--slider-pct" as never]: `${pct}%` }}
        aria-label={label}
      />
    </div>
  );
}
