import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import AccountView from "@/components/AccountView";
import BackLink from "@/components/BackLink";
import Breadcrumbs from "@/components/Breadcrumbs";

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata({ params: { locale } }: PageProps): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "Account" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function AccountPage({ params: { locale } }: PageProps) {
  setRequestLocale(locale);
  const t = await getTranslations("Account");
  const tc = await getTranslations("Common");

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 lg:px-10 lg:py-20">
      <Breadcrumbs items={[{ name: tc("home"), href: "/" }, { name: t("title"), href: "/account" }]} />
      <BackLink className="mt-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wide2 text-graphite hover:text-hermes-500" />

      <h1 className="mt-10 font-display text-2xl tracking-luxe text-ink sm:text-3xl">{t("title")}</h1>

      <div className="mt-12">
        <AccountView />
      </div>
    </div>
  );
}
