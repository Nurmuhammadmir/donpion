import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import CartView from "@/components/CartView";
import BackLink from "@/components/BackLink";

interface PageProps {
  params: { locale: string };
}

// Cart is user-specific and holds no unique indexable content — kept out of
// search results (also blocked via robots.txt).
export async function generateMetadata({ params: { locale } }: PageProps): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "Cart" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function CartPage({ params: { locale } }: PageProps) {
  setRequestLocale(locale);
  const t = await getTranslations("Cart");

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-20">
      <BackLink className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide2 text-graphite hover:text-hermes-500" />
      <h1 className="mt-4 font-display text-2xl tracking-luxe text-ink sm:text-3xl">{t("title")}</h1>
      <div className="mt-12">
        <CartView />
      </div>
    </div>
  );
}
