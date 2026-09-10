"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { resolveImageUrl } from "@/lib/images";

interface ProductGalleryProps {
  images: string[];
  alt: string;
}

// Main photo plus a thumbnail strip when a product has more than one —
// thumbnails work everywhere, swipe adds a native feel on touch devices.
export default function ProductGallery({ images, alt }: ProductGalleryProps) {
  const t = useTranslations("Common");
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const goTo = (i: number) => setIndex(((i % images.length) + images.length) % images.length);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 40) {
      goTo(index + (delta < 0 ? 1 : -1));
    }
    touchStartX.current = null;
  };

  return (
    <div>
      <div
        className="relative aspect-[3/4] overflow-hidden bg-hermes-50/30"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <Image
          src={resolveImageUrl(images[index])}
          alt={alt}
          fill
          priority={index === 0}
          sizes="(min-width: 1024px) 540px, 90vw"
          quality={95}
          className="object-cover"
        />
      </div>

      {images.length > 1 && (
        <div className="no-scrollbar mt-3 flex scroll-touch gap-3 overflow-x-auto scroll-smooth pb-1">
          {images.map((img, i) => (
            <button
              key={`${img}-${i}`}
              type="button"
              onClick={() => goTo(i)}
              aria-label={t("photoLabel", { n: i + 1 })}
              aria-current={i === index}
              className={`relative aspect-[3/4] w-16 flex-shrink-0 overflow-hidden border transition-colors ${
                i === index ? "border-ink" : "border-hairline"
              }`}
            >
              <Image src={resolveImageUrl(img)} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
