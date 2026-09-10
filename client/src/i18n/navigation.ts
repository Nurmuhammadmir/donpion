import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware wrappers around Next.js' navigation APIs — automatically
// add/omit the "/uz" prefix per routing.ts, so components don't have to
// build locale-prefixed hrefs by hand. Link itself lives in ./Link.tsx
// (it needs "use client" for its onClick handler); everything exported
// here is a plain hook/utility, safe to import from Server Components too.
export const nav = createNavigation(routing);
export const { redirect, usePathname, useRouter, getPathname } = nav;
