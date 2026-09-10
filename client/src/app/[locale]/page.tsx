import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/Link";
import { getCharacters, getProducts, getSiteSettings } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import BouquetQuiz from "@/components/BouquetQuiz";
import { resolveImageUrl } from "@/lib/images";

export const revalidate = 600;

interface PageProps {
  params: { locale: string };
}

export default async function HomePage({ params: { locale } }: PageProps) {
  setRequestLocale(locale);
  const t = await getTranslations("Home");
  const tc = await getTranslations("Common");

  const [characters, featuredRes, settings] = await Promise.all([
    getCharacters(),
    getProducts({ featured: true, limit: 8 }),
    getSiteSettings(),
  ]);

  // Luxury Collection shows only what the admin has explicitly marked
  // "Показывать в Популярном" — no fallback substitutes. The section
  // heading still always renders; see the empty-state message below.
  const luxuryItems = featuredRes.items;

  return (
    <>
      {/* Hero — one frame, one line of type, one action. No carousel.
          Mobile and tablet get their own square crop (set in the admin
          panel) rather than an awkwardly center-cropped desktop photo —
          a native <picture> so each device downloads only its own image. */}
      <section className="relative aspect-square w-full overflow-hidden lg:aspect-auto lg:h-[85vh] lg:min-h-[560px]">
        <picture>
          <source media="(max-width: 639px)" srcSet={resolveImageUrl(settings.heroImageMobile || settings.heroImage)} />
          <source media="(max-width: 1023px)" srcSet={resolveImageUrl(settings.heroImageTablet || settings.heroImage)} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveImageUrl(settings.heroImage)}
            alt="DonPion"
            fetchPriority="high"
            loading="eager"
            className="photo-fade-in absolute inset-0 h-full w-full object-cover"
          />
        </picture>
        {/* Tablet/desktop only: headline overlays the photo directly — white
            text with a soft shadow — with a light scrim for legibility.
            Hidden on mobile, where the headline moves below the photo
            instead (see the block right after this section). */}
        <div className="absolute inset-0 z-10 hidden bg-black/12 sm:block" />

        <div className="relative z-20 hidden h-full flex-col items-start justify-end px-10 pb-20 text-left sm:flex lg:px-16">
          <h1
            className="max-w-md font-display text-5xl font-normal leading-[1.2] tracking-luxe text-white lg:max-w-lg lg:text-6xl"
            style={{ textShadow: "0 2px 20px rgba(0,0,0,0.35)" }}
          >
            {t("heroTitle")}
          </h1>
          <div className="mt-10">
            <a href="#quiz" className="btn-primary">
              {t("heroCta")}
            </a>
          </div>
        </div>
      </section>

      {/* Mobile only: headline and button sit below the photo, not overlaid on it */}
      <div className="flex flex-col items-center px-6 py-10 text-center sm:hidden">
        <h1 className="max-w-[90%] font-display text-4xl font-normal leading-[1.2] tracking-luxe">
          <span className="text-ink/85">{t("heroTitleMobilePrefix")}</span>
          <span className="text-hermes-500">{t("heroTitleMobileAccent")}</span>
          <span className="text-ink/85">{t("heroTitleMobileSuffix")}</span>
        </h1>
        <div className="mt-8">
          <a href="#quiz" className="btn-primary">
            {t("heroCta")}
          </a>
        </div>
      </div>

      {/* Luxury Collection — always shown right after the hero, before the
          quiz. Desktop: a fixed grid with a "see all" link below.
          Phone/tablet: the same pieces in a horizontal strip — scroll right
          to see the rest, rather than a tall vertical grid. */}
      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-10 lg:py-28">
        <div className="mb-12 text-center">
          <p className="eyebrow mb-4">{t("luxuryEyebrow")}</p>
          <h2 className="font-display text-2xl tracking-luxe text-ink sm:text-3xl">{t("luxuryHeading")}</h2>
        </div>

        {luxuryItems.length > 0 ? (
          <>
            <div className="-mx-6 flex scroll-touch no-scrollbar gap-4 overflow-x-auto scroll-smooth px-6 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-x-8 lg:gap-y-12 lg:overflow-visible lg:px-0 lg:pb-0">
              {luxuryItems.slice(0, 4).map((product) => (
                <div key={product._id} className="w-[45%] flex-shrink-0 sm:w-[42%] lg:w-auto lg:flex-shrink">
                  <ProductCard product={product} />
                </div>
              ))}
              {/* Mobile/tablet: "see all" rides at the end of the same strip
                  instead of a separate block below it. */}
              <Link
                href="/collection"
                className="flex aspect-[3/4] w-[45%] flex-shrink-0 flex-col items-center justify-center text-center sm:w-[42%] lg:hidden"
              >
                <span className="text-xs font-medium uppercase tracking-wide2 text-hermes-500">
                  {tc("seeAllLine1")}
                  <br />
                  {tc("seeAllLine2")}
                </span>
              </Link>
            </div>

            <div className="mt-14 hidden text-center lg:block">
              <Link
                href="/collection"
                className="text-xs font-medium uppercase tracking-wide2 text-hermes-500 underline underline-offset-4"
              >
                {tc("seeAll")}
              </Link>
            </div>
          </>
        ) : (
          <p className="text-center text-sm text-graphite">{t("luxuryEmpty")}</p>
        )}
      </section>

      {/* Mini quiz — matches a character tagged directly on each product
          (see Character model / admin "Характеры"), with results shown
          inline right here rather than a separate results page. */}
      <section className="border-y border-hairline bg-paper px-6 py-24 lg:px-10">
        <BouquetQuiz characters={characters} />
      </section>

      {/* The ritual of gifting — what happens after checkout, not delivery bullet points */}
      <section className="border-t border-hairline bg-paper">
        <div className="mx-auto max-w-5xl px-6 py-24 lg:px-10">
          <div className="mb-16 text-center">
            <p className="eyebrow mb-4">{t("careEyebrow")}</p>
            <h2 className="font-display text-2xl tracking-luxe text-ink sm:text-3xl">{t("ritualHeading")}</h2>
          </div>
          <div className="grid grid-cols-1 gap-12 sm:grid-cols-3 sm:gap-10">
            {[
              { title: t("ritual1Title"), text: t("ritual1Text") },
              { title: t("ritual2Title"), text: t("ritual2Text") },
              { title: t("ritual3Title"), text: t("ritual3Text") },
            ].map((item) => (
              <div key={item.title} className="text-center sm:text-left">
                <div className="mx-auto h-px w-8 bg-hermes-500 sm:mx-0" />
                <h3 className="mt-5 font-display text-base tracking-luxe text-ink">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-graphite">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
