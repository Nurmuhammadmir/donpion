"use client";

import { useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/Link";
import type { ProductCardData } from "@/types";
import { formatUZS } from "@/lib/format";
import { resolveImageUrl } from "@/lib/images";

export default function ProductCard({ product }: { product: ProductCardData }) {
  const t = useTranslations("Common");
  const locale = useLocale();
  // The second-photo crossfade is driven by explicit state, not CSS
  // :hover/group-hover — on iOS/Android, WebKit treats a tap on an element
  // with :hover-styled descendants as "hover first, click second", which
  // was eating the first tap. touchstart/touchend never call
  // preventDefault, so the Link's click still fires normally either way.
  const [active, setActive] = useState(false);

  return (
    <Link
      href={`/flowers/${product.slug}`}
      className="block"
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onTouchStart={() => setActive(true)}
      onTouchEnd={() => setActive(false)}
      onTouchCancel={() => setActive(false)}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-hermes-50/30">
        <Image
          src={resolveImageUrl(product.images[0])}
          alt={product.name}
          fill
          sizes="(min-width: 1024px) 280px, 45vw"
          quality={95}
          className={`pointer-events-none object-cover transition-transform duration-700 ease-out ${
            active ? "scale-[1.04]" : ""
          }`}
        />
        {/* Second photo, if there is one — crossfades in on hover/touch and
            back out the moment it ends, on any device. pointer-events-none
            on both images is what makes the click always reach the Link
            below instead of landing on whichever photo is on top. */}
        {product.images[1] && (
          <Image
            src={resolveImageUrl(product.images[1])}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 280px, 45vw"
            quality={95}
            className={`pointer-events-none object-cover transition-opacity duration-500 ease-out ${
              active ? "opacity-100" : "opacity-0"
            }`}
          />
        )}
        {product.availability === "OutOfStock" && (
          <span className="absolute right-0 top-0 border border-white/70 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide2 text-white">
            {t("outOfStock")}
          </span>
        )}
        {product.oldPrice && (
          <span className="absolute left-0 top-0 bg-navy px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide2 text-white">
            {t("sale")}
          </span>
        )}
      </div>

      <div className="mt-5 flex flex-col items-center px-2 text-center">
        <h3 className="font-display text-lg leading-snug tracking-luxe text-ink">{product.name}</h3>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="font-display text-base text-ink/85">{formatUZS(product.price, locale)}</span>
          {product.oldPrice && (
            <span className="font-display text-sm text-graphite line-through">{formatUZS(product.oldPrice, locale)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
