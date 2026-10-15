const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api";

// The origin product photos are actually served from (the server's
// /uploads static route), derived from the API URL so there is only one
// place to change when deploying to a real domain.
export const ASSET_ORIGIN = API_URL.replace(/\/api\/?$/, "");

// Product/category images are stored in MongoDB as either a relative
// server path ("/uploads/xxx.webp", from the admin upload flow) or a full
// external URL (legacy seed data). This resolves either form to an
// absolute URL — required for next/image, Open Graph tags and JSON-LD,
// which all need a fully-qualified address.
export function resolveImageUrl(src: string): string {
  if (!src) return src;
  if (/^https?:\/\//i.test(src)) return src;
  return `${ASSET_ORIGIN}${src.startsWith("/") ? "" : "/"}${src}`;
}
