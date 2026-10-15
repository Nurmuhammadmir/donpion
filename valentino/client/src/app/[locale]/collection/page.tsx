import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getProducts } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import BackLink from "@/components/BackLink";
import Breadcrumbs from "@/components/Breadcrumbs";
import { localeAlternates } from "@/lib/seo";

export const revalidate = 600;

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata({ params: { locale } }: PageProps): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "Collection" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: localeAlternates("/collection"),
  };
}

export default async function CollectionPage({ params: { locale } }: PageProps) {
  setRequestLocale(locale);
  const t = await getTranslations("Collection");
  const tc = await getTranslations("Common");

  // Only what the admin has explicitly marked "Показывать в Популярном" —
  // no fallback substitutes.
  const { items } = await getProducts({ featured: true, limit: 100 });

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-20">
      <Breadcrumbs items={[{ name: tc("home"), href: "/" }, { name: t("eyebrow"), href: "/collection" }]} />
      <BackLink className="mt-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wide2 text-graphite hover:text-hermes-500" />

      <header className="mt-10 max-w-2xl">
        <p className="eyebrow mb-4">{t("eyebrow")}</p>
        <h1 className="font-display text-3xl tracking-luxe text-ink sm:text-4xl">{t("title")}</h1>
        <p className="mt-6 text-sm leading-relaxed text-graphite">{t("description")}</p>
      </header>

      {items.length > 0 ? (
        <div className="mt-16 grid grid-cols-2 gap-x-6 gap-y-12 sm:gap-x-8 lg:grid-cols-4">
          {items.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      ) : (
        <p className="mt-16 text-sm text-graphite">{t("empty")}</p>
      )}
    </div>
  );
}
