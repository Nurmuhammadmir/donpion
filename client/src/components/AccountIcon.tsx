"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/Link";

export default function AccountIcon() {
  const t = useTranslations("Nav");

  return (
    <Link
      href="/account"
      aria-label={t("account")}
      className="flex h-10 w-10 items-center justify-center text-ink transition-colors hover:text-hermes-500"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1" />
        <path d="M5 20c1.2-4 4-6 7-6s5.8 2 7 6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      </svg>
    </Link>
  );
}
