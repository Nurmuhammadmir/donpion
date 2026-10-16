"use client";

import { useTranslations } from "next-intl";
import { useCustomerAuth } from "@/components/CustomerAuthProvider";
import RegisterGate from "@/components/RegisterGate";
import OrderHistory from "@/components/OrderHistory";

export default function AccountView() {
  const { customer, loading, logout } = useCustomerAuth();
  const t = useTranslations("Account");
  const tc = useTranslations("Common");

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
