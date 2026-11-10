import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Flower2, Package, Search, Trash2 } from "lucide-react";
import { api, ApiError, createFlower, createPurchaseBatch, getFlowers, resolveImageUrl } from "@/lib/api";
import { useBranch } from "@/context/BranchContext";
import Modal from "@/components/Modal";
import type {
  Category,
  Flower,
  PurchaseBatch,
  PurchaseBatchItem,
  StockEntry,
  Supplier,
  WarehouseItem,
  WarehouseOverview,
} from "@/lib/types";
import { STOCK_REASON_LABELS } from "@/lib/types";

function formatUZS(amount: number) {
  return `${new Intl.NumberFormat("ru-RU").format(Math.round(amount))} сум`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function branchName(branch: PurchaseBatch["branch"]): string {
  return typeof branch === "string" ? "—" : branch.name;
}

function supplierName(supplier: PurchaseBatch["supplier"]): string {
  if (!supplier) return "Без поставщика";
  return typeof supplier === "string" ? "—" : supplier.name;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-graphite">
        {label}
        {required && <span className="text-hermes-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

type Tab = "stock" | "batches" | "suppliers";

const TABS: { id: Tab; label: string }[] = [
  { id: "stock", label: "Остатки" },
  { id: "batches", label: "Партии" },
  { id: "suppliers", label: "Поставщики" },
];

// The warehouse module: current stock + cost price per product ("Остатки"),
// the real import-costing flow for incoming shipments ("Партии"), and the
// supplier directory those shipments come from ("Поставщики") — three tabs,
// one route, no page reload between them.
export default function Warehouse() {
  const { activeBranchId } = useBranch();
  const [tab, setTab] = useState<Tab>("stock");

  const [overview, setOverview] = useState<WarehouseOverview | null>(null);
  const [entries, setEntries] = useState<StockEntry[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(true);

  const [flowers, setFlowers] = useState<Flower[]>([]);
  const [flowersLoading, setFlowersLoading] = useState(true);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);

  const [batches, setBatches] = useState<PurchaseBatch[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(true);

  const loadFlowers = () => {
    setFlowersLoading(true);
    getFlowers()
      .then((res) => setFlowers(res as Flower[]))
      .catch(() => setFlowers([]))
      .finally(() => setFlowersLoading(false));
  };

  const loadOverview = () => {
    setOverviewLoading(true);
    Promise.all([api<WarehouseOverview>("/warehouse/overview"), api<StockEntry[]>("/warehouse/entries?limit=40")])
      .then(([ov, en]) => {
        setOverview(ov);
        setEntries(en);
      })
      .catch(() => {
        setOverview(null);
        setEntries([]);
      })
      .finally(() => setOverviewLoading(false));
  };

  const loadSuppliers = () => {
    setSuppliersLoading(true);
    api<Supplier[]>("/warehouse/suppliers")
      .then(setSuppliers)
      .catch(() => setSuppliers([]))
      .finally(() => setSuppliersLoading(false));
  };

  const loadBatches = () => {
    setBatchesLoading(true);
    const qs = activeBranchId ? `?branch=${activeBranchId}&limit=50` : "?limit=50";
    api<PurchaseBatch[]>(`/warehouse/batches${qs}`)
      .then(setBatches)
      .catch(() => setBatches([]))
      .finally(() => setBatchesLoading(false));
  };

  useEffect(loadOverview, []);
  useEffect(loadFlowers, []);
  useEffect(loadSuppliers, []);
  // Batches are branch-attributed (unlike the stock overview), so they
  // reload whenever the admin switches branch in the sidebar/topbar.
  useEffect(loadBatches, [activeBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">Склад</h1>

      <div className="mt-5 flex gap-2 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="pill flex-none"
            data-active={tab === t.id ? "true" : "false"}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "stock" && (
          <StockTab
            overview={overview}
            entries={entries}
            flowers={flowers}
            flowersLoading={flowersLoading}
            loading={overviewLoading}
            onChanged={loadOverview}
          />
        )}
        {tab === "batches" && (
          <BatchesTab
            batches={batches}
            loading={batchesLoading}
            suppliers={suppliers}
            onCreated={() => {
              loadBatches();
              loadOverview();
              loadFlowers();
            }}
          />
        )}
        {tab === "suppliers" && <SuppliersTab suppliers={suppliers} loading={suppliersLoading} onChanged={loadSuppliers} />}
      </div>

      <p className="mt-8 text-xs text-graphite">
        Расходы на упаковку и зарплату — в разделе{" "}
        <Link to="/finance" className="text-sapphire-600 hover:underline">
          Финансы →
        </Link>
      </p>
    </div>
  );
}

// ---- Остатки ------------------------------------------------------------

type ActionType = "receipt" | "adjustment";

function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wide text-graphite">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${accent ? "text-hermes-600" : "text-ink"}`}>{value}</p>
    </div>
  );
}

function StockStatus({ item }: { item: WarehouseItem }) {
  if (item.stock <= 0) return <span className="pill border-hermes-100 bg-hermes-50 text-hermes-700">Нет в наличии</span>;
  if (item.lowStock) return <span className="pill border-amber-200 bg-amber-50 text-amber-700">Мало</span>;
  return <span className="pill">В наличии</span>;
}

function StockThumb({ image, size = "h-10 w-10" }: { image: string; size?: string }) {
  if (image) return <img src={resolveImageUrl(image)} alt="" className={`${size} flex-none rounded-sm object-cover`} />;
  return (
    <div className={`flex ${size} flex-none items-center justify-center rounded-sm bg-canvas text-graphite`}>
      <Package className="h-4 w-4" />
    </div>
  );
}

function flowerCategoryName(flower: Flower): string {
  return typeof flower.category === "string" ? "—" : flower.category?.name ?? "—";
}

function FlowerStatus({ flower, threshold }: { flower: Flower; threshold: number }) {
  if (flower.stock <= 0) return <span className="pill border-hermes-100 bg-hermes-50 text-hermes-700">Нет в наличии</span>;
  if (threshold > 0 && flower.stock <= threshold) return <span className="pill border-amber-200 bg-amber-50 text-amber-700">Мало</span>;
  return <span className="pill">В наличии</span>;
}

function FlowerCard({ flower, threshold, onEdit }: { flower: Flower; threshold: number; onEdit: () => void }) {
  return (
    <div className="card p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-hermes-50 text-hermes-600">
          <Flower2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{flower.name}</p>
          <p className="truncate text-xs text-graphite">{flowerCategoryName(flower)}</p>
        </div>
        <FlowerStatus flower={flower} threshold={threshold} />
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-graphite">
          Остаток:{" "}
          <span
            className={`font-medium ${
              flower.stock <= 0 ? "text-hermes-600" : threshold > 0 && flower.stock <= threshold ? "text-amber-600" : "text-ink"
            }`}
          >
            {flower.stock} {flower.unit}
          </span>
        </span>
        <span className="text-graphite">
          Себест.: <span className="font-medium text-ink">{formatUZS(flower.costPrice)}</span>
        </span>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="mt-3 w-full rounded-md border border-hairline px-3 py-2 text-xs font-medium text-graphite transition-colors hover:border-ink hover:text-ink"
      >
        Изменить
      </button>
    </div>
  );
}

function StockItemCard({
  item,
  onReceipt,
  onAdjust,
}: {
  item: WarehouseItem;
  onReceipt: (item: WarehouseItem) => void;
  onAdjust: (item: WarehouseItem) => void;
}) {
  return (
    <div className="card p-3">
      <div className="flex items-center gap-3">
        <StockThumb image={item.image} size="h-11 w-11" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{item.name}</p>
          <p className="truncate text-xs text-graphite">{item.category?.name ?? "—"}</p>
        </div>
        <StockStatus item={item} />
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-graphite">
          Остаток:{" "}
          <span className={`font-medium ${item.stock <= 0 ? "text-hermes-600" : item.lowStock ? "text-amber-600" : "text-ink"}`}>
            {item.stock}
          </span>
        </span>
        <span className="text-graphite">
          Себест.: <span className="font-medium text-ink">{formatUZS(item.costPrice)}</span>
        </span>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onReceipt(item)}
          className="flex-1 rounded-md border border-hairline px-3 py-2 text-xs font-medium text-sapphire-700 transition-colors hover:border-sapphire-600"
        >
          + Приход
        </button>
        <button
          type="button"
          onClick={() => onAdjust(item)}
          className="flex-1 rounded-md border border-hairline px-3 py-2 text-xs font-medium text-graphite transition-colors hover:border-ink hover:text-ink"
        >
          Корректировка
        </button>
      </div>
    </div>
  );
}

function StockTab({
  overview,
  entries,
  flowers,
  flowersLoading,
  loading,
  onChanged,
}: {
  overview: WarehouseOverview | null;
  entries: StockEntry[];
  flowers: Flower[];
  flowersLoading: boolean;
  loading: boolean;
  onChanged: () => void;
}) {
  const [formItem, setFormItem] = useState<WarehouseItem | null>(null);
  const [formType, setFormType] = useState<ActionType>("receipt");
  const [direction, setDirection] = useState<"add" | "remove">("remove");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingFlower, setEditingFlower] = useState<Flower | null>(null);
  const [editName, setEditName] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const startEditFlower = (flower: Flower) => {
    setEditingFlower(flower);
    setEditName(flower.name);
    setEditActive(flower.isActive);
    setEditError(null);
  };

  const submitEditFlower = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFlower) return;
    if (!editName.trim()) {
      setEditError("Укажите название");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      await api(`/flowers/${editingFlower._id}`, {
        method: "PUT",
        body: JSON.stringify({ name: editName.trim(), isActive: editActive }),
      });
      setEditingFlower(null);
      onChanged();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Не удалось сохранить");
    } finally {
      setEditSaving(false);
    }
  };

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
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const items = overview?.items ?? [];
  const lowStockCount = items.filter((i) => i.lowStock).length;
  const threshold = overview?.threshold ?? 0;

  return (
    <div>
      <div>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Цветы</h2>
          <span className="text-xs text-graphite">{flowersLoading ? "—" : `${flowers.length} позиций`}</span>
        </div>

        {/* mobile: card-per-flower */}
        <div className="mt-3 space-y-3 md:hidden">
          {flowers.map((flower) => (
            <FlowerCard key={flower._id} flower={flower} threshold={threshold} onEdit={() => startEditFlower(flower)} />
          ))}
          {!flowersLoading && flowers.length === 0 && (
            <p className="card text-sm text-graphite">Цветов пока нет — добавьте через «Партии».</p>
          )}
        </div>

        {/* desktop: table */}
        <div className="mt-3 hidden overflow-x-auto card p-0 md:block">
          <table className="admin-table w-full">
            <thead>
              <tr>
                <th>Цветок</th>
                <th>Категория</th>
                <th>Остаток</th>
                <th>Себестоимость</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {flowers.map((flower) => (
                <tr key={flower._id}>
                  <td className="flex items-center gap-3">
                    <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-hermes-50 text-hermes-600">
                      <Flower2 className="h-4 w-4" />
                    </div>
                    <span>{flower.name}</span>
                  </td>
                  <td>{flowerCategoryName(flower)}</td>
                  <td
                    className={
                      flower.stock <= 0
                        ? "font-medium text-hermes-600"
                        : threshold > 0 && flower.stock <= threshold
                          ? "font-medium text-amber-600"
                          : ""
                    }
                  >
                    {flower.stock} {flower.unit}
                  </td>
                  <td>{formatUZS(flower.costPrice)}</td>
                  <td>
                    <FlowerStatus flower={flower} threshold={threshold} />
                  </td>
                  <td className="text-right">
                    <button type="button" onClick={() => startEditFlower(flower)} className="text-sm text-sapphire-600 hover:underline">
                      Изменить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!flowersLoading && flowers.length === 0 && <p className="p-6 text-sm text-graphite">Цветов пока нет — добавьте через «Партии».</p>}
        </div>
      </div>

      {formItem && (
        <Modal onClose={closeForm}>
        <form onSubmit={handleSubmit} className="space-y-4">
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
        </Modal>
      )}

      {editingFlower && (
        <Modal onClose={() => setEditingFlower(null)}>
          <form onSubmit={submitEditFlower} className="space-y-4">
            <h2 className="font-medium text-ink">Изменить цветок</h2>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-graphite">Название</span>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} className="input" autoFocus />
            </label>

            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
              Активен
            </label>

            {editError && <p className="text-sm text-hermes-600">{editError}</p>}

            <div className="flex gap-3">
              <button type="submit" disabled={editSaving} className="btn-primary">
                {editSaving ? "Сохраняем…" : "Сохранить"}
              </button>
              <button type="button" onClick={() => setEditingFlower(null)} className="btn-secondary">
                Отмена
              </button>
            </div>
          </form>
        </Modal>
      )}

      <h2 className="mt-8 font-display text-lg font-semibold text-ink">Доп. товары</h2>

      {/* mobile: card-per-product */}
      <div className="mt-3 space-y-3 md:hidden">
        {items.map((item) => (
          <StockItemCard key={item._id} item={item} onReceipt={startReceipt} onAdjust={startAdjustment} />
        ))}
        {!loading && items.length === 0 && <p className="card text-sm text-graphite">Товаров пока нет.</p>}
      </div>

      {/* desktop: table */}
      <div className="mt-3 hidden overflow-x-auto card p-0 md:block">
        <table className="admin-table w-full">
          <thead>
            <tr>
              <th>Товар</th>
              <th>Категория</th>
              <th>Остаток</th>
              <th>Себестоимость</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item._id}>
                <td className="flex items-center gap-3">
                  <StockThumb image={item.image} />
                  <span>{item.name}</span>
                </td>
                <td>{item.category?.name ?? "—"}</td>
                <td className={item.stock <= 0 ? "font-medium text-hermes-600" : item.lowStock ? "font-medium text-amber-600" : ""}>
                  {item.stock}
                </td>
                <td>{formatUZS(item.costPrice)}</td>
                <td>
                  <StockStatus item={item} />
                </td>
                <td className="whitespace-nowrap text-right">
                  <button type="button" onClick={() => startReceipt(item)} className="mr-3 text-sm text-sapphire-600 hover:underline">
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
        {!loading && items.length === 0 && <p className="p-6 text-sm text-graphite">Товаров пока нет.</p>}
      </div>

      <div className="card mt-8 overflow-x-auto p-0">
        <div className="p-4 pb-0">
          <h2 className="font-medium text-ink">История движений</h2>
        </div>

        {/* mobile: compact stacked rows */}
        <div className="p-4 pt-3 md:hidden">
          {entries.map((entry) => (
            <div key={entry._id} className="border-b border-hairline py-3 last:border-b-0">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm text-ink">{entry.product?.name ?? entry.flower?.name ?? "—"}</span>
                <span className={`flex-none text-sm font-medium ${entry.quantity > 0 ? "text-sapphire-700" : "text-hermes-600"}`}>
                  {entry.quantity > 0 ? `+${entry.quantity}` : entry.quantity}
                </span>
              </div>
              <p className="mt-1 text-xs text-graphite">
                {STOCK_REASON_LABELS[entry.reason]} · {formatDate(entry.createdAt)}
              </p>
              {entry.note && <p className="mt-1 text-xs text-graphite">{entry.note}</p>}
            </div>
          ))}
          {!loading && entries.length === 0 && <p className="py-3 text-sm text-graphite">Движений пока не было.</p>}
        </div>

        {/* desktop: table */}
        <table className="admin-table hidden w-full md:table">
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
                <td>{entry.product?.name ?? entry.flower?.name ?? "—"}</td>
                <td>{STOCK_REASON_LABELS[entry.reason]}</td>
                <td className={entry.quantity > 0 ? "text-sapphire-700" : "text-hermes-600"}>
                  {entry.quantity > 0 ? `+${entry.quantity}` : entry.quantity}
                </td>
                <td className="text-graphite">{entry.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && entries.length === 0 && <p className="hidden p-6 text-sm text-graphite md:block">Движений пока не было.</p>}
      </div>
    </div>
  );
}

// ---- Партии ---------------------------------------------------------------

type BatchLine = {
  key: string;
  flower: Flower;
  quantity: string;
  unitCost: string;
  currency: "UZS" | "USD";
  exchangeRate: string;
};

function lineTotalUZS(line: BatchLine): number {
  const qty = Number(line.quantity) || 0;
  const cost = Number(line.unitCost) || 0;
  const rate = line.currency === "USD" ? Number(line.exchangeRate) || 0 : 1;
  return qty * cost * rate;
}

// Flowers are picked OR created right from this search box — "цветы либо
// выбираются, либо создаются". If a search finds nothing, "+ Создать
// «…»" creates it by name alone (no category, no extra step) and drops
// it straight into the batch as a line, no separate page.
function FlowerPicker({ onPick }: { onPick: (flower: Flower) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Flower[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [creatingName, setCreatingName] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(() => {
      getFlowers(term)
        .then((res) => setResults(res as Flower[]))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  const pick = (flower: Flower) => {
    onPick(flower);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const createAndPick = async (name: string) => {
    setCreatingName(name);
    setCreateError(null);
    try {
      const flower = (await createFlower({ name })) as Flower;
      pick(flower);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Не удалось создать цветок");
    } finally {
      setCreatingName(null);
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          placeholder="Название цветка…"
          className="input pl-9"
        />
      </div>
      {open && query.trim() && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-y-auto border border-hairline bg-paper">
          {searching ? (
            <p className="p-3 text-sm text-graphite">Ищем…</p>
          ) : results.length === 0 ? (
            <div className="p-3">
              <p className="text-sm text-graphite">Ничего не найдено</p>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => createAndPick(query.trim())}
                disabled={creatingName !== null}
                className="mt-1.5 text-sm font-medium text-sapphire-600 hover:underline disabled:opacity-50"
              >
                {creatingName ? "Создаём…" : `+ Создать «${query.trim()}»`}
              </button>
              {createError && <p className="mt-1 text-xs text-hermes-600">{createError}</p>}
            </div>
          ) : (
            results.map((flower) => (
              <button
                key={flower._id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(flower)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink hover:bg-canvas"
              >
                <div className="flex h-8 w-8 flex-none items-center justify-center rounded-sm bg-canvas text-hermes-600">
                  <Flower2 className="h-4 w-4" />
                </div>
                <span className="flex-1 truncate">{flower.name}</span>
                <span className="flex-none text-xs text-graphite">
                  остаток {flower.stock} {flower.unit}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function BatchLineEditor({
  line,
  onChange,
  onRemove,
}: {
  line: BatchLine;
  onChange: (patch: Partial<BatchLine>) => void;
  onRemove: () => void;
}) {
  const flower = line.flower;
  return (
    <div className="border border-hairline p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-sm bg-canvas text-hermes-600">
            <Flower2 className="h-4 w-4" />
          </div>
          <p className="truncate text-sm font-medium text-ink">{flower.name}</p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Удалить позицию"
          className="flex-none text-graphite transition-colors hover:text-hermes-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs text-graphite">Количество, {flower.unit}</span>
          <input
            type="number"
            min={1}
            value={line.quantity}
            onChange={(e) => onChange({ quantity: e.target.value })}
            className="input"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-graphite">Цена закупки, {line.currency}</span>
          <input
            type="number"
            min={0}
            value={line.unitCost}
            onChange={(e) => onChange({ unitCost: e.target.value })}
            className="input"
          />
        </label>
        <div>
          <span className="mb-1 block text-xs text-graphite">Валюта</span>
          <div className="flex gap-1.5">
            <button
              type="button"
              className="pill"
              data-active={line.currency === "UZS" ? "true" : "false"}
              onClick={() => onChange({ currency: "UZS", exchangeRate: "" })}
            >
              UZS
            </button>
            <button
              type="button"
              className="pill"
              data-active={line.currency === "USD" ? "true" : "false"}
              onClick={() => onChange({ currency: "USD", exchangeRate: "" })}
            >
              USD
            </button>
          </div>
        </div>
        {line.currency === "USD" && (
          <label className="block">
            <span className="mb-1 block text-xs text-graphite">Курс, UZS за $1</span>
            <input
              type="number"
              min={0}
              value={line.exchangeRate}
              onChange={(e) => onChange({ exchangeRate: e.target.value })}
              placeholder="Например: 12700"
              className="input"
            />
          </label>
        )}
      </div>

      <p className="mt-2 text-right text-sm text-graphite">
        Сумма: <span className="font-medium text-ink">{formatUZS(lineTotalUZS(line))}</span>
      </p>
    </div>
  );
}

function BatchForm({
  suppliers,
  onCancel,
  onSaved,
}: {
  suppliers: Supplier[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { branches, isCEO, activeBranchId, activeBranch } = useBranch();
  const [branchId, setBranchId] = useState(() => activeBranchId ?? "");
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<BatchLine[]>([]);
  // Lump-sum landed-cost overhead for the whole shipment (shipping,
  // customs, broker fees) — not any single flower's own price, but the
  // server folds it into each flower's weighted-average costPrice,
  // allocated by each item's share of raw goods value.
  const [additionalCost, setAdditionalCost] = useState("");
  const [additionalCostCurrency, setAdditionalCostCurrency] = useState<"UZS" | "USD">("UZS");
  const [additionalCostExchangeRate, setAdditionalCostExchangeRate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nextKey = useRef(0);

  const addLine = (flower: Flower) => {
    nextKey.current += 1;
    setLines((prev) => [
      ...prev,
      { key: `${flower._id}-${nextKey.current}`, flower, quantity: "1", unitCost: "", currency: "UZS", exchangeRate: "" },
    ]);
  };
  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));
  const updateLine = (key: string, patch: Partial<BatchLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const additionalCostUZS = useMemo(() => {
    const amount = Number(additionalCost) || 0;
    if (amount <= 0) return 0;
    const rate = additionalCostCurrency === "USD" ? Number(additionalCostExchangeRate) || 0 : 1;
    return amount * rate;
  }, [additionalCost, additionalCostCurrency, additionalCostExchangeRate]);

  const total = useMemo(
    () => lines.reduce((sum, l) => sum + lineTotalUZS(l), 0) + additionalCostUZS,
    [lines, additionalCostUZS],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) {
      setError("Укажите филиал");
      return;
    }
    if (lines.length === 0) {
      setError("Добавьте хотя бы одну позицию в партию");
      return;
    }
    for (const line of lines) {
      const qty = Number(line.quantity);
      const cost = Number(line.unitCost);
      if (!Number.isFinite(qty) || qty <= 0) {
        setError(`Укажите количество для «${line.flower.name}»`);
        return;
      }
      if (line.unitCost.trim() === "" || !Number.isFinite(cost) || cost < 0) {
        setError(`Укажите цену закупки для «${line.flower.name}»`);
        return;
      }
      if (line.currency === "USD" && !(Number(line.exchangeRate) > 0)) {
        setError(`Укажите курс USD для «${line.flower.name}»`);
        return;
      }
    }

    const additionalCostNum = additionalCost.trim() === "" ? 0 : Number(additionalCost);
    if (additionalCost.trim() !== "" && (!Number.isFinite(additionalCostNum) || additionalCostNum < 0)) {
      setError("Укажите корректную сумму доп. расходов");
      return;
    }
    if (additionalCostNum > 0 && additionalCostCurrency === "USD" && !(Number(additionalCostExchangeRate) > 0)) {
      setError("Укажите курс USD для доп. расходов");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createPurchaseBatch({
        branchId,
        supplierId: supplierId || null,
        invoiceNumber,
        date,
        notes,
        items: lines.map((l) => ({
          flowerId: l.flower._id,
          quantity: Number(l.quantity),
          unitCost: Number(l.unitCost),
          currency: l.currency,
          exchangeRate: l.currency === "USD" ? Number(l.exchangeRate) : undefined,
        })),
        additionalCost: additionalCostNum > 0 ? additionalCostNum : undefined,
        additionalCostCurrency: additionalCostNum > 0 ? additionalCostCurrency : undefined,
        additionalCostExchangeRate: additionalCostNum > 0 && additionalCostCurrency === "USD" ? Number(additionalCostExchangeRate) : undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить партию");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h2 className="font-medium text-ink">Новая партия</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Филиал" required>
          {isCEO ? (
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="input">
              <option value="">Выберите филиал…</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          ) : (
            <input value={activeBranch?.name ?? "—"} disabled className="input bg-canvas text-graphite" />
          )}
        </Field>

        <Field label="Поставщик">
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="input">
            <option value="">Без поставщика</option>
            {suppliers.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Номер накладной">
          <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="input" placeholder="Например: 00145" />
        </Field>

        <Field label="Дата">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        </Field>
      </div>

      <Field label="Заметка">
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input" placeholder="Необязательно" />
      </Field>

      <div>
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-graphite">Добавить цветок</span>
        <FlowerPicker onPick={addLine} />
      </div>

      {lines.length > 0 && (
        <div className="space-y-3">
          {lines.map((line) => (
            <BatchLineEditor key={line.key} line={line} onChange={(patch) => updateLine(line.key, patch)} onRemove={() => removeLine(line.key)} />
          ))}
        </div>
      )}

      <div className="border-t border-hairline pt-4">
        <Field label="Доп. расходы по партии — доставка, таможня">
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              value={additionalCost}
              onChange={(e) => setAdditionalCost(e.target.value)}
              placeholder="0"
              className="input"
            />
            <div className="flex flex-none gap-1.5">
              <button
                type="button"
                className="pill"
                data-active={additionalCostCurrency === "UZS" ? "true" : "false"}
                onClick={() => {
                  setAdditionalCostCurrency("UZS");
                  setAdditionalCostExchangeRate("");
                }}
              >
                UZS
              </button>
              <button
                type="button"
                className="pill"
                data-active={additionalCostCurrency === "USD" ? "true" : "false"}
                onClick={() => {
                  setAdditionalCostCurrency("USD");
                  setAdditionalCostExchangeRate("");
                }}
              >
                USD
              </button>
            </div>
          </div>
        </Field>
        {additionalCostCurrency === "USD" && (
          <div className="mt-3 max-w-[200px]">
            <Field label="Курс, UZS за $1">
              <input
                type="number"
                min={0}
                value={additionalCostExchangeRate}
                onChange={(e) => setAdditionalCostExchangeRate(e.target.value)}
                placeholder="Например: 12700"
                className="input"
              />
            </Field>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-hairline pt-4">
        <span className="text-sm font-medium text-ink">Итого по партии</span>
        <span className="font-display text-xl font-semibold text-ink">{formatUZS(total)}</span>
      </div>

      {error && <p className="text-sm text-hermes-600">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Сохраняем…" : "Сохранить партию"}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Отмена
        </button>
      </div>
    </form>
  );
}

function BatchLineRow({ item }: { item: PurchaseBatchItem }) {
  const flower = typeof item.flower === "string" ? null : item.flower;
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="truncate text-ink">
        {flower?.name ?? "Цветок удалён"} × {item.quantity}
        {flower?.unit ? ` ${flower.unit}` : ""}
      </span>
      <span className="flex-none text-graphite">
        {new Intl.NumberFormat("ru-RU").format(item.unitCost)} {item.currency}
        {item.currency === "USD" && ` (курс ${item.exchangeRate})`}
      </span>
    </div>
  );
}

function BatchesTab({
  batches,
  loading,
  suppliers,
  onCreated,
}: {
  batches: PurchaseBatch[];
  loading: boolean;
  suppliers: Supplier[];
  onCreated: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div>
      <div className="flex items-center justify-end gap-3">
        {!showForm && (
          <button type="button" onClick={() => setShowForm(true)} className="btn-primary flex-none">
            + Новая партия
          </button>
        )}
      </div>

      {showForm && (
        <BatchForm
          suppliers={suppliers}
          onCancel={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            onCreated();
          }}
        />
      )}

      {loading ? (
        <p className="card mt-4 text-sm text-graphite">Загрузка…</p>
      ) : batches.length === 0 ? (
        <p className="card mt-4 text-sm text-graphite">Партий пока не было. Добавьте первую через «+ Новая партия».</p>
      ) : (
        <>
          {/* mobile: card-per-batch, tap to expand */}
          <div className="mt-4 space-y-3 md:hidden">
            {batches.map((batch) => (
              <div
                key={batch._id}
                className="card cursor-pointer p-4"
                onClick={() => setExpandedId(expandedId === batch._id ? null : batch._id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{supplierName(batch.supplier)}</p>
                    <p className="mt-0.5 text-xs text-graphite">
                      {formatDateShort(batch.date)} · {branchName(batch.branch)}
                    </p>
                  </div>
                  <p className="flex-none font-display text-lg font-semibold text-ink">{formatUZS(batch.totalCostUZS)}</p>
                </div>
                <p className="mt-2 text-xs text-graphite">
                  {batch.items.length} {batch.items.length === 1 ? "позиция" : "позиций"}
                  {batch.invoiceNumber ? ` · накладная ${batch.invoiceNumber}` : ""}
                </p>
                {expandedId === batch._id && (
                  <div className="mt-3 space-y-1.5 border-t border-hairline pt-3">
                    {batch.items.map((item, idx) => (
                      <BatchLineRow key={idx} item={item} />
                    ))}
                    {batch.notes && <p className="mt-1 text-xs text-graphite">Заметка: {batch.notes}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* desktop: table with expandable detail row */}
          <div className="mt-4 hidden overflow-x-auto card p-0 md:block">
            <table className="admin-table w-full">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Поставщик</th>
                  <th>Филиал</th>
                  <th>Позиций</th>
                  <th>Итого</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <Fragment key={batch._id}>
                    <tr>
                      <td className="whitespace-nowrap text-graphite">{formatDateShort(batch.date)}</td>
                      <td>{supplierName(batch.supplier)}</td>
                      <td>{branchName(batch.branch)}</td>
                      <td>{batch.items.length}</td>
                      <td className="font-medium text-ink">{formatUZS(batch.totalCostUZS)}</td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expandedId === batch._id ? null : batch._id)}
                          className="text-sm text-sapphire-600 hover:underline"
                        >
                          {expandedId === batch._id ? "Скрыть" : "Детали"}
                        </button>
                      </td>
                    </tr>
                    {expandedId === batch._id && (
                      <tr>
                        <td colSpan={6} className="bg-canvas">
                          <div className="space-y-1.5 py-2">
                            {batch.items.map((item, idx) => (
                              <BatchLineRow key={idx} item={item} />
                            ))}
                            {batch.invoiceNumber && <p className="text-xs text-graphite">Накладная: {batch.invoiceNumber}</p>}
                            {batch.notes && <p className="text-xs text-graphite">Заметка: {batch.notes}</p>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ---- Поставщики -----------------------------------------------------------

const emptySupplierForm = { name: "", country: "", contactPerson: "", phone: "", notes: "", isActive: true };

function SuppliersTab({
  suppliers,
  loading,
  onChanged,
}: {
  suppliers: Supplier[];
  loading: boolean;
  onChanged: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptySupplierForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const startCreate = () => {
    setEditingId(null);
    setForm(emptySupplierForm);
    setShowForm(true);
    setError(null);
  };

  const startEdit = (s: Supplier) => {
    setEditingId(s._id);
    setForm({ name: s.name, country: s.country, contactPerson: s.contactPerson, phone: s.phone, notes: s.notes, isActive: s.isActive });
    setShowForm(true);
    setError(null);
  };

  const update =
    (field: "name" | "country" | "contactPerson" | "phone" | "notes") => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Укажите название поставщика");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await api(`/warehouse/suppliers/${editingId}`, { method: "PUT", body: JSON.stringify(form) });
      } else {
        await api("/warehouse/suppliers", { method: "POST", body: JSON.stringify(form) });
      }
      setShowForm(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить поставщика");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить поставщика?")) return;
    setDeleteError(null);
    try {
      await api(`/warehouse/suppliers/${id}`, { method: "DELETE" });
      onChanged();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Не удалось удалить поставщика");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-graphite">Поставщики, у которых закупаются цветы.</p>
        {!showForm && (
          <button type="button" onClick={startCreate} className="btn-primary flex-none">
            + Добавить поставщика
          </button>
        )}
      </div>
      {deleteError && <p className="mt-3 text-sm text-hermes-600">{deleteError}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="card mt-4 max-w-xl space-y-4">
          <h2 className="font-medium text-ink">{editingId ? "Редактировать поставщика" : "Новый поставщик"}</h2>

          <Field label="Название" required>
            <input required value={form.name} onChange={update("name")} className="input" placeholder="Например: Dutch Flower Group" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Страна">
              <input value={form.country} onChange={update("country")} className="input" placeholder="Нидерланды" />
            </Field>
            <Field label="Контактное лицо">
              <input value={form.contactPerson} onChange={update("contactPerson")} className="input" />
            </Field>
          </div>

          <Field label="Телефон">
            <input value={form.phone} onChange={update("phone")} className="input" placeholder="+998 71 200-00-00" />
          </Field>

          <Field label="Заметка">
            <input value={form.notes} onChange={update("notes")} className="input" placeholder="Необязательно" />
          </Field>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))} />
            Активен
          </label>

          {error && <p className="text-sm text-hermes-600">{error}</p>}

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Сохраняем…" : "Сохранить"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
              Отмена
            </button>
          </div>
        </form>
      )}

      <div className="card mt-4 overflow-x-auto p-0">
        <table className="admin-table w-full">
          <thead>
            <tr>
              <th>Поставщик</th>
              <th>Страна</th>
              <th>Контакт</th>
              <th>Телефон</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s._id}>
                <td>{s.name}</td>
                <td className="text-graphite">{s.country || "—"}</td>
                <td className="text-graphite">{s.contactPerson || "—"}</td>
                <td className="text-graphite">{s.phone || "—"}</td>
                <td>{s.isActive ? "Активен" : "Скрыт"}</td>
                <td className="whitespace-nowrap text-right">
                  <button type="button" onClick={() => startEdit(s)} className="mr-2 text-sm text-sapphire-600 hover:underline">
                    Изменить
                  </button>
                  <button type="button" onClick={() => handleDelete(s._id)} className="btn-danger">
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && suppliers.length === 0 && <p className="p-6 text-sm text-graphite">Поставщиков пока нет.</p>}
      </div>
    </div>
  );
}
