"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/Link";
import { useCart } from "@/components/CartProvider";
import { formatUZS } from "@/lib/format";
import Button from "@/components/Button";
import { resolveImageUrl } from "@/lib/images";
import CartCurrentOrder from "@/components/CartCurrentOrder";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api";

export default function CartView() {
  const { items, updateQuantity, removeItem, totalAmount } = useCart();
  const t = useTranslations("Cart");
  const tc = useTranslations("Common");
  const tp = useTranslations("Pions");
  const locale = useLocale();
  const [cashbackPercent, setCashbackPercent] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/settings`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setCashbackPercent(data.cashbackPercent ?? 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const pointsEstimate = Math.floor((totalAmount * cashbackPercent) / 100);

  if (items.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="text-graphite">{t("empty")}</p>
        <Link href="/" className="mt-5 inline-block text-xs font-medium uppercase tracking-wide2 text-hermes-500 underline underline-offset-4">
          {tc("goToCatalog")}
        </Link>
        <CartCurrentOrder />
      </div>
    );
  }

  return (
    <div className="grid gap-16 lg:grid-cols-[1fr_340px]">
      <ul className="min-w-0 divide-y divide-hairline">
        {items.map((item) => (
          <li key={item.productId} className="flex gap-4 py-6 sm:gap-6 sm:py-8">
            <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden bg-hermes-50/30 sm:h-28 sm:w-28">
              <Image src={resolveImageUrl(item.image)} alt={item.name} fill sizes="112px" quality={95} className="object-cover" />
            </div>

            <div className="flex flex-1 flex-col gap-3 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/flowers/${item.slug}`}
                    className="font-display text-base tracking-luxe text-ink hover:text-hermes-500 sm:text-lg"
                  >
                    {item.name}
                  </Link>
                  <p className="font-display mt-1 text-xs text-graphite sm:mt-1.5 sm:text-sm">{formatUZS(item.price, locale)}</p>
                </div>
                <div key={item.quantity} className="amount-pulse font-display flex-shrink-0 text-sm text-ink sm:text-base">
                  {formatUZS(item.price * item.quantity, locale)}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center border border-hairline">
                  <button
                    type="button"
                    aria-label={t("decreaseAria")}
                    onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                    className="h-8 w-8 text-graphite transition-transform hover:text-hermes-500 active:scale-90 sm:h-9 sm:w-9"
                  >
                    −
                  </button>
                  <span className="w-7 text-center text-sm sm:w-8">{item.quantity}</span>
                  <button
                    type="button"
                    aria-label={t("increaseAria")}
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    className="h-8 w-8 text-graphite transition-transform hover:text-hermes-500 active:scale-90 sm:h-9 sm:w-9"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.productId)}
                  className="text-[11px] uppercase tracking-wide2 text-graphite underline underline-offset-2 hover:text-hermes-500"
                >
                  {t("remove")}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <aside className="h-fit min-w-0 border border-hairline p-8">
        <h2 className="font-display text-lg tracking-luxe text-ink">{t("summaryTitle")}</h2>
        <div className="mt-6 flex items-baseline justify-between text-sm text-graphite">
          <span>{t("items")}</span>
          <span key={totalAmount} className="amount-pulse font-display text-base text-ink">
            {formatUZS(totalAmount, locale)}
          </span>
        </div>
        {cashbackPercent > 0 && (
          <p key={pointsEstimate} className="amount-pulse mt-2 text-xs text-hermes-600">
            {tp("earn", { count: pointsEstimate })}
          </p>
        )}
        <p className="mt-2 text-xs leading-relaxed text-graphite">{t("deliveryNote")}</p>
        <div className="mt-8">
          <Button href="/checkout" className="w-full">
            {t("checkoutCta")}
          </Button>
        </div>
      </aside>
    </div>
  );
}
