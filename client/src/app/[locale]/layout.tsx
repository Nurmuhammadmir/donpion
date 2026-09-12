import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CartProvider } from "@/components/CartProvider";
import { CustomerAuthProvider } from "@/components/CustomerAuthProvider";
import JsonLd from "@/components/JsonLd";
import { getBranches, getCategories } from "@/lib/api";
import { routing } from "@/i18n/routing";

const display = Playfair_Display({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: t("siteTitle"),
      template: "%s | DonPion",
    },
    description: t("siteDescription"),
    alternates: {
      // Points Google at the ru/uz twins of whichever page this is, so the
      // Uzbek version is indexed as its own language rather than treated
      // as duplicate content of the Russian original.
      languages: { ru: SITE_URL, uz: `${SITE_URL}/uz` },
    },
    openGraph: {
      type: "website",
      locale: locale === "uz" ? "uz_UZ" : "ru_RU",
      siteName: "DonPion",
    },
  };
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);
  const [messages, categories, branches, t] = await Promise.all([
    getMessages(),
    getCategories(),
    getBranches(),
    getTranslations({ locale, namespace: "Metadata" }),
  ]);

  return (
    <html lang={locale} className={`${display.variable} ${sans.variable}`}>
      <body className="flex min-h-screen flex-col bg-paper font-sans text-ink">
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "DonPion",
            url: SITE_URL,
            description: t("orgDescription"),
          }}
        />
        <NextIntlClientProvider messages={messages}>
          <CustomerAuthProvider>
            <CartProvider>
              <Header categories={categories} />
              <main className="flex-1">{children}</main>
              <Footer categories={categories} branches={branches} />
            </CartProvider>
          </CustomerAuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
