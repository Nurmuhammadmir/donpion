"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCart } from "@/components/CartProvider";
import { Link } from "@/i18n/Link";
import { formatUZS } from "@/lib/format";

// A business buyer adding several products one at a time loses track of
// the running total scrolling through a long bulk grid — this stays
// pinned at the bottom the whole time there's something in the cart, so
// "how much so far" and "go pay" are never more than a glance away.
export default function CorporateCartBar() {
  const t = useTranslations("Corporate");
  const locale = useLocale();
  const { items, totalCount, totalAmount, hydrated } = useCart();

  if (!hydrated || items.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-navy text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3 lg:px-10">
        <span key={totalCount} className="amount-pulse text-xs text-white/70">
          {t("cartCount", { count: totalCount })} · <span className="font-display text-sm text-white">{formatUZS(totalAmount, locale)}</span>
        </span>
        <Link href="/cart" className="btn-primary px-5 py-2 text-xs">
          {t("goToCart")}
        </Link>
      </div>
    </div>
  );
}
