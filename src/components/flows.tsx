"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  ArrowLeft,
  MapPin,
  MessageCircle,
  ArrowRight,
  Check,
  Clock,
  ShieldCheck,
  Sparkles,
  CalendarDays,
  Wand2,
  X,
  Minus,
  Plus,
  Phone,
} from "lucide-react";
import { api, Field, Notice, type Item } from "./Site";
import AvailabilityPicker from "./AvailabilityPicker";
import Packages, { sortPackages } from "./Packages";
import { autoPick, type DayPart } from "../lib/schedule";
type Common = { locale: string; t: (k: string) => string };

/** Phone + password fields shared by the account page and the booking form. */
function AccountFields({
  register,
  t,
}: {
  register: boolean;
  t: (k: string) => string;
}) {
  return (
    <>
      {register && (
        <Field label={t("name")}>
          <input
            name="name"
            autoComplete="name"
            minLength={2}
            maxLength={100}
            required
          />
        </Field>
      )}
      <Field label={t("phone")}>
        <input
          name={register ? "phone" : "login"}
          type="text"
          inputMode={register ? "tel" : "text"}
          autoComplete={register ? "tel" : "username"}
          placeholder="+995 5XX XXX XXX"
          maxLength={register ? 40 : 180}
          required
        />
      </Field>
      <Field label={t("password")}>
        <input
          name="password"
          type="password"
          autoComplete={register ? "new-password" : "current-password"}
          minLength={register ? 6 : 1}
          maxLength={128}
          required
        />
      </Field>
    </>
  );
}
function Forgot({ t }: { t: (k: string) => string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="forgot">
      <button
        type="button"
        className="link-button"
        onClick={() => setOpen(!open)}
      >
        {t("forgotPassword")}
      </button>
      <AnimatePresence>
        {open && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Phone size={14} /> {t("forgotText")}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
async function signIn(
  register: boolean,
  form: Record<string, any>,
  locale: string,
) {
  const r = await api("auth/" + (register ? "register" : "login"), {
    ...form,
    locale,
  });
  return r.user as Item;
}
export function Auth({
  locale,
  t,
  onUser,
}: { onUser: (u: Item) => void } & Common) {
  const [register, setRegister] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="auth-layout">
      <div>
        <span className="eyebrow">MOTION DRIVE / YOUR SPACE</span>
        <h2>{t("account")}</h2>
        <p>{t("loginToBook")}</p>
        <div className="auth-perks">
          {["bookings", "progress", "materials"].map((k) => (
            <p key={k}>
              <Check size={18} />
              {t(k)}
            </p>
          ))}
        </div>
      </div>
      <form
        className="form-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const data = Object.fromEntries(new FormData(e.currentTarget));
          try {
            onUser(await signIn(register, data, locale));
          } catch (e) {
            setError(t((e as Error).message));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="tabs">
          <button
            type="button"
            className={!register ? "selected" : ""}
            onClick={() => setRegister(false)}
          >
            {t("login")}
          </button>
          <button
            type="button"
            className={register ? "selected" : ""}
            onClick={() => setRegister(true)}
          >
            {t("register")}
          </button>
        </div>
        <AccountFields register={register} t={t} />
        {register && (
          <label className="checkbox">
            <input type="checkbox" required />
            <span>
              {t("consent")} ·{" "}
              <Link href={"/" + locale + "/privacy"}>{t("privacy")}</Link>
            </span>
          </label>
        )}
        {!register && <Forgot t={t} />}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="button" disabled={busy}>
          {t(busy ? "loading" : register ? "register" : "login")}
          <ArrowRight size={18} />
        </button>
      </form>
    </div>
  );
}

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
const PARTS: DayPart[] = ["morning", "day", "evening"];
const weekdayName = (locale: string, i: number) =>
  new Date(Date.UTC(2026, 10, 2 + i)).toLocaleDateString(locale, {
    weekday: "short",
    timeZone: "UTC",
  });
const slotLabel = (locale: string, iso: string) =>
  new Date(iso).toLocaleString(locale, {
    weekday: "short",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tbilisi",
  });

export function Booking({
  locale,
  t,
  user,
  content,
}: {
  user: Item | null | undefined;
  content: Record<string, Item[]>;
} & Common) {
  const packages = useMemo(
    () =>
      sortPackages(
        // Only courses the student schedules personally are bookable online.
        (content.packages || []).filter(
          (p) => (!p.locale || p.locale === locale) && p.bookable !== false,
        ),
      ),
    [content.packages, locale],
  );
  const [localUser, setLocalUser] = useState(user),
    [slots, setSlots] = useState<Item[]>([]),
    [pack, setPack] = useState<Item | null>(null),
    [customCount, setCustomCount] = useState(1),
    [city, setCity] = useState("akhalkalaki"),
    [instructor, setInstructor] = useState(""),
    [mode, setMode] = useState<"auto" | "manual">("auto"),
    [weekdays, setWeekdays] = useState<number[]>([]),
    [parts, setParts] = useState<DayPart[]>([]),
    [perWeek, setPerWeek] = useState(2),
    [picked, setPicked] = useState<string[]>([]),
    [missing, setMissing] = useState(0),
    [autoDone, setAutoDone] = useState(false),
    [registerMode, setRegisterMode] = useState(true),
    [error, setError] = useState(""),
    [sent, setSent] = useState<Item[] | null>(null),
    [sentBy, setSentBy] = useState<Item | null | undefined>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => setLocalUser(user), [user]);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("package");
    const found = packages.find((p) => p.id === id);
    if (found) setPack(found);
  }, [packages]);
  useEffect(() => {
    let active = true;
    async function refreshSlots() {
      try {
        const next = await api("slots");
        if (active) {
          setSlots(next);
          setPicked((current) =>
            current.filter((id) => next.some((s: Item) => s.id === id)),
          );
        }
      } catch {
        if (active) setError(t("serverError"));
      }
    }
    refreshSlots();
    const timer = setInterval(refreshSlots, 15000);
    window.addEventListener("focus", refreshSlots);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refreshSlots);
    };
  }, []);
  const perLesson = pack?.priceType === "perLesson";
  // Driving practice and exam routes run only from Akhalkalaki; theory in both branches.
  const practiceOnly = pack?.group !== "theory";
  const bookCity = practiceOnly ? "akhalkalaki" : city;
  const count = pack && !perLesson ? Number(pack.lessons) || 1 : customCount;
  const hasPrice = pack?.price !== undefined && pack?.price !== "";
  const total = hasPrice
    ? Number(pack!.price) *
      (perLesson ? Math.max(1, picked.length || count) : 1)
    : null;
  const available = slots.filter(
    (s) =>
      s.city === bookCity && (!instructor || s.instructor_id === instructor),
  );
  const pickedSlots = picked
    .map((id) => slots.find((s) => s.id === id))
    .filter(Boolean)
    .sort((a, b) => Date.parse(a!.start) - Date.parse(b!.start)) as Item[];
  const resetPick = () => {
    setPicked([]);
    setMissing(0);
    setAutoDone(false);
  };
  const runAuto = () => {
    const r = autoPick(available as any, { count, weekdays, parts, perWeek });
    setPicked(r.picked.map((s) => s.id));
    setMissing(r.missing);
    setAutoDone(true);
  };
  const toggle = <T,>(list: T[], v: T) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const stepper = (
    <div className="stepper" aria-label={t("lessonsWord")}>
      <button
        type="button"
        aria-label="−"
        onClick={() => {
          setCustomCount(Math.max(1, customCount - 1));
          resetPick();
        }}
      >
        <Minus size={16} />
      </button>
      <motion.output
        key={customCount}
        initial={{ scale: 1.3 }}
        animate={{ scale: 1 }}
      >
        {customCount}
      </motion.output>
      <button
        type="button"
        aria-label="+"
        onClick={() => {
          setCustomCount(Math.min(20, customCount + 1));
          resetPick();
        }}
      >
        <Plus size={16} />
      </button>
    </div>
  );
  if (user === undefined) return <Notice>{t("loading")}</Notice>;
  if (sent)
    return (
      <motion.div
        className="success-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <motion.span
          className="success-check"
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 14 }}
        >
          <Check size={44} />
        </motion.span>
        <h2>{t("sent")}</h2>
        <ul className="sent-list">
          {sent.map((s, i) => (
            <motion.li
              key={s.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.05 }}
            >
              <CalendarDays size={15} />
              {slotLabel(locale, s.start)}
            </motion.li>
          ))}
        </ul>
        {(() => {
          const branch = (content.branches || []).find(
            (b) => b.city === bookCity && b.whatsapp,
          );
          if (!branch) return null;
          const text = [
            t("waBooking"),
            `${sentBy?.name || ""} · ${sentBy?.phone || sentBy?.email || ""}`,
            pack ? pack.title : t("customPackage"),
            ...sent.map((s) => "• " + slotLabel(locale, s.start)),
          ].join("\n");
          return (
            <div className="wa-handoff">
              <p>{t("waHandoffText")}</p>
              <a
                className="whatsapp-button"
                href={`https://wa.me/${branch.whatsapp}?text=${encodeURIComponent(text)}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle size={17} />
                {t("waSend")}
              </a>
            </div>
          );
        })()}
        <div className="success-actions">
          <Link className="button" href={"/" + locale + "/account"}>
            {t("account")}
            <ArrowUpRight />
          </Link>
          <Link className="button outline-dark" href={"/" + locale}>
            <ArrowLeft />
            {t("backHome")}
          </Link>
        </div>
      </motion.div>
    );
  return (
    <div className="booking-layout booking-wizard">
      <aside>
        <div className="booking-sticky">
          <p className="eyebrow">
            <span />
            {t("yourOrder")}
          </p>
          <h2>{t("ctaTitle")}</h2>
          <div className="order-summary">
            <div className="order-row">
              <small>{t("package")}</small>
              <strong>{pack ? pack.title : t("customPackage")}</strong>
            </div>
            <div className="order-row">
              <small>{t("lessonsWord")}</small>
              <strong>
                <motion.span
                  key={picked.length + "/" + count}
                  initial={{ y: -8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                >
                  {picked.length}
                </motion.span>{" "}
                / {count}
              </strong>
            </div>
            <div className="order-progress" aria-hidden="true">
              <motion.span
                animate={{
                  width: `${Math.min(100, (picked.length / count) * 100)}%`,
                }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
            <ul className="order-dates">
              <AnimatePresence initial={false}>
                {pickedSlots.map((s) => (
                  <motion.li
                    key={s.id}
                    layout
                    initial={{ opacity: 0, x: -14 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 14 }}
                  >
                    <Clock size={14} />
                    <span>{slotLabel(locale, s.start)}</span>
                    <button
                      type="button"
                      aria-label={t("remove")}
                      onClick={() =>
                        setPicked(picked.filter((id) => id !== s.id))
                      }
                    >
                      <X size={14} />
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            {total !== null && (
              <div className="order-row total">
                <small>
                  {t("priceTotal")}
                  {perLesson &&
                    ` · ${Math.max(1, picked.length || count)} × ${Number(pack!.price)} ₾`}
                </small>
                <motion.strong
                  key={total}
                  initial={{ y: -6, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                >
                  {total.toLocaleString("ru-RU")} ₾
                </motion.strong>
              </div>
            )}
          </div>
          <div className="booking-summary">
            <ShieldCheck size={22} />
            <p>{t("operatorConfirms")}</p>
          </div>
        </div>
      </aside>
      <form
        className="form-card wizard-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          if (!picked.length) {
            setError(t("chooseTime"));
            return;
          }
          setBusy(true);
          const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<
            string,
            any
          >;
          try {
            let me = localUser;
            if (!me) {
              me = await signIn(registerMode, f, locale);
              setLocalUser(me);
            }
            await api("booking/create", {
              city: bookCity,
              program: pack?.program || f.program || "practice",
              gearbox: f.gearbox || pack?.gearbox || "none",
              instructor_id: instructor || null,
              slot_ids: pickedSlots.map((s) => s.id),
              package_id: pack?.id || null,
              name: me!.name,
              contact: me!.phone || me!.email || f.phone,
              note: [
                f.note || "",
                missing > 0 ? `${t("missingNote")}: ${missing}` : "",
              ]
                .filter(Boolean)
                .join("\n")
                .slice(0, 1200),
              consent: true,
              website: f.website || "",
            });
            setSentBy(me);
            setSent(pickedSlots);
          } catch (e) {
            const code = (e as Error).message;
            setError(t(code));
            if (code === "slotUnavailable") {
              const next = await api("slots");
              setSlots(next);
              setPicked((cur) =>
                cur.filter((id) => next.some((s: Item) => s.id === id)),
              );
            }
          } finally {
            setBusy(false);
          }
        }}
      >
        <section className="wizard-step">
          <header>
            <span className="step-index">01</span>
            <h3>{t("choosePackageTitle")}</h3>
          </header>
          {packages.length > 0 && (
            <Packages
              packages={packages}
              locale={locale}
              t={t}
              mode="select"
              selected={pack?.id}
              onSelect={(p) => {
                setPack(p);
                resetPick();
              }}
            />
          )}
          {perLesson && (
            <div className="per-lesson-count">
              <span>{t("howManyLessons")}</span>
              {stepper}
            </div>
          )}
          <div className={"custom-package" + (!pack ? " selected" : "")}>
            <button
              type="button"
              role="radio"
              aria-checked={!pack}
              className="custom-package-label"
              onClick={() => {
                setPack(null);
                resetPick();
              }}
            >
              <span className={"package-radio" + (!pack ? " on" : "")}>
                {!pack && <Check size={16} />}
              </span>
              <span>
                <strong>{t("customPackage")}</strong>
                <small>
                  {t(
                    packages.length ? "customPackageText" : "packagesSoonText",
                  )}
                </small>
              </span>
            </button>
            {!pack && stepper}
          </div>
        </section>

        <section className="wizard-step">
          <header>
            <span className="step-index">02</span>
            <h3>{t("chooseDatesTitle")}</h3>
          </header>
          <div className="form-grid">
            {practiceOnly ? (
              <p className="practice-city">
                <MapPin size={15} />
                {t("practiceAkhalkalaki")}
              </p>
            ) : (
              <Field label={t("city")}>
                <select
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    setInstructor("");
                    resetPick();
                  }}
                >
                  <option value="akhalkalaki">{t("city1")}</option>
                  <option value="ninotsminda">{t("city2")}</option>
                </select>
              </Field>
            )}
            <Field label={t("instructors")}>
              <select
                value={instructor}
                onChange={(e) => {
                  setInstructor(e.target.value);
                  resetPick();
                }}
              >
                <option value="">{t("any")}</option>
                {(content.instructors || [])
                  .filter((i) => i.userId)
                  .map((i) => (
                    <option key={i.id} value={i.userId}>
                      {i.title}
                    </option>
                  ))}
              </select>
            </Field>
            {!pack && (
              <Field label={t("program")}>
                <select name="program" defaultValue="practice">
                  {["practice", "theory", "individual", "group", "exam"].map(
                    (k) => (
                      <option key={k} value={k}>
                        {t(k)}
                      </option>
                    ),
                  )}
                </select>
              </Field>
            )}
            {(!pack || !pack.gearbox || pack.gearbox === "none") && (
              <Field label={t("gearbox")}>
                <select name="gearbox" defaultValue="none">
                  {["none", "manual", "automatic"].map((k) => (
                    <option key={k} value={k}>
                      {t(k)}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
          <div className="mode-switch" role="tablist">
            {(["auto", "manual"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                className={mode === m ? "selected" : ""}
                onClick={() => setMode(m)}
              >
                {mode === m && (
                  <motion.span layoutId="mode-pill" className="mode-pill" />
                )}
                <span>
                  {m === "auto" ? (
                    <Wand2 size={16} />
                  ) : (
                    <CalendarDays size={16} />
                  )}
                  {t(m === "auto" ? "autoPick" : "manualPick")}
                </span>
              </button>
            ))}
          </div>
          {available.length === 0 ? (
            <Notice>{t("noSlots")}</Notice>
          ) : mode === "auto" ? (
            <div className="auto-pick">
              <p>{t("autoPickText")}</p>
              <span className="chip-label">{t("preferredDays")}</span>
              <div className="chips">
                {WEEKDAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={weekdays.includes(d)}
                    className={weekdays.includes(d) ? "on" : ""}
                    onClick={() => setWeekdays(toggle(weekdays, d))}
                  >
                    {weekdayName(locale, d)}
                  </button>
                ))}
              </div>
              <span className="chip-label">{t("preferredTime")}</span>
              <div className="chips">
                {PARTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={parts.includes(p)}
                    className={parts.includes(p) ? "on" : ""}
                    onClick={() => setParts(toggle(parts, p))}
                  >
                    {t(p)}
                  </button>
                ))}
              </div>
              <span className="chip-label">{t("perWeek")}</span>
              <div className="chips">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={perWeek === n}
                    className={perWeek === n ? "on" : ""}
                    onClick={() => setPerWeek(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <motion.button
                type="button"
                className="button auto-button"
                whileTap={{ scale: 0.97 }}
                onClick={runAuto}
              >
                <Sparkles size={18} />
                {t(autoDone ? "autoAgain" : "autoRun")}
              </motion.button>
              <AnimatePresence>
                {autoDone && (
                  <motion.p
                    className={missing > 0 ? "auto-result warn" : "auto-result"}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    role="status"
                  >
                    {missing > 0
                      ? `${t("autoFound")} ${picked.length} / ${count}. ${t("autoMissing")}`
                      : `${t("autoFound")} ${picked.length} / ${count}. ${t("autoEditHint")}`}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <AvailabilityPicker
              key={city + instructor}
              slots={available}
              locale={locale}
              t={t}
              value={picked}
              max={count}
              onChange={(ids) => {
                setPicked(ids);
                setMissing(Math.max(0, count - ids.length));
              }}
            />
          )}
          <small>{t("availabilityRefresh")}</small>
        </section>

        <section className="wizard-step">
          <header>
            <span className="step-index">03</span>
            <h3>{t("contactsTitle")}</h3>
          </header>
          {localUser ? (
            <p className="signed-in">
              <Check size={16} /> {localUser.name} ·{" "}
              {localUser.phone || localUser.email}
            </p>
          ) : (
            <>
              <div className="tabs">
                <button
                  type="button"
                  className={registerMode ? "selected" : ""}
                  onClick={() => setRegisterMode(true)}
                >
                  {t("newStudent")}
                </button>
                <button
                  type="button"
                  className={!registerMode ? "selected" : ""}
                  onClick={() => setRegisterMode(false)}
                >
                  {t("haveAccount")}
                </button>
              </div>
              <p className="hint">
                {t(registerMode ? "accountAutoText" : "loginText")}
              </p>
              <div className="form-grid">
                <AccountFields register={registerMode} t={t} />
              </div>
              {!registerMode && <Forgot t={t} />}
            </>
          )}
          <Field label={t("note")}>
            <textarea name="note" maxLength={1000} rows={3} />
          </Field>
          <div className="honeypot" aria-hidden="true">
            <input name="website" tabIndex={-1} autoComplete="off" />
          </div>
          <label className="checkbox">
            <input type="checkbox" name="consent" required />
            <span>
              {t("consent")} ·{" "}
              <Link href={"/" + locale + "/privacy"}>{t("privacy")}</Link>
            </span>
          </label>
        </section>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button submit-order"
          disabled={busy || !picked.length}
        >
          {t(busy ? "loading" : "send")}
          {picked.length > 0 && (
            <span className="submit-count">{picked.length}</span>
          )}
          <ArrowUpRight size={20} />
        </button>
      </form>
    </div>
  );
}
export function Exam({
  locale,
  t,
  user,
}: { user: Item | null | undefined } & Common) {
  const [attempt, setAttempt] = useState<Item | null>(null),
    [answers, setAnswers] = useState<Record<string, number>>({}),
    [result, setResult] = useState<Item | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [seconds, setSeconds] = useState(1200);
  const submitting = useRef(false);
  async function submit() {
    if (!attempt || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      setResult(await api("exam/submit", { id: attempt.id, answers }));
      setAttempt(null);
    } catch (e) {
      setError(t((e as Error).message));
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }
  useEffect(() => {
    if (!attempt) return;
    const tick = () =>
      setSeconds(
        Math.max(0, Math.ceil((attempt.deadline - Date.now()) / 1000)),
      );
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [attempt]);
  useEffect(() => {
    if (attempt && seconds === 0) void submit();
  }, [seconds]);
  return (
    <div className="exam-layout">
      <Notice>{t("examNotice")}</Notice>
      <a
        className="text-link"
        href="https://www.sa.gov.ge/p/driver-license/theoretical-test"
        target="_blank"
        rel="noreferrer"
      >
        {t("official")}
        <ArrowUpRight size={18} />
      </a>
      {!user ? (
        <Link className="button" href={"/" + locale + "/account"}>
          {t("login")}
          <ArrowRight />
        </Link>
      ) : !attempt && !result ? (
        <button
          className="button"
          disabled={busy}
          onClick={async () => {
            setError("");
            setBusy(true);
            try {
              setAttempt(await api("exam/start", { locale }));
              setAnswers({});
              setSeconds(1200);
            } catch (e) {
              setError(t((e as Error).message));
            } finally {
              setBusy(false);
            }
          }}
        >
          {t(busy ? "loading" : "startExam")}
          <ArrowRight />
        </button>
      ) : null}
      {attempt && (
        <>
          <div className="exam-timer">
            <Clock size={20} />
            {t("timer")}: {Math.floor(seconds / 60)}:
            {String(seconds % 60).padStart(2, "0")}
          </div>
          {attempt.questions.map((q: Item, i: number) => (
            <fieldset className="question-card" key={q.id}>
              <legend>
                {i + 1}. {q.question}
              </legend>
              {q.options.map((option: string, n: number) => (
                <label
                  key={n}
                  className={
                    "answer-option " + (answers[q.id] === n ? "chosen" : "")
                  }
                >
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === n}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: n }))}
                  />
                  {option}
                </label>
              ))}
            </fieldset>
          ))}
          <button className="button" onClick={submit} disabled={busy}>
            {t("submitExam")}
            <Check />
          </button>
        </>
      )}
      {result && (
        <>
          <h2>
            {result.score} / {result.total}
          </h2>
          {result.answers.map((q: Item) => (
            <article className="question-card" key={q.id}>
              <span className={q.selected === q.correct ? "success" : "error"}>
                {t(q.selected === q.correct ? "correct" : "wrong")}
              </span>
              <h3>{q.question}</h3>
              <p>
                {t("correct")}: {q.options[q.correct]}
              </p>
              <p>{q.explanation}</p>
              <a href={q.source} target="_blank" rel="noreferrer">
                {t("source")} ↗
              </a>
            </article>
          ))}
          <button
            className="button outline-dark"
            onClick={() => setResult(null)}
          >
            {t("back")}
          </button>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
