import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Everything except API routes, Next internals, and files with an
  // extension (images, favicons, etc.) — those aren't localized pages.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
