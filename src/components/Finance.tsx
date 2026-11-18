"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { api, Field, Notice } from "./Site";
import { formatPhone } from "../lib/phone";

type T = (k: string) => string;
type Debt = {
  id: string;
  name: string;
  phone?: string;
  pay_method?: string | null;
  charged: number;
  paid: number;
  balance: number;
  overpaid: number;
  percent: number;
};
type Row = Record<string, any>;
/** Amounts travel as tetri (1/100 lari). */
export const gel = (tetri: number) =>
  `${(tetri / 100).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₾`;
const day = (iso?: string) => (iso || "").slice(0, 10);

/**
 * Payments and debts for all staff: who owes how much, partial payments, a ledger per student.
 * There are deliberately no grand totals here; totals live in the administrator report.
 */
export function PaymentsTab({ t }: { t: T }) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [students, setStudents] = useState<Row[]>([]);
  const [onlyDebt, setOnlyDebt] = useState(true);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<{ id: string; name: string } | null>(null);
  const [ledger, setLedger] = useState<{ charges: Row[]; payments: Row[] }>({
    charges: [],
    payments: [],
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      setDebts(await api("finance/debts", {}));
      setStudents(await api("finance/students", {}));
    } catch (e) {
      setError(t((e as Error).message));
    }
  }, [t]);
  const loadLedger = useCallback(
    async (id: string) => {
      try {
        setLedger(await api("finance/ledger", { user_id: id }));
      } catch (e) {
        setError(t((e as Error).message));
      }
    },
    [t],
  );
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (open) loadLedger(open.id);
  }, [open, loadLedger]);

  async function send(path: string, body: Row, ok: string) {
    setError("");
    setNotice("");
    try {
      await api(path, body);
      setNotice(ok);
      await load();
      if (open) await loadLedger(open.id);
      return true;
    } catch (e) {
      setError(t((e as Error).message));
      return false;
    }
  }

  const shown = useMemo(
    () =>
      debts.filter(
        (d) =>
          (!onlyDebt || d.balance > 0) &&
          (!query ||
            (d.name + " " + (d.phone || ""))
              .toLowerCase()
              .includes(query.toLowerCase())),
      ),
    [debts, onlyDebt, query],
  );
  const balanceOf = (id: string) => debts.find((d) => d.id === id);

  return (
    <div className="finance">
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
      <div className="finance-toolbar">
        <input
          type="search"
          placeholder={t("search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t("search")}
        />
        <label className="check-inline">
          <input
            type="checkbox"
            checked={onlyDebt}
            onChange={(e) => setOnlyDebt(e.target.checked)}
          />
          {t("onlyDebts")}
        </label>
        <select
          aria-label={t("openStudent")}
          value=""
          onChange={(e) => {
            const s = students.find((x) => x.id === e.target.value);
            if (s) setOpen({ id: s.id, name: s.name });
          }}
        >
          <option value="">{t("openStudent")}</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} {s.phone ? "· " + formatPhone(s.phone) : ""}
            </option>
          ))}
        </select>
      </div>

      {open && (
        <section className="finance-panel" aria-label={open.name}>
          <header>
            <div>
              <strong>{open.name}</strong>
              {balanceOf(open.id) && (
                <small>
                  {t("paidSum")}: {gel(balanceOf(open.id)!.paid)} ·{" "}
                  {t("balance")}: {gel(balanceOf(open.id)!.balance)}
                </small>
              )}
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label={t("close")}
              onClick={() => setOpen(null)}
            >
              <X size={18} />
            </button>
          </header>
          <div className="finance-forms">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = e.currentTarget;
                const d = Object.fromEntries(new FormData(f));
                if (
                  await send(
                    "finance/pay",
                    {
                      user_id: open.id,
                      amount: d.amount,
                      method: d.method,
                      note: d.note,
                    },
                    t("saved"),
                  )
                )
                  f.reset();
              }}
            >
              <h4>{t("addPayment")}</h4>
              <Field label={t("amountGel")}>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  inputMode="decimal"
                  required
                />
              </Field>
              <Field label={t("method")}>
                <select name="method" defaultValue="cash">
                  <option value="cash">{t("methodCash")}</option>
                  <option value="card">{t("methodCard")}</option>
                  <option value="transfer">{t("methodTransfer")}</option>
                </select>
              </Field>
              <Field label={t("paymentNote")}>
                <input name="note" maxLength={300} />
              </Field>
              <button className="button small">
                <Plus size={16} />
                {t("addPayment")}
              </button>
            </form>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = e.currentTarget;
                const d = Object.fromEntries(new FormData(f));
                if (
                  await send(
                    "finance/charge",
                    { user_id: open.id, title: d.title, amount: d.amount },
                    t("saved"),
                  )
                )
                  f.reset();
              }}
            >
              <h4>{t("addCharge")}</h4>
              <Field label={t("chargeTitle")}>
                <input name="title" minLength={2} maxLength={200} required />
              </Field>
              <Field label={t("amountGel")}>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  inputMode="decimal"
                  required
                />
              </Field>
              <button className="button small outline-dark">
                <Plus size={16} />
                {t("addCharge")}
              </button>
            </form>
          </div>
          <h4>{t("ledger")}</h4>
          <ul className="ledger">
            {(
              [
                ...ledger.charges.map((c) => ({
                  ...c,
                  kind: "charge",
                  at: c.created,
                })),
                ...ledger.payments.map((p) => ({
                  ...p,
                  kind: "payment",
                  at: p.paid_at,
                })),
              ] as Row[]
            )
              .sort((a, b) => String(b.at).localeCompare(String(a.at)))
              .map((r) => (
                <li
                  key={r.kind + r.id}
                  className={r.kind + (Number(r.voided) ? " voided" : "")}
                >
                  <span>{day(r.at)}</span>
                  <span>
                    {r.kind === "charge"
                      ? r.title
                      : `${t("method" + r.method[0].toUpperCase() + r.method.slice(1))}${r.note ? " · " + r.note : ""}`}
                  </span>
                  <b>
                    {r.kind === "charge" ? "+" : "−"}
                    {gel(r.amount)}
                  </b>
                  {Number(r.voided) ? (
                    <small>
                      {t("voided")}: {r.void_reason}
                    </small>
                  ) : (
                    <button
                      type="button"
                      className="link-button"
                      onClick={async () => {
                        const reason = prompt(t("voidReason"));
                        if (reason && reason.trim().length >= 3)
                          await send(
                            "finance/void",
                            { kind: r.kind, id: r.id, reason },
                            t("saved"),
                          );
                      }}
                    >
                      {t("voidEntry")}
                    </button>
                  )}
                </li>
              ))}
          </ul>
        </section>
      )}

      {shown.length ? (
        <div className="debt-list">
          {shown.map((d) => (
            <article key={d.id} className="debt-card">
              <div>
                <strong>{d.name}</strong>
                {d.phone && (
                  <a href={"tel:" + d.phone}>{formatPhone(d.phone)}</a>
                )}
              </div>
              <div
                className="debt-bar"
                role="progressbar"
                aria-valuenow={d.percent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span style={{ width: d.percent + "%" }} />
              </div>
              {d.pay_method && (
                <p className="muted">
                  {t("payHowShort")}:{" "}
                  {t(d.pay_method === "cash" ? "payCash" : "payNoncash")}
                </p>
              )}
              <p>
                {t("paidSum")}: <b>{gel(d.paid)}</b> / {gel(d.charged)} (
                {d.percent}%)
              </p>
              <p className={d.balance ? "debt-left" : "debt-ok"}>
                {d.balance
                  ? `${t("balance")}: ${gel(d.balance)}`
                  : d.overpaid
                    ? `${t("overpaid")}: ${gel(d.overpaid)}`
                    : t("paidInFull")}
              </p>
              <button
                type="button"
                className="button small outline-dark"
                onClick={() => setOpen({ id: d.id, name: d.name })}
              >
                {t("openLedger")}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Notice>{t("noDebts")}</Notice>
      )}
    </div>
  );
}

/** Totals, revenue and student statistics: administrators only (the server enforces it too). */
export function FinanceReport({ t }: { t: T }) {
  const [r, setR] = useState<Row | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api("finance/report", {})
      .then(setR)
      .catch((e) => setError(t((e as Error).message)));
  }, [t]);
  if (error)
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  if (!r) return <Notice>{t("loading")}</Notice>;
  const max = Math.max(1, ...r.monthly.map((m: Row) => m.total));
  return (
    <div className="finance">
      <div className="stat-cards">
        <article>
          <small>{t("charged")}</small>
          <strong>{gel(r.charged)}</strong>
        </article>
        <article>
          <small>{t("paidSum")}</small>
          <strong>{gel(r.paid)}</strong>
        </article>
        <article>
          <small>{t("outstanding")}</small>
          <strong>{gel(r.outstanding)}</strong>
        </article>
      </div>
      <h4>{t("revenueByMonth")}</h4>
      {r.monthly.length ? (
        <ul className="bars">
          {[...r.monthly].reverse().map((m: Row) => (
            <li key={m.month}>
              <span>{m.month}</span>
              <i style={{ width: (m.total / max) * 100 + "%" }} />
              <b>{gel(m.total)}</b>
            </li>
          ))}
        </ul>
      ) : (
        <Notice>{t("noDebts")}</Notice>
      )}
      <h4>{t("byMethod")}</h4>
      <ul className="bars">
        {r.methods.map((m: Row) => (
          <li key={m.method}>
            <span>
              {t("method" + m.method[0].toUpperCase() + m.method.slice(1))}
            </span>
            <b>{gel(m.total)}</b>
          </li>
        ))}
      </ul>
      <h4>
        {t("studentsStats")}: {r.students.total}
      </h4>
      <ul className="bars">
        <li>
          <span>{t("genderM")}</span>
          <b>{r.students.gender.m}</b>
        </li>
        <li>
          <span>{t("genderF")}</span>
          <b>{r.students.gender.f}</b>
        </li>
        {Object.entries(r.students.ages as Record<string, number>).map(
          ([k, v]) => (
            <li key={k}>
              <span>{k === "?" ? t("unknown") : k}</span>
              <b>{v}</b>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
