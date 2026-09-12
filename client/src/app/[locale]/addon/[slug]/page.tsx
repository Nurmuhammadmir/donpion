import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAddonCategories, getAddonCategoryBySlug, getProducts } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import BackLink from "@/components/BackLink";
import Breadcrumbs from "@/components/Breadcrumbs";
import JsonLd from "@/components/JsonLd";
import { routing } from "@/i18n/routing";

export const revalidate = 600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

interface PageProps {
  params: { locale: string; slug: string };
}

export async function generateStaticParams() {
  const categories = await getAddonCategories();
  return routing.locales.flatMap((locale) => categories.map((c) => ({ locale, slug: c.slug })));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const category = await getAddonCategoryBySlug(params.slug);
  if (!category) return {};

  const t = await getTranslations({ locale: params.locale, namespace: "Addon" });
  const canonical = `/addon/${category.slug}`;

  return {
    title: t("titleFor", { name: category.name }),
    alternates: { canonical },
  };
}

export default async function AddonCategoryPage({ params: { locale, slug } }: PageProps) {
  setRequestLocale(locale);
  const t = await getTranslations("Addon");
  const tc = await getTranslations("Common");

  const category = await getAddonCategoryBySlug(slug);
  if (!category) notFound();

  const { items } = await getProducts({ addonCategory: category.slug, limit: 60 });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: t("titleFor", { name: category.name }),
    url: `${SITE_URL}/addon/${category.slug}`,
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-20">
      <JsonLd data={jsonLd} />
      <Breadcrumbs items={[{ name: tc("home"), href: "/" }, { name: category.name, href: `/addon/${category.slug}` }]} />
      <BackLink className="mt-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wide2 text-graphite hover:text-hermes-500" />

      <header className="mt-10 max-w-2xl">
        <p className="eyebrow mb-4">{t("eyebrow")}</p>
        <h1 className="font-display text-3xl tracking-luxe text-ink sm:text-4xl">{category.name}</h1>
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
