// A page-level `alternates: { canonical }` REPLACES the root layout's own
// `alternates.languages` entirely (Next.js doesn't deep-merge `alternates`
// across segments) — so every page that set only `canonical` was silently
// dropping the ru/uz hreflang links the layout otherwise provides on the
// homepage. This rebuilds both together from one relative path so no page
// has to repeat (or forget) the languages mapping.
export function localeAlternates(path: string) {
  return {
    canonical: path,
    languages: { ru: path, uz: `/uz${path}` },
  };
}
