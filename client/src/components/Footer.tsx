import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/i18n/Link";
import BranchesMapLazy from "@/components/BranchesMapLazy";
import type { Branch, Category } from "@/types";

const INSTAGRAM_URL = "https://www.instagram.com/donpion.uz/";
const TELEGRAM_URL = "https://t.me/DONPIONUZ_BOT";

export default function Footer({ categories, branches }: { categories: Category[]; branches: Branch[] }) {
  const t = useTranslations("Footer");

  return (
    <footer className="border-t border-hairline bg-paper">
      <div className="mx-auto grid max-w-6xl gap-14 px-6 py-24 lg:grid-cols-4 lg:px-10">
        <div>
          <Image src="/nav-logo.png" alt="DonPion" width={1397} height={435} className="h-8 w-auto" />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-graphite">{t("tagline")}</p>
          <div className="mt-6 flex items-center gap-4">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="text-ink transition-colors hover:text-hermes-500"
            >
              <InstagramIcon />
            </a>
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Telegram"
              className="text-ink transition-colors hover:text-hermes-500"
            >
              <TelegramIcon />
            </a>
          </div>
        </div>

        <div>
          <h3 className="eyebrow mb-6">{t("catalogHeading")}</h3>
          <ul className="space-y-3.5">
            {categories.map((cat) => (
              <li key={cat._id}>
                <Link href={`/catalog/${cat.slug}`} className="text-sm text-graphite hover:text-hermes-500">
                  {cat.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="eyebrow mb-6">{t("customersHeading")}</h3>
          <ul className="space-y-3.5 text-sm text-graphite">
            <li>
              <Link href="/cart" className="hover:text-hermes-500">
                {t("cart")}
              </Link>
            </li>
            <li>
              <Link href="/checkout" className="hover:text-hermes-500">
                {t("checkout")}
              </Link>
            </li>
            <li>{t("deliveryAndPayment")}</li>
            <li>{t("freshnessGuarantee")}</li>
          </ul>
        </div>

        <div>
          <h3 className="eyebrow mb-6">{t("contactsHeading")}</h3>
          <ul className="space-y-3.5 text-sm text-graphite">
            <li>
              <a href="tel:+998878006030" className="hover:text-hermes-500">
                +998 87 800-60-30
              </a>
            </li>
            <li>
              <a href="mailto:hello@donpion.uz" className="hover:text-hermes-500">
                hello@donpion.uz
              </a>
            </li>
            <li>{t("workingHours")}</li>
          </ul>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 pb-16 lg:px-10">
        <div className="lg:mx-auto lg:w-[60%]">
          <BranchesMapLazy branches={branches} />
        </div>
      </div>

      <div className="border-t border-hairline px-6 py-6 text-center text-[11px] uppercase tracking-wide2 text-graphite lg:px-10">
        {t("copyright", { year: new Date().getFullYear() })}
        <p className="mt-2 normal-case tracking-normal text-graphite">
          Made with ❤️ by <span className="text-green-600">Orbita</span>Group
        </p>
      </div>
    </footer>
  );
}

function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1" />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}
