import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCharacterBySlug, getCharacters, getProducts } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import BackLink from "@/components/BackLink";
import Breadcrumbs from "@/components/Breadcrumbs";
import JsonLd from "@/components/JsonLd";
import { routing } from "@/i18n/routing";
import { localeAlternates } from "@/lib/seo";

export const revalidate = 600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

interface PageProps {
  params: { locale: string; slug: string };
}

export async function generateStaticParams() {
  const characters = await getCharacters();
  return routing.locales.flatMap((locale) => characters.map((c) => ({ locale, slug: c.slug })));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const character = await getCharacterBySlug(params.slug);
  if (!character) return {};

  const t = await getTranslations({ locale: params.locale, namespace: "Character" });
  const canonical = `/character/${character.slug}`;

  return {
    title: t("titleFor", { name: character.name }),
    description: character.description,
    alternates: localeAlternates(canonical),
  };
}

export default async function CharacterPage({ params: { locale, slug } }: PageProps) {
  setRequestLocale(locale);
  const t = await getTranslations("Character");
  const tc = await getTranslations("Common");

  const character = await getCharacterBySlug(slug);
  if (!character) notFound();

  const { items } = await getProducts({ character: character.slug, limit: 60 });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: t("titleFor", { name: character.name }),
    description: character.description,
    url: `${SITE_URL}/character/${character.slug}`,
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-20">
      <JsonLd data={jsonLd} />
      <Breadcrumbs items={[{ name: tc("home"), href: "/" }, { name: character.name, href: `/character/${character.slug}` }]} />
      <BackLink className="mt-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wide2 text-graphite hover:text-hermes-500" />

      <header className="mt-10 max-w-2xl">
        <p className="eyebrow mb-4">{t("eyebrow")}</p>
        <h1 className="font-display text-3xl tracking-luxe text-ink sm:text-4xl">{character.name}</h1>
        <p className="mt-6 text-sm leading-relaxed text-graphite">{character.description}</p>
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
