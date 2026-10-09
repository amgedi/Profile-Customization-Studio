import { useEffect, useState } from "react";
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from "lucide-react";

export type ToastKind = "success" | "info" | "warning" | "error";

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  desc?: string;
}

type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<Listener>();
const timers = new Map<number, number>();

function emit() {
  for (const l of listeners) l([...toasts]);
}

/** Push a frosted-glass toast. Auto-dismisses; hover pauses the timer. */
export function notify(kind: ToastKind, title: string, desc?: string, timeoutMs = 3500): void {
  const id = nextId++;
  toasts = [...toasts, { id, kind, title, desc }];
  emit();
  timers.set(id, window.setTimeout(() => dismiss(id), timeoutMs));
}

export function dismiss(id: number): void {
  const t = timers.get(id);
  if (t) { window.clearTimeout(t); timers.delete(id); }
  toasts = toasts.filter((x) => x.id !== id);
  emit();
}

const ICONS = { success: CheckCircle2, info: Info, warning: AlertTriangle, error: XCircle } as const;

/** Bottom-right toast stack. Never blocks content; respects reduced motion via CSS. */
export function Toasts() {
  const [items, setItems] = useState<Toast[]>(toasts);
  useEffect(() => {
    listeners.add(setItems);
    return () => { listeners.delete(setItems); };
  }, []);
  if (items.length === 0) return null;
  return (
    <div className="toast-stack" aria-live="polite">
      {items.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <div key={t.id} className={`toast toast-${t.kind}`}
            onMouseEnter={() => { const tm = timers.get(t.id); if (tm) { window.clearTimeout(tm); timers.delete(t.id); } }}
            onMouseLeave={() => { timers.set(t.id, window.setTimeout(() => dismiss(t.id), 1800)); }}>
            <Icon size={15} className="toast-icon" />
            <div className="toast-body">
              <span className="toast-title">{t.title}</span>
              {t.desc && <span className="toast-desc">{t.desc}</span>}
            </div>
            <button className="icon-btn" aria-label="Dismiss" onClick={() => dismiss(t.id)}><X size={12} /></button>
          </div>
        );
      })}
    </div>
  );
}
