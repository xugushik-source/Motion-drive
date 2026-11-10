"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import type { Item } from "./Site";
import { georgiaDay } from "../lib/schedule";
export { georgiaDay };
export default function AvailabilityPicker({
  slots,
  locale,
  t,
  value,
  onChange,
  max = 1,
}: {
  slots: Item[];
  locale: string;
  t: (key: string) => string;
  value: string[];
  onChange: (ids: string[]) => void;
  max?: number;
}) {
  // One lesson per day: picking another hour on the same day replaces it.
  const toggle = (slot: Item) => {
    if (value.includes(slot.id))
      return onChange(value.filter((v) => v !== slot.id));
    const sameDay = (id: string) =>
      georgiaDay(slots.find((s) => s.id === id)?.start || "") ===
      georgiaDay(slot.start);
    const kept = max === 1 ? [] : value.filter((v) => !sameDay(v));
    if (kept.length >= max) return;
    onChange([...kept, slot.id]);
  };
  const pickedDays = new Set(
    value.map((id) => georgiaDay(slots.find((s) => s.id === id)?.start || "")),
  );
  const first = slots[0]?.start;
  const [month, setMonth] = useState(() =>
    georgiaDay(first || new Date().toISOString()).slice(0, 7),
  );
  const [day, setDay] = useState(() => (first ? georgiaDay(first) : ""));
  const counts = new Map<string, number>();
  for (const slot of slots) {
    const date = georgiaDay(slot.start);
    counts.set(date, (counts.get(date) || 0) + 1);
  }
  const [year, m] = month.split("-").map(Number);
  const offset = (new Date(Date.UTC(year, m - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const move = (delta: number) => {
    const date = new Date(Date.UTC(year, m - 1 + delta, 1));
    setMonth(date.toISOString().slice(0, 7));
  };
  const available = slots.filter((s) => georgiaDay(s.start) === day);
  const format = (iso: string, options: Intl.DateTimeFormatOptions) =>
    new Date(iso).toLocaleString(locale, {
      ...options,
      timeZone: "Asia/Tbilisi",
    });
  return (
    <section className="availability-picker" aria-label={t("chooseDay")}>
      <div className="calendar-heading">
        <strong>{t("chooseDay")}</strong>
        <span>UTC+04:00 · {t("georgiaTime")}</span>
      </div>
      <div className="calendar-month">
        <button
          type="button"
          onClick={() => move(-1)}
          aria-label={t("previousMonth")}
        >
          <ChevronLeft size={20} />
        </button>
        <strong aria-live="polite">
          {new Date(Date.UTC(year, m - 1, 15)).toLocaleDateString(locale, {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}
        </strong>
        <button
          type="button"
          onClick={() => move(1)}
          aria-label={t("nextMonth")}
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="calendar-grid">
        {Array.from({ length: 7 }, (_, i) => (
          <small key={"w" + i}>
            {new Date(Date.UTC(2026, 10, 2 + i)).toLocaleDateString(locale, {
              weekday: "short",
              timeZone: "UTC",
            })}
          </small>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={"blank" + i} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`;
          const count = counts.get(date) || 0;
          return (
            <button
              type="button"
              key={date}
              disabled={!count}
              aria-pressed={day === date}
              aria-label={`${date} · ${count} ${t("freeTimes")}`}
              onClick={() => setDay(date)}
              className={
                (day === date ? "selected" : "") +
                (pickedDays.has(date) ? " picked" : "")
              }
            >
              <span>{i + 1}</span>
              {count > 0 && <small>{count}</small>}
            </button>
          );
        })}
      </div>
      <p className="calendar-legend">{t("calendarLegend")}</p>
      <strong>{t("chooseTime")}</strong>
      <div className="time-grid" aria-live="polite">
        {available.map((s) => (
          <button
            type="button"
            key={s.id}
            className={value.includes(s.id) ? "selected" : ""}
            aria-pressed={value.includes(s.id)}
            onClick={() => toggle(s)}
          >
            <Clock size={15} />
            {format(s.start, { hour: "2-digit", minute: "2-digit" })}–
            {format(s.end, { hour: "2-digit", minute: "2-digit" })}
          </button>
        ))}
      </div>
      {!available.length && <p>{t("chooseAvailableDay")}</p>}
      {value.length > 0 && (
        <p className="selected-time" role="status">
          {t("selectedTime")}: {value.length}
          {max > 1 ? ` / ${max}` : ""}
          {max > 1 && value.length >= max && <> · {t("allPicked")}</>}
        </p>
      )}
    </section>
  );
}
