"use client";

import type { ComponentProps } from "react";
import { nav, usePathname } from "./navigation";

// A link to the page you're already on (e.g. the logo, clicked while
// scrolled down the homepage) is a no-op navigation for Next.js — the URL
// doesn't change, so nothing scrolls on its own. Scroll manually in that
// one case; every other link just uses Next.js's own default (instant)
// scroll-to-top, which pairs with template.tsx's plain opacity fade —
// deliberately NOT animating the scroll position itself, which used to
// make every navigation visibly travel up the screen first.
export function Link({ onClick, href, ...props }: ComponentProps<typeof nav.Link>) {
  const pathname = usePathname();
  const isSamePage = typeof href === "string" && href === pathname;

  return (
    <nav.Link
      href={href}
      onClick={(e) => {
        if (isSamePage) {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        onClick?.(e);
      }}
      {...props}
    />
  );
}
