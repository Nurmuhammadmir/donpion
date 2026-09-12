"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/Link";
import CartIcon from "@/components/CartIcon";
import AccountIcon from "@/components/AccountIcon";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import type { Category, Occasion } from "@/types";

// Mobile menu: a short curated list, not the full flower-type catalog —
// these three occasions plus the chocolate category, in this exact order.
const NAV_OCCASION_SLUGS = ["svadebnaya-floristika", "korporativnye-zakazy", "gorshechnye-rasteniya"];
// Desktop bar: even shorter — just the two, no chocolate category link.
const DESKTOP_NAV_OCCASION_SLUGS = ["svadebnaya-floristika", "korporativnye-zakazy"];

export default function Header({ categories, occasions }: { categories: Category[]; occasions: Occasion[] }) {
  const t = useTranslations("Nav");
  const chocolateCategory = categories.find((c) => c.slug === "klubnika-v-shokolade");
  const navOccasions = NAV_OCCASION_SLUGS.map((slug) => occasions.find((o) => o.slug === slug)).filter(
    (o): o is Occasion => Boolean(o)
  );
  const desktopNavOccasions = DESKTOP_NAV_OCCASION_SLUGS.map((slug) => occasions.find((o) => o.slug === slug)).filter(
    (o): o is Occasion => Boolean(o)
  );
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Tucks the header away on a downward scroll and brings it straight back
  // on the very next upward one — phone/tablet only. The hide/show classes
  // below are prefixed max-lg: specifically so no transform utility is ever
  // applied at desktop widths at all (rather than relying on a competing
  // lg:translate-y-0 to win the cascade) — a translate-y-full that isn't
  // reliably overridden is exactly what makes the whole header, logo
  // included, silently slide out of view.
  const [hideHeader, setHideHeader] = useState(false);
  const lastScrollY = useRef(0);
  const menuRef = useRef<HTMLElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      setScrolled(currentY > 8);
      setHideHeader(currentY > lastScrollY.current && currentY > 80);
      lastScrollY.current = currentY;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Popup behaviour: lock background scroll while open, close on Escape,
  // and close on literally any click that isn't inside the menu itself
  // (or the toggle button, which already handles itself) — a document-level
  // listener rather than relying only on the dimmed backdrop's own onClick,
  // since that depends on the backdrop actually winning the click over
  // whatever else is on the page instead of just checking "was this click
  // inside the menu at all".
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const onDocumentClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (menuButtonRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", onDocumentClick);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onDocumentClick);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  return (
    <header
      className={`sticky top-0 z-40 bg-navy transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        hideHeader && !menuOpen ? "max-lg:-translate-y-full" : "max-lg:translate-y-0"
      }`}
    >
      {/* Mobile & tablet: cart pinned left, wordmark centered, menu right */}
      <div className="grid grid-cols-3 items-center px-6 py-[13px] lg:hidden">
        <div className="flex justify-start">
          <CartIcon className="text-white" />
        </div>
        <Link href="/" className="flex justify-center">
          <Image src="/nav-logo.png" alt="DonPion" width={1397} height={435} className="h-8 w-auto" priority />
        </Link>
        <div className="flex justify-end">
          <button
            ref={menuButtonRef}
            type="button"
            aria-label={t("menu")}
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center text-white transition-colors hover:text-hermes-500"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Desktop */}
      <div className="mx-auto hidden max-w-6xl items-center justify-between gap-8 px-10 py-[17px] lg:flex">
        <Link href="/" className="flex-shrink-0">
          <Image src="/nav-logo.png" alt="DonPion" width={1397} height={435} className="h-10 w-auto" priority />
        </Link>

        {/* min-w-0 is what actually lets this shrink below its content's
            natural width in a flex row — without it, the nav items being
            longer now (full occasion names, not single words) squeezed the
            logo and icons instead of scrolling themselves. */}
        <nav className="no-scrollbar flex min-w-0 flex-1 items-center gap-9 overflow-x-auto">
          {desktopNavOccasions.map((occasion) => (
            <Link
              key={occasion._id}
              href={`/occasion/${occasion.slug}`}
              className="flex-shrink-0 whitespace-nowrap text-xs font-medium uppercase tracking-wide2 text-white/75 transition-colors hover:text-hermes-500"
            >
              {occasion.name}
            </Link>
          ))}
        </nav>

        <div className="flex flex-shrink-0 items-center gap-5">
          <a
            href="tel:+998878006030"
            className="flex flex-shrink-0 items-center gap-2 whitespace-nowrap text-xs font-medium uppercase tracking-wide2 text-white transition-colors hover:text-hermes-500"
          >
            <span className="text-hermes-500">●</span>
            {t("phone")}
          </a>
          <LanguageSwitcher className="text-xs font-medium uppercase tracking-wide2 text-white/75 transition-colors hover:text-hermes-500" />
          <AccountIcon className="text-white" />
          <CartIcon className="text-white" />
        </div>
      </div>

      {/* Thin Hermes-orange line — the only accent that appears while scrolling */}
      <div
        className="h-px w-full bg-hermes-500 transition-opacity duration-300"
        style={{ opacity: scrolled ? 1 : 0 }}
      />
      <div className="h-px w-full bg-white/10" />

      {/* Popup menu — overlays the page instead of pushing it down, and
          fades/slides in rather than snapping open. */}
      <div
        aria-hidden={!menuOpen}
        className={`fixed inset-0 z-40 bg-ink/30 transition-opacity duration-300 lg:hidden ${
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMenuOpen(false)}
      />
      <nav
        ref={menuRef}
        aria-hidden={!menuOpen}
        className={`absolute left-0 right-0 top-full z-50 origin-top border-b border-hairline bg-paper px-6 py-6 transition-all duration-300 ease-out lg:hidden ${
          menuOpen ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <div className="flex flex-col gap-1">
          {navOccasions.map((occasion) => (
            <Link
              key={occasion._id}
              href={`/occasion/${occasion.slug}`}
              onClick={() => setMenuOpen(false)}
              className="border-b border-hairline py-3 text-xs font-medium uppercase tracking-wide2 text-graphite hover:text-hermes-500"
            >
              {occasion.name}
            </Link>
          ))}
          {chocolateCategory && (
            <Link
              href={`/catalog/${chocolateCategory.slug}`}
              onClick={() => setMenuOpen(false)}
              className="border-b border-hairline py-3 text-xs font-medium uppercase tracking-wide2 text-graphite hover:text-hermes-500"
            >
              {chocolateCategory.name}
            </Link>
          )}
          <Link
            href="/account"
            onClick={() => setMenuOpen(false)}
            className="border-b border-hairline py-3 text-xs font-medium uppercase tracking-wide2 text-hermes-500"
          >
            {t("account")}
          </Link>
          <div className="flex items-center justify-between pt-3">
            <a
              href="tel:+998878006030"
              onClick={() => setMenuOpen(false)}
              className="text-xs font-medium uppercase tracking-wide2 text-ink"
            >
              {t("phone")}
            </a>
            <LanguageSwitcher
              onClick={() => setMenuOpen(false)}
              className="text-xs font-medium uppercase tracking-wide2 text-graphite hover:text-hermes-500"
            />
          </div>
        </div>
      </nav>
    </header>
  );
}
