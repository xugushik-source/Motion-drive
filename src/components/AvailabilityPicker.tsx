"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import type { Item } from "./Site";
export const georgiaDay = (iso: string) =>
  new Date(Date.parse(iso) + 4 * 3600000).toISOString().slice(0, 10);
export default function AvailabilityPicker({
  slots,
  locale,
  t,
  value,
  onChange,
}: {
  slots: Item[];
  locale: string;
  t: (key: string) => string;
  value: string;
  onChange: (id: string) => void;
}) {
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
              onClick={() => {
                setDay(date);
                onChange("");
              }}
              className={day === date ? "selected" : ""}
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
            className={value === s.id ? "selected" : ""}
            aria-pressed={value === s.id}
            onClick={() => onChange(s.id)}
          >
            <Clock size={15} />
            {format(s.start, { hour: "2-digit", minute: "2-digit" })}–
            {format(s.end, { hour: "2-digit", minute: "2-digit" })}
          </button>
        ))}
      </div>
      {!available.length && <p>{t("chooseAvailableDay")}</p>}
      {value && (
        <p className="selected-time" role="status">
          {t("selectedTime")}:{" "}
          {format(slots.find((s) => s.id === value)!.start, {
            dateStyle: "long",
            timeStyle: "short",
          })}
        </p>
      )}
      <input type="hidden" name="slot_id" value={value} />
    </section>
  );
}
