import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buildCommands, type CommandDef } from "../commands.js";
import type { StudioActions } from "../commands.js";
import type { Editor } from "../editor.js";

interface Props {
  editor: Editor;
  actions: StudioActions;
  quick?: boolean;
}

export const MENU_GROUPS = ["File", "Edit", "View", "Insert", "Object", "Arrange", "Animation", "Platform", "Export", "Tools", "Help"];

/** Application menu bar. Quick Mode shows a reduced set. */
export function MenuBars({ editor, actions, quick }: Props) {
  const cmds = buildCommands(actions);
  const groups = quick ? ["File", "Edit", "View", "Insert", "Help"] : MENU_GROUPS;
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const show = (g: string, focus = false) => {
    const trigger = ref.current?.querySelector<HTMLButtonElement>(`[data-menu="${g}"]`);
    const rect = trigger?.getBoundingClientRect();
    if (!rect) return;
    setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 300)), top: rect.bottom + 4 });
    setOpen(g);
    if (focus) requestAnimationFrame(() => popup.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus());
  };
  useEffect(() => {
    if (!open) return;
    const close = () => { ref.current?.querySelector<HTMLButtonElement>(`[data-menu="${open}"]`)?.focus(); setOpen(null); };
    const outside = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node) && !popup.current?.contains(e.target as Node)) setOpen(null); };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); close(); }
      if (e.key === "Tab") setOpen(null);
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); e.stopImmediatePropagation(); show(groups[(groups.indexOf(open) + (e.key === "ArrowRight" ? 1 : groups.length - 1)) % groups.length]!, true); }
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
        e.preventDefault(); e.stopImmediatePropagation(); const buttons = [...(popup.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
        const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : (i + (e.key === "ArrowDown" ? 1 : buttons.length - 1)) % buttons.length]?.focus();
      }
    };
    const resize = () => show(open);
    window.addEventListener("pointerdown", outside, true); window.addEventListener("keydown", key, true); window.addEventListener("resize", resize);
    return () => { window.removeEventListener("pointerdown", outside, true); window.removeEventListener("keydown", key, true); window.removeEventListener("resize", resize); };
  }, [open]);

  const ctx = { editor, actions };
  const items = (g: string) => cmds.filter((c) => c.group === g);

  return (
    <div className="studio-menubar" role="menubar" aria-label="Application menus" ref={ref}>
      {groups.map((g) => (
        <div className="menu-wrap" key={g}>
          <button
            className={"menu-btn" + (open === g ? " open" : "")}
            data-menu={g} role="menuitem" aria-haspopup="menu" aria-expanded={open === g}
            onClick={() => open === g ? setOpen(null) : show(g)}
            onPointerEnter={() => { if (open) show(g); }}
            onKeyDown={(e) => { if (["Enter", "ArrowDown", " "].includes(e.key)) { e.preventDefault(); show(g, true); } }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {g}
          </button>
          {open === g && createPortal(
            <div className="studio-menu-surface" ref={popup} role="menu" aria-label={g} style={position}>
              {items(g).map((c: CommandDef) => (
                <button
                  key={c.id}
                  className="menu-item"
                  role="menuitem"
                  disabled={!c.enabled(ctx)}
                  onClick={() => { c.run(ctx); setOpen(null); }}
                >
                  <span>{c.label}</span>
                  {c.shortcut && <span className="menu-hint">{c.shortcut}</span>}
                </button>
              ))}
            </div>, document.body
          )}
        </div>
      ))}
    </div>
  );
}
