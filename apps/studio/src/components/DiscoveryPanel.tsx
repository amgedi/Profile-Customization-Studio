import {StudioSelect} from './StudioSelect.js';
import { useState } from "react";
import { Type, Shapes, Image, Sparkles, Layers, Mountain, Palette, CloudRain, PanelLeftClose, Globe } from "lucide-react";
import type { Editor } from "../editor.js";
import type { SceneEntry } from "../sceneLibrary.js";
import { SceneBrowser } from "./SceneGallery.js";
import { LayersTree, BackgroundPanel } from "./QuickPanels.js";
import { EffectBrowser } from "./EffectBrowser.js";
import { insertAtmosphere, atmosphereLayer } from "../atmosphere.js";
import { EffectStack } from "./EffectStack.js";
import { makeEffect } from "../effects.js";
import { TargetCapabilities } from "./TargetCapabilities.js";
import { TARGET_REGISTRY } from "../targets/registry.js";
const sections = [["elements", Shapes, "Elements"], ["scenes", Mountain, "Scenes"], ["effects", Sparkles, "Effects"], ["background", Palette, "Background"], ["atmosphere", CloudRain, "Atmosphere"], ["layers", Layers, "Layers"], ["platforms", Globe, "Platforms"]] as const;
export type DiscoverySection = (typeof sections)[number][0];
export function DiscoveryPanel({ editor, onScene, onImage, onExport, section, onSection }: { editor: Editor; onScene: (s: SceneEntry) => void; onImage: () => void; onExport: () => void; section: DiscoverySection; onSection: (s: DiscoverySection) => void }) {
  const setSection = onSection;
  const [query, setQuery] = useState("");
  const [effectTarget, setEffectTarget] = useState<"selected"|"scene">("selected");
  return <div className="studio-discovery">
    <nav className="studio-tool-rail" aria-label="Discovery tools">{sections.map(([id, Icon, label]) => <button key={id} data-tour={id} aria-label={label} aria-pressed={section === id} onClick={() => { setSection(id); editor.setLeftCollapsed(false); }}><Icon size={19}/><span>{label}</span></button>)}</nav>
    {!editor.leftCollapsed && <aside className="studio-library" aria-label="Design library">
      <header><h2>{sections.find(s => s[0] === section)?.[2]}</h2><button className="studio-icon" aria-label="Collapse library" onClick={() => editor.setLeftCollapsed(true)}><PanelLeftClose size={16}/></button></header>
      <div className="studio-library-body">
        {section === "elements" && <><p className="studio-eyebrow">MAKE IT YOURS</p><h3>Start with an idea.</h3><p className="paint-hint">Add something to your canvas, then make it your own.</p><div className="studio-insert-grid">
          <button data-tour="add-text" onClick={() => editor.addText()}><Type size={30}/><strong>Add text</strong><span>Headlines & identity</span></button>
          <button onClick={() => editor.addRect()}><Shapes size={30}/><strong>Rectangle</strong><span>Cards & frames</span></button>
          <button onClick={() => editor.addEllipse()}><span className="studio-circle"/><strong>Ellipse</strong><span>Shapes & accents</span></button>
          <button data-tour="import-image" onClick={onImage}><Image size={30}/><strong>Import image</strong><span>From your device</span></button>
        </div><p className="paint-hint">T text · V select · H pan · Space play / pause<br/>Ctrl+K searches all tools and presets.</p><button className="btn" onClick={() => setSection("scenes")}>Explore scene templates →</button></>}
        {section === "scenes" && <SceneBrowser editor={editor} onApply={onScene}/>}
        {section === "layers" && <LayersTree editor={editor} quick={false}/>}
        {section === "background" && <BackgroundPanel editor={editor}/>}
        {section === "atmosphere" && <><p className="paint-hint">Scene atmosphere sits beneath your text. Select its layer to tune density, size, depth and motion.</p><EffectBrowser editor={editor} atmosphereOnly onAdd={p => { const next = structuredClone(editor.doc); const layer = insertAtmosphere(next, p); editor.store.replaceDocument(next,"Add scene atmosphere"); editor.setSelectedId(layer.id); editor.setSaveState("unsaved"); }}/><EffectStack editor={editor}/></>}
        {section === "effects" && <><label className="effect-target">Apply effects to<StudioSelect aria-label="Effect target" value={effectTarget} onChange={e=>setEffectTarget(e.target.value as "selected"|"scene")}><option value="selected">{editor.selected ? "Selected layer" : "Whole scene (no selection)"}</option><option value="scene">Whole scene</option></StudioSelect></label><p className="paint-hint">{editor.selected ? "Apply to " + editor.selected.name : "Apply to the whole scene · no object selection needed."}</p><EffectBrowser editor={editor} onAdd={p => {
          if (effectTarget === "selected" && editor.selectedId && editor.selected) editor.updateLayer(editor.selectedId, { effects: [...(editor.selected.effects ?? []), makeEffect(p)] });
          else { const next = structuredClone(editor.doc); const layer = insertAtmosphere(next, p); editor.store.replaceDocument(next,"Add scene atmosphere"); editor.setSelectedId(layer.id); editor.setSaveState("unsaved"); }
        }}/></>}
        {section === "platforms" && <><p className="paint-hint">Your master stays intact. Adapt dimensions, crop and format in Export Studio.</p><input className="field-input" aria-label="Search platforms" placeholder="Find a platform…" value={query} onChange={e => setQuery(e.target.value)}/>{TARGET_REGISTRY.filter(t => t.displayName.toLowerCase().includes(query.toLowerCase())).map(t => <div className="studio-platform" key={t.id}><strong>{t.displayName}</strong><details><summary>Motion, formats & limits</summary><TargetCapabilities target={t}/></details><span>{t.recommended.width} × {t.recommended.height} · {t.animationSupport === "native" ? "Animation supported" : "Check animation compatibility"}</span><span>{t.verification === "verified" ? "Documented upload guidance" : "Dimensions need verification"}</span><button className="btn" onClick={() => { editor.setExportTargetId(t.id); onExport(); }}>Preview adaptation</button></div>)}</>}
      </div>
    </aside>}
  </div>;
}
