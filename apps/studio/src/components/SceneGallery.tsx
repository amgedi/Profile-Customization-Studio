import {renderSvg} from '@pcs/scene-core';
import { useReducedMotion } from "../useReducedMotion.js";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Check, Heart, Shuffle, Sparkles, Play, Pause } from "lucide-react";
import { isGroupLayer } from "@pcs/bannerspec";
import { runtimePrefs } from "../prefs.js";
import { SCENE_LIBRARY, type SceneEntry } from "../sceneLibrary.js";
import { scenePoster, sceneAnimated, svgToInline } from "../thumbnails.js";
import type { Editor } from "../editor.js";
import { OverlaySurface } from "./OverlayHost.js";

const FAVS_KEY = "pcs-scene-favs";
const RECENT_KEY = "pcs-scene-recent";

function loadIds(key: string): string[] {
  try { return JSON.parse(localStorage.getItem(key) ?? "[]") as string[]; } catch { return []; }
}
function saveIds(key: string, ids: string[]): void {
  localStorage.setItem(key, JSON.stringify(ids.slice(0, 24)));
}

/**
 * The ONE visual scene gallery — used by Home, Quick Build and Design → Scene.
 * Real thumbnails from the scene generators, hover animation, favorites,
 * recents, search, filter chips, details panel and confirm-before-apply.
 */
export function SceneBrowser({ editor, onApply }: {
  editor: Editor;
  /** Receives the scene entry (already confirmed by the user). */
  onApply: (scene: SceneEntry) => void;
}) {
  const reducedMotion=useReducedMotion();
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [favs, setFavs] = useState<string[]>(loadIds(FAVS_KEY));
  const [recent, setRecent] = useState<string[]>(loadIds(RECENT_KEY));
  const [confirmScene, setConfirmScene] = useState<SceneEntry | null>(null);
  const hoverTimer = useRef<number | null>(null);

  const cats = ["All", "Favorites", "Recent", ...Array.from(new Set(SCENE_LIBRARY.map((s) => s.category))), "Animated", "Experimental"];

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SCENE_LIBRARY.filter((s) => {
      // Experimental scenes stay out of the default gallery views.
      if (category !== "Experimental" && s.experimental) return false;
      if (category === "Favorites" && !favs.includes(s.id)) return false;
      if (category === "Recent" && !recent.includes(s.id)) return false;
      if (category === "Animated" && s.animationLevel !== "animated") return false;
      if (category === "Experimental") { if (!s.experimental) return false; }
      else if (category !== "All" && category !== "Favorites" && category !== "Recent" && category !== "Animated" && s.category !== category) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.blurb.toLowerCase().includes(q) ||
        s.tags.some((t) => t.includes(q)) ||
        (s.mood ?? "").includes(q)
      );
    });
  }, [category, query, favs, recent]);

  const selected = SCENE_LIBRARY.find((s) => s.id === selectedId) ?? null;

  const toggleFav = (id: string) => {
    const next = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
    setFavs(next);
    saveIds(FAVS_KEY, next);
  };

  const markRecent = (id: string) => {
    const next = [id, ...recent.filter((r) => r !== id)];
    setRecent(next);
    saveIds(RECENT_KEY, next);
  };

  const startHover = (id: string) => {
    if (!runtimePrefs().cardHoverAnimation || runtimePrefs().reducedMotion) return;
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setHoverId(id), 450);
  };
  const endHover = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    setHoverId(null);
  };

  const requestApply = (scene: SceneEntry) => {
    const hasWork = editor.doc.layers.length > 0;
    if (hasWork) {
      setConfirmScene(scene);
    } else {
      apply(scene);
    }
  };

  const apply = (scene: SceneEntry) => {
    markRecent(scene.id);
    setConfirmScene(null);
    onApply(scene);
  };

  const currentSceneId = recent[0];

  return (
    <div className="scene-gallery">
      <div className="gallery-toolbar">
        <input className="field-input gallery-search" placeholder="Search scenes — try “snow”, “rain”, “purple”…"
          value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search scenes" />
        <button className="btn" title="Pick a great scene at random (Undo works)"
          onClick={() => {
            const pool = list.length > 0 ? list : SCENE_LIBRARY;
            const pick = pool[Math.floor(Math.random() * pool.length)] ?? SCENE_LIBRARY[0]!;
            requestApply(pick);
          }}>
          <Sparkles size={13} /> Surprise Me
        </button>
      </div>

      <div className="chip-row">
        {cats.map((c) => (
          <button key={c} className={"chip" + (category === c ? " active" : "")} onClick={() => setCategory(c)}>{c}</button>
        ))}
      </div>

      <div className="gallery-grid">
        {list.map((s) => (
          <SceneCard
            key={s.id}
            scene={s}
            hovered={hoverId === s.id}
            selected={selectedId === s.id}
            isCurrent={currentSceneId === s.id}
            isFav={favs.includes(s.id)}
            reducedMotion={reducedMotion}
            onHoverStart={() => startHover(s.id)}
            onHoverEnd={endHover}
            onSelect={() => setSelectedId(s.id === selectedId ? null : s.id)}
            onFav={() => toggleFav(s.id)}
            onApply={() => requestApply(s)}
          />
        ))}
        {list.length === 0 && <p className="empty-hint">No scenes match. Try a different search or category.</p>}
      </div>

      {selected && (
        <div className="scene-details">
          <div className="scene-details-info">
            <h3>{selected.name}</h3>
            <p className="paint-hint">{selected.mood ?? selected.tags.join(" · ")} · {selected.animationLevel === "animated" ? "Animated" : "Subtle motion"}</p>
            <p className="scene-details-desc">{selected.description}</p>
            <p className="paint-hint">Includes: {groupNames(selected)}</p>
          </div>
          <div className="scene-details-actions">
            <button className="btn primary" onClick={() => requestApply(selected)}>Use Scene</button>
            {selected.supportsVariation && selected.makeWithSeed && (
              <button className="btn" title="Same scene, different arrangement — Undo works"
                onClick={() => {
                  const seed = Math.floor(Math.random() * 100000);
                  const doc = selected.makeWithSeed!(seed)(editor.doc.canvas.width, editor.doc.canvas.height);
                  editor.store.replaceDocument(doc, "Scene variation");
                  editor.setSaveState("unsaved");
                  markRecent(selected.id);
                }}>
                <Shuffle size={13} /> New Variation
              </button>
            )}
            <button className="btn ghost" onClick={() => toggleFav(selected.id)}>
              <Heart size={13} style={{ fill: favs.includes(selected.id) ? "var(--pcs-accent)" : "none" }} />
              {favs.includes(selected.id) ? "Favorited" : "Favorite"}
            </button>
          </div>
        </div>
      )}

      {confirmScene && (
        <OverlaySurface><div className="dialog-overlay" onClick={() => setConfirmScene(null)}>
          <div className="dialog" style={{ width: 460 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Apply scene">
            <h2>Apply “{confirmScene.name}”?</h2>
            <p className="dialog-sub">This will replace the current scene layout. Undo (Ctrl+Z) brings it back.</p>
            <div className="dialog-actions">
              <button className="btn ghost" onClick={() => setConfirmScene(null)}>Cancel</button>
              <button className="btn" onClick={() => apply(confirmScene)}>Preview & Apply</button>
            </div>
          </div>
        </div></OverlaySurface>
      )}
    </div>
  );
}

function groupNames(scene: SceneEntry): string {
  try {
    const doc = scene.make(1200, 350);
    const names = doc.layers
      .filter((l) => isGroupLayer(l) || l.name === "Title")
      .map((l) => l.name)
      .slice(0, 6);
    return names.length ? names.join(", ") : "background, text";
  } catch {
    return "—";
  }
}

function SceneCard({ scene, hovered, selected, isCurrent, isFav, reducedMotion, onHoverStart, onHoverEnd, onSelect, onFav, onApply }: {
  scene: SceneEntry;
  hovered: boolean;
  selected: boolean;
  isCurrent: boolean;
  isFav: boolean;
  reducedMotion: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onSelect: () => void;
  onFav: () => void;
  onApply: () => void;
}) {
  const accent=useMemo(()=>scene.make(1200,350).brand?.accent??"#e5e7eb",[scene.id]);
  const [ready, setReady] = useState(false);
  const poster = useMemo(() => scenePoster(scene.id), [scene.id]);
  const [previewPlaying,setPreviewPlaying]=useState(false),[previewTime,setPreviewTime]=useState(0);
  const previewDoc=useMemo(()=>scene.make(1200,350),[scene.id]);
  const live=(hovered||previewPlaying)&&!reducedMotion;
  useEffect(()=>{if(!live)return;const start=performance.now();const timer=setInterval(()=>setPreviewTime(((performance.now()-start)/1000)%(previewDoc.animation?.duration??8)),100);return()=>clearInterval(timer);},[live,previewDoc]);
  const animated=useMemo(()=>live?renderSvg(previewDoc,{animate:false,time:previewTime}):null,[live,previewDoc,previewTime]);

  useEffect(() => {
    if (poster !== null) {
      const t = window.setTimeout(() => setReady(true), 0);
      return () => window.clearTimeout(t);
    }
  }, [poster]);

  return (
    <div
      style={{"--scene-accent":accent} as CSSProperties}
      className={"scene-card-lg" + (selected ? " selected" : "") + (isCurrent ? " current" : "")}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onFocus={onHoverStart}
      onBlur={onHoverEnd}
      onClick={e=>{if(!(e.target as HTMLElement).closest("button"))onApply();}}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.target===e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onApply(); } }}
      aria-label={`Apply ${scene.name} — ${scene.mood ?? scene.tags.join(", ")}`}
    >
      <div className="scene-card-thumb">
        {!ready && <div className="thumb-skeleton" />}
        {ready && (
          <div
            className="thumb-svg"
            dangerouslySetInnerHTML={{ __html: svgToInline((animated ?? poster) ?? "") }}
          />
        )}
        <button className="scene-preview-play" disabled={reducedMotion} aria-label={(previewPlaying?'Pause':'Play')+' preview of '+scene.name} title={reducedMotion?'Motion previews are paused by your accessibility preferences':'Preview scene motion without applying it'} onClick={e=>{e.stopPropagation();setPreviewPlaying(!previewPlaying);}}>{previewPlaying?<Pause size={13}/>:<Play size={13}/>}</button>{isCurrent && <span className="thumb-current"><Check size={11} /> In use</span>}
        <button
          className={"fav-btn" + (isFav ? " active" : "")}
          title={isFav ? "Remove from favorites" : "Add to favorites"}
          aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
          onClick={(e) => { e.stopPropagation(); onFav(); }}
        >
          <Heart size={13} style={{ fill: isFav ? "var(--pcs-accent)" : "none" }} />
        </button>
      </div>
      <div className="scene-card-meta">
        <span className="scene-card-name">{scene.name}</span><button className="scene-info-btn" aria-label={`Details for ${scene.name}`} onClick={e=>{e.stopPropagation();onSelect();}}>Details</button><button className="btn scene-use-btn" onClick={e=>{e.stopPropagation();onApply();}}>Use scene</button>
        <span className="scene-card-tags">{scene.mood ?? scene.tags.join(" · ")}</span>
      </div>
    </div>
  );
}
