// "2026-11-10" is a plain calendar date, not an instant — parsed as
// `new Date(str)` it's midnight UTC, which (a) excludes that entire day
// from an inclusive upper bound, since anything after 00:00 UTC on the
// last day would be cut off, and (b) silently shifts whole-day meaning
// for a non-UTC server/business like this one (Tashkent, UTC+5). Parsed
// locally and pinned to day-start/day-end instead, matching the "local
// calendar day" the client (and getOrderStats) already means.
export function parseLocalDate(str, endOfDay) {
  const [y, m, d] = str.split("-").map(Number);
  return endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d, 0, 0, 0, 0);
}

// Shared by any admin list/report that takes ?from=&to= — defaults to the
// last 30 days when omitted.
export function parseRange(query) {
  const to = query.to ? parseLocalDate(query.to, true) : new Date();
  const from = query.from ? parseLocalDate(query.from, false) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}
