import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAddonCategories, getAllProductsForSitemap, getProductBySlug, getSiteSettings } from "@/lib/api";
import AddToCartButton from "@/components/AddToCartButton";
import BackLink from "@/components/BackLink";
import Breadcrumbs from "@/components/Breadcrumbs";
import JsonLd from "@/components/JsonLd";
import ProductAddons from "@/components/ProductAddons";
import ProductCard from "@/components/ProductCard";
import ProductGallery from "@/components/ProductGallery";
import { formatUZS } from "@/lib/format";
import { resolveImageUrl } from "@/lib/images";
import { routing } from "@/i18n/routing";

export const revalidate = 600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

interface PageProps {
  params: { locale: string; slug: string };
}

// Pre-renders every product page, for every locale, at build time (SSG);
// combinations added later are generated on first request (ISR fallback).
export async function generateStaticParams() {
  const products = await getAllProductsForSitemap();
  return routing.locales.flatMap((locale) => products.map((p) => ({ locale, slug: p.slug })));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const data = await getProductBySlug(params.slug);
  if (!data) return {};
  const { product } = data;
  const canonical = `/flowers/${product.slug}`;

  return {
    // "absolute" bypasses the root layout's "%s | DonPion" template — the
    // seoTitle stored in MongoDB is already the exact, complete <title>.
    title: { absolute: product.seoTitle },
    description: product.seoDescription,
    alternates: { canonical },
    openGraph: {
      title: product.seoTitle,
      description: product.seoDescription,
      url: canonical,
      images: product.images.map((url) => ({ url: resolveImageUrl(url) })),
    },
  };
}

export default async function ProductPage({ params: { locale, slug } }: PageProps) {
  setRequestLocale(locale);
  const t = await getTranslations("Product");
  const tc = await getTranslations("Common");

  const [data, addonCategories, settings] = await Promise.all([
    getProductBySlug(slug),
    getAddonCategories(),
    getSiteSettings(),
  ]);
  if (!data) notFound();

  const { product, related } = data;

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription,
    image: product.images.map(resolveImageUrl),
    sku: product._id,
    category: product.category.name,
    aggregateRating:
      product.reviewsCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.reviewsCount,
          }
        : undefined,
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/flowers/${product.slug}`,
      priceCurrency: "UZS",
      price: product.price,
      availability: `https://schema.org/${product.availability}`,
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-20">
      <JsonLd data={productJsonLd} />
      <Breadcrumbs
        items={[
          { name: tc("home"), href: "/" },
          { name: product.category.name, href: `/catalog/${product.category.slug}` },
          { name: product.name, href: `/flowers/${product.slug}` },
        ]}
      />

      <div className="mt-10 grid gap-16 lg:grid-cols-2 lg:gap-24">
        <div>
          <ProductGallery images={product.images} alt={product.name} />
          <BackLink className="mt-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wide2 text-graphite hover:text-hermes-500" />
        </div>

        <div>
          <p className="eyebrow mb-4">{product.category.name}</p>
          <h1 className="font-display text-3xl leading-tight tracking-luxe text-ink sm:text-4xl">
            {product.name}
          </h1>

          <div className="mt-6 flex items-baseline gap-3">
            <span className="font-display text-2xl text-ink/85">{formatUZS(product.price, locale)}</span>
            {product.oldPrice && (
              <span className="font-display text-lg text-graphite line-through">{formatUZS(product.oldPrice, locale)}</span>
            )}
          </div>

          <p className="mt-3 flex items-center gap-2 text-xs uppercase tracking-wide2 text-graphite">
            <span className={`h-1.5 w-1.5 ${product.availability === "InStock" ? "bg-hermes-500" : "bg-graphite"}`} />
            {product.availability === "InStock" ? tc("inStock") : tc("outOfStock")}
          </p>

          <p className="mt-8 max-w-md text-sm leading-relaxed text-graphite">{product.shortDescription}</p>

          <div className="mt-10">
            <AddToCartButton
              productId={product._id}
              slug={product.slug}
              name={product.name}
              price={product.price}
              image={resolveImageUrl(product.images[0])}
              cashbackPercent={settings.cashbackPercent}
            />
          </div>

          <ProductAddons categories={addonCategories} />

          {product.composition.length > 0 && (
            <div className="mt-12 border-t border-hairline pt-8">
              <h2 className="eyebrow mb-4">{t("compositionHeading")}</h2>
              <ul className="space-y-2 text-sm text-graphite">
                {product.composition.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {product.careInstructions && (
            <div className="mt-8 border-t border-hairline pt-8">
              <h2 className="eyebrow mb-4">{t("careHeading")}</h2>
              <p className="text-sm leading-relaxed text-graphite">{product.careInstructions}</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-24 max-w-3xl border-t border-hairline pt-12">
        <h2 className="font-display text-xl tracking-luxe text-ink">{t("aboutHeading")}</h2>
        <p className="mt-5 text-sm leading-relaxed text-graphite">{product.story}</p>
      </div>

      {related.length > 0 && (
        <div className="mt-24 border-t border-hairline pt-12">
          <h2 className="font-display text-xl tracking-luxe text-ink">{t("relatedHeading")}</h2>
          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-12 sm:gap-x-8 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
