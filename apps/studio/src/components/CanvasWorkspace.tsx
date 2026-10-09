import { useCallback, useEffect, useRef, useState } from "react";
import { renderSvg, type Layer, type RectLayer } from "@pcs/scene-core";
import { isGroupLayer } from "@pcs/bannerspec";
import { Minus, Plus, Maximize, Scan, Square, Type, Grid2x2, MousePointer2, Hand } from "lucide-react";
import type { Editor } from "../editor.js";
import { notify } from "./Toasts.js";
import { previewLayer } from "../layerTree.js";

const isRect = (l: Layer): l is RectLayer => l.type === "rect";

export function CanvasWorkspace({ editor, svgOverride, prefs }: { editor: Editor; svgOverride?: string; prefs?: import("../prefs.js").AppPrefs }) {
  const { doc, selectedId, setSelectedId, zoom, setZoom, showSafeArea, updateLayer, store, tool, setTool, pan, setPan } = editor;
  const [guides,setGuides]=useState<{x?:number;y?:number}>({});
  const areaRef = useRef<HTMLDivElement>(null);
  const renderMode = editor.mode === "preview";
  const behaviorPreview = editor.previewBehavior;
  const displayDoc = behaviorPreview ? { ...doc, layers: previewLayer(doc.layers, behaviorPreview.layerId, l => ({ ...l, behaviors: [...(l.behaviors ?? []), behaviorPreview.behavior] })) } : doc;
  const svg = (editor.previewBehavior ? undefined : svgOverride) ?? renderSvg(displayDoc, { editable: !renderMode, time: editor.time });
  const { width, height } = doc.canvas;

  const fitZoom = useCallback(() => {
    const el = areaRef.current;
    if (!el) return;
    const z = Math.min((el.clientWidth - 96) / width, (el.clientHeight - 96) / height);
    setZoom(Math.max(0.1, Math.min(2, z)));
    setPan({ x: 0, y: 0 });
  }, [width, height, setZoom, setPan]);

  // Intelligent fit on first open and whenever artboard size changes.
  useEffect(() => {
    fitZoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, editor.fitRequestCount]);

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const observer = new ResizeObserver(() => fitZoom());
    observer.observe(area);
    return () => observer.disconnect();
  }, [fitZoom]);

  // Ctrl+wheel zoom.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom((z) => Math.max(0.1, Math.min(3, z * (e.deltaY < 0 ? 1.1 : 0.9))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setZoom]);

  // --- pointer interaction state (refs, no re-render churn) ---
  const drag = useRef<
    | { kind: "move"; id: string; startX: number; startY: number; layerX: number; layerY: number }
    | { kind: "pan"; startX: number; startY: number; panX: number; panY: number }
    | { kind: "resize"; id: string; handle: string; startX: number; startY: number; w: number; h: number; x: number; y: number }
    | null
  >(null);
  const [editingText, setEditingText] = useState<string | null>(null);
  const spaceHeld = useRef(false);
  const safeWarned = useRef(false);
  const downAt = useRef<{ x: number; y: number } | null>(null);

  const scenePoint = (e: React.PointerEvent) => {
    const el = areaRef.current!;
    const r = el.getBoundingClientRect();
    return {
      x: (e.clientX - r.left - r.width / 2 - pan.x) / zoom + width / 2,
      y: (e.clientY - r.top - r.height / 2 - pan.y) / zoom + height / 2,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Let native controls (hint buttons, floating toolbar) handle their own clicks.
    const t = e.target as HTMLElement;
    if (t.closest && t.closest("button, input, textarea, a")) return;
    const target = (e.target as SVGElement).closest?.("[data-layer-id]") as SVGElement | null;
    const panning = tool === "hand" || false || e.button === 1 || (!target && tool === "select" && e.button === 0);
    if (renderMode && !panning) return;
    if (e.button === 2) return;
    if (panning) {
      // Clicking (or dragging on) empty canvas clears the selection too.
      setSelectedId(null);
      editor.clearMultiSelect();
      drag.current = { kind: "pan", startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      downAt.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (target && tool === "select") {
      const id = target.getAttribute("data-layer-id")!;
      // Multi-selection (R38): shift = range, ctrl = toggle, plain = replace.
      if (e.shiftKey) editor.rangeSelect(id);
      else if (e.ctrlKey || e.metaKey) editor.toggleSelectedId(id, true);
      else editor.toggleSelectedId(id, false);
      const layer = store.layerById(id);
      if (layer && !layer.locked && !isGroupLayer(layer)) {
        drag.current = { kind: "move", id, startX: e.clientX, startY: e.clientY, layerX: layer.x, layerY: layer.y };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
      return;
    }
    // Empty artboard area: deselect, or stamp a new layer for shape/text tools.
    setSelectedId(null);
    editor.clearMultiSelect();
    if (tool === "rect" || tool === "text" || tool === "ellipse" || tool === "line") {
      const p = scenePoint(e);
      const id = tool === "rect"
        ? editor.addRect({ x: Math.round(p.x - 160), y: Math.round(p.y - 70) })
        : tool === "ellipse"
          ? editor.addEllipse({ x: Math.round(p.x - 100), y: Math.round(p.y - 70), width: 200, height: 140 })
          : tool === "line"
            ? editor.addLine({ x: Math.round(p.x - 100), y: Math.round(p.y) })
            : editor.addText({ x: Math.round(p.x), y: Math.round(p.y) });
      setSelectedId(id);
      setTool("select");
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    if (drag.current.kind === "pan") {
      setPan({ x: drag.current.panX + (e.clientX - drag.current.startX), y: drag.current.panY + (e.clientY - drag.current.startY) });
    } else if (drag.current.kind === "move") {
      const dx = (e.clientX - drag.current.startX) / zoom;
      const dy = (e.clientY - drag.current.startY) / zoom;
      let nx = Math.round(drag.current.layerX + dx);
      let ny = Math.round(drag.current.layerY + dy);
      // R38/R40 — safe-area locking: important layers (text) are softly
      // clamped inside the safe region unless the user holds Alt (override).
      const layer = store.layerById(drag.current.id);
      if (prefs?.showSmartGuides && !e.altKey && layer && 'x' in layer) {
        const sw='width' in layer ? layer.width : layer.type==='text' ? layer.text.length*layer.fontSize*.55 : 0;
        const sh='height' in layer ? layer.height : layer.type==='text' ? layer.fontSize : 0;
        const next:{x?:number;y?:number}={};
        for (const [anchor,line] of [[0,0],[(width-sw)/2,width/2],[width-sw,width]]) if(Math.abs(nx-anchor!)<=prefs.snapStrength){nx=anchor!;next.x=line;}
        for (const [anchor,line] of [[0,0],[(height-sh)/2,height/2],[height-sh,height]]) if(Math.abs(ny-anchor!)<=prefs.snapStrength){ny=anchor!;next.y=line;}
        setGuides(next);
      }
      if (editor.safeAreaLock && !e.altKey && layer && layer.type === "text") {
        const fs = (layer as { fontSize?: number }).fontSize ?? 24;
        const estW = Math.min(width, (layer as { text?: string }).text ? (layer as { text: string }).text.length * fs * 0.55 : fs * 6);
        const estH = fs * 1.3;
        const sx = width * 0.1, sy = height * 0.1;
        const ex = width * 0.9, ey = height * 0.9;
        const clampedX = Math.min(Math.max(nx, sx), Math.max(sx, ex - estW));
        const clampedY = Math.min(Math.max(ny, sy + fs * 0.2), Math.max(sy, ey - estH));
        if (clampedX !== nx || clampedY !== ny) {
          if (!safeWarned.current) {
            safeWarned.current = true;
            notify("warning", "Kept inside the safe area", "Hold Alt while dragging to place freely, or turn the lock off.");
          }
          nx = clampedX;
          ny = clampedY;
        }
      }
      updateLayer(drag.current.id,
        { x: nx, y: ny },
        `drag:${drag.current.id}`);
    } else {
      const d = drag.current;
      if (d.kind === "resize") {
        const dx = (e.clientX - d.startX) / zoom;
        const dy = (e.clientY - d.startY) / zoom;
        let w = Math.max(8, d.w + (d.handle.includes("e") ? dx : d.handle.includes("w") ? -dx : 0));
        let h = Math.max(6, d.h + (d.handle.includes("s") ? dy : d.handle.includes("n") ? -dy : 0));
        let x = d.x + (d.handle.includes("w") ? d.w - w : 0);
        let y = d.y + (d.handle.includes("n") ? d.h - h : 0);
        if (e.shiftKey) { const r = d.w / d.h; h = Math.max(6, w / r); }
        updateLayer(d.id, { width: Math.round(w), height: Math.round(h), x: Math.round(x), y: Math.round(y) } as never, `resize:${d.id}`);
      }
    }
  };

  const onPointerUp = () => { setGuides({});drag.current = null; downAt.current = null; };

  const onDoubleClick = (e: React.MouseEvent) => {
    const target = (e.target as SVGElement).closest?.("[data-layer-id]") as SVGElement | null;
    if (!target) return;
    const id = target.getAttribute("data-layer-id")!;
    const layer = store.layerById(id);
    if (layer && "text" in layer && !layer.locked) setEditingText(id);
  };

  const startResize = (handle: string) => (e: React.PointerEvent) => {
    if (!sel || sel.locked || isGroupLayer(sel)) return;
    e.stopPropagation();
    const w0 = isRect(sel) ? sel.width : "width" in sel ? (sel.width as number) : 100;
    const h0 = isRect(sel) ? sel.height : "height" in sel ? (sel.height as number) : 40;
    drag.current = { kind: "resize", id: sel.id, handle, startX: e.clientX, startY: e.clientY, w: w0, h: h0, x: sel.x, y: sel.y };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const selected = selectedId ? store.layerById(selectedId) : undefined;
  const sel = selected?.visible && selected.type !== "group" ? selected : undefined;
  const selW = sel ? (isRect(sel) ? sel.width : "fontSize" in sel ? sel.fontSize * sel.text.length * 0.55 : ("width" in sel ? sel.width : 200)) : 0;
  const selH = sel ? (isRect(sel) ? sel.height : "fontSize" in sel ? sel.fontSize * 1.3 : ("height" in sel ? sel.height : 40)) : 0;

  const cursor = tool === "hand" ? "grab" : tool === "text" ? "text" : tool === "rect" ? "crosshair" : "default";

  return (
    <div
      className="canvas-workspace"
      ref={areaRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => { if (tool === "hand" || false) e.preventDefault(); }}
    >
      <div className="canvas-pan-area">
        <div
          className={"artboard-frame" + (editor.transparencyGrid || doc.canvas.background === undefined ? " transparency-grid" : "")}
          style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
        >
          <svg
            viewBox={`0 0 ${width} ${height}`}
            width={width * zoom}
            height={height * zoom}
            style={{ cursor }}
            dangerouslySetInnerHTML={{ __html: svg.replace("<svg", '<svg data-stage="1"') }}
          />
          {guides.x!=null&&<div style={{position:'absolute',left:guides.x*zoom,top:0,height:height*zoom,borderLeft:'1px solid var(--pcs-accent)',pointerEvents:'none'}}/>}
          {guides.y!=null&&<div style={{position:'absolute',top:guides.y*zoom,left:0,width:width*zoom,borderTop:'1px solid var(--pcs-accent)',pointerEvents:'none'}}/>}
          {showSafeArea && (
            <div className={"safe-area mode-" + editor.safeAreaMode}>
              <span className="safe-chip">Master safe area</span>
              <span className="safe-tick tl" aria-hidden />
              <span className="safe-tick tr" aria-hidden />
              <span className="safe-tick bl" aria-hidden />
              <span className="safe-tick br" aria-hidden />
            </div>
          )}
          {sel && !renderMode && (
            <div
              className="selection-box"
              style={{
                left: (sel as unknown as { x: number }).x * zoom,
                top: (sel.type === "text" ? sel.y - sel.fontSize : sel.y) * zoom,
                width: Math.max(6, selW * zoom),
                height: Math.max(6, selH * zoom),
              }}
            >
              {(["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const).map((h) => (
                <span
                  key={h}
                  className={`handle resize-handle ${h}`}
                  onPointerDown={startResize(h)}
                />
              ))}
            </div>
          )}
          {editor.selectedIds.length > 1 && doc.layers
            .filter((l) => editor.selectedIds.includes(l.id) && l.id !== selectedId && l.visible)
            .map((l) => (
              <div
                key={l.id}
                className="selection-box multi"
                style={{
                  left: (l as unknown as { x: number }).x * zoom,
                  top: (l as unknown as { y: number }).y * zoom,
                  width: Math.max(6, (("width" in l ? l.width : 120) as number) * zoom),
                  height: Math.max(6, (("height" in l ? l.height : 40) as number) * zoom),
                }}
              />
            ))}
          {editingText && sel && "text" in sel && sel.id === editingText && (
            <textarea
              className="inline-text-editor"
              autoFocus
              style={{
                left: sel.x * zoom,
                top: (sel.y - sel.fontSize) * zoom,
                width: Math.max(120, sel.fontSize * sel.text.length * 0.6 * zoom),
                height: sel.fontSize * 1.4 * zoom * sel.text.split(String.fromCharCode(10)).length,
                fontSize: sel.fontSize * zoom,
                fontFamily: sel.fontFamily,
                color: "#fff",
              }}
              defaultValue={sel.text}
              onBlur={(e) => { updateLayer(sel.id, { text: e.target.value } as never); setEditingText(null); }}
              onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); e.currentTarget.value = sel.text; e.currentTarget.blur(); } }}
            />
          )}
          {doc.layers.length === 0 && (
            <div className="artboard-empty-hint">
              <span className="hint-title">Start designing</span>
              <span className="hint-actions">
                <button className="btn" onClick={() => editor.addText()}><Type size={13} /> Add text</button>
                <button className="btn" onClick={() => editor.addRect()}><Square size={13} /> Add shape</button>
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="canvas-toolbar" onPointerDown={(e) => e.stopPropagation()}>
        {!renderMode && <><button className="icon-btn" aria-label="Select tool" aria-pressed={tool === "select"} onClick={() => setTool("select")}><MousePointer2 size={14}/></button>
        <button className="icon-btn" aria-label="Pan tool" aria-pressed={tool === "hand"} onClick={() => setTool("hand")}><Hand size={14}/></button>
        <button className="icon-btn" aria-label="Text tool" aria-pressed={tool === "text"} onClick={() => setTool("text")}><Type size={14}/></button>
        <button className="icon-btn" aria-label="Rectangle tool" aria-pressed={tool === "rect"} onClick={() => setTool("rect")}><Square size={14}/></button><span className="tb-sep"/></>}
        <button className="icon-btn" data-tip="Zoom out (Ctrl+wheel works too)" aria-label="Zoom out"
          onClick={() => setZoom((z) => Math.max(0.1, z * 0.85))}><Minus size={14} /></button>
        <span className="zoom-value">{Math.round(zoom * 100)}%</span>
        <button className="icon-btn" data-tip="Zoom in" aria-label="Zoom in"
          onClick={() => setZoom((z) => Math.min(3, z * 1.15))}><Plus size={14} /></button>
        <span className="tb-sep" />
        <button className="icon-btn" data-tip="Fit to window" aria-label="Fit to window"
          onClick={fitZoom}><Maximize size={13} /></button>
        <button className="icon-btn" data-tip="Zoom to 100%" aria-label="Zoom to 100%"
          onClick={() => setZoom(1)}><Scan size={13} /></button>
        <span className="tb-sep" />
        <button className={"icon-btn" + (editor.transparencyGrid ? " active" : "")}
          data-tip="Transparency grid (editor-only, never exported)" aria-label="Toggle transparency grid"
          style={editor.transparencyGrid ? { color: "var(--pcs-accent)" } : undefined}
          onClick={() => editor.setTransparencyGrid(!editor.transparencyGrid)}>
          <Grid2x2 size={13} />
        </button>
        <button className={"icon-btn" + (showSafeArea ? " active" : "")}
          title={"Safe area: shows where important content should stay so GitHub crops safely. Click to cycle: " + editor.safeAreaMode + " → next"}
          aria-label="Cycle safe area mode"
          style={showSafeArea ? { color: "var(--pcs-accent)" } : undefined}
          onClick={() => {
            if (!showSafeArea) { editor.setShowSafeArea(true); return; }
            editor.setSafeAreaMode(editor.safeAreaMode === "guides" ? "dim" : editor.safeAreaMode === "dim" ? "crop" : "guides");
          }}>
          <SafeAreaIcon />
        </button>
      </div>
    </div>
  );
}

function SafeAreaIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeDasharray="4 3" strokeLinecap="round" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}
