"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/Link";
import { getProducts } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
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
    const res = await getProducts({ occasion: occasion.slug, limit: 4 });
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
            <div className="page-transition">
              <div className="-mx-6 mt-12 flex scroll-touch no-scrollbar gap-4 overflow-x-auto scroll-smooth px-6 pb-2 text-left lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-x-8 lg:gap-y-12 lg:overflow-visible lg:px-0 lg:pb-0">
                {products.map((product) => (
                  <div key={product._id} className="w-[45%] flex-shrink-0 sm:w-[42%] lg:w-auto lg:flex-shrink">
                    <ProductCard product={product} />
                  </div>
                ))}
                <Link
                  href={`/occasion/${selected.slug}`}
                  className="flex aspect-[3/4] w-[45%] flex-shrink-0 flex-col items-center justify-center text-center sm:w-[42%] lg:hidden"
                >
                  <span className="text-xs font-medium uppercase tracking-wide2 text-hermes-500">
                    {tc("seeAllLine1")}
                    <br />
                    {tc("seeAllLine2")}
                  </span>
                </Link>
              </div>
              <div className="mt-10 hidden justify-center lg:flex lg:mt-14">
                <Link
                  href={`/occasion/${selected.slug}`}
                  className="text-xs font-medium uppercase tracking-wide2 text-hermes-500 underline underline-offset-4"
                >
                  {tc("seeAll")}
                </Link>
              </div>
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
