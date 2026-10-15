import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";

// Called by the server (see server/src/utils/notifyRevalidate.js) right
// after any admin write — product, category, character, or homepage
// settings. Without this, changes only appear once the ISR cache window
// (10 min, see `revalidate` exports on each page) expires on its own, or
// the dev server restarts and wipes its in-memory cache. This makes admin
// edits show up on the live site within a second or two instead.
export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");

  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ message: "Invalid or missing secret" }, { status: 401 });
  }

  // "/" and "/uz" are cached as separate URL trees even though they share
  // the same [locale]/layout.tsx file, so each locale needs its own call —
  // revalidating "/" alone would leave the Uzbek site stale.
  for (const locale of routing.locales) {
    const root = locale === routing.defaultLocale ? "/" : `/${locale}`;
    revalidatePath(root, "layout");
  }
  // sitemap.xml is a route handler, not a page under the layout tree, so it
  // needs its own explicit revalidation.
  revalidatePath("/sitemap.xml");

  return NextResponse.json({ revalidated: true, now: Date.now() });
}
