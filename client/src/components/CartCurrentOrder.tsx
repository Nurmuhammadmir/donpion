"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/Link";
import { useCustomerAuth } from "@/components/CustomerAuthProvider";
import { formatUZS } from "@/lib/format";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api";
const ACTIVE_STATUSES = ["new", "confirmed", "delivering"];

interface OrderItem {
  name: string;
  slug: string;
  price: number;
  quantity: number;
}

interface OrderSummary {
  _id: string;
  orderNumber: string;
  items: OrderItem[];
  totalAmount: number;
  status: string;
  createdAt: string;
}

// Shown below the "cart is empty" message so a returning customer still
// sees something useful instead of a dead end — the order currently being
// processed if there is one, otherwise their most recent order.
export default function CartCurrentOrder() {
  const { customer } = useCustomerAuth();
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const t = useTranslations("Cart");
  const tc = useTranslations("Common");
  const th = useTranslations("OrderHistory");
  const locale = useLocale();

  useEffect(() => {
    if (!customer) {
      setOrder(null);
      return;
    }
    // Guards against a slow response for a previous customer landing after
    // `customer` has already changed (e.g. a logout) and overwriting the
    // order shown with stale/mismatched data.
    let cancelled = false;
    fetch(`${API_URL}/orders/mine`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((orders: OrderSummary[]) => {
        if (cancelled) return;
        const active = orders.find((o) => ACTIVE_STATUSES.includes(o.status));
        setOrder(active ?? orders[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setOrder(null);
      });
    return () => {
      cancelled = true;
    };
  }, [customer]);

  if (!order) return null;

  const isActive = ACTIVE_STATUSES.includes(order.status);
  const statusLabels: Record<string, string> = {
    new: th("statusNew"),
    confirmed: th("statusConfirmed"),
    delivering: th("statusDelivering"),
    completed: th("statusCompleted"),
    cancelled: th("statusCancelled"),
  };

  return (
    <div className="mx-auto mt-10 max-w-md border border-hairline p-6 text-left">
      <p className="eyebrow mb-4 text-center">{isActive ? t("currentOrderTitle") : t("lastOrderTitle")}</p>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-display text-base text-ink">{order.orderNumber}</span>
        <span className="text-xs font-medium uppercase tracking-wide2 text-hermes-500">
          {statusLabels[order.status] || order.status}
        </span>
      </div>
      {isActive && <p className="mt-2 text-xs text-graphite">{t("currentOrderNote")}</p>}

      <ul className="mt-4 space-y-2 text-sm text-graphite">
        {order.items.map((item, i) => (
          <li key={`${item.slug}-${i}`} className="flex justify-between gap-3">
            <span>
              {item.name} × {item.quantity}
            </span>
            <span className="text-ink/85">{formatUZS(item.price * item.quantity, locale)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-baseline justify-between border-t border-hairline pt-4 text-sm">
        <span className="text-graphite">{tc("total")}</span>
        <span className="font-display text-base text-ink/85">{formatUZS(order.totalAmount, locale)}</span>
      </div>

      <Link
        href="/account"
        className="mt-4 block text-center text-xs font-medium uppercase tracking-wide2 text-hermes-500 underline underline-offset-4"
      >
        {t("viewOrders")}
      </Link>
    </div>
  );
}
