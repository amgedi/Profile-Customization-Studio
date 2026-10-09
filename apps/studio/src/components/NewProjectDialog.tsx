import { useRef, useState } from "react";
import { useOutsideClose } from "./useOutsideClose.js";
import type { PCSProject } from "../project.js";

export interface Template {
  id: string;
  name: string;
  dim: string;
  width: number;
  height: number;
}

export const TEMPLATES: Template[] = [
  { id: "github-profile", name: "GitHub Profile", dim: "Banner 1200 × 350", width: 1200, height: 350 },
  { id: "github-repo", name: "GitHub Repository", dim: "Social preview 1280 × 640", width: 1280, height: 640 },
  { id: "banner", name: "Banner Only", dim: "1500 × 500", width: 1500, height: 500 },
  { id: "custom", name: "Custom Canvas", dim: "You choose later", width: 1200, height: 350 },
];

export function NewProjectDialog({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (name: string, tpl: Template) => void;
}) {
  const [tpl, setTpl] = useState<Template>(TEMPLATES[0]!);
  const [name, setName] = useState("My GitHub Profile");
  const surface = useRef<HTMLDivElement>(null);
  useOutsideClose(surface, onClose);

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div ref={surface} className="dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="New project">
        <h2>New Project</h2>
        <p className="dialog-sub">Choose what you are designing for.</p>
        <div className="template-grid">
          {TEMPLATES.map((t) => (
            <button key={t.id} className={"template-card" + (t.id === tpl.id ? " selected" : "")} onClick={() => setTpl(t)}>
              <span className="t-name">{t.name}</span>
              <span className="t-dim">{t.dim}</span>
            </button>
          ))}
        </div>
        {tpl.id === "custom" && <div className="prop-row" style={{ marginBottom: 16 }}>
          <label>Width<input className="field-input" type="number" aria-label="Canvas width" min={1} max={16384} value={tpl.width} onChange={e => setTpl({ ...tpl, width: Math.min(16384, Math.max(1, Number(e.target.value))) })}/></label>
          <label>Height<input className="field-input" type="number" aria-label="Canvas height" min={1} max={16384} value={tpl.height} onChange={e => setTpl({ ...tpl, height: Math.min(16384, Math.max(1, Number(e.target.value))) })}/></label>
        </div>}
        <input
          className="field-input project-name-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Project name"
          placeholder="Project name"
        />
        <div className="dialog-actions">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={() => onCreate(name.trim() || "Untitled Project", tpl)}>Create Project</button>
        </div>
      </div>
    </div>
  );
}

export type { PCSProject };
