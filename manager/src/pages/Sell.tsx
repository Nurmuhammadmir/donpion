import { useEffect, useState } from "react";
import { Banknote, Check, CreditCard, Minus, Plus, Search, X } from "lucide-react";
import { ApiError, createManagerSale, resolveImageUrl, searchManagerProducts } from "@/lib/api";
import type { Order, Product } from "@/lib/types";

function formatUZS(amount: number) {
  return `${new Intl.NumberFormat("ru-RU").format(amount)} сум`;
}

interface CartLine {
  product: Product;
  quantity: number;
}

// Trimmed from admin/src/components/QuickSaleModal.tsx: a full page instead
// of a modal, and no branch picker at all — a manager's branch is fixed and
// the server forces it server-side (createManagerSale's payload has no
// branchId field), there is nothing to choose here.
export default function Sell() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);

  useEffect(() => {
    setSearching(true);
    const handle = setTimeout(() => {
      searchManagerProducts(query)
        .then((res) => setResults(res.items.filter((p) => p.isActive)))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const total = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const totalItems = cart.reduce((sum, line) => sum + line.quantity, 0);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.product._id === product._id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const changeQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.product._id === productId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    );
  };

  const removeLine = (productId: string) => setCart((prev) => prev.filter((l) => l.product._id !== productId));

  const resetForNewSale = () => {
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setPaymentMethod("cash");
    setQuery("");
    setSuccessOrder(null);
    setError(null);
  };

  const handleSubmit = async () => {
    if (cart.length === 0) {
      setError("Добавьте хотя бы один товар");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const order = await createManagerSale({
        items: cart.map((l) => ({ productId: l.product._id, quantity: l.quantity })),
        paymentMethod,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
      });
      setSuccessOrder(order);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось оформить продажу");
    } finally {
      setSubmitting(false);
    }
  };

  if (successOrder) {
    return <SaleConfirmation order={successOrder} onNewSale={resetForNewSale} />;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 font-display text-xl font-semibold text-ink">Продажа</h1>

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск товара…"
          className="input !pl-10"
        />
      </div>

      <div className="max-h-64 space-y-2 overflow-y-auto">
        {searching && results.length === 0 ? (
          <p className="px-1 py-2 text-sm text-graphite">Поиск…</p>
        ) : results.length === 0 ? (
          <p className="px-1 py-2 text-sm text-graphite">Ничего не найдено.</p>
        ) : (
          results.map((p) => (
            <button
              key={p._id}
              type="button"
              onClick={() => addToCart(p)}
              className="flex w-full items-center gap-3 rounded-xl border border-hairline bg-paper p-2.5 text-left transition-colors hover:border-hermes-500"
            >
              <img src={resolveImageUrl(p.images[0])} alt="" className="h-11 w-11 flex-none rounded-md object-cover" />
              <span className="flex-1 overflow-hidden">
                <span className="block truncate text-sm font-medium text-ink">{p.name}</span>
                <span className="block text-xs text-graphite">
                  {formatUZS(p.price)} · остаток {p.stock}
                </span>
              </span>
              <Plus className="h-4 w-4 flex-none text-hermes-600" />
            </button>
          ))
        )}
      </div>

      <div className="mt-5">
        <p className="eyebrow mb-2">Корзина{totalItems > 0 ? ` · ${totalItems}` : ""}</p>
        {cart.length === 0 ? (
          <p className="rounded-xl border border-dashed border-hairline p-4 text-center text-sm text-graphite">
            Добавьте товары из поиска выше
          </p>
        ) : (
          <ul className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline">
            {cart.map((line) => (
              <li key={line.product._id} className="flex items-center gap-3 p-2.5">
                <img
                  src={resolveImageUrl(line.product.images[0])}
                  alt=""
                  className="h-10 w-10 flex-none rounded-md object-cover"
                />
                <span className="flex-1 overflow-hidden">
                  <span className="block truncate text-sm font-medium text-ink">{line.product.name}</span>
                  <span className="block text-xs text-graphite">{formatUZS(line.product.price)}</span>
                </span>
                <div className="flex flex-none items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => changeQty(line.product._id, -1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-hairline text-graphite transition-colors hover:border-ink hover:text-ink"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-6 text-center text-sm font-medium text-ink">{line.quantity}</span>
                  <button
                    type="button"
                    onClick={() => changeQty(line.product._id, 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-hairline text-graphite transition-colors hover:border-ink hover:text-ink"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="w-24 flex-none text-right text-sm font-semibold text-ink">
                  {formatUZS(line.product.price * line.quantity)}
                </span>
                <button
                  type="button"
                  onClick={() => removeLine(line.product._id)}
                  className="flex-none text-graphite transition-colors hover:text-hermes-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5">
        <p className="eyebrow mb-2">Оплата</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setPaymentMethod("cash")} className="pill" data-active={paymentMethod === "cash"}>
            <Banknote className="h-3.5 w-3.5" /> Наличными
          </button>
          <button type="button" onClick={() => setPaymentMethod("card")} className="pill" data-active={paymentMethod === "card"}>
            <CreditCard className="h-3.5 w-3.5" /> Картой
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-graphite">Клиент (необязательно)</label>
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Имя" className="input" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-graphite">Телефон (необязательно)</label>
          <input
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="+998 __ ___-__-__"
            className="input"
          />
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-hermes-600">{error}</p>}

      <div className="mt-6 flex items-center justify-between rounded-xl border border-hairline bg-paper p-4">
        <span className="text-sm text-graphite">Итого</span>
        <span className="font-display text-xl font-semibold text-ink">{formatUZS(total)}</span>
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || cart.length === 0}
        className="btn-primary mt-3 w-full"
      >
        {submitting ? "Оформляем…" : "Оформить продажу"}
      </button>
    </div>
  );
}

function SaleConfirmation({ order, onNewSale }: { order: Order; onNewSale: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-hermes-50 text-hermes-600">
        <Check className="h-7 w-7" />
      </span>
      <h3 className="mt-4 font-display text-xl font-semibold text-ink">Продажа оформлена</h3>
      <p className="mt-1 text-sm text-graphite">Заказ {order.orderNumber}</p>
      <p className="mt-3 text-3xl font-semibold text-ink">{formatUZS(order.totalAmount)}</p>
      <button type="button" onClick={onNewSale} className="btn-primary mt-8 w-full max-w-xs">
        Новая продажа
      </button>
    </div>
  );
}
