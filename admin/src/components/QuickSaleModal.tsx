import { useEffect, useState } from "react";
import { Banknote, Check, CreditCard, Minus, Plus, Search, X } from "lucide-react";
import { api, ApiError, createPosOrder, resolveImageUrl } from "@/lib/api";
import type { Branch, Order, Product } from "@/lib/types";

function formatUZS(amount: number) {
  return `${new Intl.NumberFormat("ru-RU").format(amount)} сум`;
}

// ---- "Быстрая продажа" — the headline feature: a lightweight POS so staff
// can ring up a walk-in sale without leaving the dashboard. Shared between
// Dashboard's own quick-sale button and Finance's "+" → "Продажа" entry
// point, so it lives here instead of inline in either page. ---------------

interface CartLine {
  product: Product;
  quantity: number;
}

export default function QuickSaleModal({
  branches,
  activeBranchId,
  activeBranch,
  isCEO,
  onClose,
  onSuccess,
}: {
  branches: Branch[];
  activeBranchId: string | null;
  activeBranch: Branch | null;
  isCEO: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [branchId, setBranchId] = useState<string | null>(
    () => activeBranchId ?? branches.find((b) => b.isMain)?._id ?? branches[0]?._id ?? null
  );
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

  const needsBranchPicker = isCEO && activeBranchId === null;

  useEffect(() => {
    setSearching(true);
    const handle = setTimeout(() => {
      const qs = query.trim() ? `?search=${encodeURIComponent(query.trim())}&limit=20` : "?limit=20";
      api<{ items: Product[] }>(`/products/admin/all${qs}`)
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
    if (!branchId) {
      setError("Выберите филиал продажи");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const order = (await createPosOrder({
        items: cart.map((l) => ({ productId: l.product._id, quantity: l.quantity })),
        paymentMethod,
        branchId,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
      })) as Order;
      setSuccessOrder(order);
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось оформить продажу");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-paper sm:items-center sm:justify-center sm:bg-ink/40 sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full flex-col overflow-hidden bg-paper sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-2xl sm:border sm:border-hairline"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3 sm:px-6">
          <h2 className="font-display text-lg font-semibold text-ink">Быстрая продажа</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-graphite transition-colors hover:bg-canvas hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {successOrder ? (
          <SaleConfirmation order={successOrder} onNewSale={resetForNewSale} onDone={onClose} />
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              {needsBranchPicker ? (
                branches.length === 0 ? (
                  <p className="mb-4 text-sm text-graphite">Загрузка филиалов…</p>
                ) : (
                  <div className="mb-4">
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-graphite">
                      Филиал продажи
                    </label>
                    <select value={branchId ?? ""} onChange={(e) => setBranchId(e.target.value)} className="input">
                      {branches.map((b) => (
                        <option key={b._id} value={b._id}>
                          {b.name}
                          {b.isMain ? " (основной)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              ) : (
                <p className="mb-4 text-xs text-graphite">
                  Филиал: <span className="font-medium text-ink">{activeBranch?.name ?? "—"}</span>
                </p>
              )}

              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск товара…"
                  className="input pl-9"
                />
              </div>

              <div className="max-h-56 space-y-2 overflow-y-auto sm:max-h-64">
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
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("cash")}
                    className="pill"
                    data-active={paymentMethod === "cash"}
                  >
                    <Banknote className="h-3.5 w-3.5" /> Наличными
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("card")}
                    className="pill"
                    data-active={paymentMethod === "card"}
                  >
                    <CreditCard className="h-3.5 w-3.5" /> Картой
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-graphite">
                    Клиент (необязательно)
                  </label>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Имя"
                    className="input"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-graphite">
                    Телефон (необязательно)
                  </label>
                  <input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+998 __ ___-__-__"
                    className="input"
                  />
                </div>
              </div>

              {error && <p className="mt-4 text-sm text-hermes-600">{error}</p>}
            </div>

            <div
              className="border-t border-hairline bg-paper px-4 py-3 sm:px-6"
              style={{ paddingBottom: "calc(0.75rem + var(--safe-bottom))" }}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-graphite">Итого</span>
                <span className="font-display text-xl font-semibold text-ink">{formatUZS(total)}</span>
              </div>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || cart.length === 0 || !branchId}
                className="btn-primary w-full"
              >
                {submitting ? "Оформляем…" : "Оформить продажу"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SaleConfirmation({
  order,
  onNewSale,
  onDone,
}: {
  order: Order;
  onNewSale: () => void;
  onDone: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-hermes-50 text-hermes-600">
        <Check className="h-7 w-7" />
      </span>
      <h3 className="mt-4 font-display text-xl font-semibold text-ink">Продажа оформлена</h3>
      <p className="mt-1 text-sm text-graphite">Заказ {order.orderNumber}</p>
      <p className="mt-3 text-3xl font-semibold text-ink">{formatUZS(order.totalAmount)}</p>
      <div className="mt-8 flex w-full max-w-xs flex-col gap-2">
        <button type="button" onClick={onNewSale} className="btn-primary">
          Новая продажа
        </button>
        <button type="button" onClick={onDone} className="btn-secondary">
          Готово
        </button>
      </div>
    </div>
  );
}
