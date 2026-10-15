"use client";

import { usePathname } from "next/navigation";

// Unlike layout.tsx, this remounts on every navigation. Keying by pathname
// forces a real remount (and so a fresh play of .page-transition) on every
// navigation, push or back/forward alike — plain opacity fade, no scroll
// handling: Next.js's own default (instant scroll-to-top) is what we want
// here. An earlier version animated the scroll position itself (remember
// the old Y, restore it, then glide down to 0), which read as the whole
// page visibly travelling up the screen on every click — removed.
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="page-transition">
      {children}
    </div>
  );
}
