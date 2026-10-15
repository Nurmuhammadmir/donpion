"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatUZS } from "@/lib/format";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api";

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

export default function OrderHistory() {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const t = useTranslations("OrderHistory");
  const tc = useTranslations("Common");
  const locale = useLocale();

  const statusLabels: Record<string, string> = {
    new: t("statusNew"),
    confirmed: t("statusConfirmed"),
    delivering: t("statusDelivering"),
    completed: t("statusCompleted"),
    cancelled: t("statusCancelled"),
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === "uz" ? "uz-UZ" : "ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/orders/mine`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setOrders(data);
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (orders === null) {
    return <p className="mt-12 text-sm text-graphite">{tc("loading")}</p>;
  }

  return (
    <div className="mt-12 border-t border-hairline pt-8">
      <p className="eyebrow mb-6">{t("title")}</p>

      {orders.length === 0 ? (
        <p className="text-sm text-graphite">{t("empty")}</p>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <div key={order._id} className="border border-hairline p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-display text-base text-ink">{order.orderNumber}</span>
                <span className="text-xs font-medium uppercase tracking-wide2 text-hermes-500">
                  {statusLabels[order.status] || order.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-graphite">{formatDate(order.createdAt)}</p>

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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
