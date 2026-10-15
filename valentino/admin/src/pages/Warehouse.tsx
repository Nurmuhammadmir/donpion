import { useEffect, useState } from "react";
import { api, ApiError, resolveImageUrl } from "@/lib/api";
import type { StockEntry, WarehouseItem, WarehouseOverview } from "@/lib/types";
import { STOCK_REASON_LABELS } from "@/lib/types";

type ActionType = "receipt" | "adjustment";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// The warehouse module: current stock per product (lowest first, so what
// needs attention is always at the top), a quick "Приход" action for stock
// coming in, a "Корректировка" action for recounts/breakage/loss, and a
// movement history feed underneath so every change to a number is
// traceable back to why it happened.
export default function Warehouse() {
  const [overview, setOverview] = useState<WarehouseOverview | null>(null);
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [formItem, setFormItem] = useState<WarehouseItem | null>(null);
  const [formType, setFormType] = useState<ActionType>("receipt");
  const [direction, setDirection] = useState<"add" | "remove">("remove");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([api<WarehouseOverview>("/warehouse/overview"), api<StockEntry[]>("/warehouse/entries?limit=40")])
      .then(([ov, en]) => {
        setOverview(ov);
        setEntries(en);
      })
      .catch(() => {
        setOverview(null);
        setEntries([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const startReceipt = (item: WarehouseItem) => {
    setFormItem(item);
    setFormType("receipt");
    setDirection("add");
    setQuantity("");
    setNote("");
    setError(null);
  };

  const startAdjustment = (item: WarehouseItem) => {
    setFormItem(item);
    setFormType("adjustment");
    setDirection("remove");
    setQuantity("");
    setNote("");
    setError(null);
  };

  const closeForm = () => setFormItem(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formItem) return;
    const magnitude = Number(quantity);
    if (!Number.isFinite(magnitude) || magnitude <= 0) {
      setError("Укажите количество больше нуля");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (formType === "receipt") {
        await api("/warehouse/receipts", {
          method: "POST",
          body: JSON.stringify({ productId: formItem._id, quantity: magnitude, note }),
        });
      } else {
        const signed = direction === "add" ? magnitude : -magnitude;
        await api("/warehouse/adjustments", {
          method: "POST",
          body: JSON.stringify({ productId: formItem._id, quantity: signed, note }),
        });
      }
      closeForm();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const lowStockCount = overview?.items.filter((i) => i.lowStock).length ?? 0;

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">Склад</h1>
      <p className="mt-1 text-sm text-graphite">
        Остатки по каждому товару, приход новых поставок и корректировки (брак, потери, пересчёт).
        Порог «мало на складе» настраивается на странице «Главная страница».
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-graphite">Товаров на складе</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{loading ? "—" : overview?.items.length ?? 0}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-graphite">Мало на складе</p>
          <p className={`mt-2 text-3xl font-semibold ${lowStockCount > 0 ? "text-hermes-600" : "text-ink"}`}>
            {loading ? "—" : lowStockCount}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-graphite">Порог «мало»</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{loading ? "—" : overview?.threshold ?? 0}</p>
        </div>
      </div>

      {formItem && (
        <form onSubmit={handleSubmit} className="card mt-6 max-w-lg space-y-4">
          <h2 className="font-medium text-ink">
            {formType === "receipt" ? "Приход" : "Корректировка"}: {formItem.name}
          </h2>

          {formType === "adjustment" && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDirection("add")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  direction === "add" ? "border-sapphire-600 bg-sapphire-50 text-sapphire-700" : "border-hairline text-graphite"
                }`}
              >
                + Добавить
              </button>
              <button
                type="button"
                onClick={() => setDirection("remove")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  direction === "remove" ? "border-hermes-500 bg-hermes-50 text-hermes-700" : "border-hairline text-graphite"
                }`}
              >
                − Списать
              </button>
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-graphite">Количество</span>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="input"
              autoFocus
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-graphite">
              Примечание
              {formType === "adjustment" && <span className="text-hermes-500"> *</span>}
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={formType === "receipt" ? "Например: поставка от поставщика" : "Например: брак при доставке, пересчёт"}
              className="input"
            />
          </label>

          {error && <p className="text-sm text-hermes-600">{error}</p>}

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Сохраняем…" : "Сохранить"}
            </button>
            <button type="button" onClick={closeForm} className="btn-secondary">
              Отмена
            </button>
          </div>
        </form>
      )}

      <div className="card mt-6 overflow-x-auto p-0">
        <table className="admin-table w-full">
          <thead>
            <tr>
              <th>Товар</th>
              <th>Категория</th>
              <th>Остаток</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {overview?.items.map((item) => (
              <tr key={item._id}>
                <td className="flex items-center gap-3">
                  {item.image && <img src={resolveImageUrl(item.image)} alt="" className="h-10 w-10 rounded-md object-cover" />}
                  <span>{item.name}</span>
                </td>
                <td>{item.category?.name ?? "—"}</td>
                <td className={item.stock <= 0 ? "font-medium text-hermes-600" : item.lowStock ? "font-medium text-amber-600" : ""}>
                  {item.stock}
                </td>
                <td>
                  {item.stock <= 0 ? (
                    <span className="text-hermes-600">Нет в наличии</span>
                  ) : item.lowStock ? (
                    <span className="text-amber-600">Мало</span>
                  ) : (
                    <span className="text-graphite">В наличии</span>
                  )}
                </td>
                <td className="text-right">
                  <button type="button" onClick={() => startReceipt(item)} className="mr-2 text-sm text-sapphire-600 hover:underline">
                    + Приход
                  </button>
                  <button type="button" onClick={() => startAdjustment(item)} className="text-sm text-graphite hover:underline">
                    Корректировка
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && (overview?.items.length ?? 0) === 0 && <p className="p-6 text-sm text-graphite">Товаров пока нет.</p>}
      </div>

      <div className="card mt-8 overflow-x-auto p-0">
        <div className="p-4 pb-0">
          <h2 className="font-medium text-ink">История движений</h2>
        </div>
        <table className="admin-table w-full">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Товар</th>
              <th>Тип</th>
              <th>Количество</th>
              <th>Примечание</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry._id}>
                <td className="whitespace-nowrap text-graphite">{formatDate(entry.createdAt)}</td>
                <td>{entry.product?.name ?? "—"}</td>
                <td>{STOCK_REASON_LABELS[entry.reason]}</td>
                <td className={entry.quantity > 0 ? "text-sapphire-700" : "text-hermes-600"}>
                  {entry.quantity > 0 ? `+${entry.quantity}` : entry.quantity}
                </td>
                <td className="text-graphite">{entry.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && entries.length === 0 && <p className="p-6 text-sm text-graphite">Движений пока не было.</p>}
      </div>
    </div>
  );
}
