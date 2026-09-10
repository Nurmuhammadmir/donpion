"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

// Real browser-history back (not a fixed link to the category) — returns to
// whatever page the visitor actually came from: home, a search result,
// the cart, wherever.
export default function BackLink({ className }: { className?: string }) {
  const router = useRouter();
  const t = useTranslations("Common");

  return (
    <button type="button" onClick={() => router.back()} className={className}>
      {t("back")}
    </button>
  );
}
