import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import CheckoutForm from "@/components/CheckoutForm";

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata({ params: { locale } }: PageProps): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "Checkout" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function CheckoutPage({ params: { locale } }: PageProps) {
  setRequestLocale(locale);
  const t = await getTranslations("Checkout");

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-20">
      <h1 className="font-display text-2xl tracking-luxe text-ink sm:text-3xl">{t("title")}</h1>
      <div className="mt-12">
        <CheckoutForm />
      </div>
    </div>
  );
}
