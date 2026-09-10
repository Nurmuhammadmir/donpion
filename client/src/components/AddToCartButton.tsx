"use client";

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
  className?: string;
  full?: boolean;
}

// Once this product is in the cart, the button turns into a −/+ stepper
// with the line total next to it — reactive to real cart state instead of
// a timed "Добавлено" flash, and lets the visitor back out (− down to 0
// removes it) without leaving the product page. A direct "Оформить заказ"
// link sits right below it, so the visitor doesn't have to go hunt for the
// cart icon themselves — add, then straight to checkout.
export default function AddToCartButton({ productId, slug, name, price, image, className, full }: Props) {
  const { items, addItem, updateQuantity } = useCart();
  const t = useTranslations("Common");
  const tCart = useTranslations("Cart");
  const locale = useLocale();
  const quantityInCart = items.find((i) => i.productId === productId)?.quantity ?? 0;

  if (quantityInCart > 0) {
    return (
      <div className={`space-y-3 ${full ? "w-full" : ""} ${className ?? ""}`}>
        <div className="flex items-center gap-4">
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
        <Button href="/checkout" className="w-full">
          {tCart("checkoutCta")}
        </Button>
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
