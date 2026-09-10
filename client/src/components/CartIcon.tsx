"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/Link";
import { useCart } from "@/components/CartProvider";

export default function CartIcon() {
  const { totalCount } = useCart();
  const t = useTranslations("Footer");

  return (
    <Link
      href="/cart"
      aria-label={t("cart")}
      className="relative flex h-10 w-10 items-center justify-center text-ink transition-colors hover:text-hermes-500"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 4h2l2.2 11.4a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="9.5" cy="20" r="1.4" fill="currentColor" />
        <circle cx="17.5" cy="20" r="1.4" fill="currentColor" />
      </svg>
      {totalCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-none bg-hermes-500 px-1 text-[10px] font-semibold text-white">
          {totalCount}
        </span>
      )}
    </Link>
  );
}
