import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SubscriptionForm from "@/components/SubscriptionForm";
import { getBranches } from "@/lib/api";

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata({ params: { locale } }: PageProps): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "Subscription" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function SubscriptionPage({ params: { locale } }: PageProps) {
  setRequestLocale(locale);
  const t = await getTranslations("Subscription");
  const branches = await getBranches();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 lg:px-10 lg:py-20">
      <h1 className="font-display text-2xl tracking-luxe text-ink sm:text-3xl">{t("title")}</h1>
      <p className="mt-4 text-sm leading-relaxed text-graphite">{t("intro")}</p>
      <div className="mt-12">
        <SubscriptionForm branches={branches} />
      </div>
    </div>
  );
}
