import { useEffect, useState } from "react";
import { Flower2 } from "lucide-react";
import { getStockFlowers, getStockOverview } from "@/lib/api";
import type { Flower, WarehouseOverview } from "@/lib/types";
import { FLOWER_TYPE_LABELS } from "@/lib/types";

function formatUZS(amount: number) {
  return `${new Intl.NumberFormat("ru-RU").format(Math.round(amount))} сум`;
}

function flowerCategoryName(flower: Flower): string {
  if (!flower.category) return "—";
  return typeof flower.category === "string" ? "—" : flower.category.name;
}

// Read-only — no receipt/adjustment/write-off actions here (those stay
// admin-only; there's nothing to mutate stock through under /api/manager
// on the server either, so this page couldn't do it even if it tried).
export default function Stock() {
  const [flowers, setFlowers] = useState<Flower[]>([]);
  const [flowersLoading, setFlowersLoading] = useState(true);
  const [overview, setOverview] = useState<WarehouseOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  useEffect(() => {
    getStockFlowers()
      .then(setFlowers)
      .catch(() => setFlowers([]))
      .finally(() => setFlowersLoading(false));
    getStockOverview()
      .then(setOverview)
      .catch(() => setOverview(null))
      .finally(() => setOverviewLoading(false));
  }, []);

  const items = overview?.items ?? [];
  const threshold = overview?.threshold ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl font-semibold text-ink">Цветы</h1>
          <span className="text-xs text-graphite">{flowersLoading ? "—" : `${flowers.length} позиций`}</span>
        </div>

        <div className="mt-3 space-y-3 md:hidden">
          {flowers.map((flower) => (
            <div key={flower._id} className="card space-y-1 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink">{flower.name}</span>
                <span
                  className={
                    flower.stock <= 0
                      ? "text-sm font-medium text-hermes-600"
                      : threshold > 0 && flower.stock <= threshold
                        ? "text-sm font-medium text-amber-600"
                        : "text-sm text-ink"
                  }
                >
                  {flower.stock} {flower.unit}
                </span>
              </div>
              <p className="text-xs text-graphite">
                {flowerCategoryName(flower)} · {FLOWER_TYPE_LABELS[flower.type]}
              </p>
            </div>
          ))}
          {!flowersLoading && flowers.length === 0 && <p className="card text-sm text-graphite">Цветов пока нет.</p>}
          {flowersLoading && flowers.length === 0 && <p className="card text-sm text-graphite">Загрузка…</p>}
        </div>

        <div className="mt-3 hidden overflow-x-auto card p-0 md:block">
          <table className="admin-table w-full">
            <thead>
              <tr>
                <th>Цветок</th>
                <th>Категория</th>
                <th>Остаток</th>
                <th>Себестоимость</th>
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
                  <td>
                    {flowerCategoryName(flower)} · {FLOWER_TYPE_LABELS[flower.type]}
                  </td>
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
                </tr>
              ))}
            </tbody>
          </table>
          {!flowersLoading && flowers.length === 0 && <p className="p-6 text-sm text-graphite">Цветов пока нет.</p>}
          {flowersLoading && flowers.length === 0 && <p className="p-6 text-sm text-graphite">Загрузка…</p>}
        </div>
      </div>

      <div>
        <h2 className="font-display text-xl font-semibold text-ink">Доп. товары</h2>

        <div className="mt-3 space-y-3 md:hidden">
          {items.map((item) => (
            <div key={item._id} className="card space-y-1 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink">{item.name}</span>
                <span className={item.stock <= 0 ? "text-sm font-medium text-hermes-600" : item.lowStock ? "text-sm font-medium text-amber-600" : "text-sm text-ink"}>
                  {item.stock}
                </span>
              </div>
              <p className="text-xs text-graphite">{item.category?.name ?? "—"}</p>
            </div>
          ))}
          {!overviewLoading && items.length === 0 && <p className="card text-sm text-graphite">Товаров пока нет.</p>}
          {overviewLoading && items.length === 0 && <p className="card text-sm text-graphite">Загрузка…</p>}
        </div>

        <div className="mt-3 hidden overflow-x-auto card p-0 md:block">
          <table className="admin-table w-full">
            <thead>
              <tr>
                <th>Товар</th>
                <th>Категория</th>
                <th>Остаток</th>
                <th>Себестоимость</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id}>
                  <td>{item.name}</td>
                  <td>{item.category?.name ?? "—"}</td>
                  <td className={item.stock <= 0 ? "font-medium text-hermes-600" : item.lowStock ? "font-medium text-amber-600" : ""}>
                    {item.stock}
                  </td>
                  <td>{formatUZS(item.costPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!overviewLoading && items.length === 0 && <p className="p-6 text-sm text-graphite">Товаров пока нет.</p>}
          {overviewLoading && items.length === 0 && <p className="p-6 text-sm text-graphite">Загрузка…</p>}
        </div>
      </div>
    </div>
  );
}
