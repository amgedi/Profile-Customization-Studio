import { useEffect, useState } from "react";

/**
 * Custom frosted tooltip (R59). No browser-native `title` popups in the
 * chrome: interactive elements declare `data-tip="Text"` (optionally
 * `data-tip-key="Ctrl+K"`) and this host renders a delayed, positioned tip.
 */
export function TooltipHost({ delay = 450 }: { delay?: number }) {
  const [tip, setTip] = useState<{ text: string; key?: string; x: number; y: number } | null>(null);

  useEffect(() => {
    let timer = 0;
    const over = (e: PointerEvent) => {
      window.clearTimeout(timer);
      const t = (e.target as HTMLElement)?.closest?.("[data-tip]") as HTMLElement | null;
      if (!t) { setTip(null); return; }
      timer = window.setTimeout(() => {
        const r = t.getBoundingClientRect();
        setTip({
          text: t.dataset.tip ?? "",
          key: t.dataset.tipKey,
          x: r.left + r.width / 2,
          y: r.bottom + 8,
        });
      }, delay);
    };
    const out = (e: PointerEvent) => {
      if (!(e.relatedTarget as HTMLElement | null)?.closest?.("[data-tip]")) setTip(null);
    };
    const down = () => { window.clearTimeout(timer); setTip(null); };
    const scroll = () => setTip(null);
    window.addEventListener("pointerover", over, { passive: true });
    window.addEventListener("pointerout", out, { passive: true });
    window.addEventListener("pointerdown", down, { passive: true });
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerover", over);
      window.removeEventListener("pointerout", out);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("scroll", scroll);
    };
  }, [delay]);

  if (!tip || !tip.text) return null;
  return (
    <div className="pcs-tooltip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
      {tip.text}
      {tip.key && <kbd className="pcs-tooltip-key">{tip.key}</kbd>}
    </div>
  );
}
