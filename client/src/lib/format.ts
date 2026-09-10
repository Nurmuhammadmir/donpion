export function formatUZS(amount: number, locale: string = "ru"): string {
  // Comma as the thousands separator (not a space) — e.g. 620,000, not 620 000.
  const currency = locale === "uz" ? "so'm" : "сум";
  return `${new Intl.NumberFormat("en-US").format(amount)} ${currency}`;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}
