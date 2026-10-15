import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Derived from the real API URL so production deploys don't need a
// hand-edit here every time the domain changes — only NEXT_PUBLIC_API_URL
// needs to be set correctly at build time.
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4100/api";
const apiHost = new URL(apiUrl);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bundles only the files/deps actually needed at runtime into
  // .next/standalone — much smaller footprint and faster cold start than
  // running against the full node_modules tree, which matters on a small
  // shared VPS. Requires copying public/ and .next/static into
  // .next/standalone after `next build` (see README deploy notes).
  output: "standalone",
  images: {
    remotePatterns: [
      // Legacy/reference photos only — real product images now come from
      // our own server's /uploads (below). Safe to remove once no product
      // still references an external Unsplash URL.
      { protocol: "https", hostname: "images.unsplash.com" },
      // The API server's own uploaded product photos.
      { protocol: apiHost.protocol.replace(":", ""), hostname: apiHost.hostname },
      // Always allow plain localhost too, so local dev keeps working
      // regardless of what NEXT_PUBLIC_API_URL is set to.
      { protocol: "http", hostname: "localhost" },
    ],
  },
};

export default withNextIntl(nextConfig);
