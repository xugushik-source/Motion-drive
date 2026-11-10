"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Check, Clock, Sparkles, CarFront } from "lucide-react";
import type { Item } from "./Site";

export const sortPackages = (list: Item[]) =>
  [...list].sort(
    (a, b) =>
      (Number(a.order) || 0) - (Number(b.order) || 0) ||
      (Number(a.lessons) || 0) - (Number(b.lessons) || 0),
  );

const price = (value: unknown) =>
  value === undefined || value === null || value === ""
    ? null
    : `${Number(value).toLocaleString("ru-RU")} ₾`;

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
  return (
    <div
      className={"package-grid" + (mode === "select" ? " selectable" : "")}
      role={mode === "select" ? "radiogroup" : undefined}
      aria-label={t("packages")}
    >
      {list.map((p, i) => {
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
                  {p.lessons}
                </motion.strong>
                <small>{t("lessonsWord")}</small>
              </span>
              {mode === "select" ? (
                <span className={"package-radio" + (isSelected ? " on" : "")}>
                  {isSelected && <Check size={16} />}
                </span>
              ) : (
                <CarFront size={28} strokeWidth={1.3} />
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
              <p className="package-meta">
                <Clock size={14} />
                {p.lessonMinutes || 60} {t("minutes")}
                {p.gearbox && p.gearbox !== "none" && <> · {t(p.gearbox)}</>}
              </p>
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
                </strong>
              </span>
              {mode === "showcase" ? (
                <span className="round-link" aria-hidden="true">
                  <ArrowUpRight size={20} />
                </span>
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
                href={`/${locale}/booking?package=${encodeURIComponent(p.id)}`}
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
