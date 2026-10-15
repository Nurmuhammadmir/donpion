import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import type { Category, Order, OrderStats, WarehouseOverview } from "@/lib/types";
import { ORDER_STATUS_LABELS } from "@/lib/types";

function formatUZS(amount: number) {
  return `${new Intl.NumberFormat("en-US").format(amount)} сум`;
}

export default function Dashboard() {
  const [stats, setStats] = useState<{ products: number; categories: number; orders: number } | null>(null);
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null);
  const [lowStockCount, setLowStockCount] = useState<number | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<{ total: number }>("/products/admin/all?limit=1"),
      api<Category[]>("/categories/admin/all"),
      api<{ total: number; items: Order[] }>("/orders?limit=6"),
      api<OrderStats>("/orders/stats"),
      api<WarehouseOverview>("/warehouse/overview"),
    ])
      .then(([products, categories, orders, os, warehouse]) => {
        setStats({ products: products.total, categories: categories.length, orders: orders.total });
        setRecentOrders(orders.items);
        setOrderStats(os);
        setLowStockCount(warehouse.items.filter((i) => i.lowStock).length);
      })
      .catch(() => {
        setStats(null);
        setRecentOrders([]);
        setOrderStats(null);
        setLowStockCount(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">Обзор</h1>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Товаров" value={stats?.products} loading={loading} />
        <StatCard label="Категорий" value={stats?.categories} loading={loading} />
        <StatCard label="Заказов" value={stats?.orders} loading={loading} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wide text-graphite">Продажи за 30 дней</p>
          <p className="mt-2 text-3xl font-semibold text-ink">
            {loading ? "—" : formatUZS(orderStats?.revenue30d ?? 0)}
          </p>
          <p className="mt-1 text-xs text-graphite">{loading ? "" : `${orderStats?.orders30d ?? 0} заказов`}</p>
        </div>
        <StatCard label="Заказов сегодня" value={orderStats?.ordersToday} loading={loading} />
        <Link to="/warehouse" className="card block transition-colors hover:bg-hermes-50">
          <p className="text-xs font-medium uppercase tracking-wide text-graphite">Мало на складе</p>
          <p className={`mt-2 text-3xl font-semibold ${lowStockCount ? "text-hermes-600" : "text-ink"}`}>
            {loading ? "—" : lowStockCount ?? 0}
          </p>
        </Link>
      </div>

      <div className="card mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-medium text-ink">Последние заказы</h2>
          <Link to="/orders" className="text-sm text-sapphire-600 hover:underline">
            Все заказы →
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <p className="text-sm text-graphite">{loading ? "Загрузка…" : "Заказов пока нет."}</p>
        ) : (
          <table className="admin-table w-full">
            <thead>
              <tr>
                <th>№ заказа</th>
                <th>Клиент</th>
                <th>Сумма</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order._id}>
                  <td>{order.orderNumber}</td>
                  <td>{order.customer.name}</td>
                  <td>{formatUZS(order.totalAmount)}</td>
                  <td>{ORDER_STATUS_LABELS[order.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, loading }: { label: string; value?: number; loading: boolean }) {
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wide text-graphite">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-ink">{loading ? "—" : value}</p>
    </div>
  );
}
