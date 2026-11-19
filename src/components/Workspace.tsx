"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowLeft,
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
  Wallet,
  BarChart3,
} from "lucide-react";
import { api, Field, Notice, type Item } from "./Site";
import { georgiaDay } from "./AvailabilityPicker";
import { formatPhone } from "../lib/phone";
import { STAFF_KINDS } from "../lib/roles";
import { PaymentsTab, FinanceReport } from "./Finance";
import Applications from "./Applications";
import Staff from "./Staff";
import PayPanel from "./PayPanel";
import { MySalary, PayrollReport } from "./Payroll";
import Roles from "./Roles";
import Today from "./Today";
import Guide from "./Guide";
import Chessboard from "./Chessboard";
import { AddStudent, SetPersonalId } from "./OfficeStudent";
import { ExpensesTab, MoneyOverview } from "./Money";
type Props = {
  user: Item;
  locale: string;
  t: (k: string) => string;
  page: string;
  onLogout: () => void;
};
const modules = [
  "bookings",
  "applications",
  "students",
  "instructors",
  "programs",
  "packages",
  "services",
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
/** The side menu in sections, so that 30 items are never one flat list. */
const SECTIONS: [string, string[]][] = [
  ["Сегодня", ["today", "guide"]],
  [
    "Работа",
    ["chess", "bookings", "applications", "students", "schedule", "lessons"],
  ],
  ["Деньги", ["payments", "expenses", "finance", "payroll", "salary", "mypay"]],
  ["Люди", ["staff", "roles", "instructors"]],
  [
    "Сайт",
    [
      "programs",
      "packages",
      "services",
      "courses",
      "branches",
      "media",
      "reviews",
      "faq",
      "translations",
      "materials",
    ],
  ],
  [
    "Обращения и обучение",
    ["messages", "knowledge", "questions", "results", "imports", "progress"],
  ],
  ["Система", ["usage", "settings", "audit", "security"]],
];
export default function Workspace({ user, locale, t, page, onLogout }: Props) {
  const startsOnToday =
    (user.role === "admin" && page === "admin") ||
    ((user.role === "operator" || user.role === "manager") &&
      page === user.role);
  const initialTab = startsOnToday ? "today" : "bookings";
  const [data, setData] = useState<Item | null>(null),
    [tab, setTab] = useState(initialTab),
    [payFocus, setPayFocus] = useState<{ id: string; name: string } | null>(
      null,
    ),
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
    operator =
      (user.role === "operator" || user.role === "manager") &&
      page === user.role,
    staff = admin || operator,
    instructor =
      (user.role === "instructor" || user.role === "lecturer") &&
      page === user.role;
  // Staff edit photos and content from their own panel; prices, roles and reports stay with admins.
  const canEdit = (kind: string) =>
    admin || (operator && STAFF_KINDS.includes(kind));
  const tabs = [
    ...(staff ? ["today", "chess"] : []),
    ...(staff || instructor ? ["guide"] : []),
    ...(admin
      ? [
          ...modules.slice(0, 3),
          "payments",
          "expenses",
          "finance",
          "payroll",
          "roles",
          "staff",
          ...modules.slice(3),
        ]
      : operator
        ? [
            "bookings",
            "applications",
            "schedule",
            "students",
            "payments",
            "expenses",
            "salary",
            "messages",
            "media",
            "instructors",
            "branches",
            "programs",
            "courses",
            "reviews",
            "faq",
          ]
        : instructor
          ? ["bookings", "students", "schedule", "lessons", "salary"]
          : [
              "bookings",
              "mypay",
              "progress",
              "results",
              "materials",
              "messages",
            ]),
    "security",
  ];
  // From a student (or a debtor in the money report) straight to his account of charges and payments.
  const openLedger = (id: string, name: string) => {
    setPayFocus({ id, name });
    setTab("payments");
    setEditing(null);
    setNotice("");
    window.scrollTo({ top: 0 });
  };
  // A page that stays open for days must say when the site has been updated.
  const [stale, setStale] = useState(false);
  useEffect(() => {
    const mine = process.env.NEXT_PUBLIC_BUILD_ID || "dev";
    const check = () =>
      api("version")
        .then((v) =>
          setStale(v.id !== "dev" && mine !== "dev" && v.id !== mine),
        )
        .catch(() => {});
    check();
    const timer = setInterval(check, 120000);
    return () => clearInterval(timer);
  }, []);
  // Staff get new orders and applications without reloading the page.
  useEffect(() => {
    if (!["admin", "manager", "operator"].includes(user.role)) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible")
        api("dashboard")
          .then(setData)
          .catch(() => {});
    }, 60000);
    return () => clearInterval(timer);
  }, [user.role]);
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
  const clock = (s: string) =>
    new Date(
      /(?:Z|[+-]\d{2}(?::?\d{2})?)$/.test(s) ? s : s + "Z",
    ).toLocaleTimeString(locale, {
      timeZone: "Asia/Tbilisi",
      hour: "2-digit",
      minute: "2-digit",
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
        {(tabs.length > 10
          ? [
              ...SECTIONS.map(([title, keys]) => [
                title,
                tabs.filter((k) => keys.includes(k)),
              ]),
              [
                "Прочее",
                tabs.filter(
                  (k) => !SECTIONS.some(([, keys]) => keys.includes(k)),
                ),
              ],
            ]
          : [["", tabs]]
        )
          .filter(([, list]) => (list as string[]).length)
          .map(([title, list]) => (
            <div className="nav-section" key={title as string}>
              {title && <h5 className="nav-title">{title as string}</h5>}
              {(list as string[]).map((k) => (
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
                  ) : k === "payments" || k === "expenses" ? (
                    <Wallet size={16} />
                  ) : k === "finance" ? (
                    <BarChart3 size={16} />
                  ) : (
                    <BookOpen size={16} />
                  )}
                  {t(k)}
                  {k === "applications" && data.newApplications > 0 && (
                    <span>{data.newApplications}</span>
                  )}
                  {k === "bookings" && (
                    <span>
                      {
                        data.bookings.filter(
                          (b: Item) => b.status === "pending",
                        ).length
                      }
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        {stale && (
          <div className="notice update-banner" role="status">
            <span>
              Вышла новая версия сайта. Обновите страницу, чтобы увидеть
              изменения.
            </span>
            <button
              type="button"
              className="button small"
              onClick={() => window.location.reload()}
            >
              Обновить
            </button>
          </div>
        )}
        <small className="build-stamp">
          Версия сайта: {process.env.NEXT_PUBLIC_BUILD_ID || "dev"}
          {process.env.NEXT_PUBLIC_BUILD_TIME
            ? " · " +
              new Date(
                Date.parse(process.env.NEXT_PUBLIC_BUILD_TIME) + 4 * 3600e3,
              )
                .toISOString()
                .slice(8, 10) +
              "." +
              process.env.NEXT_PUBLIC_BUILD_TIME.slice(5, 7) +
              " " +
              new Date(
                Date.parse(process.env.NEXT_PUBLIC_BUILD_TIME) + 4 * 3600e3,
              )
                .toISOString()
                .slice(11, 16)
            : ""}
        </small>
        <div className="workspace-links">
          <Link href={"/" + locale}>
            <ArrowLeft size={16} />
            {t("backHome")}
          </Link>
          {user.role === "admin" && page !== "admin" && (
            <Link href={"/" + locale + "/admin"}>
              {t("admin")}
              <ArrowUpRight size={16} />
            </Link>
          )}
          {(user.role === "operator" || user.role === "manager") &&
            page !== user.role && (
              <Link href={"/" + locale + "/" + user.role}>
                {t(user.role)}
                <ArrowUpRight size={16} />
              </Link>
            )}
          {(user.role === "instructor" || user.role === "lecturer") &&
            page !== user.role && (
              <Link href={"/" + locale + "/" + user.role}>
                {t(user.role)}
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
          {canEdit(tab) && data.records[tab] && (
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
                          {b.slot_start && b.slot_end
                            ? ` – ${clock(b.slot_end)}`
                            : ""}
                          {series && (
                            <span className={"status " + b.status}>
                              {t(b.status)}
                            </span>
                          )}
                        </p>
                        {b.slot_end &&
                          !staff &&
                          !instructor &&
                          ["pending", "confirmed"].includes(b.status) && (
                            <small className="late-hint">
                              {t("lessonEnds").replace(
                                "%TIME%",
                                clock(b.slot_end),
                              )}
                            </small>
                          )}
                        <div className="record-actions">
                          {b.status === "confirmed" &&
                            b.slot_start &&
                            Date.parse(b.slot_start) <= Date.now() &&
                            !b.accepted_at && (
                              <>
                                {instructor && !b.conducted_at && (
                                  <button
                                    className="button small"
                                    onClick={() =>
                                      act("teach/conducted", { id: b.id })
                                    }
                                  >
                                    Урок проведён
                                    <Check size={16} />
                                  </button>
                                )}
                                {instructor && b.conducted_at && (
                                  <span className="status pending">
                                    Ждёт принятия
                                  </span>
                                )}
                                {staff && !instructor && (
                                  <>
                                    <button
                                      className="button small"
                                      onClick={async () => {
                                        const r = await act("teach/accept", {
                                          id: b.id,
                                        });
                                        if (r?.charged)
                                          setNotice(
                                            `Урок принят. Ученик ещё не заплатил: записан долг ${r.charged / 100} ₾ (его можно закрыть в «Оплаты и долг»).`,
                                          );
                                      }}
                                    >
                                      {b.conducted_at
                                        ? "Принять урок"
                                        : "Урок проведён, принять"}
                                      <CheckCheck size={16} />
                                    </button>
                                    {b.conducted_at && (
                                      <button
                                        className="button small outline-dark"
                                        onClick={() =>
                                          act("teach/unconduct", { id: b.id })
                                        }
                                      >
                                        Вернуть
                                      </button>
                                    )}
                                  </>
                                )}
                              </>
                            )}
                          {b.accepted_at && (
                            <span className="status completed">
                              Урок принят
                            </span>
                          )}
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
        {tab === "mypay" && !staff && !instructor && <PayPanel t={t} />}
        {tab === "applications" && staff && (
          <Applications
            t={t}
            students={data.users.filter((u: Item) => u.role === "student")}
            onCreated={refresh}
            onOpen={(phone) => {
              setSearch(phone);
              setTab("students");
              window.scrollTo({ top: 0 });
            }}
          />
        )}
        {tab === "today" && staff && (
          <Today
            data={data}
            freeSlots={freeSlots}
            owner={admin}
            myId={user.id}
            go={(k) => {
              setTab(k);
              setEditing(null);
              setNotice("");
              window.scrollTo({ top: 0 });
            }}
          />
        )}
        {tab === "guide" && (staff || instructor) && <Guide role={user.role} />}
        {tab === "chess" && staff && (
          <Chessboard
            slots={data.slots}
            bookings={data.bookings}
            users={data.users}
            act={act}
            refresh={refresh}
            onPay={openLedger}
            onOpenStudent={(phone) => {
              setSearch(phone);
              setTab("students");
              window.scrollTo({ top: 0 });
            }}
            goStudents={() => {
              setTab("students");
              window.scrollTo({ top: 0 });
            }}
          />
        )}
        {tab === "roles" && admin && <Roles />}
        {tab === "staff" && admin && (
          <Staff
            users={data.users}
            me={user.id}
            cards={data.records?.instructors || []}
            onChange={refresh}
          />
        )}
        {tab === "payroll" && admin && <PayrollReport />}
        {tab === "salary" && (instructor || operator) && <MySalary />}
        {tab === "payments" && staff && <PaymentsTab t={t} focus={payFocus} />}
        {tab === "expenses" && staff && (
          <ExpensesTab admin={admin} myId={user.id} />
        )}
        {tab === "finance" && admin && (
          <>
            <MoneyOverview onOpenStudent={openLedger} />
            <FinanceReport t={t} />
          </>
        )}
        {tab === "students" && (
          <div className="data-list">
            {staff && (
              <AddStudent
                instructors={data.users.filter(
                  (x: Item) =>
                    x.role === "instructor" && Number(x.active ?? 1) !== 0,
                )}
                onCreated={async (phone) => {
                  await refresh();
                  setSearch(phone);
                }}
              />
            )}
            <input
              type="search"
              className="list-search"
              placeholder="Найти ученика по имени или телефону"
              aria-label="Поиск"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {data.users
              .filter((u: Item) => u.role === "student")
              .filter(
                (u: Item) =>
                  !search ||
                  (u.name + " " + (u.phone || "") + " " + (u.email || ""))
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              )
              .map((u: Item) => (
                <article key={u.id}>
                  <strong>{u.name}</strong>
                  <p>
                    {u.phone ? (
                      <a href={"tel:" + u.phone}>{formatPhone(u.phone)}</a>
                    ) : (
                      u.email
                    )}
                  </p>
                  {u.pay_method && (
                    <p className="muted">
                      {t("payHowShort")}:{" "}
                      {t(u.pay_method === "cash" ? "payCash" : "payNoncash")}
                    </p>
                  )}
                  <AssignInstructor
                    student={u}
                    instructors={data.users.filter(
                      (x: Item) =>
                        x.role === "instructor" && Number(x.active ?? 1) !== 0,
                    )}
                    act={act}
                  />
                  <EnrollGroup
                    student={u}
                    enrollments={data.enrollments || []}
                    lecturers={data.users.filter(
                      (x: Item) => x.role === "lecturer",
                    )}
                    act={act}
                  />
                  <ShowId
                    id={u.id}
                    has={!!Number(u.has_personal_id)}
                    t={t}
                    onSaved={refresh}
                  />
                  <BookFor
                    student={u}
                    slots={freeSlots}
                    instructors={data.users.filter(
                      (x: Item) => x.role === "instructor",
                    )}
                    act={act}
                    onDone={(m) => setNotice(m)}
                  />
                  <div className="row-actions">
                    <button
                      type="button"
                      className="button small"
                      onClick={() => openLedger(u.id, u.name)}
                    >
                      <Wallet size={15} />
                      Оплаты и долг
                    </button>
                    {staff && (
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
                  </div>
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
                </article>
              ))}
            {!data.users.some((u: Item) => u.role === "student") && (
              <Empty t={t} />
            )}
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
            {staff && (
              <form
                className="form-card"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const x = Object.fromEntries(new FormData(e.currentTarget));
                  const r = await act("schedule/daylight", x);
                  if (r)
                    setNotice(
                      r.created
                        ? `Открыто занятий: ${r.created} (дней: ${r.days})`
                        : "Всё уже открыто на этот срок.",
                    );
                }}
              >
                <h3>Открыть вождение до заката</h3>
                <p className="muted">
                  Ахалкалаки, с понедельника по субботу, с 9:00, урок 60 минут.
                  Последнее занятие заканчивается до темноты: закат считается
                  сам для каждого дня, зимой занятий меньше, летом больше.
                  Расписание можно открыть повторно: уже открытое не
                  дублируется.
                </p>
                <div className="form-grid">
                  <Field label="На сколько недель">
                    <select name="weeks" defaultValue="4">
                      {[1, 2, 4, 8].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Если инструкторов ещё нет: сколько машин ездит одновременно">
                    <input
                      name="cars"
                      type="number"
                      min="1"
                      max="10"
                      defaultValue="3"
                    />
                  </Field>
                </div>
                <button className="button small">Открыть расписание</button>
              </form>
            )}
            <form
              className="form-card"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const fd = new FormData(form);
                const f = Object.fromEntries(fd);
                const base = {
                  city: f.city,
                  instructor_id: instructor ? user.id : f.instructor_id || null,
                  intervalMinutes: Number(f.intervalMinutes),
                };
                const weeks = Number(f.weeks || 1);
                const days = fd.getAll("wd").map(Number);
                if (weeks === 1 && !days.length) {
                  const r = await act("slot/create", {
                    ...base,
                    start: new Date(String(f.start) + "+04:00").toISOString(),
                    end: new Date(String(f.end) + "+04:00").toISOString(),
                  });
                  if (r) form.reset();
                  return;
                }
                // Repeat the same hours on the chosen weekdays for N weeks.
                const [first, from] = String(f.start).split("T");
                const to = String(f.end).split("T")[1];
                const startDay = new Date(first + "T12:00:00Z").getUTCDay();
                let created = 0,
                  skipped = 0;
                setError("");
                setNotice("");
                for (let i = 0; i < weeks * 7; i++) {
                  const day = new Date(
                    Date.parse(first + "T12:00:00Z") + i * 86400000,
                  );
                  if (
                    !(days.length ? days : [startDay]).includes(day.getUTCDay())
                  )
                    continue;
                  const date = day.toISOString().slice(0, 10);
                  try {
                    await api("slot/create", {
                      ...base,
                      start: new Date(`${date}T${from}+04:00`).toISOString(),
                      end: new Date(`${date}T${to}+04:00`).toISOString(),
                    });
                    created++;
                  } catch {
                    skipped++; // already open or in the past
                  }
                }
                if (created)
                  setNotice(
                    `${t("saved")}: ${created}` +
                      (skipped ? ` · ${t("skipped")}: ${skipped}` : ""),
                  );
                else setError(t("slotUnavailable"));
                await refresh();
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
              <div className="repeat-box">
                <Field label={t("repeatWeeks")}>
                  <select name="weeks" defaultValue="1">
                    {[1, 2, 4, 8].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </Field>
                <div
                  className="chips"
                  role="group"
                  aria-label={t("repeatDays")}
                >
                  {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
                    <label key={wd} className="chip-check">
                      <input type="checkbox" name="wd" value={wd} />
                      <span>
                        {new Date(
                          Date.UTC(2026, 10, 1 + wd),
                        ).toLocaleDateString(locale, {
                          weekday: "short",
                          timeZone: "UTC",
                        })}
                      </span>
                    </label>
                  ))}
                </div>
                <small>{t("repeatDays")}</small>
              </div>
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
        {canEdit(tab) &&
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
  // People and photos are one record for every language: names in all languages live inside it.
  const oneRecord = ["instructors", "media"].includes(kind);
  const RU: Record<string, string> = {
    title_en:
      kind === "media"
        ? "Подпись по-английски (необязательно)"
        : "Имя по-английски (необязательно)",
    title_ka:
      kind === "media"
        ? "Подпись по-грузински (необязательно)"
        : "Имя по-грузински (необязательно)",
    title_hy:
      kind === "media"
        ? "Подпись по-армянски (необязательно)"
        : "Имя по-армянски (необязательно)",
    role: "Должность",
    photo: "Фото",
    ...(kind === "instructors"
      ? {
          title: "Имя и фамилия (по-русски)",
          description: "Описание (по-русски, необязательно)",
        }
      : {}),
    ...(kind === "media" ? { title: "Подпись (по-русски)" } : {}),
  };
  const label = (k: string) => RU[k] || t(k === "group" ? "packageGroup" : k);
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
              "group",
              "priceType",
              "lessons",
              "weeks",
              "lessonMinutes",
              "lessonMinutesMax",
              "price",
              "oldPrice",
              "program",
              "gearbox",
              "features",
              "order",
            ]
          : kind === "services"
            ? ["title", "price", "term", "description", "order"]
            : kind === "programs"
              ? [
                  "title",
                  "description",
                  "category",
                  "stage",
                  "items",
                  "exam",
                  "price",
                  "duration",
                  "image",
                  "order",
                ]
              : [
                  "title",
                  "description",
                  ...(kind === "courses" ? ["price", "duration"] : []),
                  ...(kind === "branches" ? ["city", "address", "phone"] : []),
                  ...(kind === "instructors"
                    ? ["role", "languages", "vehicle", "order"]
                    : []),
                  ...(oneRecord ? ["title_en", "title_ka", "title_hy"] : []),
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
          await onSave(oneRecord ? { ...record, locale: "" } : record);
        } catch {
          setError(t("invalid"));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        {!oneRecord && (
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
        )}
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
        <Field key={key} label={label(key)}>
          {[
            "answer",
            "description",
            "explanation",
            "options",
            "features",
            "items",
            "exam",
            "value",
          ].includes(key) ? (
            <textarea
              rows={key === "answer" ? 5 : 3}
              value={
                ["options", "features", "items"].includes(key)
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
                    : ["features", "items"].includes(key)
                      ? e.target.value.split("\n").filter((x) => x.trim())
                      : e.target.value,
                )
              }
            />
          ) : key === "role" ? (
            <select
              value={record.role || "instructor"}
              onChange={(e) => update("role", e.target.value)}
            >
              <option value="instructor">Инструктор по вождению</option>
              <option value="lecturer">Лектор по теории</option>
              <option value="administrator">Администратор</option>
            </select>
          ) : ["category", "stage"].includes(key) ? (
            <select
              value={record[key] || (key === "category" ? "B" : "theory")}
              onChange={(e) => update(key, e.target.value)}
            >
              {(key === "category"
                ? ["B", "C"]
                : ["theory", "yard", "city", "official"]
              ).map((k) => (
                <option key={k} value={k}>
                  {key === "category" ? t("category" + k) : t("stage_" + k)}
                </option>
              ))}
            </select>
          ) : ["program", "gearbox", "group", "priceType"].includes(key) ? (
            <select
              value={
                record[key] ||
                {
                  program: "practice",
                  gearbox: "none",
                  group: "driving",
                  priceType: "total",
                }[key]
              }
              onChange={(e) => update(key, e.target.value)}
            >
              {(
                {
                  program: [
                    "practice",
                    "theory",
                    "individual",
                    "group",
                    "exam",
                  ],
                  gearbox: ["none", "manual", "automatic"],
                  group: ["theory", "driving", "exam"],
                  priceType: ["total", "perLesson"],
                } as Record<string, string[]>
              )[key].map((k) => (
                <option key={k} value={k}>
                  {t(
                    key === "group"
                      ? "group_" + k
                      : key === "priceType"
                        ? "priceType_" + k
                        : k,
                  )}
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
                        "weeks",
                        "lessonMinutes",
                        "lessonMinutesMax",
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
                          "weeks",
                          "lessonMinutes",
                          "lessonMinutesMax",
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
      {["instructors", "programs"].includes(kind) && (
        <Field label={label("photo")}>
          {record.image && (
            <img className="editor-photo" src={record.image} alt="" />
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
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
                setRecord((r) => ({ ...r, image: result.url }));
              } catch (e) {
                setError(t((e as Error).message));
              }
            }}
          />
        </Field>
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
      {kind === "packages" && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={record.bookable !== false}
            onChange={(e) => update("bookable", e.target.checked)}
          />
          {t("bookableOnline")}
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

/** Personal number of a student: hidden until staff ask for it; each view is written to the log. */
function ShowId({
  id,
  has,
  t,
  onSaved,
}: {
  id: string;
  has: boolean;
  t: (k: string) => string;
  onSaved?: () => Promise<void> | void;
}) {
  const [value, setValue] = useState<string | null>(null);
  if (!has)
    return onSaved ? (
      <SetPersonalId id={id} onSaved={onSaved} />
    ) : (
      <p className="muted">{t("personalId")}: —</p>
    );
  return value === null ? (
    <button
      type="button"
      className="link-button"
      onClick={async () => {
        try {
          const r = await api("student/personal-id", { id });
          setValue(r.personal_id || "—");
          setTimeout(() => setValue(null), 30000);
        } catch {}
      }}
    >
      {t("showPersonalId")}
    </button>
  ) : (
    <p className="muted">
      {t("personalId")}: <b>{value}</b>
    </p>
  );
}

const GROUP_SCOPE: Record<string, string> = {
  akhalkalaki: "Группа, Ахалкалаки",
  ninotsminda: "Группа, Ниноцминда",
  visiting: "Выездная группа",
  individual: "Индивидуально / мини-группа до 3",
};
/** Writes a student into a theory group (or individual theory); the lecturer's pay follows from it. */
function EnrollGroup({
  student,
  enrollments,
  lecturers,
  act,
}: {
  student: Item;
  enrollments: Item[];
  lecturers: Item[];
  act: (path: string, body: any) => Promise<any>;
}) {
  const mine = enrollments.find((e) => e.user_id === student.id);
  const [scope, setScope] = useState("akhalkalaki");
  if (mine)
    return (
      <p className="muted">
        Теория: <b>{GROUP_SCOPE[mine.scope]}</b>
        {lecturers.find((l) => l.id === mine.lecturer_id)
          ? ` · лектор ${lecturers.find((l) => l.id === mine.lecturer_id)!.name}`
          : ""}{" "}
        <button
          type="button"
          className="link-button"
          onClick={() =>
            confirm("Убрать из группы?") &&
            act("theory/unenroll", { id: mine.id })
          }
        >
          убрать
        </button>
      </p>
    );
  return (
    <details className="pay-add">
      <summary>
        Теория: записать в группу (только если ученик проходит теорию)
      </summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const x = Object.fromEntries(new FormData(e.currentTarget));
          await act("theory/enroll", {
            user_id: student.id,
            scope: x.scope,
            price: x.price || 0,
            lecturer_id: x.lecturer_id || null,
          });
        }}
      >
        <select
          name="scope"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
        >
          {Object.entries(GROUP_SCOPE).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input
          name="price"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          placeholder={
            scope === "individual"
              ? "Стоимость курса, ₾ (например, 300)"
              : "Стоимость курса, ₾ (например, 150)"
          }
          key={scope}
        />
        {lecturers.length > 0 && (
          <select
            name="lecturer_id"
            defaultValue={lecturers[0]?.id || ""}
            aria-label="Лектор"
          >
            {lecturers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        )}
        <button className="button small">Записать</button>
      </form>
    </details>
  );
}

const DAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const slotText = (iso: string) => {
  const d = new Date(Date.parse(iso) + 4 * 3600e3);
  return `${DAYS[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")} ${d.toISOString().slice(11, 16)}`;
};
/** The office books a lesson for a student after agreeing the time with him by phone. */
function BookFor({
  student,
  slots,
  instructors,
  act,
  onDone,
}: {
  student: Item;
  slots: Item[];
  instructors: Item[];
  act: (path: string, body: any) => Promise<any>;
  onDone: (message: string) => void;
}) {
  const [slot, setSlot] = useState("");
  const [kind, setKind] = useState("city");
  const [gear, setGear] = useState("automatic");
  const [everyone, setEveryone] = useState(false);
  const mine = student.instructor_id as string | undefined;
  const free = slots
    .filter((s) => s.city === "akhalkalaki")
    .filter((s) => kind !== "yard" || s.kind !== "city")
    .filter((s) => everyone || !mine || s.instructor_id === mine)
    .slice(0, 80);
  return (
    <details className="pay-add">
      <summary>Записать на занятие</summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!slot) return;
          const r = await act("booking/create", {
            user_id: student.id,
            city: "akhalkalaki",
            program: "practice",
            gearbox: gear,
            slot_ids: [slot],
            lesson_kind: kind,
            name: student.name,
            contact: student.phone || student.email || "-",
            note: "",
            consent: true,
            website: "",
          });
          if (r) {
            setSlot("");
            onDone("Занятие записано и подтверждено: " + student.name);
          }
        }}
      >
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          aria-label="Вид занятия"
        >
          <option value="city">Город</option>
          <option value="yard">Площадка</option>
        </select>
        <select
          value={gear}
          onChange={(e) => setGear(e.target.value)}
          aria-label="Коробка"
        >
          <option value="automatic">Автомат</option>
          <option value="manual">Механика</option>
        </select>
        <select
          value={slot}
          onChange={(e) => setSlot(e.target.value)}
          aria-label="Время"
          required
        >
          <option value="">— выберите время —</option>
          {free.map((s) => (
            <option key={s.id} value={s.id}>
              {slotText(s.start)}
              {s.instructor_id
                ? " · " +
                  (instructors.find((i) => i.id === s.instructor_id)?.name ||
                    "инструктор")
                : ""}
            </option>
          ))}
        </select>
        {mine && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={everyone}
              onChange={(e) => setEveryone(e.target.checked)}
            />
            <span>
              Показать время всех инструкторов (сейчас только{" "}
              {instructors.find((i) => i.id === mine)?.name ||
                "его инструктора"}
              )
            </span>
          </label>
        )}
        <button className="button small">Записать</button>
        <small className="muted">
          Запись подтверждается сразу. Ученик видит её у себя в кабинете. Чтобы
          записать на несколько занятий, повторите.
        </small>
      </form>
    </details>
  );
}

/** The driving instructor a student is assigned to (for students who take driving: city and yard). */
function AssignInstructor({
  student,
  instructors,
  act,
}: {
  student: Item;
  instructors: Item[];
  act: (path: string, body: any) => Promise<any>;
}) {
  return (
    <p className="muted assign-line">
      <label>
        Вождение (город и площадка), инструктор:{" "}
        <select
          value={student.instructor_id || ""}
          aria-label="Инструктор ученика"
          onChange={(e) =>
            act("student/assign", {
              id: student.id,
              instructor_id: e.target.value || null,
            })
          }
        >
          <option value="">не закреплён (любой)</option>
          {instructors.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </label>
    </p>
  );
}
