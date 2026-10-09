import { useEffect } from "react";

export type CursorGlowMode = "off" | "subtle" | "glow";

/**
 * Cursor ambience (0.2.5 reimplementation) — INTERACTIVE SURFACE LIGHTING.
 *
 * The old implementation painted a global radial spotlight on a full-window
 * canvas at the mouse position — explicitly wrong. The intended behavior is
 * local illumination: only the interactive surface (button, card, row, tab…)
 * nearest the pointer softly lights up, clipped inside that component.
 *
 * Technique: one passive pointermove listener + rAF throttle writes CSS
 * custom properties (--cx/--cy/--light-o) directly on the target element.
 * No React state, so the application tree never re-renders on mouse movement.
 * A `--light-o` of 0 (or removal) leaves zero overlay behind; the highlight
 * is pure CSS on the component itself, so it can never cover the canvas
 * artboard or exported output.
 */

/** Selector for surfaces eligible for local lighting (Studio chrome only). */
const SURFACE_SELECTOR = [
  "button",
  "[role='switch']",
  "[role='tab']",
  ".quick-tile",
  ".home-tile",
  ".theme-card",
  ".scene-card",
  ".effect-card",
  ".preset-card",
  ".layer-row",
  ".settings-nav-item",
  ".quick-tab",
  ".tool-btn",
  ".chip",
].join(", ");

export function CursorGlow({ mode, reducedMotion }: { mode: CursorGlowMode; reducedMotion: boolean }) {
  useEffect(() => {
    if (mode === "off" || reducedMotion) return;
    const opacity = mode === "glow" ? 0.30 : 0.14;
    const radius = mode === "glow" ? 130 : 80;
    let raf = 0;
    let pending: PointerEvent | null = null;
    let current: HTMLElement | null = null;

    const clear = (el: HTMLElement | null) => {
      if (!el) return;
      el.style.removeProperty("--light-o");
      el.removeAttribute("data-cursor-light");
    };

    const apply = () => {
      raf = 0;
      const e = pending;
      if (!e) return;
      const t = e.target as HTMLElement | null;
      const el = (t?.closest?.(SURFACE_SELECTOR) as HTMLElement | null) ?? null;
      if (el !== current) {
        clear(current);
        current = el;
        if (el) el.setAttribute("data-cursor-light", "");
      }
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--cx", `${Math.round(e.clientX - r.left)}px`);
      el.style.setProperty("--cy", `${Math.round(e.clientY - r.top)}px`);
      el.style.setProperty("--light-r", `${radius}px`);
      el.style.setProperty("--light-o", String(opacity));
    };

    const onMove = (e: PointerEvent) => {
      pending = e;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onLeave = () => { clear(current); current = null; };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      onLeave();
    };
  }, [mode, reducedMotion]);

  // No rendered element at all — lighting lives on the surfaces themselves.
  return null;
}
