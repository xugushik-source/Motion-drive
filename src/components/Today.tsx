"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { api, Notice } from "./Site";
import { gel } from "./Finance";

type Row = Record<string, any>;
const dayKey = (iso: string) =>
  new Date(Date.parse(iso) + 4 * 3600e3).toISOString().slice(0, 10);

/**
 * The first screen of the office: what needs a person right now, each item one tap away from the place
 * where it is done. Money figures are shown only to owners.
 */
export default function Today({
  data,
  freeSlots,
  owner,
  myId,
  go,
}: {
  data: Row;
  freeSlots: Row[];
  owner: boolean;
  myId: string;
  go: (tab: string) => void;
}) {
  const [cash, setCash] = useState<Row | null>(null);
  const [debts, setDebts] = useState<Row[] | null>(null);
  const [payroll, setPayroll] = useState<Row | null>(null);
  useEffect(() => {
    api("finance/cash", {})
      .then(setCash)
      .catch(() => {});
    api("finance/debts", {})
      .then(setDebts)
      .catch(() => {});
    if (owner)
      api("finance/payroll", {})
        .then(setPayroll)
        .catch(() => {});
  }, [owner]);

  const today = dayKey(new Date().toISOString());
  const bookings: Row[] = data.bookings || [];
  const pending = bookings.filter((b) => b.status === "pending").length;
  const todays = bookings.filter(
    (b) =>
      b.slot_start &&
      dayKey(b.slot_start) === today &&
      ["confirmed", "completed"].includes(b.status),
  );
  const toAccept = bookings.filter(
    (b) => b.conducted_at && !b.accepted_at && b.status !== "cancelled",
  ).length;
  const weekEnd = Date.now() + 7 * 86400e3;
  const freeWeek = freeSlots.filter(
    (s) => Date.parse(s.start) < weekEnd,
  ).length;
  const instructors = (data.users || []).filter(
    (u: Row) => u.role === "instructor" && Number(u.active ?? 1) !== 0,
  );
  const students = (data.users || []).filter((u: Row) => u.role === "student");
  const noId = students.filter((u: Row) => !Number(u.has_personal_id)).length;
  const owing = (debts || []).filter((d) => d.balance > 0);
  const owed = owing.reduce((s, d) => s + d.balance, 0);
  const waiting = payroll
    ? (payroll.rows as Row[]).reduce(
        (n, r) => n + (r.ledger?.pending?.length || 0),
        0,
      )
    : 0;
  const toConfirm: Row[] = cash?.toConfirm || [];

  // what is wrong, in the order of importance
  const alerts: { text: string; tab: string; label: string }[] = [];
  if (!instructors.length)
    alerts.push({
      text: "В системе нет ни одного инструктора: занятия некому вести, расписание не откроется.",
      tab: "staff",
      label: "Добавить сотрудника",
    });
  else if (freeWeek === 0)
    alerts.push({
      text: "На ближайшую неделю нет свободных занятий: ученики не смогут записаться.",
      tab: "chess",
      label: "Открыть шахматку",
    });
  if (toConfirm.length)
    alerts.push({
      text: `${toConfirm.length} передач наличных ждут вашего подтверждения.`,
      tab: "expenses",
      label: "Подтвердить",
    });
  if (cash && cash.till < 0)
    alerts.push({
      text: `Касса в минусе (${gel(cash.till)}): не записан приход или записан лишний расход.`,
      tab: "expenses",
      label: "Проверить кассу",
    });
  if (toAccept)
    alerts.push({
      text: `${toAccept} уроков проведены, но не приняты: от этого зависит зарплата преподавателей.`,
      tab: "bookings",
      label: "Принять уроки",
    });

  const cards: {
    title: string;
    value: string | number;
    hint: string;
    tab: string;
    hot?: boolean;
  }[] = [
    {
      title: "Новые заявки с сайта",
      value: data.newApplications || 0,
      hint: "позвонить и записать",
      tab: "applications",
      hot: (data.newApplications || 0) > 0,
    },
    {
      title: "Записи ждут подтверждения",
      value: pending,
      hint: "подтвердить время и инструктора",
      tab: "bookings",
      hot: pending > 0,
    },
    {
      title: "Уроки сегодня",
      value: todays.length,
      hint: "расписание дня",
      tab: "chess",
    },
    {
      title: "Свободных занятий на неделю",
      value: freeWeek,
      hint: "куда могут записаться ученики",
      tab: "chess",
      hot: freeWeek === 0,
    },
    {
      title: "Должны ученики",
      value: owing.length,
      hint: owner ? gel(owed) : "принять оплату",
      tab: "payments",
      hot: owing.length > 0,
    },
    {
      title: "Касса (наличные)",
      value: cash ? gel(cash.till) : "…",
      hint: "расходы и передача владельцам",
      tab: "expenses",
    },
    {
      title: "Ученики без личного номера",
      value: noId,
      hint: "нужен для записи на экзамен",
      tab: "students",
      hot: noId > 0,
    },
  ];
  if (owner)
    cards.push({
      title: "Выплаты ждут сотрудников",
      value: waiting,
      hint: "человек должен нажать «получил»",
      tab: "payroll",
      hot: waiting > 0,
    });

  return (
    <div className="today">
      {alerts.length ? (
        <div className="today-alerts">
          {alerts.map((a) => (
            <p key={a.text} className="today-alert">
              <AlertTriangle size={18} />
              <span>{a.text}</span>
              <button
                type="button"
                className="button small"
                onClick={() => go(a.tab)}
              >
                {a.label}
              </button>
            </p>
          ))}
        </div>
      ) : (
        <p className="today-ok">
          <CheckCircle2 size={18} /> Срочного нет: всё идёт по плану.
        </p>
      )}
      <div className="today-grid">
        {cards.map((c) => (
          <button
            type="button"
            key={c.title}
            className={"today-card" + (c.hot ? " hot" : "")}
            onClick={() => go(c.tab)}
          >
            <small>{c.title}</small>
            <strong>{c.value}</strong>
            <span>
              {c.hint}
              <ArrowUpRight size={14} />
            </span>
          </button>
        ))}
      </div>
      {todays.length > 0 && (
        <>
          <h4>Сегодня по расписанию</h4>
          <ul className="ledger">
            {todays
              .sort((a, b) =>
                String(a.slot_start).localeCompare(String(b.slot_start)),
              )
              .map((b) => (
                <li key={b.id}>
                  <span>
                    {new Date(Date.parse(b.slot_start) + 4 * 3600e3)
                      .toISOString()
                      .slice(11, 16)}
                  </span>
                  <span>
                    {b.name}
                    {b.package_title ? " · " + b.package_title : ""}
                  </span>
                  <b>
                    {b.accepted_at
                      ? "принят"
                      : b.conducted_at
                        ? "проведён"
                        : "по плану"}
                  </b>
                </li>
              ))}
          </ul>
        </>
      )}
      {myId && null}
      <Notice>
        Эти карточки обновляются сами раз в минуту. Нажмите на карточку, чтобы
        перейти туда, где это делается.
      </Notice>
    </div>
  );
}
