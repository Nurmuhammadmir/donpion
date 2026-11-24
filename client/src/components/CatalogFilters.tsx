"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { BouquetColor, Recipient } from "@/types";
import { formatUZS } from "@/lib/format";

const RECIPIENTS: Recipient[] = ["mom", "wife", "girlfriend", "colleague"];
const COLORS: BouquetColor[] = ["red", "white", "pink", "yellow", "purple", "orange", "mixed"];
// Quick one-tap buckets (ТЗ: "до 1 млн, до 2, до 3, до 4") — sit above the
// от/до inputs so most people never have to type a number at all.
const PRICE_PRESETS = [1_000_000, 2_000_000, 3_000_000, 4_000_000];

// Small toggleable chip, same quiet-ink/navy-fill-on-hover language as the
// site's .btn-outline — just lower-profile for a whole row of these.
function chipClass(active: boolean) {
  return `border px-3.5 py-1.5 text-xs font-medium uppercase tracking-wide2 transition-colors ${
    active ? "border-navy bg-navy text-paper" : "border-hairline text-ink hover:border-ink"
  }`;
}

// Каталог: повод/кому/цвет/цена «от–до» (ТЗ 3.1). Occasion options come
// from the server-rendered page (already fetched there for the homepage
// section); кому/цвет are the same small fixed list the admin form uses.
// Every change rewrites the URL's query string — the actual filtering
// happens server-side in page.tsx reading these same params, so a
// shared/bookmarked filtered link always renders the same result.
export default function CatalogFilters({
  occasions = [],
  showRecipient = true,
}: {
  occasions?: { name: string; slug: string }[];
  // Off on the corporate-orders page — "кому" (маме/жене/девушке/коллеге)
  // doesn't make sense for a business buyer.
  showRecipient?: boolean;
}) {
  const t = useTranslations("Catalog");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [priceMin, setPriceMin] = useState(searchParams.get("priceMin") ?? "");
  const [priceMax, setPriceMax] = useState(searchParams.get("priceMax") ?? "");

  const selectedOccasion = searchParams.get("occasion") ?? "";
  const selectedRecipients = searchParams.get("recipient")?.split(",").filter(Boolean) ?? [];
  const selectedColors = searchParams.get("color")?.split(",").filter(Boolean) ?? [];

  const pushParams = (next: URLSearchParams) => {
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const setSingle = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    pushParams(next);
  };

  const toggleMulti = (key: string, current: string[], value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    const updated = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    if (updated.length > 0) next.set(key, updated.join(","));
    else next.delete(key);
    pushParams(next);
  };

  const applyPrice = () => {
    const next = new URLSearchParams(searchParams.toString());
    if (priceMin) next.set("priceMin", priceMin);
    else next.delete("priceMin");
    if (priceMax) next.set("priceMax", priceMax);
    else next.delete("priceMax");
    pushParams(next);
  };

  // A preset is "from 0 to X" — picking one clears priceMin and any other
  // preset, picking the already-active one again clears it back to no filter.
  const applyPricePreset = (value: number) => {
    const isActive = !priceMin && priceMax === String(value);
    const nextMax = isActive ? "" : String(value);
    setPriceMin("");
    setPriceMax(nextMax);
    const next = new URLSearchParams(searchParams.toString());
    next.delete("priceMin");
    if (nextMax) next.set("priceMax", nextMax);
    else next.delete("priceMax");
    pushParams(next);
  };

  const hasActiveFilters =
    selectedOccasion || selectedRecipients.length > 0 || selectedColors.length > 0 || searchParams.get("priceMin") || searchParams.get("priceMax");

  const reset = () => {
    setPriceMin("");
    setPriceMax("");
    router.push(pathname);
  };

  return (
    <div className="mt-8 space-y-5 border-y border-hairline py-6">
      {occasions.length > 0 && (
        <div>
          <p className="eyebrow mb-2">{t("occasion")}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setSingle("occasion", "")} className={chipClass(!selectedOccasion)}>
              {t("allOccasions")}
            </button>
            {occasions.map((o) => (
              <button
                key={o.slug}
                type="button"
                onClick={() => setSingle("occasion", selectedOccasion === o.slug ? "" : o.slug)}
                className={chipClass(selectedOccasion === o.slug)}
              >
                {o.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {showRecipient && (
        <div>
          <p className="eyebrow mb-2">{t("recipient")}</p>
          <div className="flex flex-wrap gap-2">
            {RECIPIENTS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => toggleMulti("recipient", selectedRecipients, r)}
                className={chipClass(selectedRecipients.includes(r))}
              >
                {t(`recipient_${r}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="eyebrow mb-2">{t("color")}</p>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggleMulti("color", selectedColors, c)}
              className={chipClass(selectedColors.includes(c))}
            >
              {t(`color_${c}`)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="eyebrow mb-2">{t("price")}</p>
        <div className="flex flex-wrap gap-2">
          {PRICE_PRESETS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => applyPricePreset(value)}
              className={chipClass(!priceMin && priceMax === String(value))}
            >
              {t("priceUpTo", { amount: formatUZS(value, locale) })}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="eyebrow mb-1.5 block">{t("priceFrom")}</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            onBlur={applyPrice}
            className="w-28 border border-hairline bg-transparent px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="eyebrow mb-1.5 block">{t("priceTo")}</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            onBlur={applyPrice}
            className="w-28 border border-hairline bg-transparent px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={applyPrice}
          className="h-[38px] border border-ink px-4 text-xs font-medium uppercase tracking-wide2 text-ink transition-colors hover:bg-ink hover:text-white"
        >
          {t("apply")}
        </button>
        {hasActiveFilters && (
          <button type="button" onClick={reset} className="text-xs font-medium uppercase tracking-wide2 text-graphite underline-offset-4 hover:underline">
            {t("reset")}
          </button>
        )}
      </div>
    </div>
  );
}
