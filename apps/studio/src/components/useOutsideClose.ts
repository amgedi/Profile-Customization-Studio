import { useEffect, useRef, type RefObject } from "react";

/**
 * Shared outside-click / Escape dismissal for every popover, menu and dialog
 * (0.2.6 R15). Uses pointer events with composedPath() so clicks INSIDE the
 * surface — including inside nested inputs, color pickers and portals — can
 * never trigger an outside close. Attach `surfaceRef` to the outermost
 * element of the floating surface.
 *
 * - `active` gates the listener (pass the open state).
 * - `onEscape` defaults to onClose.
 * - The listener is registered on `pointerdown` capture: the decision is made
 *   before focus moves, so the first click both lands and dismisses correctly
 *   without stealing the click from the target underneath.
 */
export function useOutsideClose(
  surfaceRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  opts?: { active?: boolean; onEscape?: (e: KeyboardEvent) => void },
) {
  const active = opts?.active !== false;
  const latest = useRef({ onClose, opts }); latest.current = { onClose, opts };
  useEffect(() => {
    if (!active) return;
    const onPointerDown = (e: PointerEvent) => {
      const surface = surfaceRef.current;
      if (!surface) return;
      const target = e.target as Element | null;
      if (surface.closest('[inert]') || target?.closest('.color-pop')) return;
      // composedPath covers shadow-DOM children (native <input type=color>,
      // WebView internals) that contains() misses.
      const path = typeof e.composedPath === "function" ? e.composedPath() : null;
      const inside = path
        ? path.includes(surface)
        : !!(target && surface.contains(target));
      if (!inside) latest.current.onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (surfaceRef.current?.closest('[inert]') || document.querySelector('.color-pop')) return;
        e.stopPropagation();
        if (latest.current.opts?.onEscape) latest.current.opts.onEscape(e);
        else latest.current.onClose();
      }
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey);
    };
    // onClose/onEscape are captured per-attach; callers pass stable closures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, surfaceRef]);
}
