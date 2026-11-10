import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { api, resolveImageUrl } from "@/lib/api";
import type { AddonCategory, Category, Occasion, Product } from "@/lib/types";

function formatUZS(amount: number) {
  return `${new Intl.NumberFormat("ru-RU").format(amount)} сум`;
}

// /products/admin/all (unlike the single-product /products/admin/id/:id
// endpoint ProductForm uses) only populates `category` — `occasions` and
// `addonCategories` come back as plain id strings there. The shared
// Product type assumes the populated shape everywhere (correct for
// ProductForm), so this normalizes either shape down to an id instead of
// widening that type and risking ProductForm's own assumptions.
function refId(ref: { _id: string } | string): string {
  return typeof ref === "string" ? ref : ref._id;
}

// The homepage's "Клубника в шоколаде" shelf is actually keyed off the
// AddonCategory "Шоколад" (see client/src/app/[locale]/page.tsx — it's
// explicitly branded with this name on the homepage even though the
// underlying tag is the general chocolate add-on). A separate real
// Category can also exist under roughly this name purely as a content/SEO
// landing page (edited via the "Категории" link below) — excluded from
// the trailing base-category sections so it doesn't duplicate this one.
const CHOCOLATE_ADDON_SLUG = "shokolad";
const CHOCOLATE_CATEGORY_SLUG = "klubnika-v-shokolade";

interface Section {
  key: string;
  label: string;
  products: Product[];
}

export default function Showcase() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [addonCategories, setAddonCategories] = useState<AddonCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Taxonomy used only to group the grid below into sections — fetched
  // once, independent of the product search below. admin/all (not the
  // public list) on purpose: inactive entries still get a section here so
  // a product tagged into one never silently disappears from this page.
  useEffect(() => {
    api<Category[]>("/categories/admin/all").then(setCategories).catch(() => setCategories([]));
    api<Occasion[]>("/occasions/admin/all").then(setOccasions).catch(() => setOccasions([]));
    api<AddonCategory[]>("/addon-categories/admin/all").then(setAddonCategories).catch(() => setAddonCategories([]));
  }, []);

  // Debounced live search against the same /products/admin/all?search=
  // endpoint Products.tsx used — no submit button needed, but the previous
  // request's result is kept on screen (instead of blanking the grid) so
  // typing doesn't cause a flash on every keystroke. Limit bumped from 100
  // to 500 — the sectioned view below needs the whole catalog, not a page
  // of it, to group correctly.
  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      const qs = search ? `?search=${encodeURIComponent(search)}&limit=500` : "?limit=500";
      api<{ items: Product[] }>(`/products/admin/all${qs}`)
        .then((res) => setProducts(res.items))
        .catch(() => setProducts([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  // Mirrors the real homepage's order exactly (client/src/app/[locale]/page.tsx):
  // Люксовые коллекции, Клубника в шоколаде, one shelf per Occasion in
  // their stored order, then every other base Category so every product
  // stays reachable here even if it's not in one of the curated sections.
  // A product can land in several sections at once — that's correct, same
  // as the real site, not deduplicated on purpose.
  const sections = useMemo<Section[]>(() => {
    const chocolateAddon = addonCategories.find((a) => a.slug === CHOCOLATE_ADDON_SLUG);

    const curated: Section[] = [
      { key: "featured", label: "Люксовые коллекции", products: products.filter((p) => p.isFeatured) },
      {
        key: "chocolate",
        label: "Клубника в шоколаде",
        products: chocolateAddon
          ? products.filter((p) => p.addonCategories.some((a) => refId(a) === chocolateAddon._id))
          : [],
      },
    ];

    const occasionSections: Section[] = occasions.map((occasion) => ({
      key: `occasion-${occasion._id}`,
      label: occasion.name,
      products: products.filter((p) => p.occasions.some((o) => refId(o) === occasion._id)),
    }));

    const categorySections: Section[] = categories
      .filter((c) => c.slug !== CHOCOLATE_CATEGORY_SLUG)
      .map((category) => ({
        key: `category-${category._id}`,
        label: category.name,
        products: products.filter((p) => p.category?._id === category._id),
      }));

    return [...curated, ...occasionSections, ...categorySections];
  }, [products, categories, occasions, addonCategories]);

  const isSearching = search.trim().length > 0;

  return (
    <div>
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
          className="input !pl-10"
        />
      </div>

      <div className="mt-10">
        {isSearching ? (
          products.length > 0 ? (
            <ProductGrid products={products} />
          ) : (
            !loading && <p className="text-sm text-graphite">Товары не найдены.</p>
          )
        ) : (
          <div className="space-y-12">
            {sections.map((section) => (
              <ShowcaseSection key={section.key} label={section.label} products={section.products} loading={loading} />
            ))}
          </div>
        )}
      </div>

      {/* Категории/Поводы/Допы are now rare, small edits (routine tagging
          moved inline into ProductForm) — kept reachable here without
          taking up prominent tab space. */}
      <div className="mt-16 flex flex-wrap items-center gap-2 border-t border-hairline pt-6">
        <span className="text-xs text-graphite">Ещё:</span>
        <Link to="/showcase/categories" className="pill">
          Категории (контент страниц)
        </Link>
        <Link to="/showcase/occasions" className="pill">
          Поводы
        </Link>
        <Link to="/showcase/addons" className="pill">
          Допы
        </Link>
      </div>

      {/* Mobile-only add action; desktop gets the header button above. */}
      <Link
        to="/showcase/new"
        aria-label="Добавить товар"
        className="fixed right-4 z-20 flex h-14 w-14 items-center justify-center rounded-md bg-hermes-500 text-white shadow-md transition-all hover:bg-hermes-600 hover:shadow-lg active:scale-95 md:hidden"
        style={{ bottom: "calc(64px + var(--safe-bottom) + 16px)" }}
      >
        <Plus className="h-6 w-6" />
      </Link>
    </div>
  );
}

function ShowcaseSection({ label, products, loading }: { label: string; products: Product[]; loading: boolean }) {
  return (
    <section>
      <h2 className="flex items-baseline gap-2 font-display text-lg text-ink">
        {label}
        <span className="font-sans text-xs font-normal text-graphite">{loading ? "…" : `· ${products.length}`}</span>
      </h2>
      {products.length > 0 ? (
        <ProductGrid products={products} className="mt-5" />
      ) : (
        !loading && <p className="mt-3 text-sm text-graphite">Пока нет товаров.</p>
      )}
    </section>
  );
}

function ProductGrid({ products, className = "" }: { products: Product[]; className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-x-6 gap-y-12 sm:gap-x-8 lg:grid-cols-4 ${className}`}>
      {products.map((product, index) => (
        <ShowcaseProductCard key={product._id} product={product} index={index} />
      ))}
    </div>
  );
}

// Mirrors the real storefront's ProductCard (client/src/components/ProductCard.tsx)
// pixel-for-pixel — same aspect ratio, badges, crossfade — but the whole
// card is the edit entry point here, plus two admin-only, unobtrusive
// signals the customer never sees: the stock count, and a dimmed/grayscale
// treatment for products hidden from the site. The card itself presses on
// tap and its photo lifts with a soft shadow on desktop hover — the photo
// crossfade above was already animated, the card around it wasn't.
function ShowcaseProductCard({ product, index }: { product: Product; index: number }) {
  const [active, setActive] = useState(false);
  const inactive = !product.isActive;

  return (
    <Link
      to={`/showcase/${product._id}`}
      className={`anim-card group block transition-transform duration-150 ease-out active:scale-[0.97] ${inactive ? "opacity-50" : ""}`}
      style={{ animationDelay: `${Math.min(index, 11) * 0.04}s` }}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onTouchStart={() => setActive(true)}
      onTouchEnd={() => setActive(false)}
      onTouchCancel={() => setActive(false)}
    >
      <div
        className={`relative aspect-[3/4] overflow-hidden bg-hermes-50/30 transition-all duration-300 ease-out md:group-hover:-translate-y-1.5 md:group-hover:shadow-lg ${inactive ? "grayscale" : ""}`}
      >
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
