import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Check, SkipForward } from "lucide-react";
import type { Subscription, SubscriptionDelivery } from "@/lib/types";

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTH_LABELS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

interface DeliveryEntry {
  subscription: Subscription;
  delivery: SubscriptionDelivery;
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 42 cells (6 full weeks), Monday-start, so every month always renders the
// same grid shape — the alternative (a variable number of rows) makes the
// grid visibly resize as you page between months, which reads as janky.
function getMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const firstWeekday = (first.getDay() + 6) % 7; // getDay() is 0=Sun..6=Sat; shift to 0=Mon
  const start = new Date(year, month, 1 - firstWeekday);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function formatRu(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", weekday: "long" });
}

// A month-at-a-glance view of every subscription delivery due — the flat
// "Ближайшие доставки" worklist (see Subscriptions.tsx) answers "what do
// I do today," this answers "how loaded is next week/month," which
// matters once there are enough active subscriptions that a flat list
// stops being the right shape to plan around.
export default function SubscriptionCalendar({
  subscriptions,
  today,
  onDeliver,
  onSkip,
  busyKey,
}: {
  subscriptions: Subscription[];
  today: string;
  onDeliver: (entry: DeliveryEntry) => void;
  onSkip: (entry: DeliveryEntry) => void;
  busyKey: string | null;
}) {
  const [y, m, d] = today.split("-").map(Number);
  const [cursor, setCursor] = useState(() => new Date(y, m - 1, 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const byDate = useMemo(() => {
    const map = new Map<string, DeliveryEntry[]>();
    for (const subscription of subscriptions) {
      for (const delivery of subscription.deliveries) {
        if (delivery.status === "cancelled") continue; // nothing to plan around or act on
        const list = map.get(delivery.date) ?? [];
        list.push({ subscription, delivery });
        map.set(delivery.date, list);
      }
    }
    return map;
  }, [subscriptions]);

  const days = useMemo(() => getMonthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);
  const currentMonth = cursor.getMonth();
  const selectedEntries = selectedDate ? byDate.get(selectedDate) ?? [] : [];

  const goToMonth = (delta: number) => setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  const goToToday = () => {
    setCursor(new Date(y, m - 1, 1));
    setSelectedDate(today);
  };

  return (
    <div>
      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => goToMonth(-1)} className="rounded-full p-1.5 text-graphite hover:bg-canvas hover:text-ink">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="min-w-[160px] text-center font-display text-base text-ink">
              {MONTH_LABELS[currentMonth]} {cursor.getFullYear()}
            </p>
            <button type="button" onClick={() => goToMonth(1)} className="rounded-full p-1.5 text-graphite hover:bg-canvas hover:text-ink">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button type="button" onClick={goToToday} className="btn-secondary px-3 py-1.5 text-xs">
            Сегодня
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-graphite">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="py-1 font-medium uppercase tracking-wide">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const iso = toIsoDate(day);
            const entries = byDate.get(iso) ?? [];
            const scheduledCount = entries.filter((e) => e.delivery.status === "scheduled").length;
            const isOtherMonth = day.getMonth() !== currentMonth;
            const isToday = iso === today;
            const isSelected = iso === selectedDate;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelectedDate(iso)}
                className={`flex aspect-square flex-col items-center justify-center gap-1 border text-xs transition-colors ${
                  isSelected ? "border-ink bg-ink text-white" : isToday ? "border-hermes-500" : "border-hairline"
                } ${isOtherMonth ? "text-graphite/40" : "text-ink"} ${entries.length > 0 ? "hover:border-ink" : ""}`}
              >
                <span>{day.getDate()}</span>
                {entries.length > 0 && (
                  <span
                    className={`flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                      isSelected ? "bg-white text-ink" : scheduledCount > 0 ? "bg-hermes-500 text-white" : "bg-hairline text-graphite"
                    }`}
                  >
                    {entries.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="card mt-4">
          <p className="font-display text-base capitalize text-ink">{formatRu(selectedDate)}</p>
          {selectedEntries.length === 0 ? (
            <p className="mt-3 text-sm text-graphite">Нет доставок на эту дату.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {selectedEntries.map((entry) => {
                const { subscription, delivery } = entry;
                const key = `${subscription._id}-${delivery.date}`;
                return (
                  <div key={key} className="flex flex-wrap items-center justify-between gap-2 border border-hairline p-3">
                    <div className="min-w-0">
                      <p className="text-sm text-ink">
                        {subscription.customer.name} <span className="text-graphite">· {delivery.name}</span>
                      </p>
                      <p className="text-xs text-graphite">
                        {subscription.fulfillmentMethod === "pickup"
                          ? `Самовывоз: ${subscription.pickupBranch?.name ?? "—"}`
                          : `Доставка: ${subscription.address || "—"}`}{" "}
                        · {delivery.status === "scheduled" ? "запланирована" : delivery.status === "delivered" ? "доставлена" : "пропущена"}
                      </p>
                    </div>
                    {delivery.status === "scheduled" && (
                      <div className="flex flex-none gap-2">
                        <button
                          type="button"
                          disabled={busyKey === key}
                          onClick={() => onDeliver(entry)}
                          title="Доставлено"
                          className="rounded-full border border-hairline p-1.5 text-hermes-600 hover:border-hermes-500 disabled:opacity-40"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={busyKey === key}
                          onClick={() => onSkip(entry)}
                          title="Пропустить"
                          className="rounded-full border border-hairline p-1.5 text-graphite hover:border-ink hover:text-ink disabled:opacity-40"
                        >
                          <SkipForward className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
