"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { resolveImageUrl } from "@/lib/images";

interface ProductGalleryProps {
  images: string[];
  alt: string;
}

// A horizontal snap-scroll strip, not a click-through thumbnail rail —
// swiping/scrolling through the full-size photos IS the interaction, with a
// slim progress bar below reflecting (and, if tapped, jumping to) position.
export default function ProductGallery({ images, alt }: ProductGalleryProps) {
  const t = useTranslations("Common");
  const [index, setIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const handleScroll = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const el = scrollerRef.current;
      if (!el || el.clientWidth === 0) return;
      const i = Math.round(el.scrollLeft / el.clientWidth);
      setIndex(Math.min(images.length - 1, Math.max(0, i)));
    });
  };

  const goTo = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div>
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="scroll-touch no-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
      >
        {images.map((img, i) => (
          <div
            key={`${img}-${i}`}
            className="relative aspect-[3/4] w-full flex-shrink-0 snap-center overflow-hidden bg-hermes-50/30"
          >
            <Image
              src={resolveImageUrl(img)}
              alt={alt}
              fill
              priority={i === 0}
              sizes="(min-width: 1024px) 540px, 90vw"
              quality={95}
              className="object-cover"
            />
          </div>
        ))}
      </div>

      {images.length > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={t("photoLabel", { n: i + 1 })}
              aria-current={i === index}
              onClick={() => goTo(i)}
              className={`h-[3px] transition-all duration-300 ease-out ${
                i === index ? "w-7 bg-hermes-500" : "w-3 bg-hairline hover:bg-graphite/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
