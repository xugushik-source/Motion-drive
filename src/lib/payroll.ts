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
/** Piecework pay in tetri: one flat rate per accepted lesson. */
export const lessonPay = (rateTetri: number | null | undefined, lessons = 1) =>
  Math.max(0, Math.round(Number(rateTetri) || 0)) * lessons;
