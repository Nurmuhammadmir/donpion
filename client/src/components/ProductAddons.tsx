"use client";

import { useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { getProducts } from "@/lib/api";
import { useCart } from "@/components/CartProvider";
import { formatUZS } from "@/lib/format";
import { resolveImageUrl } from "@/lib/images";
import type { AddonCategory, ProductCardData } from "@/types";

const ADDON_ICONS: Record<string, (props: { className?: string }) => React.JSX.Element> = {
  vazy: VaseIcon,
  shokolad: ChocolateIcon,
  igrushki: ToyIcon,
  "yuvelirnye-izdeliya": GemIcon,
  "sertifikaty-partnerov": CertificateIcon,
};

// Upsell shelf on the product page — "Вазы", "Шоколад", "Игрушки"… tap one
// to reveal the actual products tagged into it (separate, admin-managed
// products — see AddonCategory) and add them to the same order right here,
// without leaving the page.
export default function ProductAddons({ categories }: { categories: AddonCategory[] }) {
  const t = useTranslations("ProductAddons");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  if (categories.length === 0) return null;

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

  return (
    <div className="mt-10 border-t border-hairline pt-8">
      <p className="eyebrow mb-5">{t("heading")}</p>
      <div className="flex flex-wrap gap-2.5">
        {categories.map((category) => {
          const Icon = ADDON_ICONS[category.slug] ?? DefaultAddonIcon;
          const isActive = activeId === category._id;
          return (
            <button
              key={category._id}
              type="button"
              onClick={() => handleSelect(category)}
              className={`flex items-center gap-2 border px-4 py-2.5 text-xs font-medium uppercase tracking-wide2 transition-all duration-200 ${
                isActive
                  ? "border-hermes-500 bg-hermes-500/25 text-ink"
                  : "border-hairline text-graphite hover:border-ink hover:text-ink"
              }`}
            >
              <Icon className={isActive ? "text-hermes-600" : "text-graphite"} />
              {category.name}
            </button>
          );
        })}
      </div>

      {activeId && (
        <div key={activeId} className="page-transition mt-6">
          {status === "loading" && <p className="text-sm text-graphite">{t("loading")}</p>}
          {status === "done" && products.length === 0 && <p className="text-sm text-graphite">{t("empty")}</p>}
          {status === "done" && products.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <AddonTile key={product._id} product={product} />
              ))}
            </div>
          )}
        </div>
      )}
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
      <div className="relative aspect-square overflow-hidden bg-hermes-50/30">
        <Image
          src={resolveImageUrl(product.images[0])}
          alt={product.name}
          fill
          sizes="180px"
          quality={95}
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
      </div>
      <p className="mt-2.5 line-clamp-1 text-xs text-ink">{product.name}</p>
      <p className="font-display text-sm text-ink/85">{formatUZS(product.price, locale)}</p>

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
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function VaseIcon({ className }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
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
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="1" stroke="currentColor" strokeWidth="1" />
      <path d="M9 6v12M15 6v12M3 12h18" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function ToyIcon({ className }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
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
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M6 4h12l3 5-9 11L3 9l3-5z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
      <path d="M3 9h18M9 4l3 5 3-5M12 9l-3 11M12 9l3 11" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

function CertificateIcon({ className }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="9" r="6" stroke="currentColor" strokeWidth="1" />
      <path d="M9 14l-2 7 5-2.5L17 21l-2-7" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}
