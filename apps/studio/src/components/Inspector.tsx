import { FontPicker } from "./FontPicker.js";
import { Sparkles, Plus, Trash2 } from "lucide-react";
import { asPaint, isGroupLayer, type Paint, type RectLayer } from "@pcs/bannerspec";
import type { Editor } from "../editor.js";
import { NumberField, TextField, Toggle, PropertyRow, InspectorSection } from "./controls.js";
import { PaintEditor } from "./PaintEditor.js";
import { EffectBrowser } from "./EffectBrowser.js";
import { EffectStack } from "./EffectStack.js";
import { effectName, makeEffect } from "../effects.js";
import { WindowControls, isWindowGroup } from "./WindowControls.js";
import { CollapsedRightStrip as _csr } from "./InspectorCollapsed.js";

export function Inspector({ editor }: { editor: Editor }) {
  const { doc, selected, updateLayer, updateCanvas, showSafeArea, setShowSafeArea, mode } = editor;

  return (
    <aside className="side-panel right" style={{ width: editor.rightWidth }} aria-label="Inspector">
      <div className="panel-resizer" role="separator" aria-label="Resize inspector" aria-orientation="vertical" tabIndex={0} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();editor.setRightWidth(Math.min(420,Math.max(240,editor.rightWidth+(e.key==='ArrowLeft'?16:-16))));}}} onMouseDown={(e) => {
        e.preventDefault();
        const startX = e.clientX, startW = editor.rightWidth;
        const move = (ev: PointerEvent) => editor.setRightWidth(Math.min(420, Math.max(240, startW - (ev.clientX - startX))));
        const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      }} />
      <header className="panel-header">
        <h2>{selected ? selected.name : "Canvas"}</h2>
        <span style={{ flex: 1 }} />
        <button className="panel-collapse-btn" title="Collapse inspector" aria-label="Collapse inspector"
          onClick={() => editor.setRightCollapsed(true)}>
          <ChevronRight />
        </button>
      </header>
      <div className="panel-body">
        {!selected && <InspectorSection title="Canvas">
          <PropertyRow label="Size">
            <NumberField value={doc.canvas.width} min={1} max={16384} onChange={(v) => updateCanvas({ width: v })} />
            <NumberField value={doc.canvas.height} min={1} max={16384} onChange={(v) => updateCanvas({ height: v })} />
          </PropertyRow>
          <PropertyRow label="Background">
            <input
              className="field-input color-hex" type="text"
              value={typeof doc.canvas.background === "string" ? doc.canvas.background : "#0f1420"}
              onChange={(e) => updateCanvas({ background: e.target.value })}
              aria-label="Background color"
              spellCheck={false}
            />
          </PropertyRow>
          <PropertyRow label="Platform">
            <span className="field-input readonly-value">Master scene</span>
          </PropertyRow>
          <PropertyRow label="Safe area">
            <Toggle on={showSafeArea} onChange={setShowSafeArea} label="Show safe area" />
          </PropertyRow>
        </InspectorSection>}

        {selected ? (
          <LayerSections key={selected.id} editor={editor} readonly={mode === "preview"} />
        ) : (
          <p className="empty-hint">Select a layer to edit its properties.</p>
        )}
      </div>
    </aside>
  );
}

function ChevronRight() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transform: "rotate(90deg)" }}>
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

function LayerSections({ editor, readonly }: { editor: Editor; readonly: boolean }) {
  const { selected, updateLayer, store } = editor;
  if (!selected) return null;
  if (isGroupLayer(selected)) {
    return (
      <>
        <InspectorSection title="Group">
          <PropertyRow label="Name">
            <TextField value={selected.name} onChange={(v) => updateLayer(selected.id, { name: v }, `insp:${selected.id}`)} />
          </PropertyRow>
          <p className="empty-hint">{selected.children.length} elements inside. Use Ambience controls or Advanced Mode for details.</p>
        </InspectorSection>
        {isWindowGroup(selected) && !readonly && (
          <WindowControls editor={editor} group={selected} />
        )}
        {!readonly && <InspectorSection title="Effects"><EffectStack editor={editor}/></InspectorSection>}
      </>
    );
  }
  const patch = (p: Parameters<typeof updateLayer>[1]) =>
    readonly ? undefined : updateLayer(selected.id, p, `inspector:${selected.id}`);
  const paint = asPaint(selected.fill, "#5b8cff");
  const rect = selected.type === "rect" ? (selected as RectLayer) : null;

  return (
    <>
      <InspectorSection title="Transform">
        <PropertyRow label="Name">
          <TextField value={selected.name} onChange={(v) => patch({ name: v })!} />
        </PropertyRow>
        <PropertyRow label="Position">
          <NumberField value={selected.x} onChange={(v) => patch({ x: v })!} />
          <NumberField value={selected.y} onChange={(v) => patch({ y: v })!} />
        </PropertyRow>
        {rect && (
          <PropertyRow label="Size">
            <NumberField value={rect.width} min={0} onChange={(v) => patch({ width: v })!} />
            <NumberField value={rect.height} min={0} onChange={(v) => patch({ height: v })!} />
          </PropertyRow>
        )}
        <PropertyRow label="Rotation">
          <NumberField value={selected.rotation} min={-360} max={360} onChange={(v) => patch({ rotation: v })!} suffix="°" />
        </PropertyRow>
        <PropertyRow label="Opacity">
          <NumberField value={selected.opacity} step={0.05} min={0} max={1} onChange={(v) => patch({ opacity: v })!} />
        </PropertyRow>
      </InspectorSection>

      {selected.type !== "image" && selected.type !== "line" && (
        <InspectorSection title="Appearance">
          <PaintEditor
            paint={paint}
            onChange={(p: Paint) => updateLayer(selected.id, { fill: p }, `paint:${selected.id}`)}
            brandColors={Object.entries(editor.doc.brand ?? {})
              .filter(([, v]) => typeof v === "string")
              .map(([name, color]) => ({ name, color: color as string }))}
          />
        </InspectorSection>
      )}

      {rect && (
        <InspectorSection title="Border & corners" defaultOpen={false}>
          <PropertyRow label="Corner radius">
            <NumberField value={rect.cornerRadius ?? 0} min={0} onChange={(v) => patch({ cornerRadius: v })!} />
          </PropertyRow>
          <PropertyRow label="Border">
            <Toggle
              on={(rect.border?.width ?? 0) > 0}
              label="Border enabled"
              onChange={(on) => patch({ border: on ? { paint: { type: "solid", color: "#5b8cff" }, width: 2 } : undefined } as Partial<Parameters<typeof updateLayer>[1]>)}
            />
          </PropertyRow>
          {rect.border && (
            <>
              <PropertyRow label="Width">
                <NumberField value={rect.border.width} min={0} onChange={(v) => patch({ border: { ...rect.border!, width: v } })!} />
              </PropertyRow>
              <div className="paint-row">
                <span className="prop-label">Border paint</span>
              </div>
              <PaintEditor
                paint={asPaint(rect.border.paint, "#5b8cff")}
                onChange={(p) => patch({ border: { ...rect.border!, paint: p } })}
              />
            </>
          )}
        </InspectorSection>
      )}

      {selected.type === "text" && (
        <InspectorSection title="Text & Font">
          <FontPicker value={selected.fontFamily} onChange={fontFamily=>patch({fontFamily})!}/>
          <PropertyRow label="Text">
            <TextField multiline value={selected.text} onChange={(v) => patch({ text: v })!} />
          </PropertyRow>
          <PropertyRow label="Font size">
            <NumberField value={selected.fontSize} min={1} onChange={(v) => patch({ fontSize: v })!} />
          </PropertyRow>
          <PropertyRow label="Tracking">
            <NumberField value={selected.letterSpacing ?? 0} step={0.5} onChange={(v) => patch({ letterSpacing: v })!} />
          </PropertyRow>
          <PropertyRow label="Line height">
            <NumberField value={selected.lineHeight ?? 1.2} step={0.05} min={0.5} onChange={(v) => patch({ lineHeight: v })!} />
          </PropertyRow>
        </InspectorSection>
      )}

      {selected.type === "image" && (
        <InspectorSection title="Image">
          <PropertyRow label="Corner radius">
            <NumberField value={selected.cornerRadius ?? 0} min={0} onChange={(v) => patch({ cornerRadius: v })!} />
          </PropertyRow>
          <p className="empty-hint" style={{ padding: "4px 2px", textAlign: "left" }}>
            Embedded image · {Math.max(1, Math.round((selected.src.length * 0.75) / 1024))} KB
          </p>
        </InspectorSection>
      )}

      <InspectorSection title="Effects" defaultOpen={false}>
        <EffectStack editor={editor}/>
        {/* Card browser (real rendered thumbnails, hover preview) — no dropdowns. */}
        {!readonly && (
          <details>
            <summary className="paint-hint" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <Plus size={12} /> Add effect…
            </summary>
            <EffectBrowser
              editor={editor}
              compact
              onAdd={(preset) => {
                if (readonly) return;
                updateLayer(selected.id, { effects: [...(selected.effects ?? []), makeEffect(preset)] } as never);
              }}
            />
          </details>
        )}
      </InspectorSection>

      <InspectorSection title="Animation" defaultOpen={false}>
        {(selected.tracks ?? []).length > 0 ? (
          <PropertyRow label="Keyframes">
            <span className="field-input readonly-value">
              {(selected.tracks ?? []).reduce((n, t) => n + t.keys.length, 0)} on {(selected.tracks ?? []).length} track(s)
            </span>
          </PropertyRow>
        ) : (
          <p className="paint-hint">No keyframes yet.</p>
        )}
        <p className="paint-hint">Edit keyframes in the Motion timeline (bottom panel).</p>
      </InspectorSection>
    </>
  );
}

export { CollapsedRightStrip } from "./InspectorCollapsed.js";
void _csr;
