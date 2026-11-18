"use client";
import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, Field, Notice } from "./Site";
import { gel } from "./Finance";

type Row = Record<string, any>;
const LABEL: Record<string, string> = {
  admin: "Владелец",
  operator: "Администратор",
  instructor: "Инструктор",
  lecturer: "Лектор",
  manager: "Менеджмент",
};
const RIGHTS: Record<string, string> = {
  admin:
    "Видит всё: деньги, зарплаты, остатки, дивиденды, настройки, должности, создаёт сотрудников.",
  operator:
    "Заявки и занятия, расписание, ученики, оплаты и долги, касса и мелкие расходы, инкассация владельцам, фото и тексты сайта. Не видит общие итоги, зарплаты и крупные расходы.",
  instructor:
    "Свои занятия и свои ученики, отмечает «урок проведён». Видит часы и авансы, но не ставки и суммы.",
  lecturer:
    "Как инструктор, для теории: свои группы и ученики. Видит часы и авансы, но не ставки и суммы.",
  manager: "Как администратор (отдельная должность на будущее).",
};
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
const KIND: Record<string, string> = {
  salary: "Оклад в месяц",
  bonus: "Бонус каждый месяц",
  percent: "Процент от оклада",
  per_lesson: "За каждый принятый урок",
  per_student: "За ученика",
  premium: "Премия",
};
/** Ready combinations for the "add a rule" form: kind | scope. */
const CHOICES: [string, string, string][] = [
  ["salary|", "Оклад в месяц", "₾"],
  ["bonus|", "Бонус каждый месяц", "₾"],
  ["percent|", "Процент от оклада", "%"],
  ["per_lesson|yard", "За урок на площадке", "₾"],
  ["per_lesson|city", "За урок в городе", "₾"],
  ["per_lesson|theory", "За урок теории", "₾"],
  ["per_lesson|exam", "За выезд на экзамен", "₾"],
  ["per_student|akhalkalaki", "За ученика, группа Ахалкалаки", "₾"],
  ["per_student|ninotsminda", "За ученика, группа Ниноцминда", "₾"],
  ["per_student|visiting", "За ученика, выездная группа", "₾"],
  [
    "per_student|individual",
    "Индивидуально и мини-группы, % от цены курса",
    "%",
  ],
];
const monthLabel = (m: string) =>
  new Date(m + "-15T12:00:00Z").toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
const text = (r: Row) =>
  r.percent
    ? `${r.percent}% ${r.kind === "percent" ? "от оклада" : "от цены курса"}`
    : gel(Number(r.amount || 0));

/**
 * Roles: every role carries its own rules (rights, pay, working hours). A person gets a role and is paid
 * by it; a change is made "from month X" and never rewrites earlier months.
 */
export default function Roles() {
  const [d, setD] = useState<Row | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(
    () =>
      api("finance/role-rules", {})
        .then(setD)
        .catch(() => setMsg({ ok: false, text: "Не удалось загрузить." })),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);
  async function call(path: string, body: Row, ok = "Сохранено") {
    setMsg(null);
    try {
      await api(path, body);
      await load();
      setMsg({ ok: true, text: ok });
      return true;
    } catch {
      setMsg({ ok: false, text: "Не получилось. Проверьте данные." });
      return false;
    }
  }
  if (!d)
    return msg ? (
      <p className="error">{msg.text}</p>
    ) : (
      <Notice>Загрузка…</Notice>
    );
  return (
    <div className="finance roles">
      <p className="muted">
        Здесь правила каждой должности. Человек получает должность и работает и
        получает деньги по этим правилам. Изменение действует «с месяца»,
        прошлые месяцы не пересчитываются.
      </p>
      {msg && (
        <p
          className={msg.ok ? "success" : "error"}
          role={msg.ok ? "status" : "alert"}
        >
          {msg.text}
        </p>
      )}
      {(d.roles as Row[]).map((r) => (
        <section className="role-card form-card" key={r.role}>
          <h3>{LABEL[r.role]}</h3>
          <p className="muted">{RIGHTS[r.role]}</p>
          <p>
            <b>Люди ({r.people.length}):</b>{" "}
            {r.people.length
              ? r.people.map((p: Row) => p.name).join(", ")
              : "пока никого"}
          </p>
          <h4>Оплата</h4>
          {r.rules.length ? (
            <ul className="ledger">
              {r.rules.map((x: Row) => (
                <li key={x.id}>
                  <span>
                    {KIND[x.kind]}
                    {x.scope ? " · " + (SCOPE[x.scope] || x.scope) : ""}
                  </span>
                  <b>{text(x)}</b>
                  <small>
                    {x.from_month <= "2020-01"
                      ? "действует с начала"
                      : "с месяца: " + monthLabel(x.from_month)}
                  </small>
                  <button
                    type="button"
                    className="link-button"
                    aria-label="Убрать"
                    onClick={() =>
                      confirm("Убрать это правило с текущего месяца?") &&
                      call("finance/role-rule-end", { id: x.id })
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              {r.role === "admin"
                ? "У владельцев нет оплаты: они берут дивиденды по факту."
                : "Правил оплаты нет."}
            </p>
          )}
          {r.role !== "admin" && (
            <details className="pay-add">
              <summary>
                <Plus size={14} /> Добавить или изменить правило
              </summary>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = e.currentTarget;
                  const x = Object.fromEntries(new FormData(f));
                  const [kind, scope] = String(x.choice).split("|");
                  const pct =
                    CHOICES.find((c) => c[0] === x.choice)?.[2] === "%";
                  if (
                    await call("finance/role-rule-set", {
                      role: r.role,
                      kind,
                      scope: scope || "",
                      ...(pct ? { percent: x.value } : { amount: x.value }),
                      from_month: x.from || undefined,
                    })
                  )
                    f.reset();
                }}
              >
                <select
                  name="choice"
                  defaultValue="salary|"
                  aria-label="Что платим"
                >
                  {CHOICES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <input
                  name="value"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder="Сумма, ₾ (или % для процентов)"
                  required
                />
                <label>
                  С месяца
                  <input name="from" type="month" />
                </label>
                <button className="button small">Сохранить правило</button>
                <small className="muted">
                  Если такое правило уже есть, оно заканчивается в прошлом
                  месяце, а новое начинается с выбранного. Месяц не указан,
                  значит с этого.
                </small>
              </form>
            </details>
          )}
          {r.role === "operator" && (
            <p className="muted">
              Премия на усмотрение владельца записывается на конкретного
              человека: «Зарплата», карточка человека, «Добавить бонус, процент
              или премию».
            </p>
          )}
          {r.role === "instructor" && (
            <>
              <h4>Время занятий</h4>
              <form
                className="staff-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const x = Object.fromEntries(new FormData(e.currentTarget));
                  call("finance/work-rules-set", x);
                }}
              >
                <div className="form-grid">
                  <Field label="Первый урок, час">
                    <input
                      name="startHour"
                      type="number"
                      min={6}
                      max={14}
                      defaultValue={d.work.startHour}
                    />
                  </Field>
                  <Field label="Последний урок на площадке начинается в, час">
                    <input
                      name="lastYardStart"
                      type="number"
                      min={10}
                      max={21}
                      defaultValue={d.work.lastYardStart}
                    />
                  </Field>
                  <Field label="Город: ездим до, час">
                    <input
                      name="cityUntil"
                      type="number"
                      min={12}
                      max={23}
                      defaultValue={d.work.cityUntil}
                    />
                  </Field>
                </div>
                <small className="muted">
                  Площадка работает только при свете: урок должен закончиться до
                  заката. Эти часы подставляются в «Открыть вождение до заката».
                </small>
                <button className="button small outline-dark">
                  Сохранить время
                </button>
              </form>
            </>
          )}
        </section>
      ))}
    </div>
  );
}
