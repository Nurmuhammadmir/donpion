"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { consumeRememberedScroll } from "@/lib/scrollMemory";

// Unlike layout.tsx, this remounts on every navigation. Plain template.tsx
// remounting alone is unreliable on browser back/forward — Next.js can
// reuse a segment from its router cache without remounting the template,
// so the fade never replayed on "Назад". Keying by pathname forces a real
// remount (and so a fresh play of .page-transition) on every navigation,
// push or back/forward alike.
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Runs before paint. Whatever Next.js already did with the scroll
  // position on its own, force it back to where the visitor actually was
  // (see @/i18n/navigation's Link) — invisible, since it happens before
  // the browser paints — then animate smoothly down to the top on the
  // next frame, once the new page has something real to scroll away from.
  useLayoutEffect(() => {
    const y = consumeRememberedScroll();
    if (y > 0) {
      window.scrollTo(0, y);
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }, [pathname]);

  return (
    <div key={pathname} className="page-transition">
      {children}
    </div>
  );
}
