"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

type Row = Record<string, any>;
const OFFSET = 4 * 3600e3; // Georgia, UTC+4
const DAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const localDay = (iso: string) =>
  new Date(Date.parse(iso) + OFFSET).toISOString().slice(0, 10);
const hourOf = (iso: string) =>
  new Date(Date.parse(iso) + OFFSET).getUTCHours();
const timeOf = (iso: string) =>
  new Date(Date.parse(iso) + OFFSET).toISOString().slice(11, 16);
const today = () => localDay(new Date().toISOString());
const addDays = (day: string, n: number) =>
  new Date(Date.parse(day + "T00:00:00Z") + n * 86400e3)
    .toISOString()
    .slice(0, 10);
const weekday = (day: string) => new Date(day + "T00:00:00Z").getUTCDay();
const monday = (day: string) => addDays(day, -((weekday(day) + 6) % 7));
const pretty = (day: string) =>
  `${DAYS[weekday(day)]} ${day.slice(8, 10)}.${day.slice(5, 7)}`;

type Cell = {
  slot: Row;
  booking?: Row;
  state: "free" | "closed" | "pending" | "confirmed" | "wait" | "done" | "past";
};
const STATE_TEXT: Record<Cell["state"], string> = {
  free: "Свободно",
  closed: "Закрыто",
  pending: "Ждёт подтверждения",
  confirmed: "Записан",
  wait: "Проведён, ждёт принятия",
  done: "Принят",
  past: "Прошло",
};

/**
 * The whole timetable on one screen: instructors across, hours down, for a day; and a week overview
 * of how full each hour is. Free and busy lessons, who teaches and who is booked, refreshed on its own.
 * A free hour can be filled right here, a booked one confirmed, cancelled or opened as a student.
 */
export default function Chessboard({
  slots,
  bookings,
  users,
  act,
  refresh,
  onOpenStudent,
  goStudents,
}: {
  slots: Row[];
  bookings: Row[];
  users: Row[];
  act: (path: string, body: any) => Promise<any>;
  refresh: () => Promise<void> | void;
  onOpenStudent: (phone: string) => void;
  goStudents: () => void;
}) {
  const [day, setDay] = useState(today());
  const [view, setView] = useState<"day" | "week">("day");
  const [picked, setPicked] = useState<string | null>(null);
  const [stamp, setStamp] = useState(new Date());
  // refreshes itself while it is open
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      await refreshRef.current();
      setStamp(new Date());
    }, 20000);
    return () => clearInterval(timer);
  }, []);

  const instructors = users.filter((u) => u.role === "instructor");
  const bySlot = useMemo(() => {
    const m = new Map<string, Row>();
    for (const b of bookings)
      if (b.slot_id && ["pending", "confirmed", "completed"].includes(b.status))
        m.set(String(b.slot_id), b);
    return m;
  }, [bookings]);
  const now = Date.now();
  const cellOf = (slot: Row): Cell => {
    const booking = bySlot.get(String(slot.id));
    if (booking) {
      if (booking.accepted_at) return { slot, booking, state: "done" };
      if (booking.conducted_at) return { slot, booking, state: "wait" };
      return {
        slot,
        booking,
        state: booking.status === "pending" ? "pending" : "confirmed",
      };
    }
    if (!Number(slot.available)) return { slot, state: "closed" };
    if (Date.parse(slot.start) <= now) return { slot, state: "past" };
    return { slot, state: "free" };
  };

  const daySlots = slots.filter((s) => localDay(s.start) === day);
  // columns: every instructor who has lessons that day (all instructors when none do), plus unassigned
  const columns: { id: string | null; name: string }[] = [
    ...instructors
      .filter((i) => daySlots.some((s) => s.instructor_id === i.id))
      .map((i) => ({ id: String(i.id), name: String(i.name) })),
    ...(daySlots.some((s) => !s.instructor_id)
      ? [{ id: null, name: "Без инструктора" }]
      : []),
  ];
  const hours = daySlots.length
    ? Array.from(
        {
          length:
            Math.max(...daySlots.map((s) => hourOf(s.end || s.start))) -
            Math.min(...daySlots.map((s) => hourOf(s.start))) +
            1,
        },
        (_, i) => Math.min(...daySlots.map((s) => hourOf(s.start))) + i,
      )
    : [];
  const find = (col: string | null, h: number) =>
    daySlots.find(
      (s) => (s.instructor_id || null) === col && hourOf(s.start) === h,
    );
  const counts = (list: Row[]) => {
    let free = 0,
      busy = 0,
      closed = 0;
    for (const s of list) {
      const c = cellOf(s);
      if (c.state === "free") free++;
      else if (c.state === "closed") closed++;
      else if (c.state !== "past") busy++;
      else if (c.booking) busy++;
    }
    return { free, busy, closed, total: list.length };
  };
  const dayCounts = counts(daySlots);
  const sel = picked ? slots.find((s) => s.id === picked) : undefined;
  const selCell = sel ? cellOf(sel) : undefined;

  const weekStart = monday(day);
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekSlots = slots.filter((s) => week.includes(localDay(s.start)));
  const weekHours = weekSlots.length
    ? Array.from(
        {
          length:
            Math.max(...weekSlots.map((s) => hourOf(s.start))) -
            Math.min(...weekSlots.map((s) => hourOf(s.start))) +
            1,
        },
        (_, i) => Math.min(...weekSlots.map((s) => hourOf(s.start))) + i,
      )
    : [];
  const step = view === "day" ? 1 : 7;

  return (
    <div className="chess">
      <div className="chess-bar">
        <div className="chess-nav">
          <button
            type="button"
            className="icon-button"
            aria-label="Назад"
            onClick={() => setDay(addDays(day, -step))}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="button small outline-dark"
            onClick={() => setDay(today())}
          >
            Сегодня
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Вперёд"
            onClick={() => setDay(addDays(day, step))}
          >
            <ChevronRight size={18} />
          </button>
          <input
            type="date"
            value={day}
            onChange={(e) => e.target.value && setDay(e.target.value)}
            aria-label="Дата"
          />
        </div>
        <div className="chess-switch" role="tablist">
          <button
            role="tab"
            aria-selected={view === "day"}
            className={view === "day" ? "on" : ""}
            onClick={() => setView("day")}
          >
            День
          </button>
          <button
            role="tab"
            aria-selected={view === "week"}
            className={view === "week" ? "on" : ""}
            onClick={() => setView("week")}
          >
            Неделя
          </button>
        </div>
        <small className="muted chess-stamp">
          <RefreshCw size={12} /> обновляется само, сейчас{" "}
          {new Date(stamp.getTime() + OFFSET).toISOString().slice(11, 19)}
        </small>
      </div>

      <div className="chess-legend">
        {(
          [
            "free",
            "pending",
            "confirmed",
            "wait",
            "done",
            "closed",
          ] as Cell["state"][]
        ).map((s) => (
          <span key={s}>
            <i className={"cb cb-" + s} /> {STATE_TEXT[s]}
          </span>
        ))}
      </div>

      {view === "day" ? (
        <>
          <h4>
            {pretty(day)}
            {day === today() ? " · сегодня" : ""}:{" "}
            <span className="muted">
              свободно {dayCounts.free}, занято {dayCounts.busy}, закрыто{" "}
              {dayCounts.closed}
            </span>
          </h4>
          {columns.length ? (
            <div className="chess-scroll">
              <table className="chess-grid">
                <thead>
                  <tr>
                    <th />
                    {columns.map((c) => (
                      <th key={c.id || "none"}>{c.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hours.map((h) => (
                    <tr key={h}>
                      <th>{String(h).padStart(2, "0")}:00</th>
                      {columns.map((c) => {
                        const s = find(c.id, h);
                        if (!s)
                          return (
                            <td
                              key={(c.id || "none") + h}
                              className="cb-none"
                            />
                          );
                        const cell = cellOf(s);
                        return (
                          <td key={s.id}>
                            <button
                              type="button"
                              className={
                                "chess-cell cb-" +
                                cell.state +
                                (picked === s.id ? " picked" : "") +
                                (s.kind === "city" ? " evening" : "")
                              }
                              onClick={() => setPicked(s.id)}
                              title={`${timeOf(s.start)}–${timeOf(s.end)} · ${STATE_TEXT[cell.state]}`}
                            >
                              {cell.booking ? (
                                <>
                                  <b>
                                    {String(cell.booking.name).split(" ")[0]}
                                  </b>
                                  <small>
                                    {cell.booking.lesson_kind === "yard"
                                      ? "площадка"
                                      : cell.booking.lesson_kind === "city"
                                        ? "город"
                                        : ""}
                                  </small>
                                </>
                              ) : (
                                <small>
                                  {cell.state === "free"
                                    ? s.kind === "city"
                                      ? "свободно · город"
                                      : "свободно"
                                    : STATE_TEXT[cell.state].toLowerCase()}
                                </small>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">
              На этот день занятий нет (воскресенье выходной). Расписание
              открывается само на три недели вперёд.
            </p>
          )}
        </>
      ) : (
        <>
          <h4>
            Неделя {pretty(week[0]!)} — {pretty(week[6]!)}:{" "}
            <span className="muted">
              свободно {counts(weekSlots).free} из {counts(weekSlots).total}
            </span>
          </h4>
          <p className="muted">
            В клетке: свободно / всего занятий в этот час у всех инструкторов.
            Нажмите на день, чтобы открыть его подробно.
          </p>
          {weekHours.length ? (
            <div className="chess-scroll">
              <table className="chess-grid week">
                <thead>
                  <tr>
                    <th />
                    {week.map((d) => (
                      <th key={d}>
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => {
                            setDay(d);
                            setView("day");
                          }}
                        >
                          {pretty(d)}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weekHours.map((h) => (
                    <tr key={h}>
                      <th>{String(h).padStart(2, "0")}:00</th>
                      {week.map((d) => {
                        const list = weekSlots.filter(
                          (s) =>
                            localDay(s.start) === d && hourOf(s.start) === h,
                        );
                        if (!list.length)
                          return <td key={d} className="cb-none" />;
                        const c = counts(list);
                        const fullness = c.total ? 1 - c.free / c.total : 0;
                        return (
                          <td key={d}>
                            <button
                              type="button"
                              className="chess-cell heat"
                              style={{
                                background: `rgba(255, 107, 82, ${0.12 + fullness * 0.7})`,
                              }}
                              onClick={() => {
                                setDay(d);
                                setView("day");
                              }}
                              title={`${pretty(d)} ${String(h).padStart(2, "0")}:00`}
                            >
                              <b>
                                {c.free}/{c.total}
                              </b>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">На этой неделе занятий нет.</p>
          )}
        </>
      )}

      {view === "day" && sel && selCell && (
        <Detail
          cell={selCell}
          users={users}
          act={act}
          close={() => setPicked(null)}
          onOpenStudent={onOpenStudent}
          goStudents={goStudents}
        />
      )}
    </div>
  );
}

/** What is behind the chosen hour and what can be done with it. */
function Detail({
  cell,
  users,
  act,
  close,
  onOpenStudent,
  goStudents,
}: {
  cell: Cell;
  users: Row[];
  act: (path: string, body: any) => Promise<any>;
  close: () => void;
  onOpenStudent: (phone: string) => void;
  goStudents: () => void;
}) {
  const { slot, booking, state } = cell;
  const who = users.find((u) => u.id === slot.instructor_id)?.name;
  const [q, setQ] = useState("");
  const [student, setStudent] = useState("");
  const [kind, setKind] = useState("city");
  const [gear, setGear] = useState("automatic");
  const students = users
    .filter((u) => u.role === "student")
    .filter(
      (u) =>
        !q ||
        (u.name + " " + (u.phone || ""))
          .toLowerCase()
          .includes(q.toLowerCase()),
    )
    .slice(0, 40);
  return (
    <section className="chess-detail form-card" aria-label="Занятие">
      <header>
        <strong>
          {pretty(localDay(slot.start))}, {timeOf(slot.start)}–
          {timeOf(slot.end)}
        </strong>
        <span>
          {who ? "Инструктор: " + who : "Инструктор не назначен"} ·{" "}
          {slot.kind === "city" ? "вечер, только город" : "площадка или город"}
        </span>
        <button
          type="button"
          className="icon-button"
          aria-label="Закрыть"
          onClick={close}
        >
          ×
        </button>
      </header>
      <p>
        <i className={"cb cb-" + state} /> <b>{STATE_TEXT[state]}</b>
      </p>

      {state === "free" && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const st = users.find((u) => u.id === student);
            if (!st) return;
            const r = await act("booking/create", {
              user_id: st.id,
              city: "akhalkalaki",
              program: "practice",
              gearbox: gear,
              slot_ids: [slot.id],
              lesson_kind: kind,
              name: st.name,
              contact: st.phone || st.email || "-",
              note: "",
              consent: true,
              website: "",
            });
            if (r) close();
          }}
        >
          <input
            type="search"
            placeholder="Найти ученика по имени или телефону"
            aria-label="Поиск ученика"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            value={student}
            onChange={(e) => setStudent(e.target.value)}
            required
            aria-label="Ученик"
          >
            <option value="">— выберите ученика —</option>
            {students.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.phone ? " · " + u.phone : ""}
              </option>
            ))}
          </select>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            aria-label="Вид занятия"
          >
            <option value="city">Город</option>
            {slot.kind !== "city" && <option value="yard">Площадка</option>}
          </select>
          <select
            value={gear}
            onChange={(e) => setGear(e.target.value)}
            aria-label="Коробка"
          >
            <option value="automatic">Автомат</option>
            <option value="manual">Механика</option>
          </select>
          {(() => {
            const st = users.find((u) => u.id === student);
            return st?.instructor_id &&
              st.instructor_id !== slot.instructor_id ? (
              <small className="muted">
                Ученик закреплён за инструктором{" "}
                {users.find((u) => u.id === st.instructor_id)?.name}, а это
                время другого инструктора. Запись возможна.
              </small>
            ) : null;
          })()}
          <button className="button small">Записать сюда</button>
          <button
            type="button"
            className="button small outline-dark"
            onClick={async () => {
              if (
                await act("slot/availability", {
                  id: slot.id,
                  available: false,
                })
              )
                close();
            }}
          >
            Закрыть это время
          </button>
          <small className="muted">
            Нет ученика в списке?{" "}
            <button type="button" className="link-button" onClick={goStudents}>
              Добавить в «Ученики»
            </button>
          </small>
        </form>
      )}

      {state === "closed" && (
        <button
          type="button"
          className="button small"
          onClick={async () => {
            if (
              await act("slot/availability", { id: slot.id, available: true })
            )
              close();
          }}
        >
          Открыть это время
        </button>
      )}

      {booking && (
        <div className="chess-booking">
          <p>
            <strong>{booking.name}</strong>
            {booking.contact && (
              <>
                {" · "}
                <a href={"tel:" + booking.contact}>{booking.contact}</a>
              </>
            )}
          </p>
          <p className="muted">
            {booking.lesson_kind === "yard"
              ? "Площадка"
              : booking.lesson_kind === "city"
                ? "Город"
                : "Занятие"}
            {booking.package_title ? " · " + booking.package_title : ""}
            {booking.gearbox === "manual"
              ? " · механика"
              : booking.gearbox === "automatic"
                ? " · автомат"
                : ""}
          </p>
          <div className="row-actions">
            {booking.status === "pending" && (
              <button
                type="button"
                className="button small"
                onClick={async () => {
                  if (
                    await act("booking/status", {
                      id: booking.id,
                      status: "confirmed",
                    })
                  )
                    close();
                }}
              >
                Подтвердить
              </button>
            )}
            {!booking.accepted_at && Date.parse(slot.start) <= Date.now() && (
              <button
                type="button"
                className="button small"
                onClick={async () => {
                  if (await act("teach/accept", { id: booking.id })) close();
                }}
              >
                {booking.conducted_at
                  ? "Принять урок"
                  : "Урок проведён, принять"}
              </button>
            )}
            {!booking.accepted_at && (
              <button
                type="button"
                className="button small outline-dark"
                onClick={async () => {
                  if (!confirm("Отменить это занятие? Время освободится."))
                    return;
                  if (
                    await act("booking/status", {
                      id: booking.id,
                      status: "cancelled",
                    })
                  )
                    close();
                }}
              >
                Отменить занятие
              </button>
            )}
            <button
              type="button"
              className="button small outline-dark"
              onClick={() => onOpenStudent(String(booking.contact))}
            >
              Открыть ученика
              <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
