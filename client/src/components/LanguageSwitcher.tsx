"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

// Swaps ru<->uz on the equivalent page (not back to the homepage) and
// persists the choice — next-intl's middleware remembers it in a cookie,
// so a return visit to "/" goes straight to the last-picked language.
export default function LanguageSwitcher({ className, onClick }: { className?: string; onClick?: () => void }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("LanguageSwitcher");
  const target = locale === "ru" ? "uz" : "ru";

  return (
    <button
      type="button"
      onClick={() => {
        router.replace(pathname, { locale: target });
        onClick?.();
      }}
      aria-label={target === "uz" ? "O'zbek tiliga o'tish" : "Переключить на русский"}
      className={className}
    >
      {t(target)}
    </button>
  );
}
