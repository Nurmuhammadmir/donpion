import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { globalSearch, resolveImageUrl } from "@/lib/api";
import type { GlobalSearchResults } from "@/lib/types";

function formatUZS(amount: number) {
  return `${new Intl.NumberFormat("ru-RU").format(Math.round(amount))} сум`;
}

const EMPTY: GlobalSearchResults = { orders: [], customers: [], products: [] };

// One box, everywhere (the sidebar on desktop, the mobile topbar) — finds
// an order by number or the customer's name/phone on it, a customer, or a
// product by name, without first having to know which section it lives
// in. Debounced-as-you-type against GET /api/admin/search.
export default function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResults>(EMPTY);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(() => {
      globalSearch(trimmed)
        .then((data) => setResults(data as GlobalSearchResults))
        .catch(() => setResults(EMPTY))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const goTo = (path: string) => {
    navigate(path);
    setOpen(false);
    setQuery("");
  };

  const hasAnyResults = results.orders.length > 0 || results.customers.length > 0 || results.products.length > 0;
  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Поиск: заказ, клиент, товар…"
          className="input !pl-9 !pr-8 text-sm"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-graphite hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-[70vh] overflow-y-auto border border-hairline bg-paper shadow-lg">
          {loading ? (
            <p className="p-4 text-sm text-graphite">Ищем…</p>
          ) : !hasAnyResults ? (
            <p className="p-4 text-sm text-graphite">Ничего не найдено.</p>
          ) : (
            <>
              {results.orders.length > 0 && (
                <div className="border-b border-hairline">
                  <p className="px-3 pt-2.5 text-xs font-medium uppercase tracking-wide text-graphite">Заказы</p>
                  {results.orders.map((o) => (
                    <button
                      key={o._id}
                      type="button"
                      onClick={() => goTo(`/orders?highlight=${o._id}`)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-canvas"
                    >
                      <span>
                        <span className="font-medium text-ink">{o.orderNumber}</span>
                        <span className="ml-2 text-graphite">
                          {o.customer.name} · {o.customer.phone}
                        </span>
                      </span>
                      <span className="flex-none tabular-nums text-graphite">{formatUZS(o.totalAmount)}</span>
                    </button>
                  ))}
                </div>
              )}

              {results.customers.length > 0 && (
                <div className="border-b border-hairline">
                  <p className="px-3 pt-2.5 text-xs font-medium uppercase tracking-wide text-graphite">Клиенты</p>
                  {results.customers.map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => goTo(`/customers/${c._id}`)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-canvas"
                    >
                      <span>
                        <span className="font-medium text-ink">{c.name}</span>
                        <span className="ml-2 text-graphite">{c.phone}</span>
                      </span>
                      <span className="flex-none text-xs text-graphite">{c.pointsBalance} Пионов</span>
                    </button>
                  ))}
                </div>
              )}

              {results.products.length > 0 && (
                <div>
                  <p className="px-3 pt-2.5 text-xs font-medium uppercase tracking-wide text-graphite">Товары</p>
                  {results.products.map((p) => (
                    <button
                      key={p._id}
                      type="button"
                      onClick={() => goTo(`/showcase/${p._id}`)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-canvas"
                    >
                      {p.images[0] && (
                        <img src={resolveImageUrl(p.images[0])} alt="" className="h-8 w-8 flex-none rounded object-cover" />
                      )}
                      <span className="flex-1 truncate font-medium text-ink">{p.name}</span>
                      <span className="flex-none tabular-nums text-graphite">{formatUZS(p.price)}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
