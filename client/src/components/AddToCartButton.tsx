"use client";

import { useState } from "react";
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

export default function AddToCartButton({ productId, slug, name, price, image, className, full }: Props) {
  const { addItem } = useCart();
  const t = useTranslations("Common");
  const [added, setAdded] = useState(false);

  const handleClick = () => {
    addItem({ productId, slug, name, price, image });
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`btn-primary ${full ? "w-full" : ""} ${className ?? ""}`}
    >
      {added ? t("added") : t("addToCart")}
    </button>
  );
}
