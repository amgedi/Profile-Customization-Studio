import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, Plus, Search, X } from "lucide-react";
import { favoriteIds, recentIds, toggleFavorite, recordRecent, customPresets, saveCustomPreset, deleteCustomPreset, type PresetKind } from "../presetStore.js";

/**
 * The reusable visual preset browser — the signature PCS interaction.
 * Left: categories/filters. Center: visual cards. Right/details: large
 * preview when provided. Search, favorites, recent, hover preview,
 * selected state, apply and undo are consistent across all browsers.
 */
export interface PresetBrowserItem {
  id: string;
  name: string;
  category: string;
  blurb?: string;
  tags?: string[];
  /** Rendered visual (HTML/SVG string) or a React node for the card face. */
  render: (opts: { large: boolean; animate: boolean }) => React.ReactNode;
}

export function PresetBrowser({ kind, items, onApply, onSavePreset, searchPlaceholder, onHover, onPreviewItem, onAddItem }: {
  kind: PresetKind;
  items: PresetBrowserItem[];
  /** Called when the user applies a preset. */
  onApply: (item: PresetBrowserItem) => void;
  /** Optionally allow saving the current state as a custom preset. */
  onSavePreset?: () => { name: string; payload: unknown } | null;
  searchPlaceholder?: string;
  /** Hovering / leaving a card — used for live previews on the canvas. */
  onHover?: (item: PresetBrowserItem | null) => void;
  /** Clicking the card body — explicit preview without applying. */
  onPreviewItem?: (item: PresetBrowserItem) => void;
  /** When provided, each card shows an explicit "+ Add" button. */
  onAddItem?: (item: PresetBrowserItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const scrolling = useRef(false);
  useEffect(() => { onHover?.(null); }, [query, category]);
  const [, setFavTick] = useState(0);
  const favs = favoriteIds(kind);
  const recent = recentIds(kind);
  const custom = customPresets(kind);

  const cats = useMemo(() => {
    const set = new Set(items.map((i) => i.category));
    return ["All", "Recent", "Favorites", ...Array.from(set)];
  }, [items]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (category === "Favorites" && !favs.includes(i.id)) return false;
      if (category === "Recent" && !recent.includes(i.id)) return false;
      if (category !== "All" && category !== "Favorites" && category !== "Recent" && i.category !== category) return false;
      if (!q) return true;
      return i.name.toLowerCase().includes(q) || (i.blurb ?? "").toLowerCase().includes(q) || (i.tags ?? []).some((t) => t.includes(q));
    });
  }, [items, category, query, favs, recent]);

  const selected = list.find((i) => i.id === selectedId) ?? null;

  const apply = (item: PresetBrowserItem) => {
    recordRecent(kind, item.id);
    onApply(item);
  };

  return (
    <div className="preset-browser" data-kind={kind}
      onWheelCapture={() => { scrolling.current = true; onHover?.(null); }}
      onPointerMove={e => { if (e.movementX || e.movementY) scrolling.current = false; }}>
      <div className="gallery-toolbar">
        <div className="search-field">
          <Search size={13} className="search-icon" />
          <input className="field-input" placeholder={searchPlaceholder ?? "Search…"} value={query}
            onChange={(e) => setQuery(e.target.value)} aria-label={`Search ${kind} presets`} />
          {query && (
            <button className="search-clear" aria-label="Clear search" onClick={() => setQuery("")}><X size={12} /></button>
          )}
          <span className="search-kbd">Ctrl+K</span>
        </div>
        {onSavePreset && (
          <button className="btn" title="Save the current look as My Preset"
            onClick={() => {
              const res = onSavePreset();
              if (res) { saveCustomPreset(kind, res.name, res.payload); setFavTick((t) => t + 1); }
            }}>
            Save Preset
          </button>
        )}
      </div>

      <div className="chip-row">
        {cats.map((c) => (
          <button key={c} className={"chip" + (category === c ? " active" : "")} onClick={() => setCategory(c)}>{c}</button>
        ))}
      </div>

      <div className="preset-grid">
        {list.map((item) => (
          <PresetCard key={item.id} item={item}
            selected={selectedId === item.id}
            isFav={favs.includes(item.id)}
            onSelect={() => { setSelectedId(selectedId === item.id ? null : item.id); onPreviewItem?.(item); }}
            onFav={() => { toggleFavorite(kind, item.id); setFavTick((t) => t + 1); }}
            onApply={() => apply(item)}
            onHover={item => { if (!item || !scrolling.current) onHover?.(item); }}
            onAddItem={onAddItem}
          />
        ))}
        {list.length === 0 && <p className="empty-hint">Nothing matches yet.</p>}
      </div>

      {custom.length > 0 && category === "All" && (
        <div className="preset-custom">
          <p className="paint-hint">My Presets</p>
          <div className="chip-row">
            {custom.map((c) => (
              <span key={c.id} className="chip active my-preset-chip">
                <button title={`Apply ${c.name}`} onClick={() => onApply({ id: c.id, name: c.name, category: "My Presets", render: () => null })}>{c.name}</button>
                <button className="my-preset-del" title="Delete preset" onClick={() => { deleteCustomPreset(c.id); setFavTick((t) => t + 1); }}><X size={10} /></button>
              </span>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div className="scene-details">
          <div className="scene-details-info">
            <h3>{selected.name}</h3>
            {selected.blurb && <p className="scene-details-desc">{selected.blurb}</p>}
          </div>
          <div className="scene-details-actions">
            <div className="preset-large-preview">{selected.render({ large: true, animate: true })}</div>
            <button className="btn primary" onClick={() => apply(selected)}>Apply {selected.name}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PresetCard({ item, selected, isFav, onSelect, onFav, onApply, onHover, onAddItem }: {
  item: PresetBrowserItem;
  selected: boolean;
  isFav: boolean;
  onSelect: () => void;
  onFav: () => void;
  onApply: () => void;
  onHover?: (item: PresetBrowserItem | null) => void;
  onAddItem?: (item: PresetBrowserItem) => void;
}) {
  return (
    <div className={"preset-card" + (selected ? " selected" : "")} role="button" tabIndex={0}
      onClick={onSelect} onDoubleClick={(e) => { if (!(e.target as HTMLElement).closest("button")) onApply(); }}
      onMouseEnter={() => onHover?.(item)}
      onMouseLeave={() => onHover?.(null)}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelect(); } }}
      aria-label={`${item.name}${item.blurb ? ` — ${item.blurb}` : ""}`}>
      <div className="preset-card-visual">{item.render({ large: false, animate: true })}</div>
      <div className="scene-card-meta">
        <span className="scene-card-name">{item.name}</span>
        {item.blurb && <span className="scene-card-tags">{item.blurb}</span>}
      </div>
      <button className={"fav-btn" + (isFav ? " active" : "")} title={isFav ? "Unfavorite" : "Favorite"}
        aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
        onClick={(e) => { e.stopPropagation(); onFav(); }}>
        <Heart size={13} style={{ fill: isFav ? "var(--pcs-accent)" : "none" }} />
      </button>
      {(
        <button className="fav-btn card-add-btn" title={`Add ${item.name}`} aria-label={`Add ${item.name}`}
          onClick={(e) => { e.stopPropagation(); (onAddItem ?? onApply)(item); }}>
          <Plus size={13} /> <span>Apply</span>
        </button>
      )}
    </div>
  );
}
