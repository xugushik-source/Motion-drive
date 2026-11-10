"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  Check,
  Clock,
  Sparkles,
  CarFront,
  BookOpen,
  Route,
  Phone,
} from "lucide-react";
import type { Item } from "./Site";

export const sortPackages = (list: Item[]) =>
  [...list].sort(
    (a, b) =>
      (Number(a.order) || 0) - (Number(b.order) || 0) ||
      (Number(a.lessons) || 0) - (Number(b.lessons) || 0),
  );

export const price = (value: unknown) =>
  value === undefined || value === null || value === ""
    ? null
    : `${Number(value).toLocaleString("ru-RU")} ₾`;
const GROUPS = ["theory", "driving", "exam"] as const;
const groupIcon = { theory: BookOpen, driving: CarFront, exam: Route };
const has = (v: unknown) => v !== undefined && v !== null && v !== "";
/** The headline number of a card: weeks for courses, minutes for single lessons, lessons for sets. */
function headline(p: Item, t: (k: string) => string) {
  if (has(p.weeks)) return [p.weeks, t("weeksWord")];
  if (p.priceType === "perLesson" && has(p.lessonMinutes))
    return [p.lessonMinutes, t("minutes")];
  if (p.group === "exam") return [p.lessons, t("routesWord")];
  return [p.lessons, t("lessonsWord")];
}
export const minutesText = (p: Item, t: (k: string) => string) =>
  has(p.lessonMinutes)
    ? `${p.lessonMinutes}${has(p.lessonMinutesMax) ? "–" + p.lessonMinutesMax : ""} ${t("minutes")}`
    : "";

/**
 * Lesson packages. `showcase` links to booking, `select` turns the cards into a
 * radio group inside the booking form. Without published packages it renders
 * animated placeholders so the layout is ready before the school sends prices.
 */
export default function Packages({
  packages,
  locale,
  t,
  mode = "showcase",
  selected,
  onSelect,
}: {
  packages: Item[];
  locale: string;
  t: (k: string) => string;
  mode?: "showcase" | "select";
  selected?: string;
  onSelect?: (p: Item) => void;
}) {
  const reduce = useReducedMotion();
  const list = sortPackages(packages);
  if (!list.length)
    return (
      <div className="package-grid" aria-label={t("packagesSoon")}>
        {[0, 1, 2].map((i) => (
          <motion.article
            key={i}
            className={
              "package-card package-placeholder" + (i === 1 ? " featured" : "")
            }
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{
              duration: reduce ? 0 : 0.55,
              delay: reduce ? 0 : i * 0.1,
            }}
          >
            {i === 1 && <span className="package-glow" aria-hidden="true" />}
            <div className="package-head">
              <span className="package-count">
                <span
                  className="shimmer-block"
                  style={{ width: 64, height: 56 }}
                />
              </span>
              <CarFront size={28} strokeWidth={1.3} />
            </div>
            <div>
              <p className="eyebrow">
                <span />
                {t("packagesSoon")}
              </p>
              <span className="shimmer-line" style={{ width: "70%" }} />
              <span className="shimmer-line" style={{ width: "90%" }} />
              <span className="shimmer-line" style={{ width: "55%" }} />
            </div>
            <div className="package-foot">
              <span className="shimmer-line" style={{ width: 90, margin: 0 }} />
              <span className="round-link" aria-hidden="true">
                <ArrowUpRight size={20} />
              </span>
            </div>
          </motion.article>
        ))}
        <p className="package-soon-note">{t("packagesSoonText")}</p>
      </div>
    );
  const groups = GROUPS.filter((g) =>
    list.some((p) => (p.group || "driving") === g),
  );
  if (mode === "showcase" && groups.length > 1)
    return (
      <div className="package-groups">
        {groups.map((g) => {
          const Icon = groupIcon[g];
          return (
            <div key={g} className="package-group">
              <h3 className="package-group-title">
                <Icon size={20} strokeWidth={1.5} />
                {t("group_" + g)}
              </h3>
              <Packages
                packages={list.filter((p) => (p.group || "driving") === g)}
                locale={locale}
                t={t}
                mode="showcase"
              />
            </div>
          );
        })}
      </div>
    );
  return (
    <div
      className={"package-grid" + (mode === "select" ? " selectable" : "")}
      role={mode === "select" ? "radiogroup" : undefined}
      aria-label={t("packages")}
    >
      {list.map((p, i) => {
        const [big, bigLabel] = headline(p, t);
        const Icon =
          groupIcon[(p.group || "driving") as keyof typeof groupIcon];
        const isSelected = selected === p.id;
        const body = (
          <>
            {p.featured && <span className="package-glow" aria-hidden="true" />}
            <div className="package-head">
              <span className="package-count">
                <motion.strong
                  initial={{ opacity: 0, scale: 0.6 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{
                    type: "spring",
                    stiffness: 220,
                    damping: 16,
                    delay: reduce ? 0 : 0.15 + i * 0.1,
                  }}
                >
                  {big}
                </motion.strong>
                <small>{bigLabel}</small>
              </span>
              {mode === "select" ? (
                <span className={"package-radio" + (isSelected ? " on" : "")}>
                  {isSelected && <Check size={16} />}
                </span>
              ) : (
                <Icon size={28} strokeWidth={1.3} />
              )}
            </div>
            <div>
              {p.featured && (
                <span className="package-badge">
                  <Sparkles size={13} />
                  {t("popular")}
                </span>
              )}
              <h3>{p.title}</h3>
              {p.description && <p>{p.description}</p>}
              {((bigLabel !== t("minutes") && minutesText(p, t)) ||
                (p.gearbox && p.gearbox !== "none")) && (
                <p className="package-meta">
                  <Clock size={14} />
                  {[
                    // the headline already shows single-lesson minutes
                    bigLabel === t("minutes") ? "" : minutesText(p, t),
                    p.gearbox && p.gearbox !== "none" ? t(p.gearbox) : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {!!p.features?.length && (
                <ul className="package-features">
                  {p.features.map((f: string) => (
                    <li key={f}>
                      <Check size={14} />
                      {f}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="package-foot">
              <span className="package-price">
                {p.oldPrice !== "" && p.oldPrice !== undefined && (
                  <s>{price(p.oldPrice)}</s>
                )}
                <strong className={price(p.price) ? "" : "pending"}>
                  {price(p.price) || t("pricePending")}
                  {price(p.price) && p.priceType === "perLesson" && (
                    <small> / {t("perLessonWord")}</small>
                  )}
                </strong>
              </span>
              {mode === "showcase" ? (
                p.bookable === false ? (
                  <span className="package-phone">
                    <Phone size={14} />
                    {t("byPhone")}
                  </span>
                ) : (
                  <span className="round-link" aria-hidden="true">
                    <ArrowUpRight size={20} />
                  </span>
                )
              ) : (
                <span className="package-choose">
                  {t(isSelected ? "selectedPackage" : "choosePackage")}
                </span>
              )}
            </div>
          </>
        );
        return (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{
              duration: reduce ? 0 : 0.5,
              delay: reduce ? 0 : i * 0.08,
            }}
          >
            {mode === "showcase" ? (
              <Link
                href={
                  p.bookable === false
                    ? `/${locale}/contacts`
                    : `/${locale}/booking?package=${encodeURIComponent(p.id)}`
                }
                className={"package-card" + (p.featured ? " featured" : "")}
              >
                {body}
              </Link>
            ) : (
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => onSelect?.(p)}
                className={
                  "package-card" +
                  (p.featured ? " featured" : "") +
                  (isSelected ? " selected" : "")
                }
              >
                {body}
              </button>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

/** Price list for documents and certificates. */
export function Services({
  services,
  t,
}: {
  services: Item[];
  t: (k: string) => string;
}) {
  const reduce = useReducedMotion();
  if (!services.length) return null;
  return (
    <section className="services">
      <div className="section-head">
        <div>
          <p className="eyebrow">
            <span />
            {t("servicesTag")}
          </p>
          <h2>{t("servicesTitle")}</h2>
        </div>
      </div>
      <ul className="service-list">
        {sortPackages(services).map((s, i) => (
          <motion.li
            key={s.id}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{
              duration: reduce ? 0 : 0.4,
              delay: reduce ? 0 : i * 0.06,
            }}
          >
            <div>
              <strong>{s.title}</strong>
              {s.description && <p>{s.description}</p>}
            </div>
            {s.term && (
              <span className="service-term">
                <Clock size={14} />
                {s.term}
              </span>
            )}
            <span className="service-price">
              {price(s.price) || t("priceOnRequest")}
            </span>
          </motion.li>
        ))}
      </ul>
      <p className="service-note">{t("servicesNote")}</p>
    </section>
  );
}
