"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/Link";
import { getProducts } from "@/lib/api";
import { useCart } from "@/components/CartProvider";
import { formatUZS } from "@/lib/format";
import { resolveImageUrl } from "@/lib/images";
import type { AddonCategory, ProductCardData } from "@/types";

const ADDON_ICONS: Record<string, (props: { className?: string }) => React.JSX.Element> = {
  vazy: VaseIcon,
  shokolad: ChocolateIcon,
  "klubnika-v-shokolade": StrawberryIcon,
  igrushki: ToyIcon,
  "yuvelirnye-izdeliya": GemIcon,
  "sertifikaty-partnerov": CertificateIcon,
};

// The category a visitor sees expanded on arrival, before tapping anything.
const DEFAULT_CATEGORY_SLUG = "shokolad";

// Upsell shelf on the product page — "Вазы", "Шоколад", "Игрушки"… tap one
// to reveal the actual products tagged into it (separate, admin-managed
// products — see AddonCategory) and add them to the same order right here,
// without leaving the page.
export default function ProductAddons({ categories }: { categories: AddonCategory[] }) {
  const t = useTranslations("ProductAddons");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  const handleSelect = async (category: AddonCategory) => {
    if (activeId === category._id) {
      setActiveId(null);
      return;
    }
    setActiveId(category._id);
    setStatus("loading");
    const res = await getProducts({ addonCategory: category.slug, limit: 8 });
    setProducts(res.items);
    setStatus("done");
  };

  // Opens straight onto the chocolate shelf instead of an empty picker — the
  // single most-clicked category, per the (informal) ask to lead with it.
  useEffect(() => {
    const defaultCategory = categories.find((c) => c.slug === DEFAULT_CATEGORY_SLUG);
    if (defaultCategory) handleSelect(defaultCategory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (categories.length === 0) return null;

  return (
    <div className="mt-10 border-t border-hairline pt-8">
      <p className="eyebrow mb-5">{t("heading")}</p>

      {/* Small photo tiles, not text chips — a row the visitor scans and
          taps. 3:4, the same ratio as every other product photo on the
          site, not a cropped square/circle. Falls back to a line-art icon
          for any category the admin hasn't uploaded a photo for yet. */}
      <div className="flex gap-4 overflow-x-auto scroll-touch no-scrollbar pb-1">
        {categories.map((category) => {
          const Icon = ADDON_ICONS[category.slug] ?? DefaultAddonIcon;
          const isActive = activeId === category._id;
          return (
            <button
              key={category._id}
              type="button"
              onClick={() => handleSelect(category)}
              className="flex w-16 flex-shrink-0 flex-col items-center gap-2"
            >
              <span
                className={`relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden border-2 transition-colors duration-200 ${
                  isActive ? "border-hermes-500" : "border-hairline"
                }`}
              >
                {category.image ? (
                  <Image src={resolveImageUrl(category.image)} alt="" fill sizes="64px" className="object-cover" />
                ) : (
                  <span
                    className={`flex h-full w-full items-center justify-center bg-hermes-50/40 ${
                      isActive ? "text-hermes-600" : "text-graphite"
                    }`}
                  >
                    <Icon />
                  </span>
                )}
              </span>
              <span
                className={`text-center text-[10px] font-medium uppercase leading-tight tracking-wide2 ${
                  isActive ? "text-hermes-600" : "text-graphite"
                }`}
              >
                {category.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Always mounted (never conditionally unmounted) so both opening AND
          closing animate — a CSS grid-template-rows tween that smoothly
          takes arbitrary content from 0 to its natural height and back,
          rather than the panel just popping in and vanishing instantly. */}
      <div className={`grid transition-[grid-template-rows] duration-500 ease-out ${activeId ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className={`pt-6 transition-opacity duration-300 ${status === "loading" ? "opacity-40" : "opacity-100"}`}>
            {status === "loading" && <p className="text-sm text-graphite">{t("loading")}</p>}
            {status === "done" && products.length === 0 && <p className="text-sm text-graphite">{t("empty")}</p>}
            {status === "done" && products.length > 0 && (
              // Phone/tablet: a horizontal scroll strip (all products in one
              // row, swipe for the rest) instead of wrapping into several
              // short rows. Desktop: a real 3-column grid, no scrolling.
              <div className="flex gap-4 overflow-x-auto scroll-touch no-scrollbar pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">
                {products.map((product) => (
                  <div key={product._id} className="w-[42%] flex-shrink-0 sm:w-auto">
                    <AddonTile product={product} />
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setActiveId(null)}
              className="mt-6 block text-xs font-medium uppercase tracking-wide2 text-graphite underline underline-offset-4 transition-colors hover:text-hermes-500"
            >
              {t("reset")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddonTile({ product }: { product: ProductCardData }) {
  const { items, addItem, updateQuantity } = useCart();
  const t = useTranslations("Common");
  const tCart = useTranslations("Cart");
  const locale = useLocale();
  const quantity = items.find((i) => i.productId === product._id)?.quantity ?? 0;

  return (
    <div className="group border border-hairline p-3 text-center transition-colors duration-200 hover:border-ink/30">
      <Link href={`/flowers/${product.slug}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden bg-hermes-50/30">
          <Image
            src={resolveImageUrl(product.images[0])}
            alt={product.name}
            fill
            sizes="(min-width: 640px) 170px, 42vw"
            quality={95}
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        </div>
        <p className="mt-2.5 line-clamp-1 text-xs font-medium text-[#ff794e] [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
          {product.name}
        </p>
        <p className="font-display text-sm text-ink/85">{formatUZS(product.price, locale)}</p>
      </Link>

      {quantity > 0 ? (
        <div className="mt-2 flex items-center justify-center border border-hairline">
          <button
            type="button"
            aria-label={tCart("decreaseAria")}
            onClick={() => updateQuantity(product._id, quantity - 1)}
            className="h-7 w-7 flex-shrink-0 text-graphite transition-transform hover:text-hermes-500 active:scale-90"
          >
            −
          </button>
          <span key={quantity} className="amount-pulse w-6 text-center text-xs">
            {quantity}
          </span>
          <button
            type="button"
            aria-label={tCart("increaseAria")}
            onClick={() => addItem({ productId: product._id, slug: product.slug, name: product.name, price: product.price, image: product.images[0] })}
            className="h-7 w-7 flex-shrink-0 text-graphite transition-transform hover:text-hermes-500 active:scale-90"
          >
            +
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => addItem({ productId: product._id, slug: product.slug, name: product.name, price: product.price, image: product.images[0] })}
          className="mt-2 w-full border border-hairline py-1.5 text-[11px] font-medium uppercase tracking-wide2 text-graphite transition-all duration-200 hover:border-hermes-500 hover:text-hermes-500 active:scale-95"
        >
          {t("addToCart")}
        </button>
      )}
    </div>
  );
}

function DefaultAddonIcon({ className }: { className?: string }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function VaseIcon({ className }: { className?: string }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M9 3h6M10 3c0 2-2 3-2 6 0 2 1 3 1 3h6s1-1 1-3c0-3-2-4-2-6"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 12c-1 2-1.5 4-1.5 6a1 1 0 001 1h9a1 1 0 001-1c0-2-.5-4-1.5-6"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChocolateIcon({ className }: { className?: string }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="1" stroke="currentColor" strokeWidth="1" />
      <path d="M9 6v12M15 6v12M3 12h18" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function StrawberryIcon({ className }: { className?: string }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M8 4c1 1.2 2.4 1.6 4 1.6S15 5.2 16 4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path
        d="M12 6c4 0 6.5 3 6.5 6.5C18.5 16.5 15 21 12 21s-6.5-4.5-6.5-8.5C5.5 9 8 6 12 6z"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <circle cx="9.5" cy="11" r="0.6" fill="currentColor" />
      <circle cx="14.5" cy="11" r="0.6" fill="currentColor" />
      <circle cx="12" cy="14" r="0.6" fill="currentColor" />
      <circle cx="9" cy="16" r="0.6" fill="currentColor" />
      <circle cx="15" cy="16" r="0.6" fill="currentColor" />
    </svg>
  );
}

function ToyIcon({ className }: { className?: string }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 3l2.2 4.9L19 9l-3.6 3.4.9 5.1-4.3-2.5-4.3 2.5.9-5.1L5 9l4.8-1.1L12 3z"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GemIcon({ className }: { className?: string }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M6 4h12l3 5-9 11L3 9l3-5z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
      <path d="M3 9h18M9 4l3 5 3-5M12 9l-3 11M12 9l3 11" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

function CertificateIcon({ className }: { className?: string }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="9" r="6" stroke="currentColor" strokeWidth="1" />
      <path d="M9 14l-2 7 5-2.5L17 21l-2-7" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}
