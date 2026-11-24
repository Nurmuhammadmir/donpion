"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useCustomerAuth } from "@/components/CustomerAuthProvider";
import RegisterGate from "@/components/RegisterGate";
import type { PickedLocation } from "@/components/AddressMapPicker";
import Button from "@/components/Button";

// mapbox-gl alone is ~500kB — dynamic + ssr:false keeps it out of this
// page's main bundle entirely, same reason CheckoutForm loads it this way
// instead of a plain static import.
const AddressMapPicker = dynamic(() => import("@/components/AddressMapPicker"), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse border border-hairline bg-hermes-50/30" />,
});
import { getProducts } from "@/lib/api";
import { buildClickPayUrl, buildPaymePayUrl } from "@/lib/payments";
import { openExternalLink } from "@/lib/telegramWebApp";
import { formatUZS } from "@/lib/format";
import type { Branch, CreateSubscriptionResponse, Product, Subscription } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api";

interface Row {
  date: string;
  productId: string;
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function emptyRow(): Row {
  return { date: "", productId: "" };
}

export default function SubscriptionForm({ branches }: { branches: Branch[] }) {
  const t = useTranslations("Subscription");
  const locale = useLocale();
  const { customer, loading: authLoading } = useCustomerAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [fulfillmentMethod, setFulfillmentMethod] = useState<"delivery" | "pickup">("delivery");
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [branchId, setBranchId] = useState(branches[0]?._id ?? "");
  const [paymentPlan, setPaymentPlan] = useState<"prepaid" | "pay_on_delivery">("prepaid");
  const [cashOrCard, setCashOrCard] = useState<"cash" | "card">("cash");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateSubscriptionResponse | null>(null);

  const [mySubscriptions, setMySubscriptions] = useState<Subscription[]>([]);
  const [checkingReturn, setCheckingReturn] = useState(true);
  const [returnNotice, setReturnNotice] = useState<Subscription | null>(null);

  useEffect(() => {
    getProducts({ limit: 60 }).then((res) => setProducts(res.items));
  }, []);

  // Delivery is online-only — no courier ever collects cash/card (same
  // rule the regular checkout enforces) — so switching to delivery can't
  // leave "оплата при получении" selected.
  useEffect(() => {
    if (fulfillmentMethod === "delivery" && paymentPlan === "pay_on_delivery") {
      setPaymentPlan("prepaid");
    }
  }, [fulfillmentMethod, paymentPlan]);

  const loadMine = () => {
    if (!customer) return;
    fetch(`${API_URL}/subscriptions/mine`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((subs: Subscription[]) => setMySubscriptions(subs))
      .catch(() => setMySubscriptions([]));
  };

  useEffect(loadMine, [customer]);

  // Click/Payme send the customer back here (?subscription=<id>, see
  // buildClickPayUrl/buildPaymePayUrl's returnTo below) — same read-back
  // shape as CheckoutForm's own checkingReturn effect, just against
  // /subscriptions/mine instead of /orders/mine.
  useEffect(() => {
    if (!checkingReturn) return;
    if (authLoading) return;
    const returningId = new URLSearchParams(window.location.search).get("subscription");
    if (!customer || !returningId) {
      setCheckingReturn(false);
      return;
    }
    let cancelled = false;
    fetch(`${API_URL}/subscriptions/mine`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((subs: Subscription[]) => {
        if (cancelled) return;
        const found = subs.find((s) => s._id === returningId);
        if (found) {
          setReturnNotice(found);
          setMySubscriptions(subs);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCheckingReturn(false);
      });
    return () => {
      cancelled = true;
    };
  }, [checkingReturn, authLoading, customer]);

  if (authLoading || checkingReturn) return null;
  if (!customer) return <RegisterGate />;

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (index: number) => setRows((prev) => prev.filter((_, i) => i !== index));
  const updateRow = (index: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const productById = (id: string) => products.find((p) => p._id === id);
  const validRows = rows.filter((r) => r.date && r.productId);
  const total = validRows.reduce((sum, r) => sum + (productById(r.productId)?.price ?? 0), 0);

  const canSubmit =
    validRows.length === rows.length &&
    rows.length > 0 &&
    (fulfillmentMethod === "pickup" ? Boolean(branchId) : Boolean(location));

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError(t("errorIncomplete"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fulfillmentMethod,
          address: location?.address,
          location: location ? { lat: location.lat, lng: location.lng } : undefined,
          branchId: fulfillmentMethod === "pickup" ? branchId : undefined,
          paymentPlan,
          paymentMethod: paymentPlan === "pay_on_delivery" ? cashOrCard : undefined,
          deliveries: validRows.map((r) => ({ date: r.date, productId: r.productId })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || t("errorGeneric"));
      }
      const data = (await res.json()) as CreateSubscriptionResponse;
      setResult(data);
      loadMine();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  };

  // After creating a prepaid subscription, pay exactly the same way
  // checkout does — just come back here (?subscription=...) instead of
  // /checkout afterward.
  const payableOrder = result?.paymentOrder;
  const returnTo = result ? { path: "subscription", param: "subscription", value: result.subscription._id } : undefined;
  const clickUrl = payableOrder ? buildClickPayUrl(payableOrder, locale, returnTo) : null;
  const paymeUrl = payableOrder ? buildPaymePayUrl(payableOrder, locale, returnTo) : null;

  if (result) {
    return (
      <div className="rounded-2xl border border-hairline bg-paper p-6">
        <h2 className="font-display text-xl text-ink">{t("createdTitle")}</h2>
        <p className="mt-2 text-sm text-graphite">
          {t("createdDeliveries", { count: result.subscription.deliveries.length })} · {formatUZS(result.subscription.totalAmount, locale)}
        </p>
        {payableOrder ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-ink">{t("payNow")}</p>
            <div className="flex flex-wrap gap-3">
              {clickUrl && (
                <Button
                  onClick={() => openExternalLink(clickUrl)}
                  className="bg-[#006EFF] hover:bg-[#0058cc]"
                >
                  Click
                </Button>
              )}
              {paymeUrl && (
                <Button onClick={() => openExternalLink(paymeUrl)} className="bg-[#00C0B4] hover:bg-[#00a89d]">
                  Payme
                </Button>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-hermes-600">{t("payOnDeliveryNote")}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {returnNotice && (
        <div className="rounded-2xl border border-hairline bg-paper p-5">
          <p className="text-sm font-medium text-ink">
            {returnNotice.paid ? t("returnPaid") : t("returnPending")}
          </p>
        </div>
      )}

      <div>
        <p className="eyebrow mb-3">{t("fulfillment")}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setFulfillmentMethod("delivery")}
            className={`flex-1 border px-4 py-2.5 text-sm font-medium ${
              fulfillmentMethod === "delivery" ? "border-ink bg-ink text-white" : "border-hairline text-ink"
            }`}
          >
            {t("delivery")}
          </button>
          <button
            type="button"
            onClick={() => setFulfillmentMethod("pickup")}
            className={`flex-1 border px-4 py-2.5 text-sm font-medium ${
              fulfillmentMethod === "pickup" ? "border-ink bg-ink text-white" : "border-hairline text-ink"
            }`}
          >
            {t("pickup")}
          </button>
        </div>
      </div>

      {fulfillmentMethod === "delivery" ? (
        <div>
          <p className="eyebrow mb-3">{t("address")}</p>
          <AddressMapPicker value={location} onChange={setLocation} />
        </div>
      ) : (
        <label className="block">
          <span className="eyebrow mb-2 block">{t("pickupBranch")}</span>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full border border-hairline bg-transparent px-3 py-2.5 text-sm text-ink">
            {branches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name} — {b.address}
              </option>
            ))}
          </select>
        </label>
      )}

      <div>
        <p className="eyebrow mb-3">{t("deliveries")}</p>
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="flex flex-wrap items-end gap-3 border border-hairline p-3">
              <label className="block">
                <span className="mb-1.5 block text-xs text-graphite">{t("date")}</span>
                <input
                  type="date"
                  min={isoToday()}
                  value={row.date}
                  onChange={(e) => updateRow(i, { date: e.target.value })}
                  className="border border-hairline bg-transparent px-3 py-2 text-sm text-ink"
                />
              </label>
              <label className="block min-w-[200px] flex-1">
                <span className="mb-1.5 block text-xs text-graphite">{t("bouquet")}</span>
                <select
                  value={row.productId}
                  onChange={(e) => updateRow(i, { productId: e.target.value })}
                  className="w-full border border-hairline bg-transparent px-3 py-2 text-sm text-ink"
                >
                  <option value="">{t("choose")}</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} — {formatUZS(p.price, locale)}
                    </option>
                  ))}
                </select>
              </label>
              {rows.length > 1 && (
                <button type="button" onClick={() => removeRow(i)} className="pb-2 text-xs text-hermes-600 underline-offset-4 hover:underline">
                  {t("remove")}
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={addRow} className="btn-outline mt-3">
          {t("addDate")}
        </button>
      </div>

      <div>
        <p className="eyebrow mb-3">{t("paymentPlan")}</p>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="radio" checked={paymentPlan === "prepaid"} onChange={() => setPaymentPlan("prepaid")} />
            {t("prepaid")}
          </label>
          <label className={`flex items-center gap-2 text-sm ${fulfillmentMethod === "delivery" ? "text-graphite/50" : "text-ink"}`}>
            <input
              type="radio"
              disabled={fulfillmentMethod === "delivery"}
              checked={paymentPlan === "pay_on_delivery"}
              onChange={() => setPaymentPlan("pay_on_delivery")}
            />
            {t("payOnDelivery")}
          </label>
          {fulfillmentMethod === "delivery" && <p className="pl-6 text-xs text-graphite">{t("payOnDeliveryDisabledNote")}</p>}
        </div>
        {paymentPlan === "pay_on_delivery" && (
          <div className="mt-3 flex gap-3 pl-6">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" checked={cashOrCard === "cash"} onChange={() => setCashOrCard("cash")} />
              {t("cash")}
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" checked={cashOrCard === "card"} onChange={() => setCashOrCard("card")} />
              {t("card")}
            </label>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-hairline pt-4">
        <span className="text-sm text-graphite">{t("total")}</span>
        <span className="font-display text-lg text-ink">{formatUZS(total, locale)}</span>
      </div>

      {error && <p className="text-sm text-hermes-600">{error}</p>}

      <Button onClick={handleSubmit} className={submitting ? "pointer-events-none opacity-60" : ""}>
        {submitting ? t("submitting") : t("submit")}
      </Button>

      {mySubscriptions.length > 0 && (
        <div className="border-t border-hairline pt-8">
          <p className="eyebrow mb-4">{t("mySubscriptions")}</p>
          <div className="space-y-4">
            {mySubscriptions.map((sub) => (
              <div key={sub._id} className="rounded-2xl border border-hairline p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">{formatUZS(sub.totalAmount, locale)}</span>
                  <span className="text-xs text-graphite">{sub.status}</span>
                </div>
                <ul className="mt-2 space-y-1">
                  {sub.deliveries.map((d) => (
                    <li key={d.date} className="flex justify-between text-xs text-graphite">
                      <span>
                        {d.date} — {d.name}
                      </span>
                      <span>{d.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
