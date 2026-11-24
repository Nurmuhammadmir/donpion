"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import OrderStatusStepper from "@/components/OrderStatusStepper";
import type { GiftOrder } from "@/types";
import { resolveImageUrl } from "@/lib/images";

const RIBBON_HEX: Record<string, string> = {
  red: "#C14C4C",
  white: "#F5F2ED",
  pink: "#E3AFC1",
  gold: "#C9A34E",
  black: "#1C1C1C",
};

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  target.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

// The whole point of the giftCode (see orders.controller.js): a sender
// forwards this link to whoever the flowers are actually for, and they
// get a small moment of their own — not just a plain "your order is on
// its way" status page. The card starts closed; opening it is a
// deliberate click, not an auto-fade-in, so there's an actual instant of
// "what does it say" instead of the message just appearing already read.
export default function GiftReveal({ gift }: { gift: GiftOrder }) {
  const t = useTranslations("Gift");
  const [opened, setOpened] = useState(false);

  const days = daysUntil(gift.deliveryDate);
  const timingNote =
    days === null
      ? ""
      : days < 0
        ? ""
        : days === 0
          ? t("today")
          : days === 1
            ? t("tomorrow")
            : t("inDays", { count: days });

  return (
    <div className="text-center">
      <p className="eyebrow mb-3">{t("eyebrow")}</p>
      <h1 className="font-display text-2xl tracking-luxe text-ink sm:text-3xl">{t("title", { name: gift.senderName })}</h1>

      {gift.bouquetImage && (
        <div className="relative mx-auto mt-10 aspect-[4/5] w-full max-w-sm overflow-hidden bg-hermes-50/30">
          <Image src={resolveImageUrl(gift.bouquetImage)} alt={gift.bouquetName} fill sizes="400px" quality={95} className="object-cover" />
        </div>
      )}
      {gift.bouquetName && <p className="mt-4 font-display text-lg text-ink">{gift.bouquetName}</p>}

      {timingNote && <p className="mt-2 text-sm text-hermes-600">{timingNote}</p>}

      <div className="mx-auto mt-6 max-w-[220px]">
        <OrderStatusStepper status={gift.status} />
      </div>

      {gift.postcardText && (
        <div className="mx-auto mt-10 max-w-sm">
          {!opened ? (
            <button
              type="button"
              onClick={() => setOpened(true)}
              className="flex aspect-[3/2] w-full flex-col items-center justify-center gap-3 border border-hairline bg-paper transition-colors hover:border-ink"
            >
              {gift.ribbonColor && RIBBON_HEX[gift.ribbonColor] && (
                <span className="h-6 w-6 rounded-full border border-hairline" style={{ backgroundColor: RIBBON_HEX[gift.ribbonColor] }} />
              )}
              <span className="text-xs font-medium uppercase tracking-wide2 text-ink">{t("tapToOpen")}</span>
            </button>
          ) : (
            <div className="page-transition flex aspect-[3/2] w-full flex-col items-center justify-center gap-3 border border-hairline bg-hermes-50/20 p-6">
              {gift.ribbonColor && RIBBON_HEX[gift.ribbonColor] && (
                <span className="h-5 w-5 flex-none rounded-full border border-hairline" style={{ backgroundColor: RIBBON_HEX[gift.ribbonColor] }} />
              )}
              <p className="font-display text-base leading-relaxed text-ink">{gift.postcardText}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
