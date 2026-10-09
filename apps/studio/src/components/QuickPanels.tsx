import { FontPicker } from "./FontPicker.js";
import { backgroundPaint, withBackgroundPaint } from "../background.js";
import { EffectStack as ParameterEffectStack } from "./EffectStack.js";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Eye, EyeOff, Lock, Unlock, MoreHorizontal, Plus, Sparkles, Trash2, CloudRain } from "lucide-react";
import { isGroupLayer, type GroupKind, type Layer } from "@pcs/bannerspec";
import { LayerIcon } from "./LayerIcons.js";
import type { Editor } from "../editor.js";
import { AMBIENCE_KINDS, generateGroupChildren, makeGroup, RAIN_PRESETS, SNOW_PRESETS, type GroupParams } from "../scenegen.js";
import { PALETTES, ANIMATED_COLOR_CARDS, GRADIENT_PRESETS, shiftScenePalette } from "../presets.js";
import { makeEffect, effectName } from "../effects.js";
import { EffectBrowser } from "./EffectBrowser.js";
import { WindowControls, isWindowGroup } from "./WindowControls.js";
import { SliderField } from "./SliderField.js";
import { PaintEditor } from "./PaintEditor.js";

// ---------------------------------------------------------------- layer icons



// ---------------------------------------------------------------- layers tree

export function LayersTree({ editor, quick }: { editor: Editor; quick: boolean }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const toggle = (id: string) => {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const renderRow = (layer: Layer, depth: number) => {
    const isGroup = isGroupLayer(layer);
    const isOpen = expanded.has(layer.id);
    return (
      <div key={layer.id}>
        <div
          className={"layer-item" + (layer.id === editor.selectedId ? " selected" : "") + (!layer.visible ? " hidden-layer" : "")}
          style={{ paddingLeft: 6 + depth * 16 }}
          data-layer-id={layer.id}
          role="treeitem" tabIndex={0} aria-selected={editor.selectedIds.includes(layer.id) || layer.id === editor.selectedId}
          aria-expanded={isGroup ? isOpen : undefined}
          draggable={!layer.locked && depth === 0}
          onDragStart={() => setDragged(layer.id)}
          onDragOver={e => { if (depth === 0) e.preventDefault(); }}
          onDrop={e => { e.preventDefault(); if (dragged && depth === 0) editor.store.reorderLayer(dragged, editor.doc.layers.findIndex(l => l.id === layer.id)); setDragged(null); }}
          onClick={e => { if (e.ctrlKey || e.metaKey || e.shiftKey) { editor.setSelectedIds(ids => ids.includes(layer.id) ? ids.filter(id => id !== layer.id) : [...new Set([editor.selectedId, ...ids, layer.id].filter((id): id is string => !!id))]); } else editor.setSelectedIds([layer.id]); editor.setSelectedId(layer.id); }}
          onDoubleClick={() => { if (!layer.locked) setRenaming(layer.id); }}
          onKeyDown={e => { if (e.target !== e.currentTarget) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); editor.setSelectedId(layer.id); editor.setSelectedIds([layer.id]); } if (e.key === "F2" && !layer.locked) { e.preventDefault(); setRenaming(layer.id); } if (isGroup && ["ArrowRight", "ArrowLeft"].includes(e.key)) { e.preventDefault(); e.stopPropagation(); setExpanded(ids => { const next = new Set(ids); if (e.key === "ArrowRight") next.add(layer.id); else next.delete(layer.id); return next; }); } }}
        >
          <span className="layer-type">
            {isGroup ? (
              <button className="icon-btn" style={{ width: 16, height: 16 }} onClick={(e) => { e.stopPropagation(); toggle(layer.id); }} aria-label={isOpen ? "Collapse group" : "Expand group"}>
                {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
            ) : <LayerIcon layer={layer} />}
          </span>
          {renaming === layer.id ? <input className="field-input" autoFocus aria-label="Layer name" defaultValue={layer.name} onClick={e => e.stopPropagation()} onBlur={e => { const name = e.target.value.trim(); if (name) editor.updateLayer(layer.id, { name }); setRenaming(null); }} onKeyDown={e => { e.stopPropagation(); if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { e.currentTarget.value = layer.name; e.currentTarget.blur(); } }}/> : <span className="layer-name" title={layer.name}>{layer.name}</span>}
          {quick && (
            <span className="layer-badges">
              {isGroup && layer.kind && layer.kind !== "scene" && <span className="badge badge-ambient">{layer.kind}</span>}
              {(layer.tracks?.length ?? 0) > 0 && <span className="badge badge-anim">animated</span>}
            </span>
          )}
          <button className="icon-btn row-hover" title={layer.visible ? "Hide" : "Show"} aria-label={`${layer.visible ? "Hide" : "Show"} ${layer.name}`}
            onClick={(e) => { e.stopPropagation(); editor.updateLayer(layer.id, { visible: !layer.visible }); }}>
            {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
          <button className="icon-btn row-hover" title={layer.locked ? "Unlock" : "Lock"} aria-label={`${layer.locked ? "Unlock" : "Lock"} ${layer.name}`}
            onClick={(e) => { e.stopPropagation(); editor.updateLayer(layer.id, { locked: !layer.locked }); }}>
            {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
          </button>
        </div>
        {isGroup && isOpen && layer.children.map((c) => renderRow(c, depth + 1))}
      </div>
    );
  };

  const ordered = [...editor.doc.layers].reverse();
  return <div className="layer-list" role="tree" aria-label="Scene layers" aria-multiselectable="true">{ordered.map((l) => renderRow(l, 0))}</div>;
}

// ---------------------------------------------------------------- ambience

export function AmbienceControls({ editor }: { editor: Editor }) {
  const { doc } = editor;
  const W = doc.canvas.width, H = doc.canvas.height;
  const groups = doc.layers.filter(isGroupLayer);

  const addAmbience = (kind: GroupKind, preset?: {name:string;params:Omit<GroupParams,'seed'>}) => {
    if(kind==='rain'||kind==='fog'){
      const layer:Layer={id:crypto.randomUUID(),type:'rect',name:preset?`${preset.name} ${kind}`:kind==='rain'?'Window raindrops':'Fog · adjustable',visible:true,locked:false,opacity:1,rotation:0,x:0,y:0,width:W,height:H,fill:'#00000000',effects:[{id:crypto.randomUUID(),type:kind==='rain'?'rain-fx':'fog-fx',visible:true,params:kind==='rain'?{amount:preset?(preset.params.intensity??.7)*100:70,count:preset?(preset.params.count??24)*4:112,speed:preset?.params.speed??.7,wind:preset?.params.wind??.15,sizeMin:1.4,sizeMax:preset?.name==='Storm'?6:5}:{density:.4,height:.85,softness:.5,speed:.6}}]};editor.store.addLayer(layer);editor.setSelectedId(layer.id);editor.setSaveState('unsaved');return;
    }
    editor.store.addLayer(makeGroup(kind, (kind as string)[0]!.toUpperCase() + (kind as string).slice(1), { count: 24, speed: 1, intensity: 0.9, seed: Math.floor(Math.random() * 100000) }, W, H));
    editor.setSaveState("unsaved");
  };

  const isProcedural = (g: NonNullable<typeof groups>[number]) =>
    AMBIENCE_KINDS.some((k) => k.kind === g.kind);

  const applyPreset = (kind: GroupKind, preset: { name: string; params: Omit<GroupParams, "seed"> }) => {
    if(kind==='rain'){addAmbience(kind,preset);return;}
    editor.store.addLayer(makeGroup(kind, `${preset.name} ${kind[0]!.toUpperCase() + kind.slice(1)}`, { ...preset.params, seed: Math.floor(Math.random() * 100000) }, W, H));
    editor.setSaveState("unsaved");
  };

  const presetRows: Array<{ kind: GroupKind; label: string; presets: typeof RAIN_PRESETS }> = [
    { kind: "rain", label: "Rain presets", presets: RAIN_PRESETS },
    { kind: "snow", label: "Snow presets", presets: SNOW_PRESETS },
  ];

  return (
    <div className="quick-tab-body">
      <p className="paint-hint">Add atmosphere, then select it to adjust density, speed, softness and more in Effects. Rain and fog use the same engine as export.</p>
      {presetRows.map(({ kind, label, presets }) => (
        <div key={kind}>
          <p className="paint-hint" style={{ marginTop: 2 }}>{label}</p>
          <div className="segmented" style={{ marginBottom: 8 }}>
            {presets.map((p) => (
              <button key={p.id} title={p.blurb} onClick={() => applyPreset(kind, p)}>{p.name}</button>
            ))}
          </div>
        </div>
      ))}
      <div className="ambience-grid">
        {AMBIENCE_KINDS.map((k) => (
          <button key={k.kind} className="ambience-card" onClick={() => addAmbience(k.kind)}>
            <span className="ambience-name">{k.label}</span>
            <span className="ambience-blurb">{k.blurb}</span>
          </button>
        ))}
      </div>
      {groups.filter(isProcedural).map((g) => {
        const gp = { count: g.params?.count ?? 24, speed: g.params?.speed ?? 1, intensity: g.params?.intensity ?? 0.8, seed: g.params?.seed ?? 1 };
        const rainWind = (v: number) => editor.store.updateGroupParams(g.id, { wind: v }, ({ kind, params }) => generateGroupChildren(kind as GroupKind, { ...gp, ...params } as GroupParams, W, H));
        return (
        <div key={g.id} className="ambience-edit">
          <div className="ambience-edit-head">
            <CloudRain size={12} />
            <strong>{g.name ?? "Ambience"}</strong>
            <span className="spacer" />
            <button className="icon-btn" title="Remove ambience" onClick={() => editor.removeLayer(g.id)}>✕</button>
          </div>
          <SliderField label="Intensity" value={gp.intensity} min={0.1} max={1}
            defaultValue={0.8} lowLabel="Light" highLabel="Heavy"
            onChange={(v) => editor.store.updateGroupParams(g.id, { intensity: v }, ({ kind, params }: { kind: string; params: Record<string, number> }) =>
              generateGroupChildren(kind as GroupKind, { ...gp, ...params } as GroupParams, W, H))} />
          <SliderField label="Speed" value={gp.speed} min={0.2} max={3}
            defaultValue={1} lowLabel="Slow" highLabel="Fast"
            onChange={(v) => editor.store.updateGroupParams(g.id, { speed: v }, ({ kind, params }) =>
              generateGroupChildren(kind as GroupKind, { ...gp, ...params } as GroupParams, W, H))} />
          <SliderField label="Amount" value={gp.count} min={4} max={60} step={1}
            defaultValue={24} lowLabel="Few" highLabel="Many"
            onChange={(v) => editor.store.updateGroupParams(g.id, { count: Math.round(v) }, ({ kind, params }) =>
              generateGroupChildren(kind as GroupKind, { ...gp, ...params } as GroupParams, W, H))} />
          {g.kind === "rain" && (
            <>
              <SliderField label="Wind" value={g.params?.wind ?? 0.35} min={0} max={1} defaultValue={0.35}
                lowLabel="Still" highLabel="Gusty" onChange={rainWind} />
              <SliderField label="Glass" value={g.params?.glass ?? 0} min={0} max={1} defaultValue={0}
                lowLabel="Dry" highLabel="Wet" onChange={(v) => editor.store.updateGroupParams(g.id, { glass: v }, ({ kind, params }) => generateGroupChildren(kind as GroupKind, { ...gp, ...params } as GroupParams, W, H))} />
              <SliderField label="Blur" value={g.params?.blur ?? 0.3} min={0} max={1} defaultValue={0.3}
                lowLabel="Sharp" highLabel="Dreamy" onChange={(v) => editor.store.updateGroupParams(g.id, { blur: v }, ({ kind, params }) => generateGroupChildren(kind as GroupKind, { ...gp, ...params } as GroupParams, W, H))} />
              <SliderField label="Lightning" value={g.params?.lightning ?? 0} min={0} max={1} defaultValue={0}
                lowLabel="Calm" highLabel="Stormy" onChange={(v) => editor.store.updateGroupParams(g.id, { lightning: v }, ({ kind, params }) => generateGroupChildren(kind as GroupKind, { ...gp, ...params } as GroupParams, W, H))} />
            </>
          )}
          {g.kind === "snow" && (
            <>
              <SliderField label="Size" value={g.params?.size ?? 1} min={0.5} max={2} defaultValue={1}
                lowLabel="Fine" highLabel="Chunky" onChange={(v) => editor.store.updateGroupParams(g.id, { size: v }, ({ kind, params }) => generateGroupChildren(kind as GroupKind, { ...gp, ...params } as GroupParams, W, H))} />
              <SliderField label="Wind" value={g.params?.wind ?? 0.3} min={-1} max={1} defaultValue={0.3}
                lowLabel="◀" highLabel="▶" onChange={(v) => editor.store.updateGroupParams(g.id, { wind: v }, ({ kind, params }) => generateGroupChildren(kind as GroupKind, { ...gp, ...params } as GroupParams, W, H))} />
              <SliderField label="Depth" value={g.params?.depth ?? 0.7} min={0} max={1} defaultValue={0.7}
                lowLabel="Flat" highLabel="Deep" onChange={(v) => editor.store.updateGroupParams(g.id, { depth: v }, ({ kind, params }) => generateGroupChildren(kind as GroupKind, { ...gp, ...params } as GroupParams, W, H))} />
              <SliderField label="Glow" value={g.params?.glow ?? 0} min={0} max={1} defaultValue={0}
                lowLabel="Matte" highLabel="Sparkle" onChange={(v) => editor.store.updateGroupParams(g.id, { glow: v }, ({ kind, params }) => generateGroupChildren(kind as GroupKind, { ...gp, ...params } as GroupParams, W, H))} />
            </>
          )}

        </div>
        );
      })}
      {groups.filter((g) => !isProcedural(g)).length > 0 && (
        <p className="paint-hint">{groups.filter((g) => !isProcedural(g)).length} scene group(s) — expand them in Layers.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- background

export function BackgroundPanel({ editor }: { editor: Editor }) {
  const { doc, store } = editor;
  const applyPalette = (name: string) => {
    const p = PALETTES.find((x) => x.name === name);
    if (!p) return;
    const draft = structuredClone(store.getDocument());
    shiftScenePalette(draft, p);
    draft.canvas.background = p.colors[0];
    store.replaceDocument(draft,"Apply background palette");
    editor.setSaveState("unsaved");
  };
  return (
    <div className="quick-tab-body">
      <p className="paint-hint">Choose Solid, Gradient or Animated. Press Play to see motion. This changes the active scene background; Undo restores it.</p>
      <PaintEditor
        paint={backgroundPaint(doc,editor.time)}
        onChange={p=>{store.replaceDocument(withBackgroundPaint(doc,editor.time,p),"Change background");editor.setSaveState("unsaved");}}
      />
      <p className="paint-hint" style={{ marginTop: 12 }}>Color palettes — recolor the whole scene</p>
      <div className="palette-grid">
        {PALETTES.map((p) => (
          <button key={p.name} className="palette-card" title={`Apply ${p.name}`} onClick={() => applyPalette(p.name)}>
            <span className="palette-strip" style={{ background: `linear-gradient(90deg, ${p.colors.join(", ")})` }} />
            <span className="palette-name">{p.name}</span>
          </button>
        ))}
      </div>
      <p className="paint-hint" style={{ marginTop: 12 }}>Surprise me</p>
      <button className="btn" style={{ width: "100%" }} onClick={() => applyPalette(PALETTES[Math.floor(Math.random() * PALETTES.length)]!.name)}>
        <Sparkles size={13} /> Surprise me — new colors
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- quick inspector

export function QuickInspector({ editor }: { editor: Editor }) {
  const { doc, selected, updateLayer, updateCanvas, showSafeArea, setShowSafeArea, setExperience } = editor;
  const patch = (p: Parameters<typeof updateLayer>[1]) => selected && updateLayer(selected.id, p, `insp:${selected.id}`);

  if (!selected) {
    return (
      <div className="panel-body">
        <InspectorSectionShell title="Canvas">
          <div className="prop-row"><span className="prop-label">Background</span></div>
          <PaintEditor
            paint={backgroundPaint(doc,editor.time)}
            onChange={p=>{editor.store.replaceDocument(withBackgroundPaint(doc,editor.time,p),"Change background");editor.setSaveState("unsaved");}}
          />
          <div className="prop-row" style={{ marginTop: 10 }}>
            <span className="prop-label">Safe area</span>
            <div className="segmented">
              {([["guides", "Guides"], ["dim", "Dim"], ["crop", "Crop"]] as const).map(([m, label]) => (
                <button key={m} className={editor.showSafeArea && editor.safeAreaMode === m ? "active" : ""}
                  onClick={() => { editor.setShowSafeArea(true); editor.setSafeAreaMode(m); }}>{label}</button>
              ))}
              <button className={!editor.showSafeArea ? "active" : ""} onClick={() => editor.setShowSafeArea(false)}>Off</button>
            </div>
          </div>
          <div className="prop-row" style={{ marginTop: 6 }}>
            <span className="prop-label">Keep content inside</span>
            <button
              className={"toggle" + (editor.safeAreaLock ? " on" : "")}
              role="switch"
              aria-checked={editor.safeAreaLock}
              aria-label="Keep important content inside the safe area"
              onClick={() => editor.setSafeAreaLock(!editor.safeAreaLock)}
            />
          </div>
          <p className="paint-hint">Titles and names stay where platforms crop safely. Hold Alt while dragging to place freely.</p>
          <div className="prop-row" style={{ marginTop: 6 }}>
            <span className="prop-label">Banner shape</span>
            <div className="segmented">
              {(["rectangle", "rounded", "cut", "ticket", "notched"] as const).map((sh) => (
                <button key={sh} className={(doc.canvas.shape ?? "rectangle") === sh ? "active" : ""}
                  onClick={() => editor.updateCanvas({ shape: sh })}>{sh}</button>
              ))}
            </div>
          </div>
        </InspectorSectionShell>
        <p className="empty-hint">Click something on the canvas to edit it.</p>
      </div>
    );
  }

  const isText = "text" in selected;
  return (
    <div className="panel-body">
      {isWindowGroup(selected) && (
        <WindowControls editor={editor} group={selected} />
      )}

      {isText && (
        <InspectorSectionShell title="Text & Font"><FontPicker value={(selected as {fontFamily:string}).fontFamily} onChange={fontFamily=>patch({fontFamily} as never)}/>
          <textarea className="field-input" rows={2} value={(selected as { text: string }).text}
            onChange={(e) => patch({ text: e.target.value } as never)} aria-label="Text content" />
          <SliderField label="Size" value={(selected as { fontSize: number }).fontSize} min={10} max={120} step={1}
            lowLabel="Small" highLabel="Big" format={(v) => `${Math.round(v)}px`}
            onChange={(v) => patch({ fontSize: Math.round(v) } as never)} />
        </InspectorSectionShell>
      )}

      {selected.type !== "image" && selected.type !== "line" && (
        <InspectorSectionShell title="Color">
          <PaintEditor
            paint={typeof selected.fill === "object" && selected.fill ? selected.fill : { type: "solid", color: typeof selected.fill === "string" ? selected.fill : "#5b8cff" }}
            onChange={(p) => updateLayer(selected.id, { fill: p }, `paint:${selected.id}`)}
          />
        </InspectorSectionShell>
      )}

      <InspectorSectionShell title="Position">
        <SliderField label="X" value={(selected as unknown as { x: number }).x} min={-200} max={doc.canvas.width} step={1} lowLabel="Left" highLabel="Right"
          onChange={(v) => patch({ x: Math.round(v) } as never)} />
        <SliderField label="Y" value={(selected as unknown as { y: number }).y} min={-100} max={doc.canvas.height} step={1} lowLabel="Top" highLabel="Bottom"
          onChange={(v) => patch({ y: Math.round(v) } as never)} />
      </InspectorSectionShell>

      <InspectorSectionShell title="Effects" defaultOpen={false}>
        <ParameterEffectStack editor={editor} />
      </InspectorSectionShell>

      <InspectorSectionShell title="Animation" defaultOpen={false}>
        <p className="paint-hint">
          {(selected.tracks?.length ?? 0) > 0 || (selected.behaviors?.length ?? 0) > 0
            ? "This element is animated."
            : "Not animated yet."}
        </p>
        <button className="btn" style={{ width: "100%" }} onClick={() => editor.setMode("animate")}>
          <Sparkles size={13} /> Add animation
        </button>
      </InspectorSectionShell>

      <InspectorSectionShell title="Advanced" defaultOpen={false}>
        <p className="paint-hint">Exact values, layers and keyframes live here.</p>
        <button className="btn ghost" style={{ width: "100%" }} onClick={() => setExperience("advanced")}>
          <MoreHorizontal size={13} /> Switch to Advanced Mode
        </button>
      </InspectorSectionShell>
    </div>
  );
}

export function InspectorSectionShell({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
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

// ---------------------------------------------------------------- effects

export function EffectStack({ editor }: { editor: Editor }) {
  const { selected, updateLayer } = editor;
  const [browsing, setBrowsing] = useState(false);
  if (!selected) return <p className="empty-hint">Select an element first.</p>;
  const effects = selected.effects ?? [];

  const setStack = (stack: typeof effects) => updateLayer(selected.id, { effects: stack } as never);

  return (
    <div className="effect-stack">
      {effects.map((e, i) => (
        <div key={e.id} className="effect-row">
          <span className="effect-name">{effectName(e)}</span>
          <span className="spacer" />
          <button className="icon-btn" title={e.visible ? "Hide effect" : "Show effect"}
            onClick={() => setStack(effects.map((x, j) => (j === i ? { ...x, visible: !x.visible } : x)))}>
            {e.visible ? <Eye size={11} /> : <EyeOff size={11} />}
          </button>
          <button className="icon-btn" title="Remove effect" onClick={() => setStack(effects.filter((_, j) => j !== i))}>
            <Trash2 size={11} />
          </button>
        </div>
      ))}
      {effects.length === 0 && <p className="paint-hint">No effects yet — add a glow, rain, chrome or grain.</p>}

      {!browsing ? (
        <button className="btn" style={{ width: "100%" }} onClick={() => setBrowsing(true)}>
          <Plus size={13} /> Add Effect
        </button>
      ) : (
        <div className="effect-browser-host">
          {/* Cards only — never a dropdown. Hover previews live; + adds to the stack. */}
          <EffectBrowser
            editor={editor}
            compact
            onAdd={(preset) => {
              setStack([...effects, makeEffect(preset)]);
              setBrowsing(false);
            }}
            onClose={() => setBrowsing(false)}
          />
        </div>
      )}
    </div>
  );
}
