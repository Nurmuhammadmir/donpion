"use client";

import { useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/Link";
import { useCart } from "@/components/CartProvider";
import type { ProductCardData } from "@/types";
import { formatUZS } from "@/lib/format";
import { isVideoUrl, resolveImageUrl } from "@/lib/images";

// Corporate buyers tend to pick a quantity and move on, not click into
// every product page one at a time — a quantity stepper + "в корзину"
// sits right on the card instead. The image/name/price stays a Link to
// the product page (for anyone who does want the full description first);
// the stepper row below it is deliberately outside that Link, since a
// button nested inside an <a> is both invalid markup and a tap-target mess.
export default function CorporateProductCard({ product }: { product: ProductCardData }) {
  const t = useTranslations("Corporate");
  const locale = useLocale();
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const handleAdd = () => {
    addItem({ productId: product._id, slug: product.slug, name: product.name, price: product.price, image: product.images[0] }, quantity);
    setJustAdded(true);
    setQuantity(1);
    window.setTimeout(() => setJustAdded(false), 1500);
  };

  return (
    <div>
      <Link href={`/flowers/${product.slug}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden bg-hermes-50/30">
          {isVideoUrl(product.images[0]) ? (
            <video
              src={resolveImageUrl(product.images[0])}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <Image
              src={resolveImageUrl(product.images[0])}
              alt={product.name}
              fill
              sizes="(min-width: 1024px) 280px, 45vw"
              quality={95}
              className="pointer-events-none object-cover"
            />
          )}
        </div>
        <div className="mt-4 px-1 text-center">
          <h3 className="font-display text-base leading-snug tracking-luxe text-ink">{product.name}</h3>
          <p className="mt-1 font-display text-sm text-ink/85">{formatUZS(product.price, locale)}</p>
        </div>
      </Link>

      <div className="mt-3 flex items-center justify-center gap-2">
        <div className="flex items-center border border-hairline">
          <button
            type="button"
            aria-label="−"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="h-9 w-8 text-graphite transition-colors hover:text-hermes-500"
          >
            −
          </button>
          <span className="w-7 text-center text-sm">{quantity}</span>
          <button
            type="button"
            aria-label="+"
            onClick={() => setQuantity((q) => q + 1)}
            className="h-9 w-8 text-graphite transition-colors hover:text-hermes-500"
          >
            +
          </button>
        </div>
        <button type="button" onClick={handleAdd} className="btn-primary flex-1 whitespace-nowrap px-3 py-2 text-xs">
          <span key={justAdded ? "added" : "idle"} className="amount-pulse inline-block">
            {justAdded ? t("added") : t("addToCart")}
          </span>
        </button>
      </div>
    </div>
  );
}
