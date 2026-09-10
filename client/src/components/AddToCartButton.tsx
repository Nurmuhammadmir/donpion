"use client";

import { useTranslations } from "next-intl";
import { useCart } from "@/components/CartProvider";

interface Props {
  productId: string;
  slug: string;
  name: string;
  price: number;
  image: string;
  className?: string;
  full?: boolean;
}

// Shows how many of this exact product are already in the cart, right on
// the card — reactive to the real cart state instead of a timed "Добавлено"
// flash that reverted back to "В корзину" and left it unclear whether (or
// how many times) the click actually landed. Clicking again just adds
// another one, incrementing the count shown.
export default function AddToCartButton({ productId, slug, name, price, image, className, full }: Props) {
  const { items, addItem } = useCart();
  const t = useTranslations("Common");
  const quantityInCart = items.find((i) => i.productId === productId)?.quantity ?? 0;

  const handleClick = () => {
    addItem({ productId, slug, name, price, image });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`btn-primary ${full ? "w-full" : ""} ${className ?? ""}`}
    >
      {quantityInCart > 0 ? t("addedCount", { count: quantityInCart }) : t("addToCart")}
    </button>
  );
}
