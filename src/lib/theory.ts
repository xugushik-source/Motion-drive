/**
 * Theory timetable: one lecturer, working 10:00–22:00.
 * A lecture block is 75 min plus a 15 min break; an individual lesson is 60 min inside a block.
 * Group start times are the ones the school offers; every other block is open for individual lessons.
 */
export const DAY_START = 10 * 60;
export const DAY_END = 22 * 60;
export const LECTURE_MIN = 75;
export const BREAK_MIN = 15;
export const INDIVIDUAL_MIN = 60;

/** The lecturer teaches Akhalkalaki on Mon/Wed/Fri and Ninotsminda on Tue/Thu/Sat (Mon = 1). */
export const CITY_DAYS = {
  akhalkalaki: [1, 3, 5],
  ninotsminda: [2, 4, 6],
} as const;
export type TheoryCity = keyof typeof CITY_DAYS;
/** Maximum students in one group. When it is full the operator decides by hand. */
export const GROUP_CAPACITY: Record<TheoryCity, number> = {
  akhalkalaki: 23,
  ninotsminda: 35,
};

export const GROUP_STARTS = {
  morning: ["10:00", "11:30"],
  evening: ["16:00", "17:30", "19:00"],
} as const;
/** Blocks that used to be the 13:00–15:00 break; opened only when the school wants full load. */
export const MIDDAY = ["13:00", "14:30"];

export type BlockKind = "group-morning" | "group-evening" | "individual";
export type Block = {
  start: string;
  end: string;
  kind: BlockKind;
  /** minutes the lecturer actually teaches in this block */
  minutes: number;
};

const hm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

/** All block starts of a working day, in minutes: 10:00, 11:30, … 20:30. */
export function blockStarts(): number[] {
  const out: number[] = [];
  for (
    let s = DAY_START;
    s + LECTURE_MIN <= DAY_END;
    s += LECTURE_MIN + BREAK_MIN
  )
    out.push(s);
  return out;
}

export function dayPlan({ openMidday = true } = {}): Block[] {
  return blockStarts()
    .map((s): Block => {
      const start = hm(s);
      const kind: BlockKind = (
        GROUP_STARTS.morning as readonly string[]
      ).includes(start)
        ? "group-morning"
        : (GROUP_STARTS.evening as readonly string[]).includes(start)
          ? "group-evening"
          : "individual";
      return {
        start,
        end: hm(s + (kind === "individual" ? INDIVIDUAL_MIN : LECTURE_MIN)),
        kind,
        minutes: kind === "individual" ? INDIVIDUAL_MIN : LECTURE_MIN,
      };
    })
    .filter((b) => openMidday || !MIDDAY.includes(b.start));
}

/** City taught on a weekday (Mon = 1 … Sun = 0), or null when the lecturer rests. */
export function cityOnWeekday(weekday: number): TheoryCity | null {
  for (const city of Object.keys(CITY_DAYS) as TheoryCity[])
    if ((CITY_DAYS[city] as readonly number[]).includes(weekday)) return city;
  return null;
}

/** What the lecturer carries in a normal week and how supply compares with demand. */
export function weeklyLoad(opts = {}) {
  const plan = dayPlan(opts);
  const days = Object.values(CITY_DAYS).reduce((a, d) => a + d.length, 0);
  const sum = (f: (b: Block) => boolean) =>
    plan.filter(f).reduce((a, b) => a + b.minutes, 0);
  const morning = plan.filter((b) => b.kind === "group-morning").length;
  const evening = plan.filter((b) => b.kind === "group-evening").length;
  return {
    days,
    blocksPerDay: plan.length,
    groupBlocksPerDay: morning + evening,
    individualBlocksPerDay: plan.length - morning - evening,
    hoursPerDay: sum(() => true) / 60,
    hoursPerWeek: (sum(() => true) / 60) * days,
    /** share of group seats in the evening (the school's demand is about 60%) */
    eveningShare: evening / (morning + evening),
  };
}

/** Free time between two blocks is always the school's break. */
export const breaksOk = (plan: Block[]) =>
  plan.every(
    (b, i) =>
      i === 0 ||
      toMin(b.start) - toMin(plan[i - 1].start) >= LECTURE_MIN + BREAK_MIN,
  );
