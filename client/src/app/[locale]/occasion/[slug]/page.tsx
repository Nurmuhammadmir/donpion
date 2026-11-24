import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCorporateProducts, getOccasionBySlug, getOccasions, getProducts } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import BackLink from "@/components/BackLink";
import Breadcrumbs from "@/components/Breadcrumbs";
import JsonLd from "@/components/JsonLd";
import CatalogFilters from "@/components/CatalogFilters";
import { routing } from "@/i18n/routing";
import { localeAlternates } from "@/lib/seo";

export const revalidate = 600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// "Корпоративные заказы" shows the whole catalog (цветы → шоколадки →
// остальное) instead of just products tagged with this Occasion — see
// getCorporateProducts. Every other occasion keeps the original tag filter.
const CORPORATE_SLUG = "korporativnye-zakazy";

interface PageProps {
  params: { locale: string; slug: string };
  searchParams: { recipient?: string; color?: string; priceMin?: string; priceMax?: string };
}

export async function generateStaticParams() {
  const occasions = await getOccasions();
  return routing.locales.flatMap((locale) => occasions.map((o) => ({ locale, slug: o.slug })));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const occasion = await getOccasionBySlug(params.slug);
  if (!occasion) return {};

  const t = await getTranslations({ locale: params.locale, namespace: "Occasion" });
  const canonical = `/occasion/${occasion.slug}`;

  return {
    title: t("titleFor", { name: occasion.name }),
    description: occasion.description || t("titleFor", { name: occasion.name }),
    alternates: localeAlternates(canonical),
  };
}

export default async function OccasionPage({ params: { locale, slug }, searchParams }: PageProps) {
  setRequestLocale(locale);
  const t = await getTranslations("Occasion");
  const tc = await getTranslations("Common");

  const occasion = await getOccasionBySlug(slug);
  if (!occasion) notFound();

  const sharedFilterParams = {
    recipient: searchParams.recipient,
    color: searchParams.color,
    priceMin: searchParams.priceMin ? Number(searchParams.priceMin) : undefined,
    priceMax: searchParams.priceMax ? Number(searchParams.priceMax) : undefined,
  };
  const { items } =
    occasion.slug === CORPORATE_SLUG
      ? await getCorporateProducts({ ...sharedFilterParams, limit: 200 })
      : await getProducts({ occasion: occasion.slug, limit: 60, ...sharedFilterParams });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: t("titleFor", { name: occasion.name }),
    description: occasion.description,
    url: `${SITE_URL}/occasion/${occasion.slug}`,
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-20">
      <JsonLd data={jsonLd} />
      <Breadcrumbs items={[{ name: tc("home"), href: "/" }, { name: occasion.name, href: `/occasion/${occasion.slug}` }]} />
      <BackLink className="mt-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wide2 text-graphite hover:text-hermes-500" />

      <header className="mt-10 max-w-2xl">
        <p className="eyebrow mb-4">{t("eyebrow")}</p>
        <h1 className="font-display text-3xl tracking-luxe text-ink sm:text-4xl">{occasion.name}</h1>
        {occasion.description && <p className="mt-6 text-sm leading-relaxed text-graphite">{occasion.description}</p>}
      </header>

      <CatalogFilters />

      {items.length > 0 ? (
        <div className="mt-16 grid grid-cols-2 gap-x-6 gap-y-12 sm:gap-x-8 lg:grid-cols-4">
          {items.map((product) => (
            <ProductCard key={product._id} product={product} showFromPrice={occasion.slug === CORPORATE_SLUG} />
          ))}
        </div>
      ) : (
        <p className="mt-16 text-sm text-graphite">{t("empty")}</p>
      )}
    </div>
  );
}
