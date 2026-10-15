import { getAddonCategories, getAllProductsForSitemap, getCategories, getCharacters, getOccasions } from "@/lib/api";
import { resolveImageUrl } from "@/lib/images";
import { routing } from "@/i18n/routing";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Regenerated from MongoDB on every request Next.js decides to refresh it
// (see revalidate below) — never edited by hand, so newly added or removed
// products/categories show up without a deploy.
export const revalidate = 3600;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// The bare path a URL entry represents (e.g. "/catalog/rozy") — every
// locale's variant of that path is listed as its own <url>, each pointing
// at the others via hreflang alternates, so Google indexes the "/uz/..."
// pages as translations rather than duplicate content.
function localizedPath(locale: string, path: string): string {
  if (locale === routing.defaultLocale) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

interface UrlEntry {
  path: string;
  lastModified?: string;
  changeFrequency: string;
  priority: number;
  images?: { loc: string; title: string }[];
}

function renderUrl(entry: UrlEntry): string {
  const imageTags = (entry.images ?? [])
    .map(
      (img) =>
        `<image:image><image:loc>${escapeXml(img.loc)}</image:loc><image:title>${escapeXml(
          img.title
        )}</image:title></image:image>`
    )
    .join("");

  const alternateTags = routing.locales
    .map(
      (locale) =>
        `<xhtml:link rel="alternate" hreflang="${locale}" href="${escapeXml(
          `${SITE_URL}${localizedPath(locale, entry.path)}`
        )}"/>`
    )
    .join("");

  return routing.locales
    .map((locale) => {
      return [
        "<url>",
        `<loc>${escapeXml(`${SITE_URL}${localizedPath(locale, entry.path)}`)}</loc>`,
        alternateTags,
        entry.lastModified ? `<lastmod>${entry.lastModified}</lastmod>` : "",
        `<changefreq>${entry.changeFrequency}</changefreq>`,
        `<priority>${entry.priority}</priority>`,
        imageTags,
        "</url>",
      ]
        .filter(Boolean)
        .join("");
    })
    .join("");
}

// A hand-built XML sitemap rather than Next's typed `sitemap.ts` helper —
// that helper's type has no field for the Google-specific <image:image>
// extension, and getting products found in Google Images (not just Google
// Web Search) is worth the extra control here.
export async function GET() {
  const [categories, products, characters, occasions, addonCategories] = await Promise.all([
    getCategories(),
    getAllProductsForSitemap(),
    getCharacters(),
    getOccasions(),
    getAddonCategories(),
  ]);

  const entries: UrlEntry[] = [
    { path: "/", changeFrequency: "daily", priority: 1 },
    { path: "/collection", changeFrequency: "daily", priority: 0.7 },
    ...categories.map(
      (cat): UrlEntry => ({
        path: `/catalog/${cat.slug}`,
        changeFrequency: "daily",
        priority: 0.8,
        images: [{ loc: resolveImageUrl(cat.image), title: cat.name }],
      })
    ),
    ...characters.map(
      (character): UrlEntry => ({
        path: `/character/${character.slug}`,
        changeFrequency: "weekly",
        priority: 0.5,
      })
    ),
    ...occasions.map(
      (occasion): UrlEntry => ({
        path: `/occasion/${occasion.slug}`,
        changeFrequency: "weekly",
        priority: 0.6,
      })
    ),
    ...addonCategories.map(
      (addon): UrlEntry => ({
        path: `/addon/${addon.slug}`,
        changeFrequency: "weekly",
        priority: 0.4,
      })
    ),
    ...products.map(
      (product): UrlEntry => ({
        path: `/flowers/${product.slug}`,
        lastModified: product.updatedAt ? new Date(product.updatedAt).toISOString() : undefined,
        changeFrequency: "weekly",
        priority: 0.6,
        images: product.images.map((img) => ({ loc: resolveImageUrl(img), title: product.name })),
      })
    ),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.map(renderUrl).join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
