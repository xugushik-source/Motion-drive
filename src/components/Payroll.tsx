"use client";
import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, Notice } from "./Site";
import { gel } from "./Finance";

type Row = Record<string, any>;
const ROLE: Record<string, string> = {
  admin: "Владелец",
  manager: "Менеджмент",
  operator: "Администратор",
  instructor: "Инструктор",
  lecturer: "Лектор",
};
const KIND: Record<string, string> = {
  salary: "Оклад",
  bonus: "Бонус (каждый месяц)",
  percent: "Процент от оклада",
  per_lesson: "За каждый принятый урок",
  per_student: "За ученика",
  premium: "Разовая премия",
};
const PAYKIND: Record<string, string> = {
  salary: "Зарплата",
  advance: "Аванс",
};
const dayOf = (iso?: string) =>
  (iso || "").slice(0, 10).split("-").reverse().join(".");
const monthName = (m: string) =>
  new Date(m + "-15T12:00:00Z").toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
const shift = (m: string, by: number) => {
  const [y, mo] = m.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, mo - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const previous = (m: string) => shift(m, -1);
const following = (m: string) => shift(m, 1);
const SCOPE: Record<string, string> = {
  yard: "площадка",
  city: "город",
  theory: "теория",
  exam: "экзамен",
  akhalkalaki: "группа, Ахалкалаки",
  ninotsminda: "группа, Ниноцминда",
  visiting: "выездная группа",
  individual: "индивидуально и мини-группы",
};
/** What a pay item is called, with the kind of lesson or group it applies to. */
const itemName = (i: Row) =>
  `${KIND[i.kind]}${i.scope ? ` · ${SCOPE[i.scope] || i.scope}` : ""}`;
const itemText = (i: Row) =>
  i.kind === "percent"
    ? `${i.percent}% от оклада`
    : i.percent
      ? `${i.percent}% от стоимости курса`
      : gel(Number(i.amount || 0)) +
        (i.kind === "per_lesson"
          ? " за урок"
          : i.kind === "per_student"
            ? " за ученика"
            : "");

/**
 * An employee's own month: hours and lessons only. Rates, totals and balances are for administrators.
 * Advances handed over are confirmed here, and so is the final salary (without any figure).
 */
export function MySalary() {
  const [month, setMonth] = useState("");
  const [d, setD] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(
    () =>
      api("payroll/me", month ? { month } : {})
        .then(setD)
        .catch(() => setError("Не удалось загрузить данные.")),
    [month],
  );
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
  const kinds = Object.entries(d.lessonsByKind as Record<string, number>);
  const groups = Object.entries(d.studentsByScope as Record<string, number>);
  return (
    <div className="finance">
      {d.pendingPayouts.map((x: Row) => (
        <div className="notice payout-note" key={x.id} role="status">
          <span>
            {x.kind === "advance" ? (
              <>
                Вам выплатили аванс <b>{gel(x.amount)}</b> ({dayOf(x.created)}
                {x.note ? ` · ${x.note}` : ""}). Получили?
              </>
            ) : (
              <>
                Зарплата выплачена ({dayOf(x.created)}). Получили всё, долга
                нет?
              </>
            )}
          </span>
          <button
            className="button small"
            onClick={async () => {
              await api("payroll/confirm", { id: x.id });
              await load();
            }}
          >
            {x.kind === "advance"
              ? "Получил(а) аванс"
              : "Получил(а), долга нет"}
          </button>
        </div>
      ))}
      <div className="month-nav">
        <button
          className="icon-button"
          aria-label="Предыдущий месяц"
          onClick={() => setMonth(previous(d.month))}
        >
          ‹
        </button>
        <strong>{monthName(d.month)}</strong>
        <button
          className="icon-button"
          aria-label="Следующий месяц"
          onClick={() => setMonth(following(d.month))}
        >
          ›
        </button>
      </div>
      <div className="stat-cards">
        <article>
          <small>Принятых уроков</small>
          <strong>{d.lessons}</strong>
        </article>
        {d.students > 0 && (
          <article>
            <small>Учеников в группах</small>
            <strong>{d.students}</strong>
          </article>
        )}
        <article>
          <small>Ждут принятия офисом</small>
          <strong>{d.pending}</strong>
        </article>
      </div>
      {kinds.length > 0 && (
        <ul className="ledger">
          {kinds.map(([k, n]) => (
            <li key={k}>
              <span>{SCOPE[k] || k}</span>
              <b>{n}</b>
            </li>
          ))}
        </ul>
      )}
      {groups.length > 0 && (
        <ul className="ledger">
          {groups.map(([k, n]) => (
            <li key={k}>
              <span>{SCOPE[k] || k}</span>
              <b>{n}</b>
            </li>
          ))}
        </ul>
      )}
      {d.receivedPayouts.length > 0 && (
        <>
          <h4>Подтверждённые выплаты</h4>
          <ul className="ledger">
            {d.receivedPayouts.map((x: Row) => (
              <li key={x.id}>
                <span>{dayOf(x.created)}</span>
                <span>{PAYKIND[x.kind]}</span>
                <b>{x.amount === null ? "получено" : gel(x.amount)}</b>
              </li>
            ))}
          </ul>
        </>
      )}
      <Notice>Суммы и ставки видят только владельцы.</Notice>
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
            {r.items.some((i: Row) => i.kind === "salary" && i.fromRole) &&
              !r.items.some((i: Row) => i.kind === "salary" && !i.fromRole) && (
                <small className="muted">
                  Оклад по должности. Если записать здесь другой, он заменит
                  оклад должности для этого человека.
                </small>
              )}
            {r.items
              .filter((i: Row) => i.kind !== "salary")
              .map((i: Row) => (
                <p key={i.id} className="pay-line">
                  <span>
                    {itemName(i)}
                    {i.title && !i.scope ? ` · ${i.title}` : ""}:{" "}
                    <b>{itemText(i)}</b>
                    {i.fromRole && <small> · по должности</small>}
                  </span>
                  {!i.fromRole && (
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
                  )}
                </p>
              ))}
            {r.lessons > 0 && (
              <p className="muted">Принято уроков: {r.lessons}</p>
            )}
            <p>
              За выбранный месяц: <b>{gel(r.total)}</b>
            </p>
            <p className={r.ledger.debt ? "debt-left" : "debt-ok"}>
              {r.ledger.debt
                ? `Долг сотруднику: ${gel(r.ledger.debt)}`
                : r.ledger.advance
                  ? `Аванс вперёд: ${gel(r.ledger.advance)}`
                  : r.ledger.accrued
                    ? "Закрыто, долга нет"
                    : "Пока ничего не начислено"}
            </p>
            <p className="muted">
              Начислено всего {gel(r.ledger.accrued)} · получено{" "}
              {gel(r.ledger.paid)}
            </p>
            {r.ledger.pending.map((x: Row) => (
              <p key={x.id} className="pay-line">
                <span>
                  Ждёт подтверждения: <b>{gel(x.amount)}</b> ({PAYKIND[x.kind]},{" "}
                  {dayOf(x.created)})
                </span>
                <span>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() =>
                      call("finance/pay-out-confirm", { id: x.id })
                    }
                  >
                    Получено
                  </button>{" "}
                  <button
                    type="button"
                    className="link-button"
                    onClick={() =>
                      confirm("Отменить эту выплату?") &&
                      call("finance/pay-out-void", { id: x.id })
                    }
                  >
                    Отменить
                  </button>
                </span>
              </p>
            ))}
            <details className="pay-add">
              <summary>
                <Plus size={14} /> Записать выплату
              </summary>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = e.currentTarget;
                  const x = Object.fromEntries(new FormData(f));
                  if (
                    await call("finance/pay-out", {
                      user_id: r.id,
                      amount: x.amount,
                      kind: x.kind,
                      method: x.method || "cash",
                      note: x.note || "",
                    })
                  )
                    f.reset();
                }}
              >
                <select name="kind" defaultValue="salary">
                  <option value="salary">Зарплата</option>
                  <option value="advance">Аванс</option>
                </select>
                <select
                  name="method"
                  defaultValue="cash"
                  aria-label="Чем выплачено"
                >
                  <option value="cash">Из кассы (наличные)</option>
                  <option value="card">С карты</option>
                  <option value="transfer">С расчётного счёта</option>
                  <option value="owners">Из денег владельцев</option>
                </select>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  inputMode="decimal"
                  placeholder={
                    r.ledger.debt
                      ? `Сумма (долг ${r.ledger.debt / 100})`
                      : "Сумма, ₾"
                  }
                  required
                />
                <input
                  name="note"
                  placeholder="Комментарий (необязательно)"
                  maxLength={200}
                />
                <button className="button small">Записать выплату</button>
                <small className="muted">
                  Сотрудник увидит выплату у себя и нажмёт «Получил(а)». До
                  этого она не уменьшает долг.
                </small>
              </form>
            </details>
            <details className="pay-add">
              <summary>
                <Plus size={14} /> Добавить бонус, процент или премию
              </summary>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = e.currentTarget;
                  const x = Object.fromEntries(new FormData(f));
                  const [kindRaw, scope = ""] = String(x.kind).split("|");
                  const byPercent =
                    kindRaw === "percent" || kindRaw.endsWith("%");
                  const body: Row = {
                    user_id: r.id,
                    kind: kindRaw.replace("%", ""),
                    scope,
                    title: x.title || "",
                    from_month: d.month,
                  };
                  if (byPercent) body.percent = x.value;
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
                  <optgroup label="За принятый урок (₾)">
                    <option value="per_lesson|yard">Урок на площадке</option>
                    <option value="per_lesson|city">Урок в городе</option>
                    <option value="per_lesson|theory">Урок теории</option>
                    <option value="per_lesson|exam">
                      Экзаменационный урок
                    </option>
                    <option value="per_lesson|">Любой урок</option>
                  </optgroup>
                  <optgroup label="За ученика в группе (₾)">
                    <option value="per_student|akhalkalaki">
                      Группа, Ахалкалаки
                    </option>
                    <option value="per_student|ninotsminda">
                      Группа, Ниноцминда
                    </option>
                    <option value="per_student|visiting">
                      Выездная группа
                    </option>
                  </optgroup>
                  <optgroup label="Процент от стоимости курса (%)">
                    <option value="per_student%|individual">
                      Индивидуально и мини-группы
                    </option>
                  </optgroup>
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
