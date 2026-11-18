/**
 * Expense categories. "small" ones are paid from the cash desk by operators; "big" ones
 * (rent, utilities, repairs, construction, dividends) are entered and seen by administrators only.
 * The admin panel is in Russian only, so the labels live here.
 */
export type ExpenseCategory = { id: string; label: string; big: boolean };
export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: "supplies", label: "Вода, чай, еда", big: false },
  { id: "household", label: "Бытовая химия, тряпки, уборка", big: false },
  { id: "stationery", label: "Канцелярия", big: false },
  { id: "repair_small", label: "Мелкий ремонт (из кассы)", big: false },
  { id: "other_small", label: "Прочая мелочь", big: false },
  { id: "rent", label: "Аренда помещения", big: true },
  { id: "utilities", label: "Коммунальные платежи", big: true },
  { id: "car_repair", label: "Ремонт и обслуживание машин", big: true },
  { id: "construction", label: "Стройка и ремонт на площадке", big: true },
  { id: "fuel", label: "Топливо", big: true },
  { id: "taxes", label: "Налоги и сборы", big: true },
  { id: "ads", label: "Реклама", big: true },
  { id: "other_big", label: "Прочие крупные расходы", big: true },
  { id: "dividends", label: "Дивиденды (выплата владельцам)", big: true },
];
export const categoryById = (id: string) =>
  EXPENSE_CATEGORIES.find((c) => c.id === id);
export const isBigCategory = (id: string) => !!categoryById(id)?.big;
/** Dividends are a payout to owners, not an operating expense: reports show them on a separate line. */
export const DIVIDENDS = "dividends";
