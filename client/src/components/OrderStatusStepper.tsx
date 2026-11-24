"use client";

import { useTranslations } from "next-intl";

const STEPS = ["new", "confirmed", "delivering", "completed"] as const;

// A live, visual read on where an order actually is — replaces a flat
// text badge everywhere an order's status shows (order history, the
// gift-reveal page).
export default function OrderStatusStepper({ status }: { status: string }) {
  const t = useTranslations("OrderHistory");

  if (status === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide2 text-hermes-600">
        <span className="h-2 w-2 rounded-full bg-hermes-500" />
        {t("statusCancelled")}
      </span>
    );
  }

  const currentIndex = Math.max(0, STEPS.indexOf(status as (typeof STEPS)[number]));

  return (
    <div className="flex w-full items-center">
      {STEPS.map((step, i) => {
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <div key={step} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`h-2.5 w-2.5 rounded-full border-2 ${
                  isDone || isCurrent ? "border-hermes-500 bg-hermes-500" : "border-hairline bg-paper"
                } ${isCurrent ? "amount-pulse" : ""}`}
              />
              <span className={`whitespace-nowrap text-[10px] uppercase tracking-wide2 ${isCurrent ? "font-medium text-ink" : "text-graphite"}`}>
                {t(`statusShort_${step}`)}
              </span>
            </div>
            {i < STEPS.length - 1 && <span className={`mx-1.5 mb-4 h-px flex-1 ${isDone ? "bg-hermes-500" : "bg-hairline"}`} />}
          </div>
        );
      })}
    </div>
  );
}
