"use client";
import { useCallback, useEffect, useState } from "react";
import { api, Notice } from "./Site";
import { gel } from "./Finance";

type Row = Record<string, any>;
const PROGRAM: Record<string, string> = {
  practice: "Вождение",
  theory: "Теория",
  individual: "Индивидуально",
  group: "Группа",
  exam: "Экзамен",
};
const when = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("ru-RU", {
        timeZone: "Asia/Tbilisi",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

/** A teacher's own earnings: accepted lessons today and this month, and what still waits for the office. */
export function MySalary() {
  const [d, setD] = useState<Row | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api("payroll/me", {})
      .then(setD)
      .catch(() => setError("Не удалось загрузить данные."));
  }, []);
  if (error)
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  if (!d) return <Notice>Загрузка…</Notice>;
  return (
    <div className="finance">
      {d.rate === null && (
        <Notice>
          Ставка за урок ещё не задана. Администратор задаст её, после этого
          принятые уроки начнут считаться.
        </Notice>
      )}
      <div className="stat-cards">
        <article>
          <small>Ставка за урок</small>
          <strong>{d.rate === null ? "—" : gel(d.rate)}</strong>
        </article>
        <article>
          <small>Сегодня принято</small>
          <strong>{gel(d.today.amount)}</strong>
          <small>{d.today.lessons} ур.</small>
        </article>
        <article>
          <small>За месяц принято</small>
          <strong>{gel(d.month.amount)}</strong>
          <small>{d.month.lessons} ур.</small>
        </article>
        <article>
          <small>Ждут принятия</small>
          <strong>{d.pending}</strong>
          <small>
            {d.pending ? `≈ ${gel(d.pendingAmount)}` : "всё принято"}
          </small>
        </article>
      </div>
      <h4>Принятые уроки за месяц</h4>
      {d.items.length ? (
        <ul className="ledger">
          {d.items.map((r: Row) => (
            <li key={r.id} className="payment">
              <span>{when(r.start || r.at)}</span>
              <span>{PROGRAM[r.program] || r.program}</span>
              <b>+{gel(r.amount)}</b>
            </li>
          ))}
        </ul>
      ) : (
        <Notice>Принятых уроков в этом месяце пока нет.</Notice>
      )}
    </div>
  );
}

/** Administrators: every teacher's lessons and pay for a month, and the rate per lesson. */
export function PayrollReport({
  onRate,
}: {
  onRate: (id: string, rate: number) => Promise<void>;
}) {
  const [month, setMonth] = useState("");
  const [d, setD] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setD(await api("finance/payroll", month ? { month } : {}));
    } catch {
      setError("Не удалось загрузить данные.");
    }
  }, [month]);
  useEffect(() => {
    load();
  }, [load]);
  if (error)
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  if (!d) return <Notice>Загрузка…</Notice>;
  const label = new Date(d.month).toLocaleDateString("ru-RU", {
    timeZone: "Asia/Tbilisi",
    month: "long",
    year: "numeric",
  });
  return (
    <div className="finance">
      <div className="finance-toolbar">
        <label>
          Месяц{" "}
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <strong>
          {label}: всего {gel(d.total)}
        </strong>
      </div>
      <p className="muted">
        Оплата сдельная: принятые уроки умножаются на ставку за урок. Ставку
        можно менять в любой момент: она действует на уроки, принятые после
        изменения.
      </p>
      <div className="debt-list">
        {d.rows.map((r: Row) => (
          <article className="debt-card" key={r.id}>
            <div>
              <strong>{r.name}</strong>
              <small>
                {r.role === "lecturer" ? "Лектор" : "Инструктор"}
                {r.active ? "" : " · доступ закрыт"}
              </small>
            </div>
            <p>
              Принято уроков: <b>{r.lessons}</b>
            </p>
            <p>
              К выплате: <b>{gel(r.amount)}</b>
            </p>
            {r.waiting > 0 && (
              <p className="debt-left">Ждут принятия: {r.waiting}</p>
            )}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const v = Number(
                  new FormData(e.currentTarget).get("rate") || 0,
                );
                await onRate(r.id, v);
                await load();
              }}
            >
              <label>
                Ставка за урок, ₾
                <input
                  name="rate"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  defaultValue={r.rate === null ? "" : r.rate / 100}
                  key={r.id + String(r.rate)}
                  required
                />
              </label>
              <button className="button small outline-dark">Сохранить</button>
            </form>
          </article>
        ))}
        {!d.rows.length && <Notice>Инструкторов и лекторов пока нет.</Notice>}
      </div>
    </div>
  );
}
