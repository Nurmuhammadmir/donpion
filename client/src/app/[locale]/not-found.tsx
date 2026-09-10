import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/Link";

export default async function NotFound() {
  const t = await getTranslations("NotFound");
  const tc = await getTranslations("Common");

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-40 text-center">
      <p className="eyebrow mb-5">404</p>
      <h1 className="font-display text-3xl tracking-luxe text-ink">{t("title")}</h1>
      <p className="mt-5 text-graphite">{t("description")}</p>
      <Link href="/" className="mt-10 text-xs font-medium uppercase tracking-wide2 text-hermes-500 underline underline-offset-4">
        {tc("backHome")}
      </Link>
    </div>
  );
}
