// Remembers the scroll position at the moment a nav Link is clicked, so
// the new page can force itself back to that exact spot before paint
// (undoing whatever Next.js already did with the scroll on its own) and
// then animate down from there — see @/i18n/navigation's Link and
// app/[locale]/template.tsx, which together make link/button navigation
// scroll smoothly instead of snapping to the top.
let lastScrollY = 0;

export function rememberScroll() {
  lastScrollY = window.scrollY;
}

export function consumeRememberedScroll(): number {
  const y = lastScrollY;
  lastScrollY = 0;
  return y;
}
