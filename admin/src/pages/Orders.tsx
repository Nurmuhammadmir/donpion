import { Fragment, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Order } from "@/lib/types";
import { ORDER_STATUS_LABELS } from "@/lib/types";
import OrderLocationMap from "@/components/OrderLocationMap";

function formatUZS(amount: number) {
  return `${new Intl.NumberFormat("en-US").format(amount)} сум`;
}

const STATUS_OPTIONS = Object.entries(ORDER_STATUS_LABELS) as [Order["status"], string][];

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api<{ items: Order[] }>("/orders?limit=100")
      .then((res) => setOrders(res.items))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleStatusChange = async (id: string, status: Order["status"]) => {
    const previousStatus = orders.find((o) => o._id === id)?.status;
    setStatusError(null);
    setOrders((prev) => prev.map((o) => (o._id === id ? { ...o, status } : o)));
    try {
      await api(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    } catch (err) {
      // The dropdown had already flipped optimistically — without this,
      // a rejected PATCH (network blip, invalid transition) left it
      // showing a status that was never actually saved, with no
      // indication anything went wrong.
      setOrders((prev) => prev.map((o) => (o._id === id && previousStatus ? { ...o, status: previousStatus } : o)));
      setStatusError(err instanceof ApiError ? err.message : "Не удалось изменить статус заказа");
    }
  };

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">Заказы</h1>
      {statusError && <p className="mt-3 text-sm text-hermes-600">{statusError}</p>}

      <div className="card mt-6 overflow-x-auto p-0">
        <table className="admin-table w-full">
          <thead>
            <tr>
              <th>№ заказа</th>
              <th>Дата</th>
              <th>Клиент</th>
              <th>Телефон</th>
              <th>Сумма</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <Fragment key={order._id}>
                <tr>
                  <td>{order.orderNumber}</td>
                  <td>{new Date(order.createdAt).toLocaleDateString("ru-RU")}</td>
                  <td>{order.customer.name}</td>
                  <td>{order.customer.phone}</td>
                  <td>{formatUZS(order.totalAmount)}</td>
                  <td>
                    <select
                      value={order.status}
                      onChange={(e) => handleStatusChange(order._id, e.target.value as Order["status"])}
                      className="input py-1.5"
                    >
                      {STATUS_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => setExpanded(expanded === order._id ? null : order._id)}
                      className="text-sm text-sapphire-600 hover:underline"
                    >
                      {expanded === order._id ? "Скрыть" : "Детали"}
                    </button>
                  </td>
                </tr>
                {expanded === order._id && (
                  <tr>
                    <td colSpan={7} className="bg-canvas">
                      <div className="grid gap-4 py-2 sm:grid-cols-2">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-graphite">Доставка</p>
                          {(order.deliveryDate || order.deliveryTime) && (
                            <p className="mt-1 text-sm text-ink">
                              {order.deliveryDate} {order.deliveryTime}
                            </p>
                          )}
                          {order.customer.address && (
                            <p className="mt-1 text-sm text-ink">
                              {order.customer.city}, {order.customer.address}
                            </p>
                          )}
                          {order.customer.comment && (
                            <p className="mt-1 text-sm text-graphite">Комментарий: {order.customer.comment}</p>
                          )}
                          {order.location && (
                            <div className="mt-3">
                              <OrderLocationMap lat={order.location.lat} lng={order.location.lng} />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-graphite">Состав заказа</p>
                          <ul className="mt-1 space-y-1 text-sm text-ink">
                            {order.items.map((item) => (
                              <li key={item.slug}>
                                {item.name} × {item.quantity} — {formatUZS(item.price * item.quantity)}
                              </li>
                            ))}
                          </ul>
                          {(order.pointsRedeemed > 0 || order.pointsEarned > 0) && (
                            <div className="mt-3 border-t border-hairline pt-3 text-sm text-graphite">
                              {order.pointsRedeemed > 0 && (
                                <p>
                                  Списано Пионов: <span className="text-ink">{formatUZS(order.pointsRedeemed)}</span>
                                </p>
                              )}
                              {order.pointsEarned > 0 && (
                                <p>
                                  Начислится Пионов:{" "}
                                  <span className="text-ink">
                                    {order.pointsEarned}
                                    {order.status === "completed" ? " (начислено)" : " (после завершения)"}
                                  </span>
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {!loading && orders.length === 0 && <p className="p-6 text-sm text-graphite">Заказов пока нет.</p>}
      </div>
    </div>
  );
}
