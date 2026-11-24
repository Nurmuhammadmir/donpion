import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getGiftOrder } from "@/lib/api";
import GiftReveal from "@/components/GiftReveal";

interface PageProps {
  params: { locale: string; code: string };
}

// Never indexed — this is a private link meant to be forwarded one-to-one,
// not discovered, and giving it a generic title avoids spoiling the
// surprise in a link preview/share card before anyone even opens it.
export async function generateMetadata(): Promise<Metadata> {
  return { title: "DonPion", robots: { index: false, follow: false } };
}

export default async function GiftPage({ params: { locale, code } }: PageProps) {
  setRequestLocale(locale);
  const gift = await getGiftOrder(code);
  if (!gift) notFound();

  return (
    <div className="mx-auto max-w-xl px-6 py-16 lg:py-24">
      <GiftReveal gift={gift} />
    </div>
  );
}
