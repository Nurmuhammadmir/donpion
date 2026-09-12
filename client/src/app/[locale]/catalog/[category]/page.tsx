import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCategories, getCategoryBySlug, getProducts } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import BackLink from "@/components/BackLink";
import Breadcrumbs from "@/components/Breadcrumbs";
import JsonLd from "@/components/JsonLd";
import { resolveImageUrl } from "@/lib/images";
import { routing } from "@/i18n/routing";
import { localeAlternates } from "@/lib/seo";

export const revalidate = 600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

interface PageProps {
  params: { locale: string; category: string };
}

// Pre-renders every category page, for every locale, at build time (SSG);
// combinations added later are generated on first request (ISR fallback).
export async function generateStaticParams() {
  const categories = await getCategories();
  return routing.locales.flatMap((locale) => categories.map((cat) => ({ locale, category: cat.slug })));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const category = await getCategoryBySlug(params.category);
  if (!category) return {};

  const canonical = `/catalog/${category.slug}`;

  return {
    // "absolute" bypasses the root layout's "%s | DonPion" template — the
    // seoTitle stored in MongoDB is already the exact, complete <title>.
    title: { absolute: category.seoTitle },
    description: category.seoDescription,
    alternates: localeAlternates(canonical),
    openGraph: {
      title: category.seoTitle,
      description: category.seoDescription,
      url: canonical,
      images: [{ url: resolveImageUrl(category.image) }],
    },
  };
}

export default async function CategoryPage({ params: { locale, category: categorySlug } }: PageProps) {
  setRequestLocale(locale);
  const t = await getTranslations("Catalog");
  const tc = await getTranslations("Common");

  const category = await getCategoryBySlug(categorySlug);
  if (!category) notFound();

  const { items } = await getProducts({ category: category.slug, limit: 60 });

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: category.seoTitle,
    description: category.seoDescription,
    url: `${SITE_URL}/catalog/${category.slug}`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: items.map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${SITE_URL}/flowers/${product.slug}`,
      })),
    },
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-20">
      <JsonLd data={itemListJsonLd} />
      <Breadcrumbs items={[{ name: tc("home"), href: "/" }, { name: category.name, href: `/catalog/${category.slug}` }]} />
      <BackLink className="mt-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wide2 text-graphite hover:text-hermes-500" />

      <header className="mt-10 max-w-2xl">
        <h1 className="font-display text-3xl tracking-luxe text-ink sm:text-4xl">{category.name}</h1>
        <p className="mt-6 text-sm leading-relaxed text-graphite">{category.introText}</p>
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
