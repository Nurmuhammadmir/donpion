"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCart } from "@/components/CartProvider";
import { formatUZS } from "@/lib/format";

interface Props {
  productId: string;
  slug: string;
  name: string;
  price: number;
  image: string;
  className?: string;
  full?: boolean;
}

// Once this product is in the cart, the button turns into a −/+ stepper
// with the line total next to it — reactive to real cart state instead of
// a timed "Добавлено" flash, and lets the visitor back out (− down to 0
// removes it) without leaving the product page.
export default function AddToCartButton({ productId, slug, name, price, image, className, full }: Props) {
  const { items, addItem, updateQuantity } = useCart();
  const t = useTranslations("Common");
  const tCart = useTranslations("Cart");
  const locale = useLocale();
  const quantityInCart = items.find((i) => i.productId === productId)?.quantity ?? 0;

  if (quantityInCart > 0) {
    return (
      <div className={`flex items-center gap-4 ${full ? "w-full justify-between" : ""} ${className ?? ""}`}>
        <div className="flex items-center border border-hairline">
          <button
            type="button"
            aria-label={tCart("decreaseAria")}
            onClick={() => updateQuantity(productId, quantityInCart - 1)}
            className="h-10 w-10 text-graphite hover:text-hermes-500"
          >
            −
          </button>
          <span className="w-8 text-center text-sm">{quantityInCart}</span>
          <button
            type="button"
            aria-label={tCart("increaseAria")}
            onClick={() => addItem({ productId, slug, name, price, image })}
            className="h-10 w-10 text-graphite hover:text-hermes-500"
          >
            +
          </button>
        </div>
        <span className="font-display text-base text-ink">{formatUZS(price * quantityInCart, locale)}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => addItem({ productId, slug, name, price, image })}
      className={`btn-primary ${full ? "w-full" : ""} ${className ?? ""}`}
    >
      {t("addToCart")}
    </button>
  );
}
