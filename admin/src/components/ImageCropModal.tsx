import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import Modal from "./Modal";
import type { CropArea } from "@/lib/cropImage";

// Every photo in Витрина is the same shape (3:4, same as the real
// storefront's own cards) — this is where that gets enforced at the
// source instead of leaving it to however each photo happened to be
// framed on whatever phone took it.
export default function ImageCropModal({
  imageSrc,
  stepLabel,
  onConfirm,
  onCancel,
}: {
  imageSrc: string;
  stepLabel?: string;
  onConfirm: (area: CropArea) => void;
  onCancel: () => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<CropArea | null>(null);

  const handleCropComplete = useCallback((_: CropArea, croppedAreaPixels: CropArea) => {
    setArea(croppedAreaPixels);
  }, []);

  return (
    <Modal onClose={onCancel} maxWidth="max-w-md">
      <h2 className="font-medium text-ink">Обрезка фото{stepLabel ? ` — ${stepLabel}` : ""}</h2>
      <p className="mt-1 text-xs text-graphite">Единый формат для всех фото в витрине — 3:4.</p>

      <div className="relative mt-4 h-80 w-full overflow-hidden rounded-xl bg-ink/5">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={0}
          aspect={3 / 4}
          minZoom={1}
          maxZoom={3}
          zoomSpeed={1}
          cropShape="rect"
          showGrid
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={handleCropComplete}
        />
      </div>

      <input
        type="range"
        min={1}
        max={3}
        step={0.01}
        value={zoom}
        onChange={(e) => setZoom(Number(e.target.value))}
        className="mt-4 w-full accent-hermes-500"
        aria-label="Масштаб"
      />

      <div className="mt-4 flex gap-3">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">
          Отмена
        </button>
        <button type="button" disabled={!area} onClick={() => area && onConfirm(area)} className="btn-primary flex-1">
          Готово
        </button>
      </div>
    </Modal>
  );
}
