"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

// Every checkout order now gets a short giftCode (see orders.controller.js)
// — this turns it into an actual link and a one-click copy, used on both
// the checkout success screen and order history. Forwarding it to whoever
// the flowers are actually for is what unlocks the gift-reveal page.
export default function GiftShareLink({ code }: { code: string }) {
  const t = useTranslations("Checkout");
  const locale = useLocale();
  const [copied, setCopied] = useState(false);

  const url = typeof window !== "undefined" ? `${window.location.origin}/${locale}/gift/${code}` : `/${locale}/gift/${code}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API can be unavailable (older browser, permissions) —
      // the link is still right there in the input, selectable by hand.
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border-t border-hairline pt-6 text-center">
      <p className="text-sm text-graphite">{t("giftShareIntro")}</p>
      <div className="mt-3 flex items-center gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 border border-hairline bg-paper px-3 py-2 text-xs text-graphite"
        />
        <button type="button" onClick={handleCopy} className="btn-outline whitespace-nowrap px-4 py-2 text-xs">
          {copied ? t("giftLinkCopied") : t("giftCopyLink")}
        </button>
      </div>
    </div>
  );
}
