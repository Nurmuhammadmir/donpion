import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Globe, ShoppingBag, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { useBranch } from "@/context/BranchContext";
import type { Order, OrderStats, WarehouseOverview } from "@/lib/types";
import { ORDER_SOURCE_LABELS, ORDER_STATUS_LABELS } from "@/lib/types";
import QuickSaleModal from "@/components/QuickSaleModal";

function formatUZS(amount: number) {
  return `${new Intl.NumberFormat("ru-RU").format(amount)} сум`;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}М`;
  }
  if (n >= 1_000) return `${Math.round(n / 1000)}К`;
  return String(n);
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ---- 14-day revenue trend, bucketed client-side from /orders (no daily-
// history endpoint exists) — keyed on local calendar date, not
// toISOString(), so a UTC+5 "today" doesn't silently shift a day.
interface TrendPoint {
  key: string;
  label: string;
  fullLabel: string;
  revenue: number;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildTrend(orders: Order[], days: number): TrendPoint[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const points: TrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    points.push({
      key: dayKey(d),
      label: d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }),
      fullLabel: d.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" }),
      revenue: 0,
    });
  }
  const byKey = new Map(points.map((p) => [p.key, p]));

  for (const order of orders) {
    if (order.status === "cancelled") continue;
    const bucket = byKey.get(dayKey(new Date(order.createdAt)));
    if (bucket) bucket.revenue += order.totalAmount;
  }
  return points;
}

function TrendTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TrendPoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="border border-hairline bg-paper px-3 py-2 text-xs">
      <p className="capitalize text-graphite">{point.fullLabel}</p>
      <p className="mt-0.5 text-sm font-semibold text-ink">{formatUZS(point.revenue)}</p>
    </div>
  );
}

export default function Dashboard() {
  const { branches, isCEO, activeBranchId, activeBranch } = useBranch();

  const [orderStats, setOrderStats] = useState<OrderStats | null>(null);
  const [lowStockCount, setLowStockCount] = useState<number | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [saleOpen, setSaleOpen] = useState(false);

  const load = () => {
    setLoading(true);
    const branchQS = activeBranchId ? `?branch=${activeBranchId}` : "";
    const ordersQS = activeBranchId ? `?branch=${activeBranchId}&limit=200` : "?limit=200";
    Promise.all([
      api<OrderStats>(`/orders/stats${branchQS}`),
      api<WarehouseOverview>(`/warehouse/overview${branchQS}`),
      api<{ items: Order[] }>(`/orders${ordersQS}`),
    ])
      .then(([os, wh, orders]) => {
        setOrderStats(os);
        setLowStockCount(wh.items.filter((i) => i.lowStock).length);
        setRecentOrders(orders.items);
      })
      .catch(() => {
        setOrderStats(null);
        setLowStockCount(null);
        setRecentOrders([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [activeBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const trend = useMemo(() => buildTrend(recentOrders, 14), [recentOrders]);
  const feed = useMemo(() => recentOrders.slice(0, 7), [recentOrders]);
  const hasLowStock = (lowStockCount ?? 0) > 0;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">{isCEO ? activeBranch?.name ?? "Все филиалы" : activeBranch?.name ?? "Филиал"}</p>
          <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">Дашборд</h1>
        </div>
        <button type="button" onClick={() => setSaleOpen(true)} className="btn-primary w-full sm:w-auto">
          <Zap className="h-4 w-4" />
          Быстрая продажа
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatTile label="Выручка сегодня" value={loading ? null : formatUZS(orderStats?.revenueToday ?? 0)} />
        <StatTile label="Заказов сегодня" value={loading ? null : String(orderStats?.ordersToday ?? 0)} />
        <StatTile
          label="Выручка за 30 дней"
          value={loading ? null : formatUZS(orderStats?.revenue30d ?? 0)}
          sub={loading ? undefined : `${orderStats?.orders30d ?? 0} заказов`}
        />
        <Link
          to="/warehouse"
          className="rounded-2xl border border-hairline bg-paper p-4 transition-colors hover:border-ink sm:p-5"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide2 text-graphite">Мало на складе</p>
          <p className={`mt-2 text-2xl font-semibold sm:text-3xl ${hasLowStock ? "text-hermes-600" : "text-ink"}`}>
            {loading ? "—" : lowStockCount ?? 0}
          </p>
          {!loading && hasLowStock && (
            <p className="mt-1 flex items-center gap-1 text-xs text-hermes-600">
              <AlertTriangle className="h-3 w-3" /> Нужно пополнить
            </p>
          )}
        </Link>
      </div>

      <div className="card mt-4">
        <div className="mb-4">
          <p className="eyebrow">Динамика</p>
          <h2 className="font-display text-lg font-semibold text-ink">Выручка за 14 дней</h2>
        </div>
        <div className="h-48 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F9511D" stopOpacity={0.16} />
                  <stop offset="100%" stopColor="#F9511D" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#E7E1D6" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#5A564F" }}
                axisLine={{ stroke: "#E7E1D6" }}
                tickLine={false}
                interval={1}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#5A564F" }}
                axisLine={false}
                tickLine={false}
                width={44}
                domain={[0, "auto"]}
                tickFormatter={formatCompact}
              />
              <Tooltip content={<TrendTooltip />} cursor={{ stroke: "#1A1A1A", strokeOpacity: 0.12 }} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#F9511D"
                strokeWidth={2}
                fill="url(#revenueFill)"
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff", fill: "#F9511D" }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card mt-4 p-0">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-ink">Последние заказы</h2>
          <Link to="/orders" className="text-sm font-medium text-hermes-600 hover:underline">
            Все заказы →
          </Link>
        </div>

        {feed.length === 0 ? (
          <p className="px-5 py-6 text-sm text-graphite">{loading ? "Загрузка…" : "Заказов пока нет."}</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {feed.map((order) => (
              <li key={order._id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-canvas text-graphite">
                  {order.source === "pos" ? <ShoppingBag className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                </span>
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium text-ink">
                    {order.customer.name} <span className="text-graphite">· {order.orderNumber}</span>
                  </p>
                  <p className="text-xs text-graphite">
                    {formatDateTime(order.createdAt)} · {ORDER_SOURCE_LABELS[order.source]}
                  </p>
                </div>
                <div className="flex-none text-right">
                  <p className="text-sm font-semibold text-ink">{formatUZS(order.totalAmount)}</p>
                  <p className="text-xs text-graphite">{ORDER_STATUS_LABELS[order.status]}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {saleOpen && (
        <QuickSaleModal
          branches={branches}
          activeBranchId={activeBranchId}
          activeBranch={activeBranch}
          isCEO={isCEO}
          onClose={() => setSaleOpen(false)}
          onSuccess={load}
        />
      )}
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string | null; sub?: string }) {
  return (
    <div className="rounded-2xl border border-hairline bg-paper p-4 sm:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide2 text-graphite">{label}</p>
      <p className="mt-2 break-words text-2xl font-semibold text-ink sm:text-3xl">{value ?? "—"}</p>
      {sub && <p className="mt-1 text-xs text-graphite">{sub}</p>}
    </div>
  );
}
