"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useCart } from "@/components/CartProvider";
import { formatUZS } from "@/lib/format";
import Button from "@/components/Button";

interface Props {
  productId: string;
  slug: string;
  name: string;
  price: number;
  image: string;
  cashbackPercent: number;
  className?: string;
  full?: boolean;
}

// Once this product is in the cart, the button turns into a −/+ stepper
// with the line total next to it — reactive to real cart state instead of
// a timed "Добавлено" flash, and lets the visitor back out (− down to 0
// removes it) without leaving the product page. A direct "Перейти в
// корзину" link sits right below it, so the visitor doesn't have to go
// hunt for the cart icon themselves after adding something.
export default function AddToCartButton({ productId, slug, name, price, image, cashbackPercent, className, full }: Props) {
  const { items, addItem, updateQuantity } = useCart();
  const t = useTranslations("Common");
  const tCart = useTranslations("Cart");
  const locale = useLocale();
  const quantityInCart = items.find((i) => i.productId === productId)?.quantity ?? 0;

  if (quantityInCart > 0) {
    return (
      <div className={`space-y-4 ${full ? "w-full" : ""} ${className ?? ""}`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center border border-hairline">
            <button
              type="button"
              aria-label={tCart("decreaseAria")}
              onClick={() => updateQuantity(productId, quantityInCart - 1)}
              className="h-10 w-10 text-graphite transition-transform hover:text-hermes-500 active:scale-90"
            >
              −
            </button>
            <span className="w-8 text-center text-sm">{quantityInCart}</span>
            <button
              type="button"
              aria-label={tCart("increaseAria")}
              onClick={() => addItem({ productId, slug, name, price, image })}
              className="h-10 w-10 text-graphite transition-transform hover:text-hermes-500 active:scale-90"
            >
              +
            </button>
          </div>
          <span key={quantityInCart} className="amount-pulse font-display text-base text-ink">
            {formatUZS(price * quantityInCart, locale)}
          </span>
        </div>
        <PionsEstimate price={price} quantity={quantityInCart} cashbackPercent={cashbackPercent} />
        <Button href="/cart" className="w-full">
          {tCart("goToCart")}
        </Button>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${full ? "w-full" : ""} ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => addItem({ productId, slug, name, price, image })}
        className={`btn-primary ${full ? "w-full" : ""}`}
      >
        {t("addToCart")}
      </button>
      <PionsEstimate price={price} quantity={1} cashbackPercent={cashbackPercent} />
    </div>
  );
}

// "+N Пионов" right next to the price, plus a tiny "?" that opens a short
// explainer — recalculated live off price × quantity, same as the actual
// accrual on the backend (see Order.pointsEarned), just an estimate since
// no discount/redemption context exists on the product page yet.
function PionsEstimate({ price, quantity, cashbackPercent }: { price: number; quantity: number; cashbackPercent: number }) {
  const t = useTranslations("Pions");
  const [infoOpen, setInfoOpen] = useState(false);

  if (cashbackPercent <= 0) return null;

  const points = Math.floor((price * quantity * cashbackPercent) / 100);

  return (
    <div className="relative flex items-center gap-1.5">
      <span key={points} className="amount-pulse text-xs text-hermes-600">
        {t("earn", { count: points })}
      </span>
      <button
        type="button"
        aria-label={t("infoAria")}
        onClick={() => setInfoOpen((v) => !v)}
        onBlur={() => setInfoOpen(false)}
        className="flex h-4 w-4 flex-shrink-0 items-center justify-center border border-graphite/40 text-[9px] leading-none text-graphite transition-colors hover:border-hermes-500 hover:text-hermes-500"
      >
        ?
      </button>
      {infoOpen && (
        <div className="page-transition absolute left-0 top-6 z-10 w-60 border border-hairline bg-paper p-3 text-xs leading-relaxed text-graphite">
          {t("infoText")}
        </div>
      )}
    </div>
  );
}
