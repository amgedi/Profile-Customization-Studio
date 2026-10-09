import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** All transient surfaces share the document root, outside workspace clipping. */
export function OverlaySurface({ children }: { children: ReactNode }) {
  return createPortal(<div className="studio-overlay-surface">{children}</div>, document.body);
}

/** One modal focus owner, including dialogs opened inside panels and inspectors. */
export function OverlayHost({ children }: { children: ReactNode }) {
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".app-shell");
    let active: HTMLElement | null = null;
    const returns = new Map<HTMLElement, HTMLElement | null>();
    const focusables = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>(
      'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"],a[href]'
    )].filter(node => node.getClientRects().length > 0 && !node.closest('[inert]'));
    const update = () => {
      const dialogs = [...document.querySelectorAll<HTMLElement>('.dialog, .palette-surface, .fx-modal, .pe-modal, .export-studio, .pro-window')];
      const next = dialogs.at(-1) ?? null;
      if (next === active) return;
      const old = active;
      const previousFocus = document.activeElement as HTMLElement | null;
      active = next;
      if (next && !returns.has(next)) returns.set(next, previousFocus);
      if (shell) shell.inert = !!next;
      for (const dialog of dialogs) {
        dialog.inert = dialog !== next;
        dialog.setAttribute('aria-modal', String(dialog === next));
        dialog.setAttribute('role', 'dialog');
      }
      if (next) {
        const returning = old && !old.isConnected ? returns.get(old) : null;
        if (returning?.isConnected && next.contains(returning)) returning.focus();
        else if (!next.contains(document.activeElement)) (focusables(next)[0] ?? next).focus();
      } else if (old) {
        const target = returns.get(old);
        if (target?.isConnected) target.focus();
      }
      if (old && !old.isConnected) returns.delete(old);
    };
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    update();
    const key = (e: KeyboardEvent) => {
      if (!active || e.key !== 'Tab') return;
      const fields = focusables(active);
      const index = fields.indexOf(document.activeElement as HTMLElement);
      if (!fields.length) { e.preventDefault(); return; }
      if (e.shiftKey && index <= 0) { e.preventDefault(); fields.at(-1)?.focus(); }
      else if (!e.shiftKey && (index < 0 || index === fields.length - 1)) { e.preventDefault(); fields[0]?.focus(); }
    };
    window.addEventListener('keydown', key, true);
    return () => { observer.disconnect(); window.removeEventListener('keydown', key, true); if (shell) shell.inert = false; };
  }, []);
  return <OverlaySurface>{children}</OverlaySurface>;
}
