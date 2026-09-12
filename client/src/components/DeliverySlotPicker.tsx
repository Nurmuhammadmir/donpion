"use client";

import { useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useDragScroll } from "@/lib/useDragScroll";

// Delivery window — adjust here if actual shop hours differ.
const OPEN_HOUR = 9;
const CLOSE_HOUR = 21;
const LEAD_MINUTES = 40;
const SLOT_STEP_MINUTES = 30;
const DAYS_AHEAD = 14;

function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toTimeKey(d: Date) {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

// Earliest bookable slot is at least LEAD_MINUTES from now, rounded up to
// the next 30-minute boundary — e.g. 12:29 -> 13:30, 12:12 -> 13:00.
function roundUpToSlot(d: Date) {
  const rounded = new Date(d);
  rounded.setSeconds(0, 0);
  const minutes = rounded.getMinutes();
  if (minutes === 0) return rounded;
  if (minutes <= 30) {
    rounded.setMinutes(30);
  } else {
    rounded.setMinutes(0);
    rounded.setHours(rounded.getHours() + 1);
  }
  return rounded;
}

interface DeliverySlotPickerProps {
  date: string;
  time: string;
  onChange: (value: { date: string; time: string }) => void;
}

// Two horizontal scroll strips — days starting today, then that day's
// half-hour time slots. On mobile, tile width is capped so exactly 4 days /
// 5 slots show per screen before scrolling; sm+ reverts to natural sizing.
// Native touch momentum handles phones; useDragScroll adds click-and-drag
// scrolling for mouse users, who have no touch gesture to fall back on.
export default function DeliverySlotPicker({ date, time, onChange }: DeliverySlotPickerProps) {
  const t = useTranslations("DeliverySlotPicker");
  const weekdays = t.raw("weekdays") as string[];
  const months = t.raw("months") as string[];
  const dayScroll = useDragScroll<HTMLDivElement>();
  const slotScroll = useDragScroll<HTMLDivElement>();

  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: DAYS_AHEAD }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  const todayKey = toDateKey(new Date());
  const selectedDate = date || todayKey;

  const timeSlots = useMemo(() => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const dayStart = new Date(y, m - 1, d, OPEN_HOUR, 0, 0, 0);
    const dayEnd = new Date(y, m - 1, d, CLOSE_HOUR, 0, 0, 0);

    let cursor = dayStart;
    if (selectedDate === todayKey) {
      const earliest = roundUpToSlot(new Date(Date.now() + LEAD_MINUTES * 60 * 1000));
      if (earliest > dayStart) cursor = earliest;
    }

    const slots: string[] = [];
    while (cursor <= dayEnd) {
      slots.push(toTimeKey(cursor));
      cursor = new Date(cursor.getTime() + SLOT_STEP_MINUTES * 60 * 1000);
    }
    return slots;
  }, [selectedDate, todayKey]);

  // Keeps a valid time selected whenever the day (and so the slot list)
  // changes — including on first mount, when date/time both start empty.
  useEffect(() => {
    if (!timeSlots.includes(time)) {
      onChange({ date: selectedDate, time: timeSlots[0] || "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, timeSlots]);

  return (
    <div className="space-y-6">
      <div>
        <span className="mb-2 block text-xs font-medium uppercase tracking-wide2 text-graphite">{t("dateLabel")}</span>
        <div
          ref={dayScroll.ref}
          {...dayScroll.dragHandlers}
          className="no-scrollbar -mx-1 flex scroll-touch cursor-grab gap-2 overflow-x-auto scroll-smooth px-1 pb-1 active:cursor-grabbing"
        >
          {days.map((d) => {
            const key = toDateKey(d);
            const isSelected = key === selectedDate;
            const isToday = key === todayKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange({ date: key, time: "" })}
                className={`flex w-[calc((100%-1.5rem)/4)] flex-shrink-0 flex-col items-center border py-3 text-center transition-colors sm:w-16 ${
                  isSelected
                    ? "border-[#F37021] bg-[#F37021]/25 text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.7)]"
                    : "border-hairline text-ink hover:border-ink"
                }`}
              >
                <span className="text-[10px] uppercase tracking-wide2 opacity-70">
                  {isToday ? t("today") : weekdays[d.getDay()]}
                </span>
                <span className="mt-1 font-display text-lg">{d.getDate()}</span>
                <span className="text-[10px] uppercase opacity-70">{months[d.getMonth()]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className="mb-2 block text-xs font-medium uppercase tracking-wide2 text-graphite">{t("timeLabel")}</span>
        {timeSlots.length > 0 ? (
          <div
            ref={slotScroll.ref}
            {...slotScroll.dragHandlers}
            className="no-scrollbar -mx-1 flex scroll-touch cursor-grab gap-2 overflow-x-auto scroll-smooth px-1 pb-1 active:cursor-grabbing"
          >
            {timeSlots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => onChange({ date: selectedDate, time: slot })}
                className={`w-[calc((100%-2rem)/5)] flex-shrink-0 border px-2 py-2.5 text-center text-sm transition-colors sm:w-auto sm:px-4 ${
                  slot === time
                    ? "border-[#F37021] bg-[#F37021]/25 text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.7)]"
                    : "border-hairline text-ink hover:border-ink"
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-graphite">{t("noSlots")}</p>
        )}
      </div>
    </div>
  );
}
