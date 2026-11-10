// Georgia has no daylight saving time: local time is always UTC+04:00.
const OFFSET = 4 * 3600000;
export const georgiaDay = (iso: string) =>
  new Date(Date.parse(iso) + OFFSET).toISOString().slice(0, 10);
export const georgiaHour = (iso: string) =>
  new Date(Date.parse(iso) + OFFSET).getUTCHours() +
  new Date(Date.parse(iso) + OFFSET).getUTCMinutes() / 60;
/** 0 = Monday … 6 = Sunday, in Georgia time. */
export const georgiaWeekday = (iso: string) =>
  (new Date(Date.parse(iso) + OFFSET).getUTCDay() + 6) % 7;
export type DayPart = "morning" | "day" | "evening";
export const dayPart = (iso: string): DayPart => {
  const h = georgiaHour(iso);
  return h < 12 ? "morning" : h < 17 ? "day" : "evening";
};
/** Monday (YYYY-MM-DD) of the Georgian week that contains the slot. */
export const weekKey = (iso: string) => {
  const local = Date.parse(iso) + OFFSET;
  return new Date(local - georgiaWeekday(iso) * 86400000)
    .toISOString()
    .slice(0, 10);
};
export type FreeSlot = {
  id: string;
  start: string;
  end: string;
  city?: string;
  instructor_id?: string | null;
};
export type Preferences = {
  count: number;
  weekdays: number[];
  parts: DayPart[];
  perWeek: number;
  from?: string;
};
/**
 * Picks a lesson series the way a school administrator would: only on the chosen
 * weekdays and parts of the day, at most one lesson per day and `perWeek` per week,
 * keeping the same hour where possible. Returns what it found plus the shortfall,
 * so the student can still send a partial request for the operator to complete.
 */
export function autoPick(slots: FreeSlot[], prefs: Preferences) {
  const count = Math.max(1, Math.min(30, Math.floor(prefs.count)));
  const perWeek = Math.max(1, Math.min(7, Math.floor(prefs.perWeek)));
  const byDay = new Map<string, FreeSlot[]>();
  for (const slot of [...slots].sort(
    (a, b) => Date.parse(a.start) - Date.parse(b.start),
  )) {
    if (
      prefs.weekdays.length &&
      !prefs.weekdays.includes(georgiaWeekday(slot.start))
    )
      continue;
    if (prefs.parts.length && !prefs.parts.includes(dayPart(slot.start)))
      continue;
    const day = georgiaDay(slot.start);
    if (prefs.from && day < prefs.from) continue;
    byDay.set(day, [...(byDay.get(day) || []), slot]);
  }
  const picked: FreeSlot[] = [];
  const weeks = new Map<string, number>();
  let anchor: number | null = null;
  for (const [, daySlots] of byDay) {
    if (picked.length >= count) break;
    const week = weekKey(daySlots[0].start);
    if ((weeks.get(week) || 0) >= perWeek) continue;
    const best =
      anchor === null
        ? daySlots[0]
        : daySlots.reduce((a, b) =>
            Math.abs(georgiaHour(b.start) - anchor!) <
            Math.abs(georgiaHour(a.start) - anchor!)
              ? b
              : a,
          );
    anchor ??= georgiaHour(best.start);
    picked.push(best);
    weeks.set(week, (weeks.get(week) || 0) + 1);
  }
  return { picked, missing: count - picked.length };
}

/** The next `count` start dates of a group that restarts every `cycleDays` from `startDate`. */
export function nextStarts(
  p: { startDate?: string; cycleDays?: unknown },
  count = 3,
  today = new Date(),
) {
  if (!p.startDate || !Number(p.cycleDays)) return [];
  const step = Number(p.cycleDays) * 86400000;
  const first = Date.parse(p.startDate + "T00:00:00Z");
  // "today" is the calendar day in Georgia (UTC+4), not in UTC
  const now = Date.parse(georgiaDay(today.toISOString()) + "T00:00:00Z");
  const skip = now > first ? Math.ceil((now - first) / step) : 0;
  return Array.from(
    { length: count },
    (_, i) => new Date(first + (skip + i) * step),
  );
}
