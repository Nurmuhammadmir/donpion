"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api";

// General "write to us" lead capture, reachable from the footer on every
// page — unlike CorporateLanding's lead form, this one has no dedicated
// route, so it's a self-contained trigger+modal with no props: Footer.tsx
// just drops it in and stays a Server Component.
export default function FooterContactModal() {
  const t = useTranslations("ContactLead");

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      setError(t("errorIncomplete"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      setSent(true);
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <span className="text-graphite">
        {t("triggerLabel")}{" "}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="underline decoration-hairline underline-offset-2 hover:text-hermes-500"
        >
          {t("triggerCta")}
        </button>
      </span>

      <div
        aria-hidden={!open}
        className={`fixed inset-0 z-50 flex items-center justify-center bg-ink/30 px-6 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setOpen(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-hidden={!open}
          onClick={(e) => e.stopPropagation()}
          className={`w-full max-w-sm border border-hairline bg-paper p-6 transition-all duration-300 ease-out sm:p-8 ${
            open ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-display text-xl text-ink">{t("modalTitle")}</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("close")}
              className="text-graphite hover:text-hermes-500"
            >
              ✕
            </button>
          </div>

          {sent ? (
            <p className="mt-4 text-sm text-ink">{t("sent")}</p>
          ) : (
            <>
              <p className="mt-2 text-sm text-graphite">{t("modalIntro")}</p>
              <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder={t("name")}
                  className="border border-hairline bg-paper px-3 py-2.5 text-sm text-ink"
                />
                <input
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder={t("phone")}
                  className="border border-hairline bg-paper px-3 py-2.5 text-sm text-ink"
                />
                <textarea
                  value={form.message}
                  onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
                  placeholder={t("message")}
                  rows={3}
                  className="border border-hairline bg-paper px-3 py-2.5 text-sm text-ink"
                />
                {error && <p className="text-sm text-hermes-600">{error}</p>}
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? t("submitting") : t("submit")}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}
