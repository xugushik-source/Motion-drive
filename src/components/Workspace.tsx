"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Plus,
  Check,
  LogOut,
  LayoutDashboard,
  Users,
  CalendarDays,
  BookOpen,
  Settings,
  MessageCircle,
  Upload,
  Trash2,
  Pencil,
  ShieldCheck,
  Download,
  Layers,
  CheckCheck,
  KeyRound,
  Copy,
} from "lucide-react";
import { api, Field, Notice, type Item } from "./Site";
import { georgiaDay } from "./AvailabilityPicker";
import { formatPhone } from "../lib/phone";
type Props = {
  user: Item;
  locale: string;
  t: (k: string) => string;
  page: string;
  onLogout: () => void;
};
const modules = [
  "bookings",
  "students",
  "instructors",
  "packages",
  "courses",
  "schedule",
  "lessons",
  "branches",
  "media",
  "reviews",
  "faq",
  "knowledge",
  "messages",
  "translations",
  "materials",
  "questions",
  "results",
  "imports",
  "usage",
  "settings",
  "audit",
];
export default function Workspace({ user, locale, t, page, onLogout }: Props) {
  const [data, setData] = useState<Item | null>(null),
    [tab, setTab] = useState("bookings"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [editing, setEditing] = useState<Item | null>(null),
    [audit, setAudit] = useState<Item[]>([]),
    [freeSlots, setFreeSlots] = useState<Item[]>([]),
    [filterCity, setFilterCity] = useState(""),
    [filterDay, setFilterDay] = useState(""),
    [filterStatus, setFilterStatus] = useState(""),
    [search, setSearch] = useState(""),
    [issued, setIssued] = useState<{ id: string; password: string } | null>(
      null,
    );
  const admin = user.role === "admin" && page === "admin",
    operator = user.role === "operator" && page === "operator",
    staff = admin || operator,
    instructor = user.role === "instructor" && page === "instructor";
  const tabs = [
    ...(admin
      ? modules
      : operator
        ? ["bookings", "schedule", "students", "messages"]
        : instructor
          ? ["bookings", "students", "schedule", "lessons"]
          : ["bookings", "progress", "results", "materials", "messages"]),
    "security",
  ];
  async function refresh() {
    try {
      setData(await api("dashboard"));
      setFreeSlots(await api("slots"));
    } catch (e) {
      setError(t((e as Error).message));
    }
  }
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 15000);
    const focus = () => refresh();
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, []);
  async function act(path: string, body: any) {
    setError("");
    setNotice("");
    try {
      const r = await api(path, body);
      setNotice(t("saved"));
      await refresh();
      return r;
    } catch (e) {
      setError(t((e as Error).message));
      return null;
    }
  }
  // A temporary password from the operator must be replaced before anything else.
  if (user.must_change_password)
    return (
      <div className="workspace-locked">
        <ChangePassword t={t} forced onDone={() => window.location.reload()} />
      </div>
    );
  if (!data) return <Notice>{error || t("loading")}</Notice>;
  const fmt = (s: string) =>
    new Date(
      /(?:Z|[+-]\d{2}(?::?\d{2})?)$/.test(s) ? s : s + "Z",
    ).toLocaleString(locale, {
      timeZone: "Asia/Tbilisi",
      dateStyle: "medium",
      timeStyle: "short",
    });
  const query = search
    .trim()
    .toLowerCase()
    .replace(/[\s()-]/g, "");
  const visibleBookings: Item[] = data.bookings.filter(
    (b: Item) =>
      (!filterCity || b.city === filterCity) &&
      (!filterStatus || b.status === filterStatus) &&
      (!filterDay ||
        (b.slot_start && georgiaDay(b.slot_start) === filterDay)) &&
      (!query ||
        (b.name + " " + b.contact)
          .toLowerCase()
          .replace(/[\s()-]/g, "")
          .includes(query)),
  );
  // Lessons of one order travel together; the earliest lesson leads the card.
  const groupMap = new Map<string, Item[]>();
  for (const b of visibleBookings)
    groupMap.set(b.series_id || b.id, [
      ...(groupMap.get(b.series_id || b.id) || []),
      b,
    ]);
  const groups = [...groupMap.values()].map((g) =>
    g.sort(
      (a, b) =>
        Date.parse(a.slot_start || a.created) -
        Date.parse(b.slot_start || b.created),
    ),
  );
  return (
    <div className="workspace">
      <aside className="workspace-nav">
        <div className="workspace-user">
          <span className="avatar">{user.name.slice(0, 1)}</span>
          <div>
            <strong>{user.name}</strong>
            <small>{t(user.role)}</small>
          </div>
        </div>
        {tabs.map((k) => (
          <button
            key={k}
            className={tab === k ? "selected" : ""}
            onClick={() => {
              setTab(k);
              setEditing(null);
              setNotice("");
              if (k === "audit")
                act("admin/audit", {}).then((r) => r && setAudit(r));
            }}
          >
            {["bookings", "schedule", "lessons"].includes(k) ? (
              <CalendarDays size={16} />
            ) : ["students", "instructors"].includes(k) ? (
              <Users size={16} />
            ) : ["knowledge", "faq", "messages"].includes(k) ? (
              <MessageCircle size={16} />
            ) : (
              <BookOpen size={16} />
            )}
            {t(k)}
            {k === "bookings" && (
              <span>
                {
                  data.bookings.filter((b: Item) => b.status === "pending")
                    .length
                }
              </span>
            )}
          </button>
        ))}
        <div className="workspace-links">
          {user.role === "admin" && page !== "admin" && (
            <Link href={"/" + locale + "/admin"}>
              {t("admin")}
              <ArrowUpRight size={16} />
            </Link>
          )}
          {user.role === "operator" && page !== "operator" && (
            <Link href={"/" + locale + "/operator"}>
              {t("operator")}
              <ArrowUpRight size={16} />
            </Link>
          )}
          {user.role === "instructor" && page !== "instructor" && (
            <Link href={"/" + locale + "/instructor"}>
              {t("instructor")}
              <ArrowUpRight size={16} />
            </Link>
          )}
          <button
            onClick={async () => {
              await api("auth/logout", {});
              onLogout();
            }}
          >
            <LogOut size={16} />
            {t("logout")}
          </button>
        </div>
      </aside>
      <div className="workspace-main">
        <div className="workspace-title">
          <div>
            <p className="eyebrow">MOTION DRIVE / {user.role.toUpperCase()}</p>
            <h2>{t(tab)}</h2>
          </div>
          {admin && data.records[tab] && (
            <button className="button small" onClick={() => setEditing({})}>
              <Plus size={17} />
              {t("add")}
            </button>
          )}
        </div>
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
        {(tab === "bookings" || tab === "schedule") && (
          <>
            <div className="workspace-filters">
              <Field label={t("city")}>
                <select
                  value={filterCity}
                  onChange={(e) => setFilterCity(e.target.value)}
                >
                  <option value="">{t("all")}</option>
                  <option value="akhalkalaki">{t("city1")}</option>
                  <option value="ninotsminda">{t("city2")}</option>
                </select>
              </Field>
              <Field label={t("chooseDay")}>
                <input
                  type="date"
                  value={filterDay}
                  onChange={(e) => setFilterDay(e.target.value)}
                />
              </Field>
              {tab === "bookings" && (
                <Field label={t("status")}>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="">{t("all")}</option>
                    {["pending", "confirmed", "cancelled", "completed"].map(
                      (s) => (
                        <option key={s} value={s}>
                          {t(s)}
                        </option>
                      ),
                    )}
                  </select>
                </Field>
              )}
              <button
                type="button"
                className="button small outline-dark"
                onClick={() => {
                  setFilterCity("");
                  setFilterDay("");
                  setFilterStatus("");
                  refresh();
                }}
              >
                {t("refreshCalendar")}
              </button>
            </div>
            <small>{t("availabilityRefresh")}</small>
          </>
        )}
        {tab === "bookings" && (
          <>
            <Notice>{t("notification")}</Notice>
            {staff && (
              <div className="orders-toolbar">
                <Field label={t("search")}>
                  <input
                    type="search"
                    value={search}
                    placeholder={t("searchPlaceholder")}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </Field>
                <button
                  type="button"
                  className="button small outline-dark"
                  onClick={() => exportCsv(visibleBookings, t, fmt)}
                >
                  <Download size={16} />
                  {t("exportExcel")}
                </button>
                <span className="orders-count">
                  {t("ordersCount")}: {groups.length} · {t("lessonsWord")}:{" "}
                  {visibleBookings.length}
                </span>
              </div>
            )}
            {groups.length ? (
              groups.map((g) => {
                const b = g[0];
                const series = g.length > 1 || !!b.series_id;
                const active = g.filter((x) =>
                  ["pending", "confirmed"].includes(x.status),
                );
                const counts = g.reduce(
                  (m: Record<string, number>, x) => (
                    (m[x.status] = (m[x.status] || 0) + 1),
                    m
                  ),
                  {},
                );
                return (
                  <article
                    className={"booking-record" + (series ? " series" : "")}
                    key={b.series_id || b.id}
                  >
                    <div className="record-top">
                      {series ? (
                        <span className="series-badge">
                          <Layers size={14} />
                          {t("course")} · {g.length} {t("lessonsWord")}
                        </span>
                      ) : (
                        <span className={"status " + b.status}>
                          {t(b.status)}
                        </span>
                      )}
                      <small>{fmt(b.created)}</small>
                    </div>
                    <h3>
                      {b.package_title || t(b.program)} ·{" "}
                      {t(b.city === "akhalkalaki" ? "city1" : "city2")}
                    </h3>
                    <p>
                      {t("gearbox")}: {t(b.gearbox)}
                    </p>
                    <p>
                      <strong>{b.name}</strong> ·{" "}
                      {staff ? (
                        <a href={"tel:" + b.contact.replace(/[^+\d]/g, "")}>
                          {formatPhone(b.contact)}
                        </a>
                      ) : (
                        b.contact
                      )}
                    </p>
                    {b.note && <p className="booking-note">{b.note}</p>}
                    {series && (
                      <div className="series-status">
                        {Object.entries(counts).map(([k, n]) => (
                          <span key={k} className={"status " + k}>
                            {t(k)}: {n}
                          </span>
                        ))}
                      </div>
                    )}
                    {series &&
                      active.length > 0 &&
                      !instructor &&
                      b.series_id && (
                        <div className="record-actions">
                          {staff && g.some((x) => x.status === "pending") && (
                            <button
                              className="button small"
                              onClick={() =>
                                act("booking/series", {
                                  series_id: b.series_id,
                                  status: "confirmed",
                                })
                              }
                            >
                              {t("confirmAll")}
                              <CheckCheck size={16} />
                            </button>
                          )}
                          <button
                            className="button small outline-dark"
                            onClick={() =>
                              confirm(t("cancelAllConfirm")) &&
                              act("booking/series", {
                                series_id: b.series_id,
                                status: "cancelled",
                              })
                            }
                          >
                            {t("cancelAll")}
                          </button>
                        </div>
                      )}
                    {(series ? g : [b]).map((b) => (
                      <div
                        className={series ? "lesson-row" : "lesson-single"}
                        key={b.id}
                      >
                        <p className="lesson-when">
                          <CalendarDays size={15} />
                          {b.slot_start ? fmt(b.slot_start) : t("agreeTime")}
                          {series && (
                            <span className={"status " + b.status}>
                              {t(b.status)}
                            </span>
                          )}
                        </p>
                        <div className="record-actions">
                          {["pending", "confirmed"].includes(b.status) && (
                            <>
                              {!instructor && (
                                <button
                                  className="button small outline-dark"
                                  onClick={() =>
                                    act("booking/status", {
                                      id: b.id,
                                      status: "cancelled",
                                    })
                                  }
                                >
                                  {t("cancel")}
                                </button>
                              )}
                              {staff && b.status === "pending" && (
                                <button
                                  className="button small"
                                  onClick={() =>
                                    act("booking/status", {
                                      id: b.id,
                                      status: "confirmed",
                                    })
                                  }
                                >
                                  {t("confirmAction")}
                                  <Check size={16} />
                                </button>
                              )}
                              {!instructor && (
                                <form
                                  onSubmit={async (e) => {
                                    e.preventDefault();
                                    const form = new FormData(e.currentTarget);
                                    await act("booking/reschedule", {
                                      id: b.id,
                                      slot_id: form.get("slot_id"),
                                    });
                                  }}
                                >
                                  <label
                                    className="sr-only"
                                    htmlFor={"slot-" + b.id}
                                  >
                                    {t("date")}
                                  </label>
                                  <select
                                    required
                                    id={"slot-" + b.id}
                                    name="slot_id"
                                  >
                                    <option value="">{t("change")}</option>
                                    {freeSlots
                                      .filter((s) => s.city === b.city)
                                      .map((s) => (
                                        <option key={s.id} value={s.id}>
                                          {fmt(s.start)}
                                        </option>
                                      ))}
                                  </select>
                                  <button className="button small outline-dark">
                                    {t("save")}
                                  </button>
                                </form>
                              )}
                            </>
                          )}
                          {(admin || instructor) &&
                            b.status === "confirmed" && (
                              <form
                                className="lesson-form"
                                onSubmit={async (e) => {
                                  e.preventDefault();
                                  const f = Object.fromEntries(
                                    new FormData(e.currentTarget),
                                  );
                                  await act("lesson", {
                                    bookingId: b.id,
                                    ...f,
                                  });
                                }}
                              >
                                <input
                                  name="skills"
                                  required
                                  placeholder={t("skills")}
                                  aria-label={t("skills")}
                                />
                                <input
                                  name="recommendation"
                                  required
                                  placeholder={t("recommendation")}
                                  aria-label={t("recommendation")}
                                />
                                <button className="button small">
                                  {t("completed")}
                                </button>
                              </form>
                            )}
                        </div>
                      </div>
                    ))}
                  </article>
                );
              })
            ) : (
              <Empty t={t} />
            )}
          </>
        )}
        {tab === "security" && (
          <ChangePassword t={t} onDone={() => setNotice(t("saved"))} />
        )}
        {tab === "progress" && (
          <>
            <div className="stats-grid">
              <div>
                <span>{data.lessons.length}</span>
                <p>{t("lessonsDone")}</p>
              </div>
              <div>
                <span>{data.results.length}</span>
                <p>{t("results")}</p>
              </div>
            </div>
            {!data.lessons.length && <Notice>{t("noProgress")}</Notice>}
            {data.lessons.map((l: Item) => (
              <article className="booking-record" key={l.id}>
                <h3>{t("skills")}</h3>
                <p>{l.skills}</p>
                <p>
                  {t("recommendation")}: {l.recommendation}
                </p>
              </article>
            ))}
          </>
        )}
        {tab === "students" && (
          <div className="data-list">
            {data.users
              .filter((u: Item) => u.role !== "admin")
              .map((u: Item) => (
                <article key={u.id}>
                  <strong>{u.name}</strong>
                  <p>
                    {u.phone ? (
                      <a href={"tel:" + u.phone}>{formatPhone(u.phone)}</a>
                    ) : (
                      u.email
                    )}
                    {!admin && u.role !== "student" && <> · {t(u.role)}</>}
                  </p>
                  {staff && (admin || u.role === "student") && (
                    <button
                      type="button"
                      className="button small outline-dark"
                      onClick={async () => {
                        if (!confirm(t("resetConfirm"))) return;
                        const r = await act("admin/reset-password", {
                          id: u.id,
                        });
                        if (r) setIssued({ id: u.id, password: r.password });
                      }}
                    >
                      <KeyRound size={15} />
                      {t("resetPassword")}
                    </button>
                  )}
                  {issued && issued.id === u.id && (
                    <div className="temp-password" role="status">
                      <small>{t("tempPasswordText")}</small>
                      <code>{issued.password}</code>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={t("copy")}
                        onClick={() =>
                          navigator.clipboard?.writeText(issued!.password)
                        }
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  )}
                  {admin && (
                    <>
                      <code>{u.id}</code>
                      <Field label={t("role")}>
                        <select
                          value={u.role}
                          onChange={(e) =>
                            act("admin/role", {
                              id: u.id,
                              role: e.target.value,
                            })
                          }
                        >
                          <option value="student">{t("student")}</option>
                          <option value="instructor">{t("instructor")}</option>
                          <option value="operator">{t("operator")}</option>
                        </select>
                      </Field>
                    </>
                  )}
                </article>
              ))}
            {!data.users.length && <Empty t={t} />}
          </div>
        )}
        {tab === "results" && (
          <>
            {data.results.length ? (
              data.results.map((r: Item) => (
                <details className="booking-record" key={r.id}>
                  <summary>
                    {r.score} / {r.total} · {fmt(r.created + "Z")}
                  </summary>
                  {JSON.parse(r.answers).map((q: Item) => (
                    <div className="result-review" key={q.id}>
                      <h3>{q.question}</h3>
                      <p
                        className={
                          q.selected === q.correct ? "success" : "error"
                        }
                      >
                        {t(q.selected === q.correct ? "correct" : "wrong")}
                      </p>
                      <p>{q.options[q.correct]}</p>
                      <p>{q.explanation}</p>
                    </div>
                  ))}
                </details>
              ))
            ) : (
              <Empty t={t} />
            )}
          </>
        )}
        {tab === "messages" && (
          <>
            {data.messages.length ? (
              data.messages.map((m: Item) => (
                <article className="booking-record" key={m.id}>
                  <small>
                    {fmt(m.created)} · {m.locale.toUpperCase()}
                  </small>
                  <p>
                    <strong>{m.text}</strong>
                  </p>
                  <p>{m.answer}</p>
                  {!!m.escalated && (
                    <span className="status pending">{t("pending")}</span>
                  )}
                  {m.admin_reply && (
                    <p className="success">
                      {t("reply")}: {m.admin_reply}
                    </p>
                  )}
                  {staff && (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await act("admin/reply", {
                          id: m.id,
                          answer: new FormData(e.currentTarget).get("answer"),
                        });
                      }}
                    >
                      <Field label={t("reply")}>
                        <textarea
                          name="answer"
                          defaultValue={m.admin_reply || ""}
                          required
                          maxLength={6000}
                          rows={3}
                        />
                      </Field>
                      <button className="button small">{t("chatSend")}</button>
                    </form>
                  )}
                </article>
              ))
            ) : (
              <Empty t={t} />
            )}
          </>
        )}
        {tab === "schedule" && (
          <>
            <form
              className="form-card"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = Object.fromEntries(new FormData(e.currentTarget));
                const r = await act("slot/create", {
                  ...f,
                  instructor_id: instructor ? user.id : f.instructor_id || null,
                  intervalMinutes: Number(f.intervalMinutes),
                  start: new Date(String(f.start) + "+04:00").toISOString(),
                  end: new Date(String(f.end) + "+04:00").toISOString(),
                });
                if (r) (e.target as HTMLFormElement).reset();
              }}
            >
              {staff && (
                <Field label={t("instructors")}>
                  <select name="instructor_id">
                    <option value="">{t("assignInstructorLater")}</option>
                    {data.users
                      .filter((u: Item) => u.role === "instructor")
                      .map((u: Item) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                </Field>
              )}
              <Field label={t("city")}>
                <select name="city">
                  <option value="akhalkalaki">{t("city1")}</option>
                  <option value="ninotsminda">{t("city2")}</option>
                </select>
              </Field>
              <div className="form-grid">
                <Field label={t("start") + " · UTC+04:00"}>
                  <input required type="datetime-local" name="start" />
                </Field>
                <Field label={t("end") + " · UTC+04:00"}>
                  <input required type="datetime-local" name="end" />
                </Field>
              </div>
              <Field label={t("slotDuration")}>
                <select name="intervalMinutes" defaultValue="60">
                  {[30, 45, 60, 90, 120].map((n) => (
                    <option key={n} value={n}>
                      {n} {t("minutes")}
                    </option>
                  ))}
                </select>
              </Field>
              <p>{t("splitHours")}</p>
              <button className="button small">
                {t("add")}
                <Plus size={17} />
              </button>
            </form>
            <div className="schedule-summary">
              <span>
                {t("freeTimes")}:{" "}
                {
                  data.slots.filter(
                    (s: Item) =>
                      s.available &&
                      !s.booking_id &&
                      Date.parse(s.start) > Date.now(),
                  ).length
                }
              </span>
              <span>
                {t("occupiedTimes")}:{" "}
                {data.slots.filter((s: Item) => s.booking_id).length}
              </span>
            </div>
            {data.slots
              .filter(
                (s: Item) =>
                  (!filterCity || s.city === filterCity) &&
                  (!filterDay || georgiaDay(s.start) === filterDay),
              )
              .map((s: Item) => (
                <article className="booking-record" key={s.id}>
                  <h3>
                    {fmt(s.start)} — {fmt(s.end)}
                  </h3>
                  <p>
                    {data.users.find((u: Item) => u.id === s.instructor_id)
                      ?.name || t("assignInstructorLater")}
                  </p>
                  <button
                    className="button small outline-dark"
                    disabled={Boolean(s.booking_id)}
                    onClick={() =>
                      act("slot/availability", {
                        id: s.id,
                        available: !s.available,
                      })
                    }
                  >
                    {s.booking_id
                      ? t(s.booking_status)
                      : t(s.available ? "available" : "unavailable")}
                  </button>
                </article>
              ))}
          </>
        )}
        {tab === "lessons" && (
          <>
            {data.lessons.length ? (
              data.lessons.map((l: Item) => (
                <article key={l.id} className="booking-record">
                  <h3>{l.skills}</h3>
                  <p>{l.recommendation}</p>
                  <small>{l.completedAt}</small>
                </article>
              ))
            ) : (
              <Empty t={t} />
            )}
          </>
        )}
        {tab === "materials" && !admin && (
          <MaterialList locale={locale} t={t} />
        )}
        {tab === "usage" && (
          <>
            <Notice>{t("faqMode")}</Notice>
            <div className="stats-grid">
              <div>
                <span>
                  $
                  {data.usage
                    .reduce((s: number, x: Item) => s + x.usd, 0)
                    .toFixed(4)}
                </span>
                <p>{t("usage")}</p>
              </div>
              <div>
                <span>
                  {data.usage.reduce((s: number, x: Item) => s + x.tokens, 0)}
                </span>
                <p>Tokens</p>
              </div>
            </div>
          </>
        )}
        {tab === "audit" && (
          <div className="audit-list">
            {audit.map((a) => (
              <details key={a.id}>
                <summary>
                  {a.created} · {a.action}
                </summary>
                <pre>
                  {JSON.stringify(
                    {
                      before: a.before_value
                        ? JSON.parse(a.before_value)
                        : null,
                      after: a.after_value ? JSON.parse(a.after_value) : null,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            ))}
          </div>
        )}
        {tab === "imports" && (
          <>
            <Notice>{t("importNotice")}</Notice>
            <form
              className="form-card"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                await act("admin/import", {
                  text: f.get("text"),
                  consent: true,
                });
              }}
            >
              <Field label={t("importText")}>
                <textarea name="text" required rows={8} maxLength={100000} />
              </Field>
              <label className="checkbox">
                <input required type="checkbox" />
                <span>{t("importConsent")}</span>
              </label>
              <button className="button small">
                {t("imports")}
                <Upload size={17} />
              </button>
            </form>
            {data.records.imports.map((r: Item) => (
              <details className="booking-record" key={r.id}>
                <summary>
                  {t("draftStatus")} · {r.groups?.length}
                </summary>
                {r.groups?.map((g: Item, i: number) => (
                  <p key={i}>
                    {g.locale} · {g.count} × {g.question}
                  </p>
                ))}
              </details>
            ))}
          </>
        )}
        {admin &&
          data.records[tab] &&
          !["imports", "lessons"].includes(tab) && (
            <>
              {editing ? (
                <RecordEditor
                  key={tab + (editing.id || "new")}
                  kind={tab}
                  item={editing}
                  locale={locale}
                  t={t}
                  onCancel={() => setEditing(null)}
                  onSave={async (record) => {
                    const r = await act("admin/record", {
                      kind: tab,
                      id: editing.id,
                      data: record,
                    });
                    if (r) setEditing(null);
                  }}
                />
              ) : (
                <div className="data-list">
                  {data.records[tab].map((r: Item) => (
                    <article key={r.id}>
                      <span
                        className={
                          "status " +
                          (r.status === "published" ? "confirmed" : "pending")
                        }
                      >
                        {t(
                          r.status === "published"
                            ? "published"
                            : "draftStatus",
                        )}
                      </span>
                      <h3>{r.title || r.question || r.key || r.id}</h3>
                      <p>
                        {r.locale?.toUpperCase()} ·{" "}
                        {r.description || r.answer || r.value}
                      </p>
                      <div className="record-actions">
                        <button
                          onClick={() => setEditing(r)}
                          className="button small outline-dark"
                        >
                          <Pencil size={15} />
                          {t("edit")}
                        </button>
                        <button
                          aria-label={t("delete")}
                          className="icon-button"
                          onClick={() =>
                            act("admin/delete", { kind: tab, id: r.id })
                          }
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </article>
                  ))}
                  {!data.records[tab].length && <Empty t={t} />}
                </div>
              )}
            </>
          )}
      </div>
    </div>
  );
}
function Empty({ t }: { t: (k: string) => string }) {
  return (
    <div className="empty-state">
      <RouteIcon />
      <p>{t("empty")}</p>
    </div>
  );
}
function RouteIcon() {
  return (
    <svg
      width="70"
      height="70"
      viewBox="0 0 70 70"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M15 55V35a12 12 0 0 1 24 0v2a8 8 0 0 0 16 0V15"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="4 5"
      />
      <circle cx="15" cy="55" r="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="55" cy="15" r="5" fill="currentColor" />
    </svg>
  );
}
function MaterialList({
  locale,
  t,
}: {
  locale: string;
  t: (k: string) => string;
}) {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    api("public").then((x) =>
      setItems(x.materials.filter((m: Item) => m.locale === locale)),
    );
  }, []);
  return items.length ? (
    <>
      {items.map((m) => (
        <article key={m.id} className="booking-record">
          <h3>{m.title}</h3>
          <p>{m.description}</p>
          {m.url && (
            <a
              href={m.url}
              className="text-link"
              target="_blank"
              rel="noreferrer"
            >
              {t("materials")}
              <ArrowUpRight size={17} />
            </a>
          )}
        </article>
      ))}
    </>
  ) : (
    <Empty t={t} />
  );
}
function RecordEditor({
  kind,
  item,
  locale,
  t,
  onCancel,
  onSave,
}: {
  kind: string;
  item: Item;
  locale: string;
  t: (k: string) => string;
  onCancel: () => void;
  onSave: (r: Item) => Promise<void>;
}) {
  const { id, ...initial } = item;
  const [record, setRecord] = useState<Item>({
      locale,
      status: "draft",
      ...(kind === "media" ? { type: "photo" } : {}),
      ...(kind === "branches" ? { city: "akhalkalaki" } : {}),
      ...initial,
    }),
    [raw, setRaw] = useState(JSON.stringify(initial, null, 2)),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const knowledge = ["faq", "knowledge"].includes(kind);
  const fields = knowledge
    ? ["question", "answer", "category", "source", "verifiedAt", "responsible"]
    : ["translations", "settings"].includes(kind)
      ? ["key", "value"]
      : kind === "questions"
        ? [
            "question",
            "options",
            "correctIndex",
            "explanation",
            "topic",
            "source",
            "verifiedAt",
          ]
        : kind === "packages"
          ? [
              "title",
              "description",
              "lessons",
              "lessonMinutes",
              "price",
              "oldPrice",
              "program",
              "gearbox",
              "features",
              "order",
            ]
          : [
              "title",
              "description",
              ...(kind === "courses" ? ["price", "duration"] : []),
              ...(kind === "branches" ? ["city", "address", "phone"] : []),
              ...(kind === "instructors"
                ? ["userId", "languages", "vehicle"]
                : []),
              ...(["media", "materials"].includes(kind) ? ["url"] : []),
            ];
  const update = (key: string, value: any) =>
    setRecord((r) => ({ ...r, [key]: value }));
  return (
    <form
      className="form-card record-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await onSave(record);
        } catch {
          setError(t("invalid"));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        <Field label={t("language")}>
          <select
            value={record.locale}
            onChange={(e) => update("locale", e.target.value)}
          >
            {["ka", "hy", "ru", "en"].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </Field>
        <Field label={t("status")}>
          <select
            value={record.status}
            onChange={(e) => update("status", e.target.value)}
          >
            <option value="draft">{t("draftStatus")}</option>
            <option value="published">{t("published")}</option>
          </select>
        </Field>
      </div>
      {fields.map((key) => (
        <Field key={key} label={t(key)}>
          {[
            "answer",
            "description",
            "explanation",
            "options",
            "features",
            "value",
          ].includes(key) ? (
            <textarea
              rows={key === "answer" ? 5 : 3}
              value={
                ["options", "features"].includes(key)
                  ? (record[key] || []).join("\n")
                  : record[key] || ""
              }
              required={
                knowledge || kind === "questions" || kind === "translations"
              }
              onChange={(e) =>
                update(
                  key,
                  key === "options"
                    ? e.target.value.split("\n")
                    : key === "features"
                      ? e.target.value.split("\n").filter((x) => x.trim())
                      : e.target.value,
                )
              }
            />
          ) : key === "program" || key === "gearbox" ? (
            <select
              value={record[key] || (key === "program" ? "practice" : "none")}
              onChange={(e) => update(key, e.target.value)}
            >
              {(key === "program"
                ? ["practice", "theory", "individual", "group", "exam"]
                : ["none", "manual", "automatic"]
              ).map((k) => (
                <option key={k} value={k}>
                  {t(k)}
                </option>
              ))}
            </select>
          ) : key === "city" ? (
            <select
              value={record.city || "akhalkalaki"}
              onChange={(e) => update(key, e.target.value)}
            >
              <option value="akhalkalaki">{t("city1")}</option>
              <option value="ninotsminda">{t("city2")}</option>
            </select>
          ) : (
            <input
              type={
                key === "verifiedAt"
                  ? "date"
                  : [
                        "price",
                        "oldPrice",
                        "correctIndex",
                        "lessons",
                        "lessonMinutes",
                        "order",
                      ].includes(key)
                    ? "number"
                    : "text"
              }
              min={key === "correctIndex" ? 1 : 0}
              step={["price", "oldPrice"].includes(key) ? ".01" : undefined}
              value={
                key === "correctIndex"
                  ? (record.correct ?? 0) + 1
                  : (record[key] ?? "")
              }
              required={
                knowledge ||
                kind === "questions" ||
                key === "title" ||
                (kind === "packages" && key === "lessons") ||
                kind === "translations"
              }
              onChange={(e) =>
                update(
                  key === "correctIndex" ? "correct" : key,
                  key === "correctIndex"
                    ? Number(e.target.value) - 1
                    : [
                          "price",
                          "oldPrice",
                          "lessons",
                          "lessonMinutes",
                          "order",
                        ].includes(key)
                      ? e.target.value === ""
                        ? ""
                        : Number(e.target.value)
                      : e.target.value,
                )
              }
            />
          )}
        </Field>
      ))}
      {kind === "media" && (
        <>
          <Field label={t("category")}>
            <select
              value={record.type || "photo"}
              onChange={(e) => update("type", e.target.value)}
            >
              <option value="photo">{t("photo")}</option>
              <option value="video">{t("video")}</option>
            </select>
          </Field>
          <Field label={t("upload")}>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setError("");
                try {
                  const data = new FormData();
                  data.set("file", file);
                  const res = await fetch("/api/upload", {
                    method: "POST",
                    body: data,
                  });
                  const result = await res.json();
                  if (!res.ok) throw Error(result.error);
                  setRecord((r) => ({
                    ...r,
                    url: result.url,
                    type: result.type.startsWith("video/") ? "video" : "photo",
                  }));
                } catch (e) {
                  setError(t((e as Error).message));
                }
              }}
            />
          </Field>
        </>
      )}
      {kind === "packages" && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={record.featured || false}
            onChange={(e) => update("featured", e.target.checked)}
          />
          {t("featured")}
        </label>
      )}
      {kind === "reviews" && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={record.permission || false}
            onChange={(e) => update("permission", e.target.checked)}
          />
          {t("permission")}
        </label>
      )}
      {kind === "questions" && (
        <label className="checkbox">
          <input
            type="checkbox"
            required
            checked={record.verified || false}
            onChange={(e) => update("verified", e.target.checked)}
          />
          {t("verified")}
        </label>
      )}
      <details>
        <summary>{t("jsonHelp")}</summary>
        <textarea
          className="code-input"
          rows={8}
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            try {
              setRecord((r) => ({ ...r, ...JSON.parse(e.target.value) }));
              setError("");
            } catch {
              setError(t("invalid"));
            }
          }}
        />
      </details>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="record-actions">
        <button className="button" disabled={busy || !!error}>
          {t(busy ? "loading" : "save")}
          <Check size={18} />
        </button>
        <button
          className="button outline-dark"
          type="button"
          onClick={onCancel}
        >
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}

function ChangePassword({
  t,
  forced = false,
  onDone,
}: {
  t: (k: string) => string;
  forced?: boolean;
  onDone: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="form-card password-card"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget));
        if (f.password !== f.repeat) return setError(t("passwordsDiffer"));
        setBusy(true);
        setError("");
        try {
          await api("auth/password", {
            current: f.current,
            password: f.password,
          });
          (e.target as HTMLFormElement).reset();
          onDone();
        } catch (e) {
          setError(t((e as Error).message));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>
        <KeyRound size={20} /> {t("changePassword")}
      </h3>
      {forced && <Notice>{t("mustChangePassword")}</Notice>}
      <Field label={t(forced ? "tempPassword" : "currentPassword")}>
        <input
          name="current"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
      <Field label={t("newPassword")}>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          maxLength={128}
          required
        />
      </Field>
      <Field label={t("repeatPassword")}>
        <input
          name="repeat"
          type="password"
          autoComplete="new-password"
          minLength={6}
          maxLength={128}
          required
        />
      </Field>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button" disabled={busy}>
        {t(busy ? "loading" : "save")}
        <Check size={18} />
      </button>
    </form>
  );
}
/** Excel opens UTF-8 CSV correctly only with a BOM; `;` matches the Russian/Georgian Excel locale. */
function exportCsv(
  rows: Item[],
  t: (k: string) => string,
  fmt: (s: string) => string,
) {
  const head = [
    "ID",
    t("date"),
    t("status"),
    t("name"),
    t("phone"),
    t("city"),
    t("package"),
    t("program"),
    t("gearbox"),
    t("note"),
    t("created"),
  ];
  const cell = (v: unknown) => {
    const s = String(v ?? "");
    // Neutralise spreadsheet formulas typed into free-text fields.
    const safe = /^[=+\-@\t\r]/.test(s) && !/^\+\d/.test(s) ? "'" + s : s;
    return '"' + safe.replace(/"/g, '""') + '"';
  };
  const lines = rows.map((b) =>
    [
      b.series_id || b.id,
      b.slot_start ? fmt(b.slot_start) : "",
      t(b.status),
      b.name,
      b.contact,
      t(b.city === "akhalkalaki" ? "city1" : "city2"),
      b.package_title,
      t(b.program),
      t(b.gearbox),
      b.note,
      fmt(b.created),
    ]
      .map(cell)
      .join(";"),
  );
  const blob = new Blob(
    ["\ufeff" + [head.map(cell).join(";"), ...lines].join("\r\n")],
    {
      type: "text/csv;charset=utf-8",
    },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `motion-drive-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
