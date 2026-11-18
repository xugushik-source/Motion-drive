"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { api, Field, Notice } from "./Site";
import { gel } from "./Finance";
import { EXPENSE_CATEGORIES, categoryById } from "../lib/expenses";

type Row = Record<string, any>;
const today = () =>
  new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
const monthStart = () => today().slice(0, 8) + "01";
const dayOf = (iso?: string) =>
  (iso || "").slice(0, 10).split("-").reverse().join(".");
const CITY: Record<string, string> = {
  akhalkalaki: "Ахалкалаки",
  ninotsminda: "Ниноцминда",
};

/** Interval picker shared by the expense list and the administrator report. */
function Interval({
  from,
  to,
  setFrom,
  setTo,
}: {
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
}) {
  const set = (a: string, b: string) => {
    setFrom(a);
    setTo(b);
  };
  const t = today();
  const d = new Date(t + "T00:00:00Z");
  const back = (n: number) =>
    new Date(d.getTime() - n * 86400e3).toISOString().slice(0, 10);
  const prevStart = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1),
  )
    .toISOString()
    .slice(0, 10);
  const prevEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0))
    .toISOString()
    .slice(0, 10);
  return (
    <div className="finance-toolbar">
      <label>
        С{" "}
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </label>
      <label>
        По{" "}
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </label>
      <button
        type="button"
        className="button small outline-dark"
        onClick={() => set(t, t)}
      >
        Сегодня
      </button>
      <button
        type="button"
        className="button small outline-dark"
        onClick={() => set(back(6), t)}
      >
        7 дней
      </button>
      <button
        type="button"
        className="button small outline-dark"
        onClick={() => set(monthStart(), t)}
      >
        Этот месяц
      </button>
      <button
        type="button"
        className="button small outline-dark"
        onClick={() => set(prevStart, prevEnd)}
      >
        Прошлый месяц
      </button>
    </div>
  );
}

/**
 * Cash desk, small expenses and hand-over of cash to the owners. Operators enter small expenses only;
 * administrators also enter and see the big ones (rent, utilities, repairs, construction, dividends).
 */
export function ExpensesTab({ admin, myId }: { admin: boolean; myId: string }) {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [rows, setRows] = useState<Row[]>([]);
  const [cash, setCash] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const cats = useMemo(
    () => EXPENSE_CATEGORIES.filter((c) => admin || !c.big),
    [admin],
  );
  const load = useCallback(async () => {
    try {
      setRows((await api("finance/expenses", { from, to })).rows);
      setCash(await api("finance/cash", {}));
    } catch {
      setError("Не удалось загрузить данные.");
    }
  }, [from, to]);
  useEffect(() => {
    load();
  }, [load]);
  async function send(path: string, body: Row, ok: string) {
    setError("");
    setNotice("");
    try {
      await api(path, body);
      setNotice(ok);
      await load();
      return true;
    } catch (e) {
      setError("Не получилось сохранить: проверьте поля или права доступа.");
      return false;
    }
  }
  const total = rows
    .filter((r) => r.category !== "dividends")
    .reduce((s, r) => s + r.amount, 0);
  return (
    <div className="finance">
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      {cash?.toConfirm?.map((c: Row) => (
        <div className="notice payout-note" key={c.id} role="status">
          <span>
            {c.from_name} передал(а) вам наличные: <b>{gel(c.amount)}</b>
            {c.note ? ` · ${c.note}` : ""}. Получили?
          </span>
          <button
            className="button small"
            onClick={() =>
              send("finance/collect-confirm", { id: c.id }, "Подтверждено")
            }
          >
            Получил(а)
          </button>
        </div>
      ))}
      {cash && (
        <div className="stat-cards">
          <article>
            <small>В кассе должно быть (наличные)</small>
            <strong>{gel(cash.till)}</strong>
            <small>
              получено {gel(cash.received)} − мелкие расходы {gel(cash.spent)} −
              передано {gel(cash.handed)}
            </small>
          </article>
        </div>
      )}

      <div className="finance-forms">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = e.currentTarget;
            const d = Object.fromEntries(new FormData(f));
            if (
              await send(
                "finance/expense-add",
                {
                  category: d.category,
                  amount: d.amount,
                  note: d.note,
                  city: d.city || "",
                  spent_on: d.spent_on || undefined,
                },
                "Расход записан",
              )
            )
              f.reset();
          }}
        >
          <h4>Записать расход</h4>
          <Field label="Статья">
            <select name="category" defaultValue={cats[0]?.id}>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Сумма, ₾">
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              required
            />
          </Field>
          <Field label="Что случилось и за что заплатили">
            <input name="note" minLength={3} maxLength={300} required />
          </Field>
          <Field label="Филиал">
            <select name="city" defaultValue="">
              <option value="">общий</option>
              <option value="akhalkalaki">Ахалкалаки</option>
              <option value="ninotsminda">Ниноцминда</option>
            </select>
          </Field>
          <Field label="Дата">
            <input
              name="spent_on"
              type="date"
              defaultValue={today()}
              max={today()}
            />
          </Field>
          <button className="button small">
            <Plus size={16} />
            Записать
          </button>
        </form>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = e.currentTarget;
            const d = Object.fromEntries(new FormData(f));
            if (
              await send(
                "finance/collect",
                { to_user: d.to_user, amount: d.amount, note: d.note || "" },
                "Передача записана. Получатель должен её подтвердить.",
              )
            )
              f.reset();
          }}
        >
          <h4>Передать наличные руководству (инкассация)</h4>
          <Field label="Кому передали">
            <select name="to_user" required defaultValue="">
              <option value="" disabled>
                выберите
              </option>
              {(cash?.admins || [])
                .filter((a: Row) => a.id !== myId)
                .map((a: Row) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Сумма, ₾">
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              required
            />
          </Field>
          <Field label="Комментарий">
            <input name="note" maxLength={300} />
          </Field>
          <button className="button small outline-dark">
            <Plus size={16} />
            Передал(а)
          </button>
        </form>
      </div>

      {cash?.collections?.length > 0 && (
        <>
          <h4>Передачи наличных</h4>
          <ul className="ledger">
            {cash!.collections.map((c: Row) => (
              <li key={c.id}>
                <span>{dayOf(c.created)}</span>
                <span>
                  {c.from_name} → {c.to_name}
                  {c.note ? ` · ${c.note}` : ""}
                </span>
                <b>{gel(c.amount)}</b>
                <small>
                  {c.confirmed_at ? "подтверждено" : "ждёт подтверждения"}
                </small>
                {!c.confirmed_at && (c.from_user === myId || admin) && (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() =>
                      send("finance/collect-void", { id: c.id }, "Отменено")
                    }
                  >
                    отменить
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <h4>Расходы</h4>
      <Interval from={from} to={to} setFrom={setFrom} setTo={setTo} />
      {rows.length ? (
        <>
          <ul className="ledger">
            {rows.map((r) => (
              <li key={r.id}>
                <span>{dayOf(r.spent_on)}</span>
                <span>
                  <b>{categoryById(r.category)?.label || r.category}</b> ·{" "}
                  {r.note}
                  {r.city ? ` · ${CITY[r.city]}` : ""}
                  <small> ({r.author})</small>
                </span>
                <b>−{gel(r.amount)}</b>
                <button
                  type="button"
                  className="link-button"
                  onClick={async () => {
                    const reason = prompt("Причина отмены записи");
                    if (reason && reason.trim().length >= 3)
                      await send(
                        "finance/expense-void",
                        { id: r.id, reason },
                        "Запись отменена",
                      );
                  }}
                >
                  отменить
                </button>
              </li>
            ))}
          </ul>
          <p>
            Итого за период: <b>{gel(total)}</b>
          </p>
        </>
      ) : (
        <Notice>За этот период расходов нет.</Notice>
      )}
    </div>
  );
}

/** Administrator report for any interval: money received, money expected, expenses, salaries, dividends. */
export function PeriodReport() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [r, setR] = useState<Row | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (from > to) return;
    api("finance/period", { from, to })
      .then((x) => {
        setR(x);
        setError("");
      })
      .catch(() => setError("Не удалось загрузить отчёт."));
  }, [from, to]);
  return (
    <div className="finance">
      <h4>Деньги за период</h4>
      <Interval from={from} to={to} setFrom={setFrom} setTo={setTo} />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {from > to && <Notice>Дата «С» позже даты «По».</Notice>}
      {r && (
        <>
          <div className="stat-cards">
            <article>
              <small>Пришло денег</small>
              <strong>{gel(r.received)}</strong>
            </article>
            <article>
              <small>Ожидается (долги учеников)</small>
              <strong>{gel(r.expected)}</strong>
            </article>
            <article>
              <small>Расходы</small>
              <strong>{gel(r.expenses)}</strong>
            </article>
            <article>
              <small>Выплачено сотрудникам</small>
              <strong>{gel(r.salaries)}</strong>
            </article>
            <article className={r.net < 0 ? "owe" : ""}>
              <small>Итого: пришло − расходы − зарплаты</small>
              <strong>{gel(r.net)}</strong>
            </article>
            <article>
              <small>Дивиденды (отдельно)</small>
              <strong>{gel(r.dividends)}</strong>
            </article>
          </div>
          <h4>По способу оплаты</h4>
          <ul className="bars">
            {r.byMethod.map((m: Row) => (
              <li key={m.method}>
                <span>
                  {m.method === "cash"
                    ? "Наличные"
                    : m.method === "card"
                      ? "Карта"
                      : "Перевод"}
                </span>
                <b>{gel(m.total)}</b>
              </li>
            ))}
          </ul>
          <h4>Расходы по статьям</h4>
          <ul className="bars">
            {(r.categories as { id: string; label: string }[])
              .filter((c) => r.byCategory[c.id])
              .map((c) => (
                <li key={c.id}>
                  <span>{c.label}</span>
                  <b>{gel(r.byCategory[c.id])}</b>
                </li>
              ))}
          </ul>
        </>
      )}
    </div>
  );
}
