import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { ApiError, getCustomer, updateCustomer } from "@/lib/api";
import type { Customer, ImportantDate } from "@/lib/types";
import { ORDER_STATUS_LABELS } from "@/lib/types";

function formatUZS(amount: number) {
  return `${new Intl.NumberFormat("ru-RU").format(Math.round(amount))} сум`;
}

function formatRu(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU");
}

// "ММ-ДД" (no year, stored) <-> a full date for <input type="date">
// (needs one to render/edit) — the year is thrown away either direction,
// an arbitrary leap year (2024) so Feb 29 is always a valid round trip.
function mmddToInputDate(mmdd: string) {
  return `2024-${mmdd}`;
}
function inputDateToMmdd(value: string) {
  return value.slice(5);
}

interface OrderRow {
  _id: string;
  orderNumber: string;
  createdAt: string;
  status: keyof typeof ORDER_STATUS_LABELS;
  totalAmount: number;
}

function emptyDateDraft() {
  return { occasion: "", date: mmddToInputDate("01-01"), recipient: "" };
}

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [dates, setDates] = useState<ImportantDate[]>([]);
  const [draft, setDraft] = useState(emptyDateDraft());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    getCustomer(id)
      .then((res) => {
        const data = res as { customer: Customer; orders: OrderRow[]; totalSpent: number };
        setCustomer(data.customer);
        setName(data.customer.name);
        setDates(data.customer.importantDates);
        setOrders(data.orders);
        setTotalSpent(data.totalSpent);
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Не удалось загрузить клиента"))
      .finally(() => setLoading(false));
  }, [id]);

  const addDraft = () => {
    if (!draft.occasion.trim()) return;
    setDates((prev) => [...prev, { occasion: draft.occasion.trim(), date: inputDateToMmdd(draft.date), recipient: draft.recipient.trim() }]);
    setDraft(emptyDateDraft());
  };

  const removeDate = (index: number) => setDates((prev) => prev.filter((_, i) => i !== index));

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateCustomer(id, { name, importantDates: dates });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-graphite">Загрузка…</p>;

  if (loadError || !customer) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-hermes-600">{loadError}</p>
        <button type="button" onClick={() => navigate("/customers")} className="btn-secondary">
          Назад к клиентам
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-ink">{customer.name}</h1>
        <button type="button" onClick={() => navigate("/customers")} className="text-xs font-medium text-graphite hover:text-ink">
          Назад
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="card p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-graphite">Телефон</p>
          <p className="mt-1 text-sm font-medium text-ink">{customer.phone}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-graphite">Сумма покупок</p>
          <p className="mt-1 text-sm font-medium text-ink">{formatUZS(totalSpent)}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-graphite">Пионы</p>
          <p className="mt-1 text-sm font-medium text-ink">{customer.pointsBalance}</p>
        </div>
      </div>

      <div className="card mt-5 max-w-xl">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-graphite">Имя</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </label>

        <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-graphite">Важные даты</p>
        <div className="space-y-2">
          {dates.map((d, i) => (
            <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-hairline px-3 py-2 text-sm">
              <span className="min-w-0 truncate">
                {d.occasion}
                {d.recipient ? ` — ${d.recipient}` : ""} ·{" "}
                <span className="text-graphite">{d.date.split("-").reverse().join(".")}</span>
              </span>
              <button type="button" onClick={() => removeDate(i)} aria-label="Удалить" className="flex-none text-graphite hover:text-hermes-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {dates.length === 0 && <p className="text-sm text-graphite">Дат пока нет.</p>}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input
            value={draft.occasion}
            onChange={(e) => setDraft((prev) => ({ ...prev, occasion: e.target.value }))}
            placeholder="Повод, напр. День рождения"
            className="input col-span-2 sm:col-span-2"
          />
          <input
            type="date"
            value={draft.date}
            onChange={(e) => setDraft((prev) => ({ ...prev, date: e.target.value }))}
            className="input"
          />
          <input
            value={draft.recipient}
            onChange={(e) => setDraft((prev) => ({ ...prev, recipient: e.target.value }))}
            placeholder="Кому (необяз.)"
            className="input"
          />
        </div>
        <button type="button" onClick={addDraft} disabled={!draft.occasion.trim()} className="btn-secondary mt-2">
          <Plus className="h-4 w-4" /> Добавить дату
        </button>

        {saveError && <p className="mt-3 text-sm text-hermes-600">{saveError}</p>}
        {saved && <p className="mt-3 text-sm text-sapphire-600">Сохранено.</p>}

        <div className="mt-4">
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </div>

      <p className="mb-2 mt-6 text-xs font-medium uppercase tracking-wide text-graphite">История заказов</p>
      <div className="card overflow-x-auto p-0">
        <table className="admin-table w-full">
          <thead>
            <tr>
              <th>Заказ</th>
              <th>Дата</th>
              <th>Статус</th>
              <th className="text-right">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order._id}>
                <td className="font-medium">{order.orderNumber}</td>
                <td className="whitespace-nowrap text-graphite">{formatRu(order.createdAt)}</td>
                <td>{ORDER_STATUS_LABELS[order.status]}</td>
                <td className="whitespace-nowrap text-right tabular-nums">{formatUZS(order.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && <p className="p-6 text-sm text-graphite">Заказов пока нет.</p>}
      </div>
    </div>
  );
}
