import type { Layer } from "@pcs/bannerspec";

/** Return the sibling list that owns a layer at any nesting depth. */
export function layerContainer(layers: Layer[], id: string): Layer[] | undefined {
  if (layers.some(layer => layer.id === id)) return layers;
  for (const layer of layers) {
    if (layer.type === "group") { const found = layerContainer(layer.children, id); if (found) return found; }
  }
}

/** Derive a temporary render tree without changing the saved scene or history. */
export function previewLayer(layers: Layer[], id: string, patch: (layer: Layer) => Layer): Layer[] {
  return layers.map(layer => {
    const nested = layer.type === "group" ? { ...layer, children: previewLayer(layer.children, id, patch) } : layer;
    return layer.id === id ? patch(nested) : nested;
  });
}
