import type { BannerSpecDocument, Layer, RectLayer, TextLayer } from "@pcs/bannerspec";

export type { BannerSpecDocument, Layer, RectLayer, TextLayer };

/**
 * A command is a reversible edit to the scene document.
 * `apply` mutates a draft copy; `revert` undoes it on the same draft.
 * Commands must be self-contained (no references to live UI state).
 */
export interface SceneCommand {
  readonly label: string;
  apply(doc: BannerSpecDocument): void;
  revert(doc: BannerSpecDocument): void;
}

export function makeUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Deterministic fallback for non-secure contexts.
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export class AddLayerCommand implements SceneCommand {
  readonly label: string;
  constructor(private layer: Layer) {
    this.label = `Add ${layer.name}`;
  }
  apply(doc: BannerSpecDocument): void {
    doc.layers.push(this.layer);
  }
  revert(doc: BannerSpecDocument): void {
    doc.layers = doc.layers.filter((l) => l.id !== this.layer.id);
  }
}

export class RemoveLayerCommand implements SceneCommand {
  readonly label = "Delete layer";
  private index = 0;
  private parentId: string | null = null;
  constructor(
    private layerId: string,
    private removed: Layer,
  ) {}
  apply(doc: BannerSpecDocument): void {
    const remove = (layers: Layer[], parentId: string | null): boolean => {
      const index = layers.findIndex(l => l.id === this.layerId);
      if (index >= 0) { this.index = index; this.parentId = parentId; layers.splice(index, 1); return true; }
      return layers.some(l => l.type === "group" && remove(l.children, l.id));
    };
    remove(doc.layers, null);
  }
  revert(doc: BannerSpecDocument): void {
    const parent = this.parentId ? findLayer(doc.layers, this.parentId) : null;
    const layers = parent?.type === "group" ? parent.children : doc.layers;
    layers.splice(this.index, 0, structuredClone(this.removed));
  }
}

export class ReorderLayerCommand implements SceneCommand {
  readonly label = "Reorder layer";
  constructor(private layerId: string, private from: number, private to: number) {}
  apply(doc: BannerSpecDocument): void {
    move(doc.layers, this.from, this.to);
  }
  revert(doc: BannerSpecDocument): void {
    move(doc.layers, this.to, this.from);
  }
}

export class UpdateLayerCommand implements SceneCommand {
  readonly label: string;
  constructor(
    private layerId: string,
    private patch: Partial<Layer>,
    private previous: Partial<Layer>,
    /** When set, consecutive edits with the same key merge into one undo step. */
    readonly coalesceKey?: string,
  ) {
    this.label = "Edit layer";
  }
  private target(doc: BannerSpecDocument): Layer | undefined {
    return findLayer(doc.layers, this.layerId);
  }
  merge(patch: Partial<Layer>, previous: Partial<Layer>): void {
    for (const key of Object.keys(previous)) {
      if (!(key in this.previous)) (this.previous as Record<string, unknown>)[key] = (previous as Record<string, unknown>)[key];
    }
    Object.assign(this.patch, patch);
  }
  apply(doc: BannerSpecDocument): void {
    const t = this.target(doc);
    if (t) Object.assign(t, this.patch);
  }
  revert(doc: BannerSpecDocument): void {
    const t = this.target(doc);
    if (t) {
      for (const key of Object.keys(this.patch)) {
        delete (t as unknown as Record<string, unknown>)[key];
      }
      Object.assign(t, this.previous);
    }
  }
}

export function findLayer(layers: Layer[], id: string): Layer | undefined {
  for (const layer of layers) {
    if (layer.id === id) return layer;
    if (layer.type === "group") { const child = findLayer(layer.children, id); if (child) return child; }
  }
  return undefined;
}

export class UpdateCanvasCommand implements SceneCommand {
  readonly label: string;
  constructor(
    private patch: Partial<BannerSpecDocument["canvas"]>,
    private previous: Partial<BannerSpecDocument["canvas"]>,
  ) {
    this.label = "Edit canvas";
  }
  apply(doc: BannerSpecDocument): void {
    Object.assign(doc.canvas, this.patch);
  }
  revert(doc: BannerSpecDocument): void {
    Object.assign(doc.canvas, this.previous);
  }
}

function move<T>(arr: T[], from: number, to: number): void {
  if (from === to || from < 0 || from >= arr.length) return;
  const [item] = arr.splice(from, 1);
  arr.splice(Math.max(0, Math.min(to, arr.length)), 0, item as T);
}
