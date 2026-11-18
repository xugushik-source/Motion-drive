"use client";
import { useCallback, useEffect, useState } from "react";
import { Banknote, Check, CreditCard } from "lucide-react";
import { api, Notice } from "./Site";
import { gel } from "./Finance";

type T = (k: string) => string;

/**
 * The end of the funnel: what is due and how the student will pay (cash or non-cash).
 * Money is taken in the school or by transfer, never on the site; this records the choice so the
 * administrator knows what to expect and what to say.
 */
export default function PayPanel({ t }: { t: T }) {
  const [d, setD] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(
    () =>
      api("mypay/balance", {})
        .then(setD)
        .catch(() => setError(t("serverError"))),
    [t],
  );
  useEffect(() => {
    load();
  }, [load]);
  async function choose(method: "cash" | "noncash") {
    try {
      await api("mypay/method", { method });
      await load();
    } catch {
      setError(t("serverError"));
    }
  }
  if (error)
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  if (!d) return <Notice>{t("loading")}</Notice>;
  const opts: { id: "cash" | "noncash"; icon: any }[] = [
    { id: "cash", icon: Banknote },
    { id: "noncash", icon: CreditCard },
  ];
  return (
    <section className="pay-panel">
      <h3>{t("payHow")}</h3>
      {d.charged > 0 ? (
        <p className="pay-due">
          {d.due > 0 ? (
            <>
              {t("payDue")}: <b>{gel(d.due)}</b>
              {d.paid > 0 && (
                <small>
                  {" "}
                  · {t("paidSum")}: {gel(d.paid)}
                </small>
              )}
            </>
          ) : (
            <b>{t("payClosed")}</b>
          )}
        </p>
      ) : (
        <p className="pay-due">{t("payNoCharge")}</p>
      )}
      <div className="pay-options" role="radiogroup" aria-label={t("payHow")}>
        {opts.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={d.method === id}
            className={"pay-option" + (d.method === id ? " on" : "")}
            onClick={() => choose(id)}
          >
            <Icon size={26} strokeWidth={1.5} />
            <span>
              <strong>{t(id === "cash" ? "payCash" : "payNoncash")}</strong>
              <small>
                {t(id === "cash" ? "payCashText" : "payNoncashText")}
              </small>
            </span>
            {d.method === id && <Check size={20} />}
          </button>
        ))}
      </div>
      {d.method && (
        <p className="pay-next" role="status">
          {t(d.method === "cash" ? "payCashNext" : "payNoncashNext")}
        </p>
      )}
    </section>
  );
}
