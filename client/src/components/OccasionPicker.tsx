"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { getProducts } from "@/lib/api";
import ProductShelf from "@/components/ProductShelf";
import type { Occasion, ProductCardData } from "@/types";

type Status = "idle" | "loading" | "done";

// Right after the personality quiz — same click-a-tile-see-matching-products
// mechanism as BouquetQuiz, but grouped by what the flowers are FOR
// ("Свадебная флористика", "Корпоративные заказы"…) rather than who they suit.
export default function OccasionPicker({ occasions }: { occasions: Occasion[] }) {
  const t = useTranslations("OccasionPicker");
  const tc = useTranslations("Common");
  const [selected, setSelected] = useState<Occasion | null>(null);
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [status, setStatus] = useState<Status>("idle");

  if (occasions.length === 0) return null;

  const handleSelect = async (occasion: Occasion) => {
    setSelected(occasion);
    setStatus("loading");
    const res = await getProducts({ occasion: occasion.slug, limit: 8 });
    setProducts(res.items);
    setStatus("done");
  };

  return (
    <div className="mx-auto max-w-5xl text-center">
      <p className="eyebrow mb-4">{t("eyebrow")}</p>
      <h2 className="font-display text-2xl tracking-luxe text-ink sm:text-3xl">
        {selected ? t("resultTitle") : t("questionTitle")}
      </h2>

      {!selected ? (
        <div className="page-transition mx-auto mt-10 flex max-w-xl flex-col gap-4">
          {occasions.map((occasion) => (
            <button
              key={occasion._id}
              type="button"
              onClick={() => handleSelect(occasion)}
              className="border border-hairline px-6 py-4 text-sm text-ink transition-colors hover:border-ink"
            >
              {occasion.name}
            </button>
          ))}
        </div>
      ) : (
        <div className="page-transition mt-10">
          <p className="font-display text-xl tracking-luxe text-hermes-500">{selected.name}</p>
          {selected.description && (
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-graphite">{selected.description}</p>
          )}

          {status === "loading" && <p className="mt-10 text-sm text-graphite">{t("loadingText")}</p>}

          {status === "done" && products.length > 0 && (
            <div className="page-transition mt-12 text-left">
              <ProductShelf
                products={products}
                seeAllHref={`/occasion/${selected.slug}`}
                seeAllLabel={tc("seeAll")}
                seeAllLine1={tc("seeAllLine1")}
                seeAllLine2={tc("seeAllLine2")}
                emptyText={t("emptyText")}
              />
            </div>
          )}

          {status === "done" && products.length === 0 && (
            <div className="page-transition">
              <p className="mt-10 text-sm text-graphite">{t("emptyText")}</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setSelected(null)}
            className="mt-10 block text-xs font-medium uppercase tracking-wide2 text-graphite underline underline-offset-4 hover:text-hermes-500"
          >
            {t("changeChoice")}
          </button>
        </div>
      )}
    </div>
  );
}
