/** Pure bookkeeping helpers (money in tetri) so the rules are easy to test. */
export type Charge = { amount: number; created: string };
export type Aging = {
  total: number;
  current: number; // up to 7 days
  month: number; // 8-30 days
  old: number; // over 30 days
  oldestDays: number;
};
/**
 * A student's payments settle the oldest charges first (FIFO); whatever is left is the debt,
 * aged by the date of the charge it belongs to.
 */
export function ageDebt(
  charges: Charge[],
  paid: number,
  now = Date.now(),
): Aging {
  let credit = Math.max(0, paid);
  const out: Aging = { total: 0, current: 0, month: 0, old: 0, oldestDays: 0 };
  for (const c of [...charges].sort((a, b) =>
    a.created.localeCompare(b.created),
  )) {
    const settle = Math.min(credit, c.amount);
    credit -= settle;
    const left = c.amount - settle;
    if (left <= 0) continue;
    const days = Math.max(
      0,
      Math.floor((now - Date.parse(c.created)) / 86400000),
    );
    out.total += left;
    if (days <= 7) out.current += left;
    else if (days <= 30) out.month += left;
    else out.old += left;
    out.oldestDays = Math.max(out.oldestDays, days);
  }
  return out;
}
export const ACCOUNTS = ["cash", "card", "transfer", "owners"] as const;
export type Account = (typeof ACCOUNTS)[number];
export const ACCOUNT_LABEL: Record<Account, string> = {
  cash: "Касса (наличные)",
  card: "Карта",
  transfer: "Расчётный счёт / переводы",
  owners: "У владельцев (инкассация)",
};
/** Change in percent between two periods; null when there is nothing to compare with. */
export const change = (now: number, before: number) =>
  before ? Math.round(((now - before) / before) * 100) : null;
