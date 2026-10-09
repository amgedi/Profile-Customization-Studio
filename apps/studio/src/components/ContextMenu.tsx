import { useEffect, useRef, useState } from "react";
import { useOutsideClose } from "./useOutsideClose.js";

export interface MenuItem {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  run?: () => void;
  separatorBefore?: boolean;
}

/**
 * PCS-styled context menu. Portal-free (fixed positioning), stays inside
 * the viewport, closes on Escape / outside click / action.
 */
export function ContextMenu({ x, y, items, onClose }: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nx = Math.min(x, window.innerWidth - r.width - 8);
    const ny = Math.min(y, window.innerHeight - r.height - 8);
    setPos({ x: Math.max(8, nx), y: Math.max(8, ny) });
  }, [x, y]);

  useOutsideClose(ref, onClose);

  useEffect(() => { ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus(); }, []);

  return (
    <div className="menu-dropdown context-menu" ref={ref} style={{ position: "fixed", left: pos.x, top: pos.y }} role="menu" onKeyDown={e => {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
      e.preventDefault(); e.stopPropagation(); const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      buttons[e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : (index + (e.key === "ArrowDown" ? 1 : buttons.length - 1)) % buttons.length]?.focus();
    }}>
      {items.map((item, i) => (
        <div key={i}>
          {item.separatorBefore && <div className="ctx-sep" />}
          <button
            className={"menu-item" + (item.danger ? " danger" : "")}
            disabled={item.disabled}
            role="menuitem"
            onClick={() => { item.run?.(); onClose(); }}
          >
            <span>{item.label}</span>
            {item.shortcut && <span className="menu-hint">{item.shortcut}</span>}
          </button>
        </div>
      ))}
    </div>
  );
}
