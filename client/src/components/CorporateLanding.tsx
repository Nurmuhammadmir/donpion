"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import CatalogFilters from "@/components/CatalogFilters";
import CorporateProductCard from "@/components/CorporateProductCard";
import CorporateCartBar from "@/components/CorporateCartBar";
import type { Product } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api";

const VALUE_PROPS = ["recurring", "gifts", "events", "quote"] as const;

// The whole point of this component: "Корпоративные заказы" shouldn't
// just be the generic occasion-page grid with a different sort order — a
// business buyer needs a different pitch (why order here, who to talk to
// for a custom case) and a different grid (bulk quantity, not one click
// per product). Rendered by occasion/[slug]/page.tsx in place of its
// usual header+grid, only for the korporativnye-zakazy slug.
export default function CorporateLanding({ products }: { products: Product[] }) {
  const t = useTranslations("Corporate");

  const [form, setForm] = useState({ name: "", phone: "", companyName: "", comment: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      setError(t("leadErrorIncomplete"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/corporate-leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      setSent(true);
    } catch {
      setError(t("leadErrorGeneric"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pb-20">
      <CorporateCartBar />

      {/* Negative margin cancels the page's own px-6/lg:px-10 so this bleeds
          to the edge of the content column (not the full viewport — a
          plain 100vw breakout risks a horizontal scrollbar; this doesn't),
          reading as a deliberate break from the rest of the (white-
          background) site instead of just another section on the page. */}
      <div className="-mx-6 bg-navy px-6 py-12 text-white sm:-mx-10 sm:px-10 sm:py-16">
        <header className="max-w-2xl">
          <p className="eyebrow mb-4 text-hermes-500">{t("eyebrow")}</p>
          <h1 className="font-display text-3xl tracking-luxe text-white sm:text-4xl">{t("title")}</h1>
          <div className="mt-5 h-px w-14 bg-hermes-500" />
          <p className="mt-6 text-sm leading-relaxed text-white/70">{t("intro")}</p>
        </header>

        <div className="mt-12 grid grid-cols-2 gap-6 border-t border-white/10 pt-8 sm:grid-cols-4">
          {VALUE_PROPS.map((key, i) => (
            <div key={key}>
              <span className="block text-xs font-medium uppercase tracking-wide2 text-hermes-500">{String(i + 1).padStart(2, "0")}</span>
              <p className="mt-2 text-xs leading-relaxed text-white/70">{t(`value_${key}`)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-16 border border-hairline bg-hermes-50/20 p-6 sm:p-8">
        {sent ? (
          <p className="text-sm text-ink">{t("leadSent")}</p>
        ) : (
          <>
            <h2 className="font-display text-xl text-ink">{t("leadTitle")}</h2>
            <p className="mt-2 text-sm text-graphite">{t("leadIntro")}</p>
            <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={t("leadName")}
                className="border border-hairline bg-paper px-3 py-2.5 text-sm text-ink"
              />
              <input
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder={t("leadPhone")}
                className="border border-hairline bg-paper px-3 py-2.5 text-sm text-ink"
              />
              <input
                value={form.companyName}
                onChange={(e) => setForm((prev) => ({ ...prev, companyName: e.target.value }))}
                placeholder={t("leadCompany")}
                className="border border-hairline bg-paper px-3 py-2.5 text-sm text-ink sm:col-span-2"
              />
              <textarea
                value={form.comment}
                onChange={(e) => setForm((prev) => ({ ...prev, comment: e.target.value }))}
                placeholder={t("leadComment")}
                rows={3}
                className="border border-hairline bg-paper px-3 py-2.5 text-sm text-ink sm:col-span-2"
              />
              {error && <p className="text-sm text-hermes-600 sm:col-span-2">{error}</p>}
              <button type="submit" disabled={submitting} className="btn-primary sm:col-span-2">
                {submitting ? t("leadSubmitting") : t("leadSubmit")}
              </button>
            </form>
          </>
        )}
      </div>

      <div className="mt-16">
        <p className="eyebrow mb-6">{t("catalogTitle")}</p>
        <CatalogFilters showRecipient={false} />

        {products.length > 0 ? (
          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-12 sm:gap-x-8 lg:grid-cols-4">
            {products.map((product) => (
              <CorporateProductCard key={product._id} product={product} />
            ))}
          </div>
        ) : (
          <p className="mt-10 text-sm text-graphite">{t("empty")}</p>
        )}
      </div>
    </div>
  );
}
