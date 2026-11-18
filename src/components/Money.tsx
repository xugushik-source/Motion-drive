"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { api, Field, Notice } from "./Site";
import { gel } from "./Finance";
import { formatPhone } from "../lib/phone";
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
    () =>
      EXPENSE_CATEGORIES.filter(
        (c) => c.id !== "dividends" && (admin || !c.big),
      ),
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
                  method: admin ? d.method : undefined,
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
            <select
              name="category"
              defaultValue={cats[0]?.id}
              onChange={(e) => {
                // small things are paid from the cash desk, big ones from the bank
                const big = !!EXPENSE_CATEGORIES.find(
                  (c) => c.id === e.target.value,
                )?.big;
                const m = e.currentTarget.form?.elements.namedItem(
                  "method",
                ) as HTMLSelectElement | null;
                if (m) m.value = big ? "transfer" : "cash";
              }}
            >
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          {admin && (
            <Field label="Чем оплачено">
              <select name="method" defaultValue="cash">
                <option value="cash">Наличные из кассы</option>
                <option value="card">Карта</option>
                <option value="transfer">Расчётный счёт / перевод</option>
                <option value="owners">Деньги владельцев</option>
              </select>
            </Field>
          )}
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

        {admin && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = e.currentTarget;
              const d = Object.fromEntries(new FormData(f));
              if (
                await send(
                  "finance/expense-add",
                  {
                    category: "dividends",
                    person: d.person,
                    amount: d.amount,
                    method: d.method,
                    note: d.note || "",
                    spent_on: d.spent_on || undefined,
                  },
                  "Дивиденды записаны",
                )
              )
                f.reset();
            }}
          >
            <h4>Дивиденды владельца</h4>
            <p className="muted">
              Записывается по факту: сколько взял, столько и пишете. Плана и
              нормы нет, можно взять больше, меньше или не брать.
            </p>
            <Field label="Кто взял">
              <select name="person" required defaultValue="">
                <option value="" disabled>
                  выберите владельца
                </option>
                {(cash?.admins || []).map((a: Row) => (
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
            <Field label="Откуда взяли">
              <select name="method" defaultValue="owners">
                <option value="owners">Из денег владельцев (инкассация)</option>
                <option value="cash">Из кассы (наличные)</option>
                <option value="card">С карты</option>
                <option value="transfer">С расчётного счёта</option>
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
            <Field label="Комментарий (необязательно)">
              <input name="note" maxLength={300} />
            </Field>
            <button className="button small outline-dark">
              <Plus size={16} />
              Записать дивиденды
            </button>
          </form>
        )}
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
          <h4>Передать наличные владельцам (инкассация)</h4>
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

const DIR: Record<string, string> = {
  theory: "Теория",
  yard: "Площадка",
  city: "Город",
  exam: "Экзамен",
  other: "Прочее",
};
const ACC: Record<string, string> = {
  cash: "Касса (наличные)",
  card: "Карта",
  transfer: "Расчётный счёт и переводы",
  owners: "У владельцев (инкассация)",
};
const METHOD: Record<string, string> = {
  cash: "Наличные",
  card: "Карта",
  transfer: "Перевод",
};
const CITYN: Record<string, string> = {
  akhalkalaki: "Ахалкалаки",
  ninotsminda: "Ниноцминда",
  common: "Общие",
};
const Change = ({ v }: { v: number | null }) =>
  v === null ? null : (
    <small className={v >= 0 ? "chg up" : "chg down"}>
      {v >= 0 ? "▲" : "▼"} {Math.abs(v)}% к прошлому периоду
    </small>
  );
function Bars({ rows, max }: { rows: [string, number][]; max?: number }) {
  const top = max || Math.max(1, ...rows.map((r) => r[1]));
  return (
    <ul className="bars">
      {rows.map(([k, n]) => (
        <li key={k}>
          <span>{k}</span>
          <i style={{ width: Math.max(2, (n / top) * 100) + "%" }} />
          <b>{gel(n)}</b>
        </li>
      ))}
    </ul>
  );
}
function Chart({ series }: { series: Row[] }) {
  if (!series.length) return null;
  const max = Math.max(1, ...series.flatMap((x) => [x.received, x.expenses]));
  const w = Math.max(320, series.length * 26);
  return (
    <div className="money-chart" role="img" aria-label="Получено и расходы">
      <svg
        viewBox={`0 0 ${w} 140`}
        width="100%"
        height="140"
        preserveAspectRatio="none"
      >
        {series.map((x, i) => (
          <g key={x.label} transform={`translate(${i * 26 + 4} 0)`}>
            <rect
              y={120 - (x.received / max) * 110}
              width="9"
              height={(x.received / max) * 110}
              fill="#2e7d32"
              rx="2"
            >
              <title>{`${x.label}: получено ${gel(x.received)}`}</title>
            </rect>
            <rect
              x="10"
              y={120 - (x.expenses / max) * 110}
              width="9"
              height={(x.expenses / max) * 110}
              fill="#d6192b"
              rx="2"
            >
              <title>{`${x.label}: расходы ${gel(x.expenses)}`}</title>
            </rect>
          </g>
        ))}
      </svg>
      <small>
        <i style={{ background: "#2e7d32" }} /> получено{" "}
        <i style={{ background: "#d6192b" }} /> расходы · {series[0]!.label} —{" "}
        {series.at(-1)!.label}
      </small>
    </div>
  );
}

/**
 * The administrator's whole picture of the school's money for any interval and branch: where the
 * money lies, what came in, who owes (aged), what went out, what is owed to staff and the result
 * in two ways: real money and what was earned.
 */
export function MoneyOverview({
  onOpenStudent,
}: {
  onOpenStudent?: (id: string, name: string) => void;
}) {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [city, setCity] = useState("");
  const [r, setR] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (from > to) return;
    api("finance/overview", { from, to, city })
      .then((x) => {
        setR(x);
        setError("");
      })
      .catch(() => setError("Не удалось загрузить отчёт."));
  }, [from, to, city, tick]);
  async function adjust(account: string, balance: number) {
    const fact = prompt(
      `Сколько на самом деле в «${ACC[account]}»? Сейчас по учёту: ${(balance / 100).toFixed(2)} ₾.\nВведите фактическую сумму в лари (для первого ввода остатка — начальную).`,
    );
    if (fact === null || fact.trim() === "") return;
    const diff =
      Math.round((Number(fact.replace(",", ".")) - balance / 100) * 100) / 100;
    if (!Number.isFinite(diff) || diff === 0) return;
    const note = prompt(
      `Разница ${diff > 0 ? "+" : ""}${diff} ₾. Причина (например: «начальный остаток», «пересчёт кассы»):`,
    );
    if (!note || note.trim().length < 3) return;
    try {
      await api("finance/adjust", { account, amount: diff, note });
      setTick((x) => x + 1);
    } catch {
      setError("Не удалось записать корректировку.");
    }
  }
  const [sheets, setSheets] = useState<Row | null>(null);
  const [syncMsg, setSyncMsg] = useState("");
  useEffect(() => {
    api("finance/sheets-status", {})
      .then(setSheets)
      .catch(() => {});
  }, []);
  async function syncSheets() {
    setSyncMsg("Синхронизирую…");
    try {
      const x = await api("finance/sheets-sync", {});
      setSyncMsg(
        "Готово: " +
          Object.entries(x.tabs as Record<string, number>)
            .map(([k, n]) => `${k} ${n}`)
            .join(", "),
      );
    } catch {
      setSyncMsg(
        "Не получилось записать в таблицу. Проверьте доступ таблицы для сервисного адреса.",
      );
    }
  }
  function csv() {
    if (!r) return;
    const rows: (string | number)[][] = [
      [
        "Motion Drive: деньги",
        `${r.from} — ${r.to}`,
        r.city ? CITYN[r.city] : "все филиалы",
      ],
      [],
      ["Раздел", "Показатель", "₾"],
      ["Итог", "Получено − расходы − выплаты", r.result.cash / 100],
      [
        "Итог",
        "Заработано − расходы − начисленные зарплаты",
        r.result.accrual / 100,
      ],
      ["Итог", "После дивидендов", r.result.afterDividends / 100],
      ["Доходы", "Выставлено", r.income.charged / 100],
      ["Доходы", "Получено", r.income.received / 100],
      ...Object.entries(r.income.byKind).map(([k, n]) => [
        "Выставлено по направлениям",
        DIR[k] || k,
        (n as number) / 100,
      ]),
      ...Object.entries(r.income.byMethod).map(([k, n]) => [
        "Получено по способам",
        METHOD[k] || k,
        (n as number) / 100,
      ]),
      ["Долги", "Всего", r.receivables.total / 100],
      ["Долги", "До 7 дней", r.receivables.current / 100],
      ["Долги", "8–30 дней", r.receivables.month / 100],
      ["Долги", "Свыше 30 дней", r.receivables.old / 100],
      ...r.receivables.top.map((d: Row) => ["Должники", d.name, d.total / 100]),
      ["Расходы", "Всего", r.expenses.total / 100],
      ...(r.categories as Row[])
        .filter((c) => r.expenses.byCategory[c.id])
        .map((c) => [
          "Расходы по статьям",
          c.label,
          r.expenses.byCategory[c.id] / 100,
        ]),
      ...r.expenses.dividendsBy.map((d: Row) => [
        "Дивиденды (за период)",
        d.name,
        d.period / 100,
      ]),
      ["Зарплаты", "Начислено", r.payroll.accrued / 100],
      ["Зарплаты", "Выплачено", r.payroll.paid / 100],
      ["Зарплаты", "Долг школы сотрудникам", r.payroll.owed / 100],
      ...r.payroll.rows.map((x: Row) => [
        "Сотрудники",
        x.name,
        x.accrued / 100,
      ]),
      ...Object.entries(r.accounts).map(([k, x]) => [
        "Остатки",
        ACC[k] || k,
        (x as Row).balance / 100,
      ]),
    ];
    const text = rows
      .map((row) =>
        row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `motion-drive-dengi-${r.from}-${r.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="finance money">
      <h3>Деньги</h3>
      <Interval from={from} to={to} setFrom={setFrom} setTo={setTo} />
      <div className="finance-toolbar">
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          aria-label="Филиал"
        >
          <option value="">Все филиалы</option>
          <option value="akhalkalaki">Ахалкалаки</option>
          <option value="ninotsminda">Ниноцминда</option>
        </select>
        <button
          type="button"
          className="button small outline-dark"
          onClick={csv}
          disabled={!r}
        >
          Скачать для Excel / Google Таблиц
        </button>
      </div>
      {sheets && (
        <div className="notice sheets-note">
          {sheets.configured ? (
            <>
              <span>
                Google Таблица подключена: каждая операция добавляется в лист
                «Журнал» сама.{" "}
                <a href={sheets.url} target="_blank" rel="noopener noreferrer">
                  Открыть таблицу
                </a>
              </span>
              <button
                type="button"
                className="button small outline-dark"
                onClick={syncSheets}
              >
                Обновить все листы
              </button>
              {syncMsg && <small>{syncMsg}</small>}
            </>
          ) : (
            <details>
              <summary>Google Таблица не подключена. Как подключить</summary>
              <ol>
                <li>
                  В Google Cloud создайте сервисный аккаунт и скачайте его ключ
                  (JSON), включите Google Sheets API.
                </li>
                <li>
                  Создайте таблицу и дайте доступ «Редактор» адресу сервисного
                  аккаунта из ключа (client_email).
                </li>
                <li>
                  В Vercel добавьте переменные:{" "}
                  <code>GOOGLE_SERVICE_ACCOUNT_JSON</code> (содержимое ключа) и{" "}
                  <code>GOOGLE_SHEET_ID</code> (часть адреса таблицы между /d/ и
                  /edit).
                </li>
                <li>
                  Перезапустите сайт — здесь появится кнопка «Обновить все
                  листы».
                </li>
              </ol>
            </details>
          )}
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {from > to && <Notice>Дата «С» позже даты «По».</Notice>}
      {r && (
        <>
          <div className="stat-cards">
            <article className={r.result.cash < 0 ? "owe" : ""}>
              <small>Реальные деньги за период</small>
              <strong>{gel(r.result.cash)}</strong>
              <small>получено − расходы − выплаты сотрудникам</small>
            </article>
            <article className={r.result.accrual < 0 ? "owe" : ""}>
              <small>Заработано за период</small>
              <strong>{gel(r.result.accrual)}</strong>
              <small>выставлено − расходы − начисленные зарплаты</small>
            </article>
            <article>
              <small>Остаётся после дивидендов</small>
              <strong>{gel(r.result.afterDividends)}</strong>
              <small>дивиденды: {gel(r.expenses.dividends)}</small>
            </article>
          </div>

          <h4>Где деньги сейчас</h4>
          <div className="stat-cards">
            {Object.entries(r.accounts as Record<string, Row>).map(([k, x]) => (
              <article key={k} className={x.balance < 0 ? "owe" : ""}>
                <small>{ACC[k]}</small>
                <strong>{gel(x.balance)}</strong>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => adjust(k, x.balance)}
                >
                  Сверить / ввести остаток
                </button>
              </article>
            ))}
            <article>
              <small>Всего на счетах</small>
              <strong>
                {gel(
                  Object.values(r.accounts as Record<string, Row>).reduce(
                    (s, x) => s + x.balance,
                    0,
                  ),
                )}
              </strong>
              <small>ещё должны ученики: {gel(r.receivables.total)}</small>
            </article>
          </div>
          {r.adjustments.length > 0 && (
            <details>
              <summary>Корректировки остатков ({r.adjustments.length})</summary>
              <ul className="ledger">
                {r.adjustments.map((x: Row) => (
                  <li key={x.id}>
                    <span>
                      {String(x.created)
                        .slice(0, 10)
                        .split("-")
                        .reverse()
                        .join(".")}
                    </span>
                    <span>
                      {ACC[x.account]} · {x.note}
                    </span>
                    <b>
                      {x.amount >= 0 ? "+" : "−"}
                      {gel(Math.abs(x.amount))}
                    </b>
                    <button
                      type="button"
                      className="link-button"
                      onClick={async () => {
                        await api("finance/adjust-void", { id: x.id });
                        setTick((n) => n + 1);
                      }}
                    >
                      отменить
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <h4>Доходы</h4>
          <div className="stat-cards">
            <article>
              <small>Получено</small>
              <strong>{gel(r.income.received)}</strong>
              <Change v={r.income.change.received} />
            </article>
            <article>
              <small>Выставлено ученикам</small>
              <strong>{gel(r.income.charged)}</strong>
              <Change v={r.income.change.charged} />
            </article>
          </div>
          <Chart series={r.series} />
          <div className="two-cols">
            <div>
              <h5>Выставлено по направлениям</h5>
              <Bars
                rows={Object.entries(
                  r.income.byKind as Record<string, number>,
                ).map(([k, n]) => [DIR[k] || k, n])}
              />
            </div>
            <div>
              <h5>Получено по способам</h5>
              <Bars
                rows={Object.entries(
                  r.income.byMethod as Record<string, number>,
                ).map(([k, n]) => [METHOD[k] || k, n])}
              />
              {!r.city && (
                <>
                  <h5>Получено по филиалам</h5>
                  <Bars
                    rows={Object.entries(
                      r.income.byCity as Record<string, number>,
                    ).map(([k, n]) => [CITYN[k] || k, n])}
                  />
                </>
              )}
            </div>
          </div>

          <h4>Кто должен ({r.receivables.count})</h4>
          <div className="stat-cards">
            <article>
              <small>Всего должны</small>
              <strong>{gel(r.receivables.total)}</strong>
            </article>
            <article>
              <small>До 7 дней</small>
              <strong>{gel(r.receivables.current)}</strong>
            </article>
            <article>
              <small>8–30 дней</small>
              <strong>{gel(r.receivables.month)}</strong>
            </article>
            <article className={r.receivables.old ? "owe" : ""}>
              <small>Больше 30 дней</small>
              <strong>{gel(r.receivables.old)}</strong>
            </article>
          </div>
          {r.receivables.top.length > 0 && (
            <ul className="ledger">
              {r.receivables.top.map((d: Row) => (
                <li key={d.id}>
                  <span>
                    {onOpenStudent ? (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => onOpenStudent(d.id, d.name)}
                      >
                        {d.name}
                      </button>
                    ) : (
                      d.name
                    )}
                  </span>
                  <span>
                    {d.phone ? (
                      <a href={"tel:" + d.phone}>{formatPhone(d.phone)}</a>
                    ) : (
                      ""
                    )}{" "}
                    · долг {d.oldestDays} дн.
                  </span>
                  <b>{gel(d.total)}</b>
                </li>
              ))}
            </ul>
          )}

          <h4>Расходы</h4>
          <div className="stat-cards">
            <article>
              <small>Расходы за период</small>
              <strong>{gel(r.expenses.total)}</strong>
              <Change v={r.expenses.change} />
            </article>
          </div>
          <div className="two-cols">
            <div>
              <h5>По статьям</h5>
              <Bars
                rows={(r.categories as Row[])
                  .filter((c) => r.expenses.byCategory[c.id])
                  .map((c) => [c.label, r.expenses.byCategory[c.id]])}
              />
            </div>
            <div>
              <h5>По филиалам</h5>
              <Bars
                rows={Object.entries(
                  r.expenses.byCity as Record<string, number>,
                ).map(([k, n]) => [CITYN[k] || k, n])}
              />
            </div>
          </div>

          {r.expenses.dividendsBy.length > 0 && (
            <>
              <h4>Дивиденды владельцев</h4>
              <p className="muted">
                По факту: кто сколько взял за выбранный период и за всё время.
              </p>
              <ul className="ledger">
                {r.expenses.dividendsBy.map((d: Row) => (
                  <li key={d.id}>
                    <span>{d.name}</span>
                    <span>за всё время {gel(d.total)}</span>
                    <b>{gel(d.period)}</b>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h4>Зарплаты</h4>
          <div className="stat-cards">
            <article>
              <small>Начислено за месяцы периода</small>
              <strong>{gel(r.payroll.accrued)}</strong>
            </article>
            <article>
              <small>Выплачено в периоде</small>
              <strong>{gel(r.payroll.paid)}</strong>
            </article>
            <article className={r.payroll.owed ? "owe" : ""}>
              <small>Школа должна сотрудникам сейчас</small>
              <strong>{gel(r.payroll.owed)}</strong>
            </article>
          </div>
          {r.payroll.rows.length > 0 && (
            <ul className="ledger">
              {r.payroll.rows.map((x: Row) => (
                <li key={x.id}>
                  <span>{x.name}</span>
                  <span>
                    начислено {gel(x.accrued)} · выплачено {gel(x.paid)}
                  </span>
                  <b>
                    {x.debt
                      ? "долг " + gel(x.debt)
                      : x.advance
                        ? "аванс вперёд " + gel(x.advance)
                        : "в расчёте"}
                  </b>
                </li>
              ))}
            </ul>
          )}

          {r.directions.length > 0 && (
            <>
              <h4>Что выгодно: по направлениям</h4>
              <p className="muted">
                Выставлено минус оплата преподавателей этого направления. Оклады
                ({gel(r.payroll.fixed)}) считаются общими и сюда не входят.
              </p>
              <ul className="ledger">
                {r.directions.map((d: Row) => (
                  <li key={d.kind}>
                    <span>{DIR[d.kind]}</span>
                    <span>
                      выставлено {gel(d.charged)} · преподавателям{" "}
                      {gel(d.teachers)}
                      {d.lessons ? ` · уроков ${d.lessons}` : ""}
                    </span>
                    <b className={d.margin < 0 ? "debt-left" : ""}>
                      {gel(d.margin)}
                    </b>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
