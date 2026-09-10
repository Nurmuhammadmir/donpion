"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useCustomerAuth } from "@/components/CustomerAuthProvider";
import RegisterGate from "@/components/RegisterGate";
import OrderHistory from "@/components/OrderHistory";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api";

export default function AccountView() {
  const { customer, loading, logout } = useCustomerAuth();
  const t = useTranslations("Account");
  const tc = useTranslations("Common");
  const [cashbackPercent, setCashbackPercent] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/settings`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setCashbackPercent(data.cashbackPercent ?? 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    if (window.confirm(t("logoutConfirm"))) {
      await logout();
    }
  };

  if (loading) {
    return <p className="text-sm text-graphite">{tc("loading")}</p>;
  }

  if (!customer) {
    return <RegisterGate />;
  }

  return (
    <div className="page-transition">
      <div className="border border-hairline bg-hermes-50/30 p-10">
        <p className="eyebrow mb-2">{t("profileEyebrow")}</p>
        <h2 className="font-display text-xl tracking-luxe text-ink">{customer.name}</h2>
        <p className="mt-2 text-sm text-graphite">{customer.phone}</p>

        <div className="mt-8 border-t border-hairline pt-6">
          <p className="text-xs font-medium uppercase tracking-wide2 text-graphite">{t("pointsBalance")}</p>
          <p className="mt-2 font-display text-3xl tracking-luxe text-hermes-500">
            {new Intl.NumberFormat("en-US").format(customer.pointsBalance)}
          </p>
          <p className="mt-2 text-xs text-graphite">{t("pointsNote")}</p>
          {cashbackPercent > 0 && <p className="mt-1 text-xs text-graphite">{t("cashbackNote", { percent: cashbackPercent })}</p>}
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-8 text-xs font-medium uppercase tracking-wide2 text-graphite underline underline-offset-4 hover:text-hermes-500"
        >
          {t("logout")}
        </button>
      </div>

      <OrderHistory />
    </div>
  );
}
