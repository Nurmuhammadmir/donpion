import { defineRouting } from "next-intl/routing";

// Russian stays at the bare root ("/") since that's the site's original,
// already-indexed URL structure — only Uzbek gets a "/uz" prefix.
export const routing = defineRouting({
  locales: ["ru", "uz"],
  defaultLocale: "ru",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
