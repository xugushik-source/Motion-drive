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
  kind:
    "salary" | "bonus" | "percent" | "per_lesson" | "per_student" | "premium";
  title?: string;
  amount?: number | null;
  percent?: number | null;
  /** per_lesson: lesson kind (yard, city, theory, exam); per_student: group scope. Empty means all. */
  scope?: string | null;
  from_month: string;
  to_month?: string | null;
  voided?: number;
};
export const itemActive = (it: PayItem, month: string) =>
  !Number(it.voided) &&
  it.from_month <= month &&
  (!it.to_month || it.to_month >= month);
/** Lessons accepted per kind, and students enrolled per scope with the course prices they paid. */
export type PayCounts = {
  lessons?: Record<string, number>;
  students?: Record<string, { n: number; price: number }>;
};
export function computePay(
  items: PayItem[],
  month: string,
  counts: number | PayCounts = 0,
) {
  const lessons: Record<string, number> =
    typeof counts === "number" ? { all: counts } : counts.lessons || {};
  const students = typeof counts === "number" ? {} : counts.students || {};
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
  const perLesson = active
    .filter((i) => i.kind === "per_lesson")
    .reduce(
      (a, i) =>
        a +
        Math.round(Number(i.amount) || 0) *
          Math.max(0, Math.round(lessons[i.scope || "all"] ?? 0)),
      0,
    );
  const perStudent = active
    .filter((i) => i.kind === "per_student")
    .reduce((a, i) => {
      const st = students[i.scope || "all"] || { n: 0, price: 0 };
      // a percent is taken from what the students paid for the course, an amount is paid per student
      return (
        a +
        (i.percent
          ? Math.round((st.price * Number(i.percent)) / 100)
          : Math.round(Number(i.amount) || 0) * st.n)
      );
    }, 0);
  const premium = sum("premium");
  return {
    salary,
    bonus,
    percent,
    perLesson,
    perStudent,
    premium,
    total: salary + bonus + percent + perLesson + perStudent + premium,
    items: active,
  };
}

/** The month after "YYYY-MM". */
export const nextMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};
/**
 * Everything earned from the first month that has pay items up to `nowMonth`, month by month.
 * `lessonsByMonth` holds accepted lessons per month for the "per lesson" items.
 */
export function accrualSince(
  items: PayItem[],
  nowMonth: string,
  countsByMonth: Record<string, number | PayCounts> = {},
) {
  const live = items.filter((i) => !Number(i.voided));
  const first = live.map((i) => i.from_month).sort()[0];
  const months: { month: string; total: number }[] = [];
  let accrued = 0;
  if (first && first >= "2020-01")
    for (
      let m = first;
      m <= nowMonth && months.length < 600;
      m = nextMonth(m)
    ) {
      const total = computePay(live, m, countsByMonth[m] || 0).total;
      months.push({ month: m, total });
      accrued += total;
    }
  return { accrued, months };
}
/**
 * What is still owed (debt) or paid ahead (advance). A payment counts only after the employee
 * confirmed that they received it; a surplus is an advance that the next months' pay uses up.
 */
export const balanceOf = (accrued: number, paidConfirmed: number) => ({
  balance: accrued - paidConfirmed,
  debt: Math.max(accrued - paidConfirmed, 0),
  advance: Math.max(paidConfirmed - accrued, 0),
  closed: accrued - paidConfirmed === 0,
});

/** The default rates the school pays (2026-11-18). Added automatically when an account is created. */
export const DEFAULT_RATES: Record<
  string,
  {
    kind: PayItem["kind"];
    scope: string;
    amount?: number;
    percent?: number;
    title: string;
  }[]
> = {
  instructor: [
    {
      kind: "per_lesson",
      scope: "yard",
      amount: 1500,
      title: "Урок на площадке",
    },
    { kind: "per_lesson", scope: "city", amount: 2000, title: "Урок в городе" },
  ],
  lecturer: [
    {
      kind: "per_student",
      scope: "akhalkalaki",
      amount: 5000,
      title: "Группа, Ахалкалаки (за ученика)",
    },
    {
      kind: "per_student",
      scope: "ninotsminda",
      amount: 6000,
      title: "Группа, Ниноцминда (за ученика)",
    },
    {
      kind: "per_student",
      scope: "visiting",
      amount: 6000,
      title: "Выездная группа (за ученика)",
    },
    {
      kind: "per_student",
      scope: "individual",
      percent: 50,
      title: "Индивидуально или мини-группа до 3 человек (50% от стоимости)",
    },
  ],
};
/** Lesson kind of a booking, from the package it came from (or the program when there is none). */
export function lessonKindOf(
  packageId?: string | null,
  program?: string | null,
) {
  const id = String(packageId || "");
  if (id.includes("yard")) return "yard";
  if (id.startsWith("theory") || program === "theory" || program === "group")
    return "theory";
  if (id.startsWith("exam") || program === "exam") return "exam";
  return "city";
}

/**
 * Splits a month's pay by direction so the school can see what each kind of teaching really costs:
 * per-lesson items go to their lesson kind (yard, city, theory, exam), per-student items to theory,
 * and fixed parts (salary, bonuses, premiums) are kept apart as "fixed".
 */
export function payByDirection(
  items: PayItem[],
  month: string,
  counts: PayCounts = {},
) {
  const out: Record<string, number> = {
    yard: 0,
    city: 0,
    theory: 0,
    exam: 0,
    other: 0,
    fixed: 0,
  };
  const total = computePay(items, month, counts);
  const lessons = counts.lessons || {};
  let direct = 0;
  for (const i of items.filter((x) => itemActive(x, month))) {
    if (i.kind === "per_lesson") {
      const n = Math.max(0, Math.round(lessons[i.scope || "all"] ?? 0));
      const v = Math.round(Number(i.amount) || 0) * n;
      const key =
        i.scope && i.scope in out && i.scope !== "fixed" ? i.scope : "other";
      out[key] = (out[key] || 0) + v;
      direct += v;
    }
  }
  const perStudent = total.perStudent;
  out.theory = (out.theory || 0) + perStudent;
  direct += perStudent;
  out.fixed = total.total - direct;
  return out;
}
