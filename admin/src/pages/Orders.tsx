import { Fragment, lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Globe, MapPin, Store } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Branch, Order } from "@/lib/types";
import { ORDER_SOURCE_LABELS, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/types";
import { useBranch } from "@/context/BranchContext";
import { Skeleton } from "@/components/Skeleton";

// mapbox-gl alone is ~500KB gzipped — on a static top-level import, every
// visit to Заказы had to fetch it immediately even though a map only ever
// renders once a specific order with a location is actually expanded. This
// way it's only fetched the first time that actually happens.
const OrderLocationMap = lazy(() => import("@/components/OrderLocationMap"));

function formatUZS(amount: number) {
  return `${new Intl.NumberFormat("ru-RU").format(amount)} сум`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU");
}

// branch comes back from the API as a bare ObjectId string (getOrders
// doesn't populate it) — resolved against the branch list BranchContext
// already loaded, rather than trusting it to ever arrive pre-populated.
function resolveBranchName(order: Order, branches: Branch[]): string | null {
  const branch = order.branch;
  if (!branch) return null;
  if (typeof branch === "string") return branches.find((b) => b._id === branch)?.name ?? null;
  return branch.name;
}

const STATUS_OPTIONS = Object.entries(ORDER_STATUS_LABELS) as [Order["status"], string][];
const STATUS_FILTERS: Array<Order["status"] | "all"> = ["all", ...STATUS_OPTIONS.map(([value]) => value)];

const LABEL_CLASS = "text-xs font-medium uppercase tracking-wide text-graphite";

// Status color-coding, kept strictly within the brand's hermes/navy/ink/
// graphite tokens (no green/red) — a progression from "needs attention"
// (hermes) through "acknowledged" (navy) to a filled, solid tag once it's
// actually done, with cancelled fading back to neutral graphite.
const STATUS_STYLES: Record<Order["status"], string> = {
  new: "border-hermes-300 bg-hermes-50 text-hermes-700",
  confirmed: "border-navy/25 bg-navy/5 text-navy",
  delivering: "border-hermes-500 bg-hermes-500 text-white",
  completed: "border-ink bg-ink text-white",
  cancelled: "border-hairline bg-canvas text-graphite",
};

const PAYMENT_STATUS_STYLES: Record<Order["paymentStatus"], string> = {
  paid: "text-ink font-medium",
  pending: "text-graphite",
  failed: "text-hermes-600 font-medium",
};

const FULFILLMENT_LABELS: Record<NonNullable<Order["fulfillmentMethod"]>, string> = {
  delivery: "Доставка",
  pickup: "Самовывоз",
  in_store: "Продажа в магазине",
};

// The colored status control doubles as the status badge the brief asks
// for — built from plain utilities rather than the shared `.input`/`.pill`
// classes, since those hardcode their own border/text colors that a
// same-specificity utility on the same element can't actually override.
function StatusSelect({ status, onChange }: { status: Order["status"]; onChange: (status: Order["status"]) => void }) {
  return (
    <div
      className={`relative inline-flex items-center rounded-sm border transition-colors focus-within:ring-2 focus-within:ring-hermes-50 ${STATUS_STYLES[status]}`}
    >
      <select
        value={status}
        onChange={(e) => onChange(e.target.value as Order["status"])}
        aria-label="Статус заказа"
        className="appearance-none bg-transparent py-1.5 pl-2.5 pr-7 text-xs font-medium outline-none"
      >
        {STATUS_OPTIONS.map(([value, label]) => (
          <option key={value} value={value} className="text-ink">
            {label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5" />
    </div>
  );
}

function SourceTag({ source }: { source: Order["source"] }) {
  const isPos = source === "pos";
  const Icon = isPos ? Store : Globe;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] font-medium ${
        isPos ? "border-navy/20 bg-navy/10 text-navy" : "border-hairline text-graphite"
      }`}
    >
      <Icon className="h-3 w-3" />
      {ORDER_SOURCE_LABELS[source]}
    </span>
  );
}

function BranchTag({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-graphite">
      <MapPin className="h-3 w-3 flex-none" />
      {name}
    </span>
  );
}

function OrderDetail({ order, branches }: { order: Order; branches: Branch[] }) {
  const method = order.fulfillmentMethod ?? "delivery";
  const resolvedBranch = resolveBranchName(order, branches);

  return (
    <div className="grid gap-5 py-3 sm:grid-cols-2">
      <div>
        <p className={LABEL_CLASS}>{FULFILLMENT_LABELS[method]}</p>
        {(order.deliveryDate || order.deliveryTime) && (
          <p className="mt-1 text-sm text-ink">
            {order.deliveryDate} {order.deliveryTime}
          </p>
        )}
        {method === "pickup" && order.pickupBranch?.name && (
          <p className="mt-1 text-sm text-ink">
            {order.pickupBranch.name}, {order.pickupBranch.address}
          </p>
        )}
        {method === "in_store" && resolvedBranch && <p className="mt-1 text-sm text-ink">{resolvedBranch}</p>}
        {method === "delivery" && order.customer.address && (
          <p className="mt-1 text-sm text-ink">
            {order.customer.city}, {order.customer.address}
          </p>
        )}
        {order.customer.comment && <p className="mt-1 text-sm text-graphite">Комментарий: {order.customer.comment}</p>}

        <p className={`mt-4 ${LABEL_CLASS}`}>Оплата</p>
        <p className="mt-1 text-sm text-ink">
          {PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod}
          {order.paymentMethod === "online" && (
            <span className={`ml-1 ${PAYMENT_STATUS_STYLES[order.paymentStatus]}`}>
              — {PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus}
            </span>
          )}
        </p>

        {order.location && (
          <div className="mt-4">
            <Suspense fallback={<Skeleton className="h-40 w-full rounded-lg" />}>
              <OrderLocationMap lat={order.location.lat} lng={order.location.lng} />
            </Suspense>
          </div>
        )}
      </div>

      <div>
        <p className={LABEL_CLASS}>Состав заказа</p>
        <ul className="mt-1.5 space-y-1.5 text-sm text-ink">
          {order.items.map((item) => (
            <li key={item.slug} className="flex items-center justify-between gap-3">
              <span>
                {item.name} × {item.quantity}
              </span>
              <span className="flex-none text-graphite">{formatUZS(item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>

        {(order.pointsRedeemed > 0 || order.pointsEarned > 0) && (
          <div className="mt-4 border-t border-hairline pt-3 text-sm text-graphite">
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
  );
}

function OrderCard({
  order,
  branches,
  showBranch,
  expanded,
  onToggle,
  onStatusChange,
}: {
  order: Order;
  branches: Branch[];
  showBranch: boolean;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (status: Order["status"]) => void;
}) {
  const resolvedBranch = showBranch ? resolveBranchName(order, branches) : null;

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-base font-semibold text-ink">{order.orderNumber}</p>
          <p className="mt-0.5 text-xs text-graphite">{formatDate(order.createdAt)}</p>
        </div>
        <StatusSelect status={order.status} onChange={onStatusChange} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{order.customer.name}</p>
          <p className="text-xs text-graphite">{order.customer.phone}</p>
        </div>
        <p className="flex-none text-base font-semibold text-ink">{formatUZS(order.totalAmount)}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <SourceTag source={order.source} />
        {resolvedBranch && <BranchTag name={resolvedBranch} />}
      </div>

      <button
        type="button"
        onClick={onToggle}
        className="mt-3 flex w-full items-center justify-center gap-1 border-t border-hairline pt-3 text-sm font-medium text-hermes-600 transition-colors hover:text-hermes-700"
      >
        {expanded ? "Скрыть детали" : "Детали заказа"}
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {expanded && (
        <div className="border-t border-hairline">
          <OrderDetail order={order} branches={branches} />
        </div>
      )}
    </div>
  );
}

export default function Orders() {
  const { activeBranchId, isCEO, branches } = useBranch();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<Order["status"] | "all">("all");

  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams({ limit: "100" });
    if (activeBranchId) qs.set("branch", activeBranchId);
    api<{ items: Order[] }>(`/orders?${qs.toString()}`)
      .then((res) => setOrders(res.items))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  };

  // Refetch when the branch switcher changes (CEO flipping between branches
  // or "all branches") — status, by contrast, is filtered client-side below
  // so switching tabs is instant instead of a round trip every click.
  useEffect(load, [activeBranchId]);

  const counts = useMemo(() => {
    const base = { all: orders.length } as Record<Order["status"] | "all", number>;
    STATUS_OPTIONS.forEach(([value]) => {
      base[value] = 0;
    });
    orders.forEach((order) => {
      base[order.status] += 1;
    });
    return base;
  }, [orders]);

  const filteredOrders = useMemo(
    () => (statusFilter === "all" ? orders : orders.filter((order) => order.status === statusFilter)),
    [orders, statusFilter]
  );

  // Showing per-order branch is only useful in the CEO's aggregate view —
  // once a single branch is selected every row is that branch, so the
  // column would just repeat the same name.
  const showBranchColumn = isCEO && activeBranchId === null;
  const columnCount = showBranchColumn ? 8 : 7;

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

  const toggleExpanded = (id: string) => setExpanded((prev) => (prev === id ? null : id));

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">Заказы</h1>
      <p className="mt-1 text-sm text-graphite">
        {loading
          ? "Загрузка…"
          : statusFilter === "all"
            ? `${orders.length} заказов`
            : `${filteredOrders.length} из ${orders.length}`}
      </p>

      {statusError && (
        <p className="mt-3 border border-hermes-300 bg-hermes-50 px-3 py-2 text-sm text-hermes-700">{statusError}</p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatusFilter(value)}
            data-active={statusFilter === value}
            className="pill"
          >
            {value === "all" ? "Все" : ORDER_STATUS_LABELS[value]}
            <span className="opacity-60">{counts[value]}</span>
          </button>
        ))}
      </div>

      {/* Mobile: a real card list, not a shrunk table. */}
      <div className="mt-5 space-y-3 md:hidden">
        {filteredOrders.map((order) => (
          <OrderCard
            key={order._id}
            order={order}
            branches={branches}
            showBranch={showBranchColumn}
            expanded={expanded === order._id}
            onToggle={() => toggleExpanded(order._id)}
            onStatusChange={(status) => handleStatusChange(order._id, status)}
          />
        ))}
        {loading && filteredOrders.length === 0 && (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-7 w-24 flex-none rounded-full" />
                </div>
              </div>
            ))}
          </>
        )}
        {!loading && filteredOrders.length === 0 && (
          <p className="card text-center text-sm text-graphite">
            {orders.length === 0 ? "Заказов пока нет." : "Заказов с таким статусом не найдено."}
          </p>
        )}
      </div>

      {/* Desktop: full table. */}
      <div className="card mt-5 hidden overflow-x-auto p-0 md:block">
        <table className="admin-table w-full">
          <thead>
            <tr>
              <th>№ заказа</th>
              <th>Дата</th>
              <th>Клиент</th>
              {showBranchColumn && <th>Филиал</th>}
              <th>Источник</th>
              <th className="text-right">Сумма</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => {
              const resolvedBranch = showBranchColumn ? resolveBranchName(order, branches) : null;
              return (
                <Fragment key={order._id}>
                  <tr>
                    <td className="font-medium">{order.orderNumber}</td>
                    <td className="whitespace-nowrap">{formatDate(order.createdAt)}</td>
                    <td>
                      <div>{order.customer.name}</div>
                      <div className="text-xs text-graphite">{order.customer.phone}</div>
                    </td>
                    {showBranchColumn && (
                      <td>{resolvedBranch ? <BranchTag name={resolvedBranch} /> : <span className="text-graphite">—</span>}</td>
                    )}
                    <td>
                      <SourceTag source={order.source} />
                    </td>
                    <td className="whitespace-nowrap text-right font-medium">{formatUZS(order.totalAmount)}</td>
                    <td>
                      <StatusSelect status={order.status} onChange={(status) => handleStatusChange(order._id, status)} />
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(order._id)}
                        className="inline-flex items-center gap-1 text-sm font-medium text-hermes-600 hover:text-hermes-700"
                      >
                        {expanded === order._id ? "Скрыть" : "Детали"}
                        {expanded === order._id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    </td>
                  </tr>
                  {expanded === order._id && (
                    <tr>
                      <td colSpan={columnCount} className="bg-canvas">
                        <OrderDetail order={order} branches={branches} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {loading &&
              filteredOrders.length === 0 &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={columnCount} className="py-3.5">
                    <Skeleton className="h-4 w-full" />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!loading && filteredOrders.length === 0 && (
          <p className="p-6 text-sm text-graphite">
            {orders.length === 0 ? "Заказов пока нет." : "Заказов с таким статусом не найдено."}
          </p>
        )}
      </div>
    </div>
  );
}
