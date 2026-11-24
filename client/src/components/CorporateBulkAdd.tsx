"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useCart } from "@/components/CartProvider";
import { formatUZS } from "@/lib/format";
import type { Product } from "@/types";

interface ParsedRow {
  raw: string;
  quantity: number;
  searchText: string;
  productId: string; // "" = unmatched
}

// A trailing quantity in any of the shapes someone actually types when
// pasting a list from a chat/email: "Розы x10", "Розы х 10" (Cyrillic х),
// "Розы 10 шт", or just "Розы 10". Falls back to quantity 1 (and the
// whole line as the search text) when none of them match, rather than
// discarding the line.
function parseLine(line: string): { quantity: number; searchText: string } {
  const trimmed = line.trim().replace(/^[-•*]\s*/, ""); // strip a leading bullet, if any
  const patterns = [/^(.+?)\s*[xх×]\s*(\d+)\s*$/i, /^(.+?)\s+(\d+)\s*(?:шт\.?|штук|pcs)?\s*$/i];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m && m[1].trim()) return { searchText: m[1].trim(), quantity: Math.max(1, parseInt(m[2], 10)) };
  }
  return { searchText: trimmed, quantity: 1 };
}

// Exact name match, then substring either direction, then "how many
// whole words overlap" as a last resort — good enough for "Розовый
// закат" to find "Букет «Розовый закат»" without a real search index.
function findBestMatch(searchText: string, products: Product[]): Product | null {
  const needle = searchText.toLowerCase().trim();
  if (!needle) return null;

  const exact = products.find((p) => p.name.toLowerCase() === needle);
  if (exact) return exact;

  const substring = products.find((p) => p.name.toLowerCase().includes(needle) || needle.includes(p.name.toLowerCase()));
  if (substring) return substring;

  const needleWords = needle.split(/\s+/).filter((w) => w.length > 1);
  let best: Product | null = null;
  let bestScore = 0;
  for (const p of products) {
    const nameWords = p.name.toLowerCase().split(/\s+/);
    const score = needleWords.filter((w) => nameWords.some((nw) => nw.includes(w) || w.includes(nw))).length;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return bestScore > 0 ? best : null;
}

export default function CorporateBulkAdd({ products }: { products: Product[] }) {
  const t = useTranslations("Corporate");
  const locale = useLocale();
  const { addItem } = useCart();
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [added, setAdded] = useState(false);

  const productById = (id: string) => products.find((p) => p._id === id);

  const handleParse = () => {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    setRows(
      lines.map((line) => {
        const { quantity, searchText } = parseLine(line);
        const match = findBestMatch(searchText, products);
        return { raw: line, quantity, searchText, productId: match?._id ?? "" };
      })
    );
    setAdded(false);
  };

  const updateRow = (index: number, patch: Partial<ParsedRow>) =>
    setRows((prev) => prev?.map((r, i) => (i === index ? { ...r, ...patch } : r)) ?? null);

  const matchedCount = rows?.filter((r) => r.productId).length ?? 0;
  const total = (rows ?? []).reduce((sum, r) => {
    const p = productById(r.productId);
    return sum + (p ? p.price * r.quantity : 0);
  }, 0);

  const handleAddAll = () => {
    if (!rows) return;
    for (const row of rows) {
      const product = productById(row.productId);
      if (!product) continue;
      addItem({ productId: product._id, slug: product.slug, name: product.name, price: product.price, image: product.images[0] }, row.quantity);
    }
    setAdded(true);
    setText("");
    setRows(null);
  };

  return (
    <div className="border border-hairline p-6 sm:p-8">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between text-left">
        <span>
          <span className="font-display text-lg text-ink">{t("bulkTitle")}</span>
          <span className="mt-1 block text-sm text-graphite">{t("bulkIntro")}</span>
        </span>
        <span className="flex-none text-xs font-medium uppercase tracking-wide2 text-hermes-500">
          {expanded ? t("bulkCollapse") : t("bulkExpand")}
        </span>
      </button>

      {expanded && (
        <div className="mt-6">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("bulkPlaceholder")}
            rows={5}
            className="w-full border border-hairline bg-paper px-3 py-2.5 font-mono text-xs text-ink"
          />
          <button type="button" onClick={handleParse} disabled={!text.trim()} className="btn-outline mt-3 disabled:opacity-40">
            {t("bulkParse")}
          </button>

          {rows && rows.length > 0 && (
            <div className="mt-6">
              <p className="text-sm text-graphite">{t("bulkMatchedCount", { matched: matchedCount, total: rows.length })}</p>
              <div className="mt-3 space-y-2">
                {rows.map((row, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 border border-hairline p-2.5 text-sm">
                    <span className="min-w-[160px] flex-1 truncate text-graphite" title={row.raw}>
                      {row.raw}
                    </span>
                    <select
                      value={row.productId}
                      onChange={(e) => updateRow(i, { productId: e.target.value })}
                      className={`min-w-[180px] flex-1 border px-2 py-1.5 text-xs ${row.productId ? "border-hairline text-ink" : "border-hermes-300 text-hermes-600"}`}
                    >
                      <option value="">{t("bulkNotMatched")}</option>
                      {products.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={row.quantity}
                      onChange={(e) => updateRow(i, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                      className="w-16 flex-none border border-hairline px-2 py-1.5 text-xs text-ink"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-hairline pt-4">
                <span className="text-sm text-graphite">{t("total")}</span>
                <span className="font-display text-base text-ink">{formatUZS(total, locale)}</span>
              </div>

              <button type="button" onClick={handleAddAll} disabled={matchedCount === 0} className="btn-primary mt-4 disabled:opacity-40">
                {t("bulkAddAll", { count: matchedCount })}
              </button>
            </div>
          )}

          {added && <p className="mt-4 text-sm text-hermes-600">{t("bulkAdded")}</p>}
        </div>
      )}
    </div>
  );
}
