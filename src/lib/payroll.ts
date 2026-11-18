/** Georgia has no daylight saving: local time is UTC+4 all year. Slots and entries are stored in UTC. */
const OFFSET = 4 * 3600 * 1000;
const local = (d: Date) => new Date(d.getTime() + OFFSET);
/** [start, end) of the local day containing `now`, as ISO strings in UTC. */
export function dayRange(now = new Date()) {
  const l = local(now);
  const start =
    Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()) - OFFSET;
  return [
    new Date(start).toISOString(),
    new Date(start + 86400000).toISOString(),
  ] as const;
}
/** "YYYY-MM" of the current Georgian month. */
export const currentMonth = (now = new Date()) => {
  const l = local(now);
  return `${l.getUTCFullYear()}-${String(l.getUTCMonth() + 1).padStart(2, "0")}`;
};
/** The month before "YYYY-MM". */
export const previousMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};
/** [start, end) of a local month; `month` is "YYYY-MM", default the current local month. */
export function monthRange(month?: string, now = new Date()) {
  const m = /^(\d{4})-(\d{2})$/.exec(month || "");
  const l = local(now);
  const y = m ? Number(m[1]) : l.getUTCFullYear();
  const mo = m ? Number(m[2]) - 1 : l.getUTCMonth();
  const start = Date.UTC(y, mo, 1) - OFFSET;
  const end = Date.UTC(y, mo + 1, 1) - OFFSET;
  return [new Date(start).toISOString(), new Date(end).toISOString()] as const;
}

/**
 * Pay is a KPI-style sum of items, all amounts in tetri (1/100 lari):
 *  salary      оклад, a fixed amount every month
 *  bonus       a fixed monthly extra
 *  percent     a percentage of the salary
 *  per_lesson  an amount for each accepted lesson of the month
 *  premium     a one-time amount in one month
 * An item counts for the months from `from_month` to `to_month` (open-ended when empty).
 */
export type PayItem = {
  id?: string;
  kind: "salary" | "bonus" | "percent" | "per_lesson" | "premium";
  title?: string;
  amount?: number | null;
  percent?: number | null;
  from_month: string;
  to_month?: string | null;
  voided?: number;
};
export const itemActive = (it: PayItem, month: string) =>
  !Number(it.voided) &&
  it.from_month <= month &&
  (!it.to_month || it.to_month >= month);
export function computePay(items: PayItem[], month: string, lessons = 0) {
  const active = items.filter((i) => itemActive(i, month));
  const sum = (kind: PayItem["kind"]) =>
    active
      .filter((i) => i.kind === kind)
      .reduce((a, i) => a + Math.round(Number(i.amount) || 0), 0);
  const salary = sum("salary");
  const bonus = sum("bonus");
  const percent = active
    .filter((i) => i.kind === "percent")
    .reduce(
      (a, i) => a + Math.round((salary * (Number(i.percent) || 0)) / 100),
      0,
    );
  const perLesson = sum("per_lesson") * Math.max(0, Math.round(lessons));
  const premium = sum("premium");
  return {
    salary,
    bonus,
    percent,
    perLesson,
    premium,
    total: salary + bonus + percent + perLesson + premium,
    items: active,
  };
}
