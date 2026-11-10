export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// 3:4 at a size sharp (server/src/controllers/uploads.controller.js) will
// happily pass through without upscaling — it only ever caps width at
// 2400, never enlarges, and still re-encodes/compresses whatever lands
// here, so this doesn't need to be the final delivered resolution.
const OUTPUT_WIDTH = 1200;
const OUTPUT_HEIGHT = 1600;

export async function cropImageToFile(imageSrc: string, area: CropArea, filename: string): Promise<File> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_WIDTH;
  canvas.height = OUTPUT_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas недоступен");

  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Не удалось обрезать фото"))), "image/jpeg", 0.92);
  });
  return new File([blob], filename, { type: "image/jpeg" });
}
