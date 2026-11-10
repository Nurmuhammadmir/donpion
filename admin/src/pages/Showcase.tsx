import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { api, resolveImageUrl } from "@/lib/api";
import type { Product } from "@/lib/types";
import ShowcaseTabs from "@/components/ShowcaseTabs";

function formatUZS(amount: number) {
  return `${new Intl.NumberFormat("ru-RU").format(amount)} сум`;
}

export default function Showcase() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Debounced live search against the same /products/admin/all?search=
  // endpoint Products.tsx used — no submit button needed, but the previous
  // request's result is kept on screen (instead of blanking the grid) so
  // typing doesn't cause a flash on every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      const qs = search ? `?search=${encodeURIComponent(search)}&limit=100` : "?limit=100";
      api<{ items: Product[] }>(`/products/admin/all${qs}`)
        .then((res) => setProducts(res.items))
        .catch(() => setProducts([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  return (
    <div>
      <ShowcaseTabs />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink">Витрина</h1>
          <p className="mt-1 text-sm text-graphite">
            {loading ? "Загрузка…" : `${products.length} ${products.length === 1 ? "товар" : "товаров"}`}
          </p>
        </div>
        <Link to="/showcase/new" className="btn-primary hidden md:inline-flex">
          + Добавить товар
        </Link>
      </div>

      <div className="relative mt-6 max-w-sm">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по названию…"
          className="input pl-10"
        />
      </div>

      {products.length > 0 ? (
        <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-12 sm:gap-x-8 lg:grid-cols-4">
          {products.map((product) => (
            <ShowcaseProductCard key={product._id} product={product} />
          ))}
        </div>
      ) : (
        !loading && <p className="mt-10 text-sm text-graphite">Товары не найдены.</p>
      )}

      {/* Mobile-only add action; desktop gets the header button above. */}
      <Link
        to="/showcase/new"
        aria-label="Добавить товар"
        className="fixed right-4 z-20 flex h-14 w-14 items-center justify-center rounded-md bg-hermes-500 text-white transition-colors hover:bg-hermes-600 md:hidden"
        style={{ bottom: "calc(64px + var(--safe-bottom) + 16px)" }}
      >
        <Plus className="h-6 w-6" />
      </Link>
    </div>
  );
}

// Mirrors the real storefront's ProductCard (client/src/components/ProductCard.tsx)
// pixel-for-pixel — same aspect ratio, badges, crossfade — but the whole
// card is the edit entry point here, plus two admin-only, unobtrusive
// signals the customer never sees: the stock count, and a dimmed/grayscale
// treatment for products hidden from the site.
function ShowcaseProductCard({ product }: { product: Product }) {
  const [active, setActive] = useState(false);
  const inactive = !product.isActive;

  return (
    <Link
      to={`/showcase/${product._id}`}
      className={`block ${inactive ? "opacity-50" : ""}`}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onTouchStart={() => setActive(true)}
      onTouchEnd={() => setActive(false)}
      onTouchCancel={() => setActive(false)}
    >
      <div className={`relative aspect-[3/4] overflow-hidden bg-hermes-50/30 ${inactive ? "grayscale" : ""}`}>
        <img
          src={resolveImageUrl(product.images[0])}
          alt={product.name}
          className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out ${
            active ? "scale-[1.04]" : ""
          }`}
        />
        {product.images[1] && (
          <img
            src={resolveImageUrl(product.images[1])}
            alt={product.name}
            className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ease-out ${
              active ? "opacity-100" : "opacity-0"
            }`}
          />
        )}
        {product.availability === "OutOfStock" && (
          <span className="absolute right-0 top-0 border border-white/70 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide2 text-white">
            Нет в наличии
          </span>
        )}
        {product.oldPrice && (
          <span className="absolute left-0 top-0 bg-navy px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide2 text-white">
            Скидка
          </span>
        )}
        {inactive && (
          <span className="absolute bottom-0 right-0 bg-ink px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide2 text-white">
            Скрыт
          </span>
        )}
      </div>

      <div className="mt-5 flex flex-col items-center px-2 text-center">
        <h3 className="font-display text-lg leading-snug tracking-luxe text-ink">{product.name}</h3>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="font-display text-base text-ink/85">{formatUZS(product.price)}</span>
          {product.oldPrice && (
            <span className="font-display text-sm text-graphite line-through">{formatUZS(product.oldPrice)}</span>
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-graphite">Остаток: {product.stock} шт.</p>
      </div>
    </Link>
  );
}
