import { useEffect, useState } from "react";
import { Camera, MessageCircle, ShoppingBag } from "lucide-react";
import { ApiError, getManagerLeads, getManagerOrders, updateManagerLeadStatus } from "@/lib/api";
import type { Lead, LeadStatus, Order } from "@/lib/types";
import { LEAD_STATUS_LABELS } from "@/lib/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatUZS(amount: number) {
  return `${new Intl.NumberFormat("ru-RU").format(Math.round(amount))} сум`;
}

// A lead row is either a real Lead document (site_form/instagram) or a
// just-placed, unconfirmed online Order (status:"new") shown here as a
// signal only — see the plan: confirming/advancing a real order stays in
// admin/, this page never changes an order's own status.
type Row =
  | { kind: "lead"; at: string; lead: Lead }
  | { kind: "order"; at: string; order: Order };

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "site_form" | "instagram" | "order">("all");

  const load = () => {
    setLoading(true);
    Promise.all([
      getManagerLeads({}).catch(() => [] as Lead[]),
      getManagerOrders({ status: "new" }).catch(() => ({ items: [] as Order[], total: 0 })),
    ])
      .then(([l, o]) => {
        setLeads(l);
        setOrders(o.items);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const rows: Row[] = [
    ...leads.map((lead): Row => ({ kind: "lead", at: lead.createdAt, lead })),
    ...orders.map((order): Row => ({ kind: "order", at: order.createdAt, order })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const filtered = rows.filter((row) => {
    if (filter === "all") return true;
    if (row.kind === "order") return filter === "order";
    return row.lead.channel === filter;
  });

  const changeStatus = async (lead: Lead, status: LeadStatus) => {
    try {
      await updateManagerLeadStatus(lead._id, status);
      setLeads((prev) => prev.map((l) => (l._id === lead._id ? { ...l, status } : l)));
    } catch (err) {
      // Best-effort — a failed status change just leaves the row as it
      // was, nothing else on the page depends on it.
      console.error(err instanceof ApiError ? err.message : err);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 font-display text-xl font-semibold text-ink">Лиды</h1>

      <div className="mb-4 flex gap-2 overflow-x-auto no-scrollbar">
        <button type="button" onClick={() => setFilter("all")} className="pill" data-active={filter === "all"}>
          Все
        </button>
        <button type="button" onClick={() => setFilter("site_form")} className="pill" data-active={filter === "site_form"}>
          С сайта
        </button>
        <button type="button" onClick={() => setFilter("instagram")} className="pill" data-active={filter === "instagram"}>
          Instagram
        </button>
        <button type="button" onClick={() => setFilter("order")} className="pill" data-active={filter === "order"}>
          Новые заказы
        </button>
      </div>

      {loading && rows.length === 0 && <p className="card text-sm text-graphite">Загрузка…</p>}
      {!loading && filtered.length === 0 && <p className="card text-sm text-graphite">Пока ничего нет.</p>}

      <ul className="space-y-3">
        {filtered.map((row) =>
          row.kind === "order" ? (
            <li key={`order-${row.order._id}`} className="card flex items-start gap-3">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-sapphire-50 text-sapphire-700">
                <ShoppingBag className="h-4 w-4" />
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink">
                    Заказ {row.order.orderNumber} · {row.order.customer.name}
                  </span>
                  <span className="flex-none text-xs text-graphite">{formatDate(row.order.createdAt)}</span>
                </div>
                <p className="mt-1 text-xs text-graphite">{row.order.customer.phone}</p>
                <p className="mt-1 text-sm text-ink">{formatUZS(row.order.totalAmount)} · новый, необработан</p>
              </div>
            </li>
          ) : (
            <li key={`lead-${row.lead._id}`} className="card flex items-start gap-3">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-hermes-50 text-hermes-600">
                {row.lead.channel === "instagram" ? <Camera className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink">
                    {row.lead.channel === "instagram" ? row.lead.instagramUsername || "Instagram" : row.lead.name || "Без имени"}
                  </span>
                  <span className="flex-none text-xs text-graphite">{formatDate(row.lead.createdAt)}</span>
                </div>
                {row.lead.phone && <p className="mt-1 text-xs text-graphite">{row.lead.phone}</p>}
                {row.lead.message && <p className="mt-1 text-sm text-ink">{row.lead.message}</p>}
                <div className="mt-2 flex gap-2">
                  {(["new", "contacted", "closed"] as LeadStatus[]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => changeStatus(row.lead, status)}
                      className="pill"
                      data-active={row.lead.status === status}
                    >
                      {LEAD_STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
              </div>
            </li>
          )
        )}
      </ul>
    </div>
  );
}
