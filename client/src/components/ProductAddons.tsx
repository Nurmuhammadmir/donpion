"use client";

import { useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { getProducts } from "@/lib/api";
import { useCart } from "@/components/CartProvider";
import { formatUZS } from "@/lib/format";
import { resolveImageUrl } from "@/lib/images";
import type { AddonCategory, ProductCardData } from "@/types";

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
      <p className="mb-4 text-xs font-medium uppercase tracking-wide2 text-graphite">{t("heading")}</p>
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category._id}
            type="button"
            onClick={() => handleSelect(category)}
            className={`border px-4 py-2 text-xs font-medium uppercase tracking-wide2 transition-colors ${
              activeId === category._id
                ? "border-hermes-500 bg-hermes-500/25 text-ink"
                : "border-hairline text-graphite hover:border-ink hover:text-ink"
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      {activeId && (
        <div className="page-transition mt-6">
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
  const { items, addItem } = useCart();
  const t = useTranslations("Common");
  const locale = useLocale();
  const quantity = items.find((i) => i.productId === product._id)?.quantity ?? 0;

  return (
    <div className="border border-hairline p-3 text-center">
      <div className="relative aspect-square overflow-hidden bg-hermes-50/30">
        <Image src={resolveImageUrl(product.images[0])} alt={product.name} fill sizes="180px" quality={95} className="object-cover" />
      </div>
      <p className="mt-2 text-xs text-ink">{product.name}</p>
      <p className="font-display text-sm text-ink/85">{formatUZS(product.price, locale)}</p>
      <button
        type="button"
        onClick={() => addItem({ productId: product._id, slug: product.slug, name: product.name, price: product.price, image: product.images[0] })}
        className="mt-2 w-full border border-hairline py-1.5 text-[11px] font-medium uppercase tracking-wide2 text-graphite transition-colors hover:border-hermes-500 hover:text-hermes-500"
      >
        {quantity > 0 ? `${t("addToCart")} · ${quantity}` : t("addToCart")}
      </button>
    </div>
  );
}
