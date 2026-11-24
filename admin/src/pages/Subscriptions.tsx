import { useEffect, useMemo, useState } from "react";
import { Calendar, Check, SkipForward, X } from "lucide-react";
import {
  ApiError,
  cancelSubscription,
  getCorporateLeads,
  getSubscriptionsAdmin,
  markSubscriptionDeliveryDelivered,
  skipSubscriptionDelivery,
  updateCorporateLeadStatus,
} from "@/lib/api";
import type { CorporateLead, Subscription, SubscriptionDelivery } from "@/lib/types";
import { CORPORATE_LEAD_STATUS_LABELS, SUBSCRIPTION_STATUS_LABELS } from "@/lib/types";
import { Skeleton } from "@/components/Skeleton";
import SubscriptionCalendar from "@/components/SubscriptionCalendar";

function formatUZS(amount: number) {
  return `${new Intl.NumberFormat("ru-RU").format(Math.round(amount))} сум`;
}

function formatRu(dateStr: string) {
  // "YYYY-MM-DD" parsed as local, not UTC-shifted midnight.
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", weekday: "short" });
}

// NOT new Date().toISOString().slice(0, 10) — that converts to UTC first,
// which is the wrong calendar day for a chunk of every morning in
// Tashkent (UTC+5): at 02:00 local it's still "yesterday" in UTC, so the
// "сегодня"/"просрочено" badges below would misjudge exactly the
// deliveries this worklist exists to flag correctly. Local getters avoid
// the UTC round-trip entirely.
function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface WorklistRow {
  subscription: Subscription;
  delivery: SubscriptionDelivery;
}

// "Подписки" — a customer picks several future dates up front, each with
// its own bouquet (see AGENTS/the server model's own comment for why this
// is a separate section rather than folded into Occasion "Корпоративные
// заказы"). No cron job drives this: the florist works the "Ближайшие
// доставки" worklist below by hand, same shape as Клиенты' "Скоро даты".
export default function Subscriptions() {
  const [tab, setTab] = useState<"worklist" | "calendar" | "all" | "leads">("worklist");
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [leads, setLeads] = useState<CorporateLead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);

  const load = () => {
    setLoading(true);
    getSubscriptionsAdmin()
      .then((data) => setSubscriptions(data as Subscription[]))
      .catch(() => setSubscriptions([]))
      .finally(() => setLoading(false));
  };

  const loadLeads = () => {
    setLeadsLoading(true);
    getCorporateLeads()
      .then((data) => setLeads(data as CorporateLead[]))
      .catch(() => setLeads([]))
      .finally(() => setLeadsLoading(false));
  };

  useEffect(load, []);
  // Loaded on mount, not just when the "Заявки" tab opens — the pill
  // itself shows a new-lead count, which needs the data before it's clicked.
  useEffect(loadLeads, []);

  const newLeadCount = leads.filter((l) => l.status === "new").length;

  const handleLeadStatus = async (lead: CorporateLead, status: "contacted" | "closed") => {
    setBusyKey(lead._id);
    setActionError(null);
    try {
      await updateCorporateLeadStatus(lead._id, status);
      loadLeads();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Не удалось обновить заявку");
    } finally {
      setBusyKey(null);
    }
  };

  const worklist = useMemo<WorklistRow[]>(() => {
    const rows: WorklistRow[] = [];
    for (const sub of subscriptions) {
      if (sub.status !== "active") continue;
      for (const delivery of sub.deliveries) {
        if (delivery.status === "scheduled") rows.push({ subscription: sub, delivery });
      }
    }
    return rows.sort((a, b) => a.delivery.date.localeCompare(b.delivery.date));
  }, [subscriptions]);

  const handleDeliver = async (row: WorklistRow) => {
    const key = `${row.subscription._id}-${row.delivery.date}`;
    setBusyKey(key);
    setActionError(null);
    try {
      await markSubscriptionDeliveryDelivered(row.subscription._id, row.delivery.date);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Не удалось отметить доставку");
    } finally {
      setBusyKey(null);
    }
  };

  const handleSkip = async (row: WorklistRow) => {
    if (!window.confirm(`Пропустить доставку ${formatRu(row.delivery.date)} для ${row.subscription.customer.name}?`)) return;
    const key = `${row.subscription._id}-${row.delivery.date}`;
    setBusyKey(key);
    setActionError(null);
    try {
      await skipSubscriptionDelivery(row.subscription._id, row.delivery.date);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Не удалось пропустить доставку");
    } finally {
      setBusyKey(null);
    }
  };

  const handleCancel = async (sub: Subscription) => {
    if (!window.confirm(`Отменить подписку клиента ${sub.customer.name}? Оставшиеся запланированные доставки будут отменены.`)) return;
    setBusyKey(sub._id);
    setActionError(null);
    try {
      await cancelSubscription(sub._id);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Не удалось отменить подписку");
    } finally {
      setBusyKey(null);
    }
  };

  const today = isoToday();

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">Подписки</h1>

      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" onClick={() => setTab("worklist")} className="pill" data-active={tab === "worklist"}>
          Ближайшие доставки
        </button>
        <button type="button" onClick={() => setTab("calendar")} className="pill" data-active={tab === "calendar"}>
          Календарь
        </button>
        <button type="button" onClick={() => setTab("all")} className="pill" data-active={tab === "all"}>
          Все подписки
        </button>
        <button type="button" onClick={() => setTab("leads")} className="pill" data-active={tab === "leads"}>
          Заявки (корпоратив)
          {newLeadCount > 0 && (
            <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-hermes-500 px-1 text-[11px] font-semibold text-white">
              {newLeadCount}
            </span>
          )}
        </button>
      </div>

      {actionError && <p className="mt-3 text-sm text-hermes-600">{actionError}</p>}

      {tab === "leads" ? (
        leadsLoading ? (
          <div className="card mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="card mt-4 overflow-x-auto p-0">
            <table className="admin-table w-full">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Контакт</th>
                  <th>Компания</th>
                  <th>Комментарий</th>
                  <th>Статус</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead._id}>
                    <td className="whitespace-nowrap text-graphite">{formatRu(lead.createdAt.slice(0, 10))}</td>
                    <td>
                      <span className="block text-ink">{lead.name}</span>
                      <span className="block text-xs text-graphite">{lead.phone}</span>
                    </td>
                    <td className="text-graphite">{lead.companyName || "—"}</td>
                    <td className="max-w-xs text-graphite">{lead.comment || "—"}</td>
                    <td>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                          lead.status === "new"
                            ? "border-hermes-200 bg-hermes-50 text-hermes-600"
                            : lead.status === "closed"
                              ? "border-hairline text-graphite"
                              : "border-hairline text-ink"
                        }`}
                      >
                        {CORPORATE_LEAD_STATUS_LABELS[lead.status]}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-3">
                        {lead.status === "new" && (
                          <button
                            type="button"
                            disabled={busyKey === lead._id}
                            onClick={() => handleLeadStatus(lead, "contacted")}
                            className="text-sm text-sapphire-600 hover:underline disabled:opacity-40"
                          >
                            Связались
                          </button>
                        )}
                        {lead.status !== "closed" && (
                          <button
                            type="button"
                            disabled={busyKey === lead._id}
                            onClick={() => handleLeadStatus(lead, "closed")}
                            className="text-sm text-graphite hover:underline disabled:opacity-40"
                          >
                            Закрыть
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {leads.length === 0 && <p className="p-6 text-sm text-graphite">Заявок пока нет.</p>}
          </div>
        )
      ) : tab === "calendar" ? (
        loading ? (
          <div className="card mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <SubscriptionCalendar subscriptions={subscriptions} today={today} onDeliver={handleDeliver} onSkip={handleSkip} busyKey={busyKey} />
          </div>
        )
      ) : loading ? (
        <div className="card mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : tab === "worklist" ? (
        <div className="card mt-4 overflow-x-auto p-0">
          <table className="admin-table w-full">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Клиент</th>
                <th>Букет</th>
                <th>Куда</th>
                <th>Оплата</th>
                <th>Сумма</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {worklist.map((row) => {
                const key = `${row.subscription._id}-${row.delivery.date}`;
                const isOverdue = row.delivery.date < today;
                const isToday = row.delivery.date === today;
                return (
                  <tr key={key}>
                    <td className="whitespace-nowrap">
                      <span className={isOverdue ? "font-medium text-hermes-600" : isToday ? "font-medium text-ink" : "text-graphite"}>
                        {formatRu(row.delivery.date)}
                      </span>
                      {isToday && <span className="ml-2 text-xs text-hermes-600">сегодня</span>}
                      {isOverdue && <span className="ml-2 text-xs text-hermes-600">просрочено</span>}
                    </td>
                    <td>
                      <span className="block text-ink">{row.subscription.customer.name}</span>
                      <span className="block text-xs text-graphite">{row.subscription.customer.phone}</span>
                    </td>
                    <td className="text-graphite">{row.delivery.name}</td>
                    <td className="text-graphite">
                      {row.subscription.fulfillmentMethod === "pickup"
                        ? `Самовывоз: ${row.subscription.pickupBranch?.name ?? "—"}`
                        : `Доставка: ${row.subscription.address || "—"}`}
                    </td>
                    <td className="text-graphite">{row.subscription.paymentPlan === "prepaid" ? "Оплачено заранее" : "При получении"}</td>
                    <td className="tabular-nums">{formatUZS(row.delivery.price)}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={busyKey === key}
                          onClick={() => handleDeliver(row)}
                          title="Доставлено"
                          className="rounded-full border border-hairline p-1.5 text-hermes-600 transition-colors hover:border-hermes-500 disabled:opacity-40"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={busyKey === key}
                          onClick={() => handleSkip(row)}
                          title="Пропустить"
                          className="rounded-full border border-hairline p-1.5 text-graphite transition-colors hover:border-ink hover:text-ink disabled:opacity-40"
                        >
                          <SkipForward className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {worklist.length === 0 && (
            <p className="flex items-center gap-2 p-6 text-sm text-graphite">
              <Calendar className="h-4 w-4" /> Нет запланированных доставок.
            </p>
          )}
        </div>
      ) : (
        <div className="card mt-4 overflow-x-auto p-0">
          <table className="admin-table w-full">
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Оплата</th>
                <th>Статус</th>
                <th>Доставок</th>
                <th>Сумма</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((sub) => {
                const remaining = sub.deliveries.filter((d) => d.status === "scheduled").length;
                const canCancel = sub.status === "active" || sub.status === "pending_payment";
                return (
                  <tr key={sub._id}>
                    <td>
                      <span className="block text-ink">{sub.customer.name}</span>
                      <span className="block text-xs text-graphite">{sub.customer.phone}</span>
                    </td>
                    <td className="text-graphite">{sub.paymentPlan === "prepaid" ? "Сразу онлайн" : "При получении"}</td>
                    <td>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                          sub.status === "cancelled"
                            ? "border-hairline text-graphite"
                            : sub.status === "active"
                              ? "border-hermes-200 bg-hermes-50 text-hermes-600"
                              : "border-hairline text-ink"
                        }`}
                      >
                        {SUBSCRIPTION_STATUS_LABELS[sub.status]}
                      </span>
                    </td>
                    <td className="text-graphite">
                      {sub.deliveries.length} всего · {remaining} осталось
                    </td>
                    <td className="tabular-nums">{formatUZS(sub.totalAmount)}</td>
                    <td className="text-right">
                      {canCancel && (
                        <button
                          type="button"
                          disabled={busyKey === sub._id}
                          onClick={() => handleCancel(sub)}
                          className="inline-flex items-center gap-1 text-sm text-hermes-600 hover:underline disabled:opacity-40"
                        >
                          <X className="h-3.5 w-3.5" /> Отменить
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {subscriptions.length === 0 && <p className="p-6 text-sm text-graphite">Подписок пока нет.</p>}
        </div>
      )}
    </div>
  );
}
