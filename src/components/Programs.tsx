"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  BookOpen,
  CarFront,
  Check,
  ChevronDown,
  Route,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import { api, Field, type Item } from "./Site";

type T = (k: string) => string;
type Cat = "B" | "C";
type Stage = "theory" | "yard" | "city";
const STAGES: Stage[] = ["theory", "yard", "city"];
const stageIcon = { theory: BookOpen, yard: Route, city: CarFront };
/** The school's own photos for the cards that have one; the others get a designed panel. */
const PHOTO: Record<string, string> = {
  "B-yard": "/media/yard-1-poster.jpg",
  "B-city": "/media/street-car.webp",
};
const day = (iso?: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
};

/**
 * "Training programmes": categories B and C, each with Theory / Yard / City cards that unfold into
 * the full programme and lead to an application form. All texts and the price come from the
 * records, so the school edits them in the admin panel; a draft record hides a programme.
 */
export default function Programs({
  programs,
  locale,
  t,
}: {
  programs: Item[];
  locale: string;
  t: T;
}) {
  const reduce = useReducedMotion();
  const cats = (["B", "C"] as Cat[]).filter((c) =>
    programs.some((p) => p.category === c && p.stage !== "official"),
  );
  const [cat, setCat] = useState<Cat>(cats[0] || "B");
  const [openId, setOpenId] = useState<string | null>(null);
  const [apply, setApply] = useState<{ category: Cat; course: Stage } | null>(
    null,
  );
  const active = cats.includes(cat) ? cat : cats[0];
  const cards = useMemo(
    () =>
      STAGES.map((s) =>
        programs.find((p) => p.category === active && p.stage === s),
      ).filter(Boolean) as Item[],
    [programs, active],
  );
  const official = programs.find(
    (p) => p.category === active && p.stage === "official",
  );
  if (!cats.length) return null;
  return (
    <div className="programs-hub">
      <div className="pg-switch" role="tablist" aria-label={t("programTitle")}>
        {cats.map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={active === c}
            className={active === c ? "on" : ""}
            onClick={() => {
              setCat(c);
              setOpenId(null);
            }}
          >
            {c === "B" ? <CarFront size={26} /> : <Truck size={26} />}
            <span>
              <strong>{t("category" + c)}</strong>
              <small>{t("category" + c + "Desc")}</small>
            </span>
          </button>
        ))}
      </div>

      <div className="pg-grid">
        {cards.map((p, i) => {
          const st = p.stage as Stage;
          const Icon = cat === "C" && st !== "theory" ? Truck : stageIcon[st];
          const photo = p.image || PHOTO[`${active}-${st}`];
          const open = openId === p.id;
          const hasPrice = p.price !== undefined && p.price !== "";
          return (
            <motion.article
              key={active + p.id}
              layout={!reduce}
              className={"pg-card" + (open ? " open" : "")}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reduce ? 0 : 0.45,
                delay: reduce ? 0 : i * 0.08,
              }}
            >
              <div className={"pg-media" + (photo ? "" : " plain")}>
                {photo ? (
                  <img src={photo} alt="" loading="lazy" />
                ) : (
                  <Icon size={64} strokeWidth={1} />
                )}
                <span className="pg-num">0{i + 1}</span>
                <span className="pg-chip">{t("stage_" + st)}</span>
              </div>
              <div className="pg-body">
                <h3>{p.title}</h3>
                <p>{p.description}</p>
                <div className="pg-meta">
                  <b className={hasPrice ? "" : "pending"}>
                    {hasPrice ? `${p.price} ₾` : t("askPrice")}
                  </b>
                  {p.duration && <span>{p.duration}</span>}
                </div>
                <button
                  type="button"
                  className="pg-toggle"
                  aria-expanded={open}
                  aria-controls={"pg-more-" + p.id}
                  onClick={() => setOpenId(open ? null : p.id)}
                >
                  {t(open ? "hideProgram" : "showProgram")}
                  <ChevronDown size={18} className={open ? "flip" : ""} />
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      key="more"
                      id={"pg-more-" + p.id}
                      className="pg-more"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: reduce ? 0 : 0.35 }}
                    >
                      <ol className="pg-list">
                        {(p.items || []).map((it: string, k: number) => (
                          <motion.li
                            key={k}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{
                              delay: reduce ? 0 : 0.08 + k * 0.035,
                            }}
                          >
                            {it}
                          </motion.li>
                        ))}
                      </ol>
                      {p.exam && (
                        <p className="pg-exam">
                          <ShieldCheck size={18} />
                          {p.exam}
                        </p>
                      )}
                      <button
                        type="button"
                        className="button"
                        onClick={() =>
                          setApply({ category: active, course: st })
                        }
                      >
                        {t("applyNow")}
                        <ArrowUpRight size={18} />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.article>
          );
        })}
      </div>

      {official && (
        <aside className="pg-official">
          <h3>
            <ShieldCheck size={20} />
            {official.title}
          </h3>
          <ul>
            {(official.items || []).map((it: string, k: number) => (
              <li key={k}>{it}</li>
            ))}
          </ul>
          <small>
            {t("programsSource")}:{" "}
            <a href={official.source} target="_blank" rel="noopener noreferrer">
              sa.gov.ge
            </a>
            {official.verifiedAt && (
              <>
                {" · "}
                {t("programsVerified")} {day(official.verifiedAt)}
              </>
            )}
          </small>
          <small>{t("programsDisclaimer")}</small>
        </aside>
      )}

      <AnimatePresence>
        {apply && (
          <ApplyForm
            key="apply"
            preset={apply}
            cats={cats}
            locale={locale}
            t={t}
            onClose={() => setApply(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ApplyForm({
  preset,
  cats,
  locale,
  t,
  onClose,
}: {
  preset: { category: Cat; course: Stage };
  cats: Cat[];
  locale: string;
  t: T;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<Cat>(preset.category);
  const [course, setCourse] = useState<Stage>(preset.course);
  const [city, setCity] = useState("akhalkalaki");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  // Driving practice runs only from Akhalkalaki; theory is taught in both towns.
  const practice = course !== "theory";
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.documentElement.classList.add("intro-lock");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("intro-lock");
    };
  }, [onClose]);
  return (
    <motion.div
      className="apply-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="apply-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t("applyTitle")}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="icon-button apply-close"
          aria-label={t("close")}
          onClick={onClose}
        >
          <X size={20} />
        </button>
        {sent ? (
          <div className="apply-done" role="status">
            <Check size={40} />
            <h3>{t("applySent")}</h3>
            <button type="button" className="button" onClick={onClose}>
              {t("close")}
            </button>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const d = Object.fromEntries(new FormData(e.currentTarget));
              setBusy(true);
              setError("");
              try {
                await api("applications/create", {
                  category,
                  course,
                  city: practice ? "akhalkalaki" : city,
                  name: d.name,
                  phone: d.phone,
                  note: d.note || "",
                  locale,
                  consent: d.consent === "on",
                  website: d.website || "",
                });
                setSent(true);
              } catch (err) {
                setError(t((err as Error).message));
              } finally {
                setBusy(false);
              }
            }}
          >
            <h3>{t("applyTitle")}</h3>
            <p className="apply-lead">{t("applyLead")}</p>
            <div className="form-grid">
              <Field label={t("applyCategory")}>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Cat)}
                >
                  {cats.map((c) => (
                    <option key={c} value={c}>
                      {t("category" + c)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("applyCourse")}>
                <select
                  value={course}
                  onChange={(e) => setCourse(e.target.value as Stage)}
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {t("stage_" + s)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("applyBranch")}>
                <select
                  value={practice ? "akhalkalaki" : city}
                  disabled={practice}
                  onChange={(e) => setCity(e.target.value)}
                >
                  <option value="akhalkalaki">{t("city1")}</option>
                  <option value="ninotsminda">{t("city2")}</option>
                </select>
              </Field>
              <Field label={t("name")}>
                <input
                  name="name"
                  minLength={2}
                  maxLength={100}
                  required
                  autoComplete="name"
                />
              </Field>
              <Field label={t("phone")}>
                <input
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                />
              </Field>
            </div>
            {practice && <small>{t("practiceAkhalkalaki")}</small>}
            <Field label={t("note")}>
              <textarea name="note" rows={2} maxLength={500} />
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
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="button" disabled={busy}>
              {t("applySend")}
              <ArrowUpRight size={18} />
            </button>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}
