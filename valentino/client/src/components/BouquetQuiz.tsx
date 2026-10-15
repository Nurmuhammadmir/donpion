"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/Link";
import { getProducts } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import type { Character, ProductCardData } from "@/types";

type Status = "idle" | "loading" | "done";

export default function BouquetQuiz({ characters }: { characters: Character[] }) {
  const t = useTranslations("Quiz");
  const tc = useTranslations("Common");
  const [selected, setSelected] = useState<Character | null>(null);
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [status, setStatus] = useState<Status>("idle");

  const handleSelect = async (character: Character) => {
    setSelected(character);
    setStatus("loading");
    const res = await getProducts({ character: character.slug, limit: 4 });
    setProducts(res.items);
    setStatus("done");
  };

  return (
    <div id="quiz" className="mx-auto max-w-5xl scroll-mt-24 text-center">
      <p className="eyebrow mb-4">{t("eyebrow")}</p>
      <h2 className="font-display text-2xl tracking-luxe text-ink sm:text-3xl">
        {selected ? t("resultTitle") : t("questionTitle")}
      </h2>

      {!selected ? (
        <div className="page-transition mx-auto mt-10 flex max-w-xl flex-col gap-4">
          {characters.map((character) => (
            <button
              key={character._id}
              type="button"
              onClick={() => handleSelect(character)}
              className="border border-hairline px-6 py-4 text-sm text-ink transition-colors hover:border-ink"
            >
              {character.name}
            </button>
          ))}
        </div>
      ) : (
        <div className="page-transition mt-10">
          <p className="font-display text-xl tracking-luxe text-hermes-500">{selected.name}</p>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-graphite">{selected.description}</p>

          {status === "loading" && <p className="mt-10 text-sm text-graphite">{t("loadingText")}</p>}

          {status === "done" && products.length > 0 && (
            <div className="page-transition">
              <div className="-mx-6 mt-12 flex scroll-touch no-scrollbar gap-4 overflow-x-auto scroll-smooth px-6 pb-2 text-left lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-x-8 lg:gap-y-12 lg:overflow-visible lg:px-0 lg:pb-0">
                {products.map((product) => (
                  <div
                    key={product._id}
                    className="w-[45%] flex-shrink-0 sm:w-[42%] lg:w-auto lg:flex-shrink"
                  >
                    <ProductCard product={product} />
                  </div>
                ))}
                {/* Mobile/tablet: "see all" rides at the end of the strip */}
                <Link
                  href={`/character/${selected.slug}`}
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
                  href={`/character/${selected.slug}`}
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
        </div>
      )}
    </div>
  );
}
