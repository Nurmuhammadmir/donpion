"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/Link";
import CartIcon from "@/components/CartIcon";
import AccountIcon from "@/components/AccountIcon";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import type { Category } from "@/types";

export default function Header({ categories }: { categories: Category[] }) {
  const t = useTranslations("Nav");
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Tucks the header away on a downward scroll and brings it straight back
  // on the very next upward one — phone/tablet only (desktop stays pinned
  // via the lg:translate-y-0 override below), so the navy bar doesn't sit
  // permanently between the visitor and the page while they're reading.
  const [hideHeader, setHideHeader] = useState(false);
  const lastScrollY = useRef(0);

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

  // Popup behaviour: lock background scroll while open, close on Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  return (
    <header
      className={`sticky top-0 z-40 bg-navy transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:translate-y-0 ${
        hideHeader && !menuOpen ? "-translate-y-full" : "translate-y-0"
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
        <Link href="/">
          <Image src="/nav-logo.png" alt="DonPion" width={1397} height={435} className="h-10 w-auto" priority />
        </Link>

        <nav className="flex items-center gap-9">
          {categories.map((cat) => (
            <Link
              key={cat._id}
              href={`/catalog/${cat.slug}`}
              className="text-xs font-medium uppercase tracking-wide2 text-white/75 transition-colors hover:text-hermes-500"
            >
              {cat.name}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-5">
          <a
            href="tel:+998878353508"
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
        aria-hidden={!menuOpen}
        className={`absolute left-0 right-0 top-full z-50 origin-top border-b border-hairline bg-paper px-6 py-6 transition-all duration-300 ease-out lg:hidden ${
          menuOpen ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <div className="flex flex-col gap-1">
          {categories.map((cat) => (
            <Link
              key={cat._id}
              href={`/catalog/${cat.slug}`}
              onClick={() => setMenuOpen(false)}
              className="border-b border-hairline py-3 text-xs font-medium uppercase tracking-wide2 text-graphite last:border-0 hover:text-hermes-500"
            >
              {cat.name}
            </Link>
          ))}
          <Link
            href="/account"
            onClick={() => setMenuOpen(false)}
            className="border-b border-hairline py-3 text-xs font-medium uppercase tracking-wide2 text-hermes-500"
          >
            {t("account")}
          </Link>
          <div className="flex items-center justify-between pt-3">
            <a href="tel:+998878353508" className="text-xs font-medium uppercase tracking-wide2 text-ink">
              {t("phone")}
            </a>
            <LanguageSwitcher className="text-xs font-medium uppercase tracking-wide2 text-graphite hover:text-hermes-500" />
          </div>
        </div>
      </nav>
    </header>
  );
}
