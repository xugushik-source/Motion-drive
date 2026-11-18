"use client";
import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, Notice } from "./Site";
import { gel } from "./Finance";

type Row = Record<string, any>;
const ROLE: Record<string, string> = {
  admin: "Администратор",
  manager: "Менеджмент",
  operator: "Оператор",
  instructor: "Инструктор",
  lecturer: "Лектор",
};
const KIND: Record<string, string> = {
  salary: "Оклад",
  bonus: "Бонус (каждый месяц)",
  percent: "Процент от оклада",
  per_lesson: "За каждый принятый урок",
  premium: "Разовая премия",
};
const monthName = (m: string) =>
  new Date(m + "-15T12:00:00Z").toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
const itemText = (i: Row) =>
  i.kind === "percent" ? `${i.percent}% от оклада` : gel(Number(i.amount || 0));

/** Own pay for a month: salary and every extra, so the person sees how the total is made up. */
export function MySalary() {
  const [month, setMonth] = useState("");
  const [d, setD] = useState<Row | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api("payroll/me", month ? { month } : {})
      .then(setD)
      .catch(() => setError("Не удалось загрузить данные."));
  }, [month]);
  if (error)
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  if (!d) return <Notice>Загрузка…</Notice>;
  const empty = !d.items.length;
  return (
    <div className="finance">
      <div className="finance-toolbar">
        <label>
          Месяц{" "}
          <input
            type="month"
            value={month || d.month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
      </div>
      {empty && (
        <Notice>
          За этот месяц ничего не начислено. Оклад и доплаты вносит
          администратор.
        </Notice>
      )}
      <div className="stat-cards">
        <article>
          <small>Итого за {monthName(d.month)}</small>
          <strong>{gel(d.total)}</strong>
        </article>
        <article>
          <small>Оклад</small>
          <strong>{gel(d.salary)}</strong>
        </article>
        <article>
          <small>Бонусы и проценты</small>
          <strong>{gel(d.bonus + d.percent + d.perLesson)}</strong>
        </article>
        <article>
          <small>Премии</small>
          <strong>{gel(d.premium)}</strong>
        </article>
      </div>
      {!empty && (
        <ul className="ledger">
          {d.items.map((i: Row) => (
            <li key={i.id} className="payment">
              <span>{KIND[i.kind]}</span>
              <span>{i.title && i.title !== "Оклад" ? i.title : ""}</span>
              <b>{itemText(i)}</b>
            </li>
          ))}
        </ul>
      )}
      {(d.lessons > 0 || d.pending > 0) && (
        <p className="muted">
          Принято уроков в этом месяце: {d.lessons}. Ждут принятия: {d.pending}.
        </p>
      )}
    </div>
  );
}

/** Administrators: every employee's pay for a month, with the salary and the extras to add. */
export function PayrollReport() {
  const [month, setMonth] = useState("");
  const [d, setD] = useState<Row | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(async () => {
    try {
      setD(await api("finance/payroll", month ? { month } : {}));
    } catch {
      setMsg({ ok: false, text: "Не удалось загрузить данные." });
    }
  }, [month]);
  useEffect(() => {
    load();
  }, [load]);
  async function call(path: string, body: Row) {
    setMsg(null);
    try {
      await api(path, body);
      await load();
      setMsg({ ok: true, text: "Сохранено" });
      return true;
    } catch {
      setMsg({ ok: false, text: "Не получилось. Проверьте данные." });
      return false;
    }
  }
  if (!d)
    return msg ? (
      <p className="error" role="alert">
        {msg.text}
      </p>
    ) : (
      <Notice>Загрузка…</Notice>
    );
  return (
    <div className="finance">
      {msg && (
        <p
          className={msg.ok ? "success" : "error"}
          role={msg.ok ? "status" : "alert"}
        >
          {msg.text}
        </p>
      )}
      <div className="finance-toolbar">
        <label>
          Месяц{" "}
          <input
            type="month"
            value={month || d.month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <strong>
          {monthName(d.month)}: всего к выплате {gel(d.total)}
        </strong>
      </div>
      <p className="muted">
        Сначала впишите оклад. Бонусы, проценты и премии добавляются сверху.
        Бонус и процент действуют каждый месяц, пока вы их не уберёте, разовая
        премия только в выбранном месяце.
      </p>
      <div className="debt-list">
        {d.rows.map((r: Row) => (
          <article
            className={"debt-card" + (r.active ? "" : " app-closed")}
            key={r.id}
          >
            <div>
              <strong>{r.name}</strong>
              <small>
                {ROLE[r.role]}
                {r.active ? "" : " · доступ закрыт"}
              </small>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const amount = Number(
                  new FormData(e.currentTarget).get("salary") || 0,
                );
                await call("finance/pay-salary", {
                  user_id: r.id,
                  amount,
                  from_month: d.month,
                });
              }}
            >
              <label>
                Оклад в месяц, ₾
                <input
                  name="salary"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  defaultValue={r.salary ? r.salary / 100 : ""}
                  key={r.id + d.month + r.salary}
                  required
                />
              </label>
              <button className="button small outline-dark">
                Сохранить оклад
              </button>
            </form>
            {r.items
              .filter((i: Row) => i.kind !== "salary")
              .map((i: Row) => (
                <p key={i.id} className="pay-line">
                  <span>
                    {KIND[i.kind]}
                    {i.title ? ` · ${i.title}` : ""}: <b>{itemText(i)}</b>
                  </span>
                  <button
                    type="button"
                    className="link-button"
                    aria-label="Убрать"
                    onClick={() =>
                      confirm("Убрать эту доплату?") &&
                      call("finance/pay-void", { id: i.id })
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </p>
              ))}
            {r.lessons > 0 && (
              <p className="muted">Принято уроков: {r.lessons}</p>
            )}
            <p>
              К выплате: <b>{gel(r.total)}</b>
            </p>
            <details className="pay-add">
              <summary>
                <Plus size={14} /> Добавить бонус, процент или премию
              </summary>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = e.currentTarget;
                  const x = Object.fromEntries(new FormData(f));
                  const body: Row = {
                    user_id: r.id,
                    kind: x.kind,
                    title: x.title || "",
                    from_month: d.month,
                  };
                  if (x.kind === "percent") body.percent = x.value;
                  else body.amount = x.value;
                  if (await call("finance/pay-add", body)) f.reset();
                }}
              >
                <select name="kind" defaultValue="premium">
                  <option value="premium">
                    Разовая премия (в этом месяце)
                  </option>
                  <option value="bonus">Бонус каждый месяц (₾)</option>
                  <option value="percent">Процент от оклада (%)</option>
                  <option value="per_lesson">
                    За каждый принятый урок (₾)
                  </option>
                </select>
                <input
                  name="title"
                  placeholder="За что (необязательно)"
                  maxLength={200}
                />
                <input
                  name="value"
                  type="number"
                  step="0.01"
                  min="0.01"
                  inputMode="decimal"
                  placeholder="Сумма или %"
                  required
                />
                <button className="button small">Добавить</button>
              </form>
            </details>
          </article>
        ))}
        {!d.rows.length && <Notice>Сотрудников пока нет.</Notice>}
      </div>
    </div>
  );
}
