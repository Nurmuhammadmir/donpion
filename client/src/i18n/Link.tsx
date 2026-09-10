"use client";

import type { ComponentProps } from "react";
import { nav, usePathname } from "./navigation";
import { rememberScroll } from "@/lib/scrollMemory";

// Next.js jumps the new page to the top instantly on navigation, which
// reads as a jarring snap rather than a page turn. scroll={false} asks it
// not to — but that alone isn't reliable, so this also records where the
// visitor was right before the click; template.tsx uses that to force the
// scroll back to this exact spot the instant the new page mounts (undoing
// whatever Next did on its own) and then animates smoothly down from there.
//
// Separate file from navigation.ts (and "use client" here specifically)
// because attaching onClick makes this a real Client Component — Server
// Components like Footer.tsx can still render it (that's fine, passing
// serializable props to a client child), but can't define the handler
// themselves without this being its own client boundary.
export function Link({ scroll = false, onClick, href, ...props }: ComponentProps<typeof nav.Link>) {
  const pathname = usePathname();
  // A link to the page you're already on (e.g. the logo, clicked while
  // scrolled down the homepage) is a no-op navigation for Next.js — the
  // URL doesn't change, so template.tsx never remounts and the usual
  // scroll-to-top-on-navigate effect below never fires. From the visitor's
  // side the click just does nothing. Scroll manually in that case instead
  // of going through the remembered-scroll/template.tsx dance meant for
  // actual page changes.
  const isSamePage = typeof href === "string" && href === pathname;

  return (
    <nav.Link
      href={href}
      scroll={scroll}
      onClick={(e) => {
        if (isSamePage) {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          rememberScroll();
        }
        onClick?.(e);
      }}
      {...props}
    />
  );
}
