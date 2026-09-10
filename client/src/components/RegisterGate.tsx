"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useCustomerAuth } from "@/components/CustomerAuthProvider";
import PhoneInput from "@/components/PhoneInput";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api";

type Step = "form" | "code";

declare global {
  interface Window {
    Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } };
  }
}

// Gates checkout and the account page: name + phone, then a code confirms
// the number and signs the visitor in. The server sends through both
// Telegram channels at once when available — Gateway (instant, no bot
// step — see server/src/utils/telegramGateway.js) and the bot deep link
// (telegramBot.js) — so this just renders whichever are active and accepts
// whichever code actually arrives. Once verified, CustomerAuthProvider's
// cookie session takes over.
export default function RegisterGate() {
  const { refresh } = useCustomerAuth();
  const t = useTranslations("RegisterGate");
  const tc = useTranslations("Common");
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+998");
  const [code, setCode] = useState("");
  const [registrationId, setRegistrationId] = useState("");
  const [gatewaySent, setGatewaySent] = useState(false);
  const [botSent, setBotSent] = useState(false);
  const [botLink, setBotLink] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPolling = (id: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/auth/customer/status/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.codeSent) {
            setCodeSent(true);
            if (pollRef.current) clearInterval(pollRef.current);
          }
        }
      } catch {
        // keep retrying silently — a missed poll tick isn't worth surfacing
      }
    }, 2000);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/auth/customer/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || t("registerFailed"));

      setRegistrationId(data.registrationId);
      setGatewaySent(data.gatewaySent);
      setBotSent(data.botSent);
      setBotLink(data.botLink);
      setStep("code");

      // Only need to wait for a Start press when the bot couldn't already
      // push the code straight to a known chat (a first-time visitor).
      if (data.botLink && !data.botSent) {
        startPolling(data.registrationId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenBot = () => {
    if (!botLink) return;
    if (typeof window !== "undefined" && window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(botLink);
    } else {
      window.open(botLink, "_blank", "noopener,noreferrer");
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/auth/customer/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ registrationId, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || t("invalidCode"));

      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("genericError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-transition mx-auto max-w-md border border-hairline bg-hermes-50/30 p-10 text-center">
      <p className="eyebrow mb-4">{t("eyebrow")}</p>
      <h2 className="font-display text-2xl tracking-luxe text-ink">{t("title")}</h2>
      <p className="mt-4 text-sm leading-relaxed text-graphite">{t("description")}</p>

      {step === "form" ? (
        <form onSubmit={handleRegister} className="mt-8 space-y-5 text-left">
          <label className="block">
            <span className="mb-2 block text-xs font-medium uppercase tracking-wide2 text-graphite">{tc("nameLabel")}</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder={tc("namePlaceholder")} />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-medium uppercase tracking-wide2 text-graphite">{tc("phoneLabel")}</span>
            <PhoneInput required value={phone} onChange={setPhone} />
          </label>
          {error && <p className="text-sm text-hermes-600">{error}</p>}
          <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-60">
            {submitting ? t("sending") : t("getCode")}
          </button>
        </form>
      ) : (
        <div className="mt-8 space-y-5 text-left">
          {gatewaySent && <p className="text-center text-xs text-graphite">{t("gatewaySentNote")}</p>}

          {botSent && <p className="text-center text-xs text-graphite">{t("codeSentViaBot")}</p>}

          {botLink && !botSent && (
            <>
              <button type="button" onClick={handleOpenBot} className="btn-outline w-full">
                {t("openBot")}
              </button>
              <p className="text-center text-xs text-graphite">
                {codeSent ? t("codeSentViaBot") : t("waitingForBot")}
              </p>
            </>
          )}

          <form onSubmit={handleVerify} className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-wide2 text-graphite">{t("codeLabel")}</span>
              <input
                required
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="input text-center tracking-[0.3em]"
                placeholder="000000"
                maxLength={6}
              />
            </label>
            {error && <p className="text-sm text-hermes-600">{error}</p>}
            <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-60">
              {submitting ? t("verifying") : t("confirm")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
