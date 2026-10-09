import {
  emptyBannerSpec,
  type BannerSpecDocument,
  type Layer,
  type RectLayer,
  type TextLayer,
  type EllipseLayer,
  type LineLayer,
  type ImageLayer,
  type LayerEffect,
  type Paint,
  type Track,
  type EffectType,
} from "@pcs/bannerspec";
import {
  AddLayerCommand,
  RemoveLayerCommand,
  ReorderLayerCommand,
  UpdateCanvasCommand,
  UpdateLayerCommand,
  type SceneCommand,
  makeUuid,
  findLayer,
} from "./commands.js";

export type { SceneCommand };

/**
 * The single owner of scene-document state.
 * All edits go through commands so undo/redo stays consistent.
 * Listeners are notified with the (frozen) new document after each commit.
 */
export class SceneStore {
  private doc: BannerSpecDocument;
  private undoStack: SceneCommand[] = [];
  private redoStack: SceneCommand[] = [];
  private listeners = new Set<(doc: BannerSpecDocument) => void>();

  constructor(doc: BannerSpecDocument = emptyBannerSpec()) {
    this.doc = doc;
  }

  getDocument(): BannerSpecDocument {
    return this.doc;
  }

  subscribe(fn: (doc: BannerSpecDocument) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.doc);
  }

  private commit(cmd: SceneCommand): void {
    const draft = structuredClone(this.doc);
    cmd.apply(draft);
    this.doc = draft;
    this.undoStack.push(cmd);
    this.redoStack = [];
    this.emit();
  }

  /** Integrate project-level commands into the same chronological history. */
  executeCommand(command: SceneCommand): void { this.commit(command); }

  lastAction():string|null{return [...this.undoStack].reverse().find(c=>c.label!=='Edit profile')?.label??null;}

  canUndo(): boolean { return this.undoStack.length > 0; }
  canRedo(): boolean { return this.redoStack.length > 0; }

  undo(): void {
    const cmd = this.undoStack.pop();
    if (!cmd) return;
    const draft = structuredClone(this.doc);
    cmd.revert(draft);
    this.doc = draft;
    this.redoStack.push(cmd);
    this.emit();
  }

  redo(): void {
    const cmd = this.redoStack.pop();
    if (!cmd) return;
    const draft = structuredClone(this.doc);
    cmd.apply(draft);
    this.doc = draft;
    this.undoStack.push(cmd);
    this.emit();
  }

  /** Replace the whole document (open project). Clears history. */
  loadDocument(doc: BannerSpecDocument): void {
    this.doc = doc;
    this.undoStack = [];
    this.redoStack = [];
    this.emit();
  }

  /**
   * Replace the whole document as one undoable command (scene/palette apply).
   * The previous document stays one Ctrl+Z away.
   */
  replaceDocument(doc: BannerSpecDocument, label = "Apply"): void {
    const prev = structuredClone(this.doc);
    this.commit(new (class implements SceneCommand {
      readonly label = label;
      apply(d: BannerSpecDocument): void {
        d.canvas = doc.canvas;
        d.layers = doc.layers;
        d.brand = doc.brand;
        d.animation = doc.animation;
      }
      revert(d: BannerSpecDocument): void {
        d.canvas = prev.canvas;
        d.layers = prev.layers;
        d.brand = prev.brand;
        d.animation = prev.animation;
      }
    })());
  }

  addRect(patch: Partial<Omit<RectLayer, "type" | "id">> = {}): string {
    const id = makeUuid();
    this.commit(new AddLayerCommand({
      id,
      type: "rect",
      name: patch.name ?? "Rectangle",
      visible: patch.visible ?? true,
      locked: patch.locked ?? false,
      opacity: patch.opacity ?? 1,
      rotation: patch.rotation ?? 0,
      fill: patch.fill ?? { type: "solid", color: "#4f7cff" },
      x: patch.x ?? 40,
      y: patch.y ?? 40,
      width: patch.width ?? 320,
      height: patch.height ?? 140,
      cornerRadius: patch.cornerRadius ?? 12,
    }));
    return id;
  }

  addText(patch: Partial<Omit<TextLayer, "type" | "id">> = {}): string {
    const id = makeUuid();
    this.commit(new AddLayerCommand({
      id,
      type: "text",
      name: patch.name ?? "Text",
      visible: patch.visible ?? true,
      locked: patch.locked ?? false,
      opacity: patch.opacity ?? 1,
      rotation: patch.rotation ?? 0,
      fill: patch.fill ?? { type: "solid", color: "#ffffff" },
      x: patch.x ?? 60,
      y: patch.y ?? 80,
      text: patch.text ?? "Make your profile yours.",
      fontFamily: patch.fontFamily ?? "Segoe UI, sans-serif",
      fontSize: patch.fontSize ?? 48,
      fontWeight: patch.fontWeight ?? 600,
    }));
    return id;
  }

  addEllipse(patch: Partial<Omit<EllipseLayer, "type" | "id">> = {}): string {
    const id = makeUuid();
    this.commit(new AddLayerCommand({
      id,
      type: "ellipse",
      name: patch.name ?? "Ellipse",
      visible: patch.visible ?? true,
      locked: patch.locked ?? false,
      opacity: patch.opacity ?? 1,
      rotation: patch.rotation ?? 0,
      fill: patch.fill ?? { type: "solid", color: "#8a63ff" },
      x: patch.x ?? 60,
      y: patch.y ?? 60,
      width: patch.width ?? 200,
      height: patch.height ?? 120,
    }));
    return id;
  }

  addLine(patch: Partial<Omit<LineLayer, "type" | "id">> = {}): string {
    const id = makeUuid();
    this.commit(new AddLayerCommand({
      id,
      type: "line",
      name: patch.name ?? "Line",
      visible: patch.visible ?? true,
      locked: patch.locked ?? false,
      opacity: patch.opacity ?? 1,
      rotation: patch.rotation ?? 0,
      fill: patch.fill ?? { type: "solid", color: "#5b8cff" },
      x: patch.x ?? 60,
      y: patch.y ?? 100,
      x2: patch.x2 ?? 300,
      y2: patch.y2 ?? 0,
      strokeWidth: patch.strokeWidth ?? 3,
    }));
    return id;
  }

  addImage(patch: Partial<Omit<ImageLayer, "type" | "id">> & { src: string }): string {
    const id = makeUuid();
    this.commit(new AddLayerCommand({
      id,
      type: "image",
      name: patch.name ?? "Image",
      visible: patch.visible ?? true,
      locked: patch.locked ?? false,
      opacity: patch.opacity ?? 1,
      rotation: patch.rotation ?? 0,
      fill: patch.fill ?? { type: "solid", color: "#00000000" },
      x: patch.x ?? 40,
      y: patch.y ?? 40,
      width: patch.width ?? 320,
      height: patch.height ?? 200,
      src: patch.src,
      fit: patch.fit ?? "cover",
      cornerRadius: patch.cornerRadius ?? 0,
    }));
    return id;
  }

  /** Add an externally constructed layer (duplicate/paste/import). */
  addLayer(layer: Layer): string {
    this.commit(new AddLayerCommand(layer));
    return layer.id;
  }

  /** Replace a group's children (procedural regeneration). */
  setGroupChildren(groupId: string, children: Layer[]): void {
    const g = this.doc.layers.find((l) => l.id === groupId);
    if (!g || g.type !== "group" || g.locked) return;
    this.commit(new UpdateLayerCommand(groupId, { children } as Partial<Layer>, { children: g.children } as Partial<Layer>));
  }

  /** Update a group's procedural params (and optionally regenerate children). */
  updateGroupParams(groupId: string, params: Record<string, number>, regenerate?: (g: { kind: string; params: Record<string, number> }) => Layer[]): void {
    const g = this.doc.layers.find((l) => l.id === groupId);
    if (!g || g.type !== "group" || g.locked) return;
    const patch: Partial<Layer> = { params: { ...(g.params ?? {}), ...params } } as Partial<Layer>;
    const prev: Partial<Layer> = { params: g.params } as Partial<Layer>;
    if (regenerate) {
      const children = regenerate({ kind: (g as { kind?: string }).kind ?? "custom", params: (patch as unknown as { params?: Record<string, number> }).params as Record<string, number> });
      (patch as { children?: Layer[] }).children = children;
      (prev as { children?: Layer[] }).children = g.children;
    }
    this.commit(new UpdateLayerCommand(groupId, patch, prev, `group-params:${groupId}`));
  }

  /** Add or replace an effect on a layer. */
  addEffect(layerId: string, type: EffectType, params: Record<string, number> = {}): void {
    const layer = this.layerById(layerId);
    if (!layer || layer.locked) return;
    const effect: LayerEffect = { id: makeUuid(), type, visible: true, params };
    this.commit(new UpdateLayerCommand(layerId, { effects: [...(layer.effects ?? []), effect] } as Partial<Layer>, { effects: layer.effects }));
  }

  removeEffect(layerId: string, effectId: string): void {
      const layer = this.layerById(layerId);
    if (!layer || layer.locked) return;
    this.commit(new UpdateLayerCommand(layerId, { effects: (layer.effects ?? []).filter((e) => e.id !== effectId) } as Partial<Layer>, { effects: layer.effects }));
  }

  toggleEffect(layerId: string, effectId: string): void {
    const layer = this.layerById(layerId);
    if (!layer || layer.locked) return;
    this.commit(new UpdateLayerCommand(
      layerId,
      { effects: (layer.effects ?? []).map((e) => (e.id === effectId ? { ...e, visible: !e.visible } : e)) } as Partial<Layer>,
      { effects: layer.effects },
    ));
  }

  /** Replace the animation tracks of a layer (whole-array edit; timeline owns UX). */
  setTracks(layerId: string, tracks: Track[]): void {
    const layer = this.layerById(layerId);
    if (!layer || layer.locked) return;
    this.commit(new UpdateLayerCommand(layerId, { tracks } as Partial<Layer>, { tracks: layer.tracks }));
  }

  /** Update paint of a layer (typed convenience). */
  updatePaint(layerId: string, paint: Paint): void {
    this.updateLayer(layerId, { fill: paint } as Partial<Layer>, `paint:${layerId}`);
  }

  /** Commit an externally constructed layer (duplicate/paste/import). */
  commitForeign(layer: Layer): void {
    this.commit(new AddLayerCommand(layer));
  }

  /** Update document-level animation settings. */
  setAnimation(patch: Partial<BannerSpecDocument["animation"]>): void {
    const cur = this.doc.animation ?? { duration: 8, loop: true };
    const next = { ...cur, ...patch };
    const prev = { ...cur };
    this.commit(new (class implements SceneCommand {
      readonly label = "Edit animation";
      apply(doc: BannerSpecDocument): void { doc.animation = next; }
      revert(doc: BannerSpecDocument): void { doc.animation = prev; }
    })());
  }

  removeLayer(layerId: string): void {
    const layer = this.layerById(layerId);
    if (!layer || layer.locked) return;
    this.commit(new RemoveLayerCommand(layerId, layer));
  }

  /** Merge consecutive patches to the same property set into one undo step. */
  updateLayer(layerId: string, patch: Partial<Layer>, coalesceKey?: string): void {
    const layer = this.layerById(layerId);
    if (!layer || (layer.locked && !(Object.keys(patch).length === 1 && patch.locked === false))) return;
    if (Object.entries(patch).every(([key, value]) => JSON.stringify((layer as unknown as Record<string, unknown>)[key]) === JSON.stringify(value))) return;
    const previous: Record<string, unknown> = {};
    for (const key of Object.keys(patch)) {
      previous[key] = (layer as unknown as Record<string, unknown>)[key];
    }
    // Coalesce: if the top command is the same keyed edit on the same layer,
    // fold this patch into it instead of stacking a new undo entry.
    const top = this.undoStack[this.undoStack.length - 1];
    if (
      coalesceKey &&
      top instanceof UpdateLayerCommand &&
      (top as unknown as { layerId: string }).layerId === layerId &&
      top.coalesceKey === coalesceKey
    ) {
      const draft = structuredClone(this.doc);
      Object.assign(findLayer(draft.layers, layerId) as Layer, patch);
      top.merge(patch, previous);
      this.doc = draft;
      this.redoStack = [];
      this.emit();
      return;
    }
    this.commit(new UpdateLayerCommand(layerId, patch, previous, coalesceKey));
  }

  updateCanvas(patch: Partial<BannerSpecDocument["canvas"]>): void {
    const previous: Record<string, unknown> = {};
    for (const key of Object.keys(patch)) {
      previous[key] = (this.doc.canvas as unknown as Record<string, unknown>)[key];
    }
    this.commit(new UpdateCanvasCommand(patch, previous));
  }

  /** Move layer within z-order. `to` indexes the array after removal semantics: higher = closer to top. */
  reorderLayer(layerId: string, to: number): void {
    const from = this.doc.layers.findIndex((l) => l.id === layerId);
    if (from < 0) return;
    const clamped = Math.max(0, Math.min(this.doc.layers.length - 1, to));
    if (from === clamped) return;
    this.commit(new ReorderLayerCommand(layerId, from, clamped));
  }

  layerById(layerId: string): Layer | undefined {
    return findLayer(this.doc.layers, layerId);
  }
}
