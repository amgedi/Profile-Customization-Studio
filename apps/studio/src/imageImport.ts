import type { Editor } from "./editor.js";

/** Local drops and image clipboard items use the same embedded asset format as Open Image. */
export async function insertLocalImage(file: File, editor: Editor): Promise<void> {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error("Choose a PNG, JPEG, WebP, or GIF image.");
  if (file.size > 20_000_000) throw new Error("This image is over 20 MB. Resize it before importing.");
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Could not read the image.")); reader.readAsDataURL(file);
  });
  const image = new Image();
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("The image could not be decoded.")); image.src = src; });
  const scale = Math.min(1, editor.doc.canvas.width * .6 / image.naturalWidth, editor.doc.canvas.height * .8 / image.naturalHeight);
  editor.addImage({ src, name: file.name || "Pasted image", width: Math.max(1, Math.round(image.naturalWidth * scale)), height: Math.max(1, Math.round(image.naturalHeight * scale)), x: 40, y: 40 });
}
