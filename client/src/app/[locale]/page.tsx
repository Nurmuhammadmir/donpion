import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCharacters, getOccasions, getProducts, getSiteSettings } from "@/lib/api";
import BouquetQuiz from "@/components/BouquetQuiz";
import OccasionPicker from "@/components/OccasionPicker";
import ProductShelf from "@/components/ProductShelf";
import { resolveImageUrl } from "@/lib/images";

export const revalidate = 600;

interface PageProps {
  params: { locale: string };
}

export default async function HomePage({ params: { locale } }: PageProps) {
  setRequestLocale(locale);
  const t = await getTranslations("Home");
  const tc = await getTranslations("Common");

  const [characters, occasions, featuredRes, chocolateRes, settings] = await Promise.all([
    getCharacters(),
    getOccasions(),
    getProducts({ featured: true, limit: 8 }),
    getProducts({ addonCategory: "shokolad", limit: 8 }),
    getSiteSettings(),
  ]);

  // Luxury Collection shows only what the admin has explicitly marked
  // "Показывать в Популярном" — no fallback substitutes. The section
  // heading still always renders; see the empty-state message below.
  const luxuryItems = featuredRes.items;
  const chocolateItems = chocolateRes.items;

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

        <ProductShelf
          products={luxuryItems}
          seeAllHref="/collection"
          seeAllLabel={tc("seeAll")}
          seeAllLine1={tc("seeAllLine1")}
          seeAllLine2={tc("seeAllLine2")}
          emptyText={t("luxuryEmpty")}
        />
      </section>

      {/* Mini quiz — matches a character tagged directly on each product
          (see Character model / admin "Характеры"), with results shown
          inline right here rather than a separate results page. */}
      <section className="border-y border-hairline bg-paper px-6 py-24 lg:px-10">
        <BouquetQuiz characters={characters} />
      </section>

      {/* Right after the personality quiz — a shelf of whatever's tagged
          into the "Шоколад" add-on category (see AddonCategory / admin
          "Допы"), the same shelf shape as Luxury Collection above. */}
      <section className="border-b border-hairline bg-paper px-6 py-24 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <p className="eyebrow mb-4">{t("chocolateEyebrow")}</p>
            <h2 className="font-display text-2xl tracking-luxe text-ink sm:text-3xl">{t("chocolateHeading")}</h2>
          </div>
          <ProductShelf
            products={chocolateItems}
            seeAllHref="/addon/shokolad"
            seeAllLabel={tc("seeAll")}
            seeAllLine1={tc("seeAllLine1")}
            seeAllLine2={tc("seeAllLine2")}
            emptyText={t("chocolateEmpty")}
          />
        </div>
      </section>

      {/* Right after that — same mechanism again, grouped by what the
          flowers are FOR instead of who they suit (see Occasion model /
          admin "Поводы"). */}
      <section className="border-b border-hairline bg-paper px-6 py-24 lg:px-10">
        <OccasionPicker occasions={occasions} />
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
