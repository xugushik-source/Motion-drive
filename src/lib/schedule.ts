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

const MONTHS: Record<string, string[]> = {
  ru: [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
  ],
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
  ka: [
    "იანვარი",
    "თებერვალი",
    "მარტი",
    "აპრილი",
    "მაისი",
    "ივნისი",
    "ივლისი",
    "აგვისტო",
    "სექტემბერი",
    "ოქტომბერი",
    "ნოემბერი",
    "დეკემბერი",
  ],
  hy: [
    "հունվարի",
    "փետրվարի",
    "մարտի",
    "ապրիլի",
    "մայիսի",
    "հունիսի",
    "հուլիսի",
    "օգոստոսի",
    "սեպտեմբերի",
    "հոկտեմբերի",
    "նոյեմբերի",
    "դեկտեմբերի",
  ],
};
/**
 * "23 ноября" in every language, from a fixed table. Intl month names for Georgian and Armenian
 * differ between Node and the browser, which breaks server rendering (hydration) of these dates.
 */
export function formatDayMonth(d: Date, locale: string) {
  const names = MONTHS[locale] || MONTHS.en!;
  return locale === "en"
    ? `${names[d.getUTCMonth()]} ${d.getUTCDate()}`
    : `${d.getUTCDate()} ${names[d.getUTCMonth()]}`;
}

export type PlanPrefs = {
  count: number;
  weekdays: number[];
  parts: DayPart[];
  /** Lessons should fall within this many weeks from the first free day; 0 means no window. */
  weeks: number;
  from?: string;
  /** A chosen instructor, or empty for "any". */
  instructor?: string | null;
};
const addDays = (day: string, n: number) =>
  new Date(Date.parse(day + "T00:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
function planOne(list: FreeSlot[], count: number, weeks: number) {
  const byDay = new Map<string, FreeSlot[]>();
  for (const s of list) {
    const d = georgiaDay(s.start);
    byDay.set(d, [...(byDay.get(d) || []), s]);
  }
  const days = [...byDay.keys()].sort();
  const picked: FreeSlot[] = [];
  if (!days.length) return picked;
  // The hour that is free on the most days: the same time every day is the most convenient.
  const freq = new Map<number, number>();
  for (const d of days)
    for (const h of new Set(byDay.get(d)!.map((s) => georgiaHour(s.start))))
      freq.set(h, (freq.get(h) || 0) + 1);
  const anchor = [...freq.entries()].sort(
    (a, b) => b[1] - a[1] || a[0] - b[0],
  )[0]![0];
  const used = new Set<string>();
  const take = (s: FreeSlot) => {
    used.add(s.id);
    picked.push(s);
  };
  const free = (d: string) => byDay.get(d)!.filter((s) => !used.has(s.id));
  // one lesson per day at the usual hour, then more on the same days next to the first
  const fill = (scope: string[]) => {
    for (const d of scope) {
      if (picked.length >= count) return;
      const f = free(d);
      if (!f.length) continue;
      take(
        f.reduce((a, b) =>
          Math.abs(georgiaHour(b.start) - anchor) <
          Math.abs(georgiaHour(a.start) - anchor)
            ? b
            : a,
        ),
      );
    }
    let progress = true;
    while (picked.length < count && progress) {
      progress = false;
      for (const d of scope) {
        if (picked.length >= count) return;
        const f = free(d);
        if (!f.length) continue;
        const have = picked
          .filter((p) => georgiaDay(p.start) === d)
          .map((p) => georgiaHour(p.start));
        const dist = (s: FreeSlot) =>
          have.length
            ? Math.min(...have.map((h) => Math.abs(h - georgiaHour(s.start))))
            : Math.abs(georgiaHour(s.start) - anchor);
        take(f.reduce((a, b) => (dist(b) < dist(a) ? b : a)));
        progress = true;
      }
    }
  };
  const end = weeks > 0 ? addDays(days[0]!, weeks * 7) : null;
  const inside = end ? days.filter((d) => d < end) : days;
  const outside = end ? days.filter((d) => d >= end) : [];
  fill(inside);
  if (picked.length < count && outside.length) fill(outside);
  return picked.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}
/**
 * Proposes a whole series the way a good administrator would: with one instructor (the one who
 * can take the most lessons), at the same hour on consecutive days, adding more lessons on the
 * same days when the week is short of days, and taking whatever exists when there is not enough
 * room. The student can then remove or replace any proposed lesson.
 */
export function autoPlan(slots: FreeSlot[], prefs: PlanPrefs) {
  const count = Math.max(1, Math.min(30, Math.floor(prefs.count)));
  const groups = new Map<string, FreeSlot[]>();
  for (const slot of [...slots].sort(
    (a, b) => Date.parse(a.start) - Date.parse(b.start),
  )) {
    if (prefs.instructor && slot.instructor_id !== prefs.instructor) continue;
    if (
      prefs.weekdays.length &&
      !prefs.weekdays.includes(georgiaWeekday(slot.start))
    )
      continue;
    if (prefs.parts.length && !prefs.parts.includes(dayPart(slot.start)))
      continue;
    if (prefs.from && georgiaDay(slot.start) < prefs.from) continue;
    const key = slot.instructor_id || "";
    groups.set(key, [...(groups.get(key) || []), slot]);
  }
  let best: { key: string; picked: FreeSlot[] } | null = null;
  for (const [key, list] of groups) {
    const picked = planOne(list, count, Math.max(0, Math.floor(prefs.weeks)));
    const better =
      !best ||
      picked.length > best.picked.length ||
      (picked.length === best.picked.length &&
        picked.length > 0 &&
        Date.parse(picked.at(-1)!.start) <
          Date.parse(best.picked.at(-1)!.start));
    if (better) best = { key, picked };
  }
  const picked = best?.picked || [];
  return {
    picked,
    missing: count - picked.length,
    instructor_id: best?.key || null,
  };
}
