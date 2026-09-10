import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/Link";
import JsonLd from "@/components/JsonLd";

export interface BreadcrumbItem {
  name: string;
  href: string;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Renders the visual breadcrumb trail AND its matching BreadcrumbList JSON-LD,
// so the two never drift out of sync. Async Server Component — safe to use
// directly as JSX from any server page, no "use client" needed.
export default async function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const t = await getTranslations("Common");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.href}`,
    })),
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <nav aria-label={t("breadcrumbLabel")} className="text-[11px] uppercase tracking-wide2 text-graphite">
        <ol className="flex flex-wrap items-center gap-2">
          {items.map((item, index) => (
            <li key={item.href} className="flex items-center gap-2">
              {index > 0 && <span className="text-hairline">/</span>}
              {index === items.length - 1 ? (
                <span className="text-ink">{item.name}</span>
              ) : (
                <Link href={item.href} className="hover:text-hermes-500">
                  {item.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
