"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/Link";
import { useCart } from "@/components/CartProvider";
import { useCustomerAuth } from "@/components/CustomerAuthProvider";
import RegisterGate from "@/components/RegisterGate";
import DeliverySlotPicker from "@/components/DeliverySlotPicker";
import type { PickedLocation } from "@/components/AddressMapPicker";
import PhoneInput from "@/components/PhoneInput";
import { formatUZS } from "@/lib/format";
import Button from "@/components/Button";

// mapbox-gl is a large (~200KB+ gzipped) client-only library — deferring it
// into its own chunk keeps the checkout page's initial JS small instead of
// loading the whole map engine before the visitor has even filled in their
// name and phone.
const AddressMapPicker = dynamic(() => import("@/components/AddressMapPicker"), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse border border-hairline bg-hermes-50/30" />,
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api";

type Status = "idle" | "submitting" | "success" | "error";

interface PlacedOrder {
  items: { name: string; price: number; quantity: number }[];
  subtotal: number;
  totalAmount: number;
  pointsRedeemed: number;
  pointsEarned: number;
  deliveryDate: string;
  deliveryTime: string;
  address: string;
  paymentMethod: "cash" | "card" | "online";
}

export default function CheckoutForm() {
  const { items, totalAmount, clearCart } = useCart();
  const { customer, loading: authLoading, refresh: refreshCustomer } = useCustomerAuth();
  const t = useTranslations("Checkout");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const [status, setStatus] = useState<Status>("idle");
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [redeemPoints, setRedeemPoints] = useState(false);

  // How much the "use points" toggle would actually take off this order —
  // capped by both the balance and the order total, same rule the server
  // applies for real when the order is placed.
  const pointsAvailable = customer?.pointsBalance ?? 0;
  const pointsDiscount = redeemPoints ? Math.min(pointsAvailable, totalAmount) : 0;
  const payableAmount = totalAmount - pointsDiscount;

  // The order confirmation view is much shorter than the form above it —
  // without this the page keeps whatever scroll position the form had,
  // which the browser then clamps to the new (shorter) page's bottom.
  useEffect(() => {
    if (status === "success") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [status]);

  const [form, setForm] = useState({
    name: "",
    phone: "+998",
    comment: "",
    deliveryDate: "",
    deliveryTime: "",
    paymentMethod: "cash" as "cash" | "card" | "online",
  });

  // Registration happens after these hooks are declared but before the form
  // itself can render (see the !customer branch below), so name/phone only
  // become known once the verified account loads in.
  useEffect(() => {
    if (customer) {
      setForm((prev) => ({ ...prev, name: customer.name, phone: customer.phone }));
    }
  }, [customer]);

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || !customer) return;

    setStatus("submitting");
    setErrorMessage(null);

    try {
      const res = await fetch(`${API_URL}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          customer: {
            name: form.name,
            phone: form.phone,
            comment: form.comment,
            address: location?.address ?? "",
          },
          location: location ? { lat: location.lat, lng: location.lng } : undefined,
          deliveryDate: form.deliveryDate,
          deliveryTime: form.deliveryTime,
          paymentMethod: form.paymentMethod,
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          redeemPoints,
        }),
      });

      if (!res.ok) throw new Error(t("submitFailed"));

      const order = await res.json();
      setOrderNumber(order.orderNumber);
      // Read the confirmation straight from what the server actually priced
      // and saved — not from the client's cart snapshot, which can be stale
      // (e.g. a product's price changed between add-to-cart and checkout;
      // the server always re-prices from the DB, so it's the source of truth).
      setPlacedOrder({
        items: order.items.map((i: { name: string; price: number; quantity: number }) => ({
          name: i.name,
          price: i.price,
          quantity: i.quantity,
        })),
        subtotal: order.subtotal,
        totalAmount: order.totalAmount,
        pointsRedeemed: order.pointsRedeemed,
        pointsEarned: order.pointsEarned,
        deliveryDate: order.deliveryDate ?? "",
        deliveryTime: order.deliveryTime ?? "",
        address: order.customer?.address ?? "",
        paymentMethod: order.paymentMethod,
      });
      setStatus("success");
      clearCart();
      // The order may have just spent points off this customer's balance —
      // refresh the cached balance so it's correct everywhere (account
      // page, this form if they place another order) without a reload.
      refreshCustomer();
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : t("genericError"));
    }
  };

  if (status === "success") {
    const paymentLabels: Record<PlacedOrder["paymentMethod"], string> = {
      cash: t("paymentCash"),
      card: t("paymentCard"),
      online: t("paymentOnline"),
    };

    return (
      <div className="border border-hairline bg-hermes-50/30 p-8 text-center sm:p-16">
        <h2 className="font-display text-2xl tracking-luxe text-ink">{t("successTitle")}</h2>
        <p className="mt-4 text-graphite">
          {t.rich("successText", { orderNumber: orderNumber ?? "", b: (chunks) => <span className="text-ink">{chunks}</span> })}
        </p>

        {placedOrder && (
          <div className="mx-auto mt-10 max-w-md border-t border-hairline pt-8 text-left">
            <h3 className="font-display text-lg tracking-luxe text-ink">{t("orderSummaryTitle")}</h3>
            <ul className="mt-6 space-y-3 text-sm text-graphite">
              {placedOrder.items.map((item, i) => (
                <li key={`${item.name}-${i}`} className="flex justify-between gap-3">
                  <span>
                    {item.name} × {item.quantity}
                  </span>
                  <span className="font-display text-ink">{formatUZS(item.price * item.quantity, locale)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 space-y-2 border-t border-hairline pt-6 text-sm">
              {placedOrder.deliveryDate && (
                <div className="flex justify-between gap-4">
                  <span className="text-graphite">{t("deliveryLabel")}</span>
                  <span className="text-right text-ink">
                    {placedOrder.deliveryDate}
                    {placedOrder.deliveryTime ? `, ${placedOrder.deliveryTime}` : ""}
                  </span>
                </div>
              )}
              {placedOrder.address && (
                <div className="flex justify-between gap-4">
                  <span className="text-graphite">{t("addressLabel")}</span>
                  <span className="text-right text-ink">{placedOrder.address}</span>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <span className="text-graphite">{t("paymentLabel")}</span>
                <span className="text-right text-ink">{paymentLabels[placedOrder.paymentMethod]}</span>
              </div>
            </div>

            {placedOrder.pointsRedeemed > 0 && (
              <div className="mt-6 space-y-2 border-t border-hairline pt-6 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-graphite">{t("subtotalLabel")}</span>
                  <span className="text-right text-ink">{formatUZS(placedOrder.subtotal, locale)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-graphite">{t("pointsDiscountLabel")}</span>
                  <span className="text-right text-hermes-500">−{formatUZS(placedOrder.pointsRedeemed, locale)}</span>
                </div>
              </div>
            )}

            <div className="mt-6 flex items-baseline justify-between border-t border-hairline pt-6 text-sm">
              <span>{tc("total")}</span>
              <span className="font-display text-base text-ink">{formatUZS(placedOrder.totalAmount, locale)}</span>
            </div>

            {placedOrder.pointsEarned > 0 && (
              <p className="mt-4 text-xs text-graphite">
                {t("pointsEarnedNote", { count: new Intl.NumberFormat("en-US").format(placedOrder.pointsEarned) })}
              </p>
            )}
          </div>
        )}

        <Link href="/" className="mt-8 inline-block text-xs font-medium uppercase tracking-wide2 text-hermes-500 underline underline-offset-4">
          {tc("backHome")}
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-graphite">{t("emptyCart")}</p>
        <Link href="/" className="mt-5 inline-block text-xs font-medium uppercase tracking-wide2 text-hermes-500 underline underline-offset-4">
          {tc("goToCatalog")}
        </Link>
      </div>
    );
  }

  if (authLoading) {
    return <p className="py-20 text-center text-sm text-graphite">{tc("loading")}</p>;
  }

  if (!customer) {
    return <RegisterGate />;
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-16 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-7">
        <div className="grid gap-7 sm:grid-cols-2">
          <Field label={tc("nameLabel")} required>
            <input required value={form.name} onChange={update("name")} className="input" placeholder={tc("namePlaceholder")} />
          </Field>
          <Field label={tc("phoneLabel")} required>
            <PhoneInput required value={form.phone} onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))} />
          </Field>
        </div>

        <DeliverySlotPicker
          date={form.deliveryDate}
          time={form.deliveryTime}
          onChange={({ date, time }) => setForm((prev) => ({ ...prev, deliveryDate: date, deliveryTime: time }))}
        />

        <div>
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide2 text-graphite">
            {t("addressLabel")}
          </span>
          <AddressMapPicker value={location} onChange={setLocation} />
        </div>

        <Field label={t("paymentLabel")}>
          <select value={form.paymentMethod} onChange={update("paymentMethod")} className="input">
            <option value="cash">{t("paymentCash")}</option>
            <option value="card">{t("paymentCard")}</option>
            <option value="online">{t("paymentOnline")}</option>
          </select>
        </Field>

        <Field label={t("commentLabel")}>
          <textarea value={form.comment} onChange={update("comment")} className="input min-h-24" placeholder={t("commentPlaceholder")} />
        </Field>

        {status === "error" && <p className="text-sm text-hermes-600">{errorMessage}</p>}
      </div>

      <aside className="h-fit min-w-0 border border-hairline p-8">
        <h2 className="font-display text-lg tracking-luxe text-ink">{t("orderSummaryTitle")}</h2>
        <ul className="mt-6 space-y-3 text-sm text-graphite">
          {items.map((item) => (
            <li key={item.productId} className="flex justify-between gap-3">
              <span>
                {item.name} × {item.quantity}
              </span>
              <span className="font-display text-ink">{formatUZS(item.price * item.quantity, locale)}</span>
            </li>
          ))}
        </ul>
        {pointsAvailable > 0 && (
          <label className="mt-6 flex items-start gap-3 border-t border-hairline pt-6 text-sm">
            <input
              type="checkbox"
              checked={redeemPoints}
              onChange={(e) => setRedeemPoints(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-graphite">
              {t("usePointsLabel", { count: new Intl.NumberFormat("en-US").format(pointsAvailable) })}
            </span>
          </label>
        )}

        {pointsDiscount > 0 && (
          <div className="mt-4 flex items-baseline justify-between text-sm">
            <span className="text-graphite">{t("pointsDiscountLabel")}</span>
            <span className="text-hermes-500">−{formatUZS(pointsDiscount, locale)}</span>
          </div>
        )}

        <div className="mt-6 flex items-baseline justify-between border-t border-hairline pt-6 text-sm">
          <span>{tc("total")}</span>
          <span className="font-display text-base text-ink">{formatUZS(payableAmount, locale)}</span>
        </div>
        <div className="mt-8">
          <Button type="submit" disabled={status === "submitting"} className="w-full disabled:opacity-60">
            {status === "submitting" ? t("submitting") : t("submit")}
          </Button>
        </div>
      </aside>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium uppercase tracking-wide2 text-graphite">
        {label}
        {required && <span className="text-hermes-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
