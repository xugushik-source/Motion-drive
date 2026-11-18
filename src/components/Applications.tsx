"use client";
import { useCallback, useEffect, useState } from "react";
import { api, Notice } from "./Site";
import { formatPhone } from "../lib/phone";

type T = (k: string) => string;
type Row = Record<string, any>;

/** Applications sent from the programme cards, newest first, with a status the staff move along. */
export default function Applications({
  t,
  students = [],
  onCreated,
  onOpen,
}: {
  t: T;
  students?: Row[];
  onCreated?: () => Promise<void> | void;
  onOpen?: (phone: string) => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [made, setMade] = useState<{ id: string; password: string } | null>(
    null,
  );
  const load = useCallback(async () => {
    try {
      setRows(await api("applications/list", {}));
    } catch (e) {
      setError(t((e as Error).message));
    }
  }, [t]);
  useEffect(() => {
    load();
  }, [load]);
  if (error)
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  if (!rows) return <Notice>{t("loading")}</Notice>;
  if (!rows.length) return <Notice>{t("noApplications")}</Notice>;
  return (
    <div className="debt-list">
      {rows.map((a) => (
        <article key={a.id} className={"debt-card app-" + a.status}>
          <div>
            <strong>{a.name}</strong>
            <a href={"tel:" + a.phone}>{formatPhone(a.phone)}</a>
          </div>
          <p>
            {t("category" + a.category)} · {t("stage_" + a.course)} ·{" "}
            {t(a.city === "ninotsminda" ? "city2" : "city1")}
          </p>
          {a.note && <p>{a.note}</p>}
          <small>{String(a.created).slice(0, 16).replace("T", " ")}</small>
          {students.some((u) => u.phone === a.phone) ? (
            <button
              type="button"
              className="button small"
              onClick={() => onOpen?.(a.phone)}
            >
              Открыть ученика
            </button>
          ) : (
            <button
              type="button"
              className="button small"
              onClick={async () => {
                setError("");
                try {
                  const r = await api("student/create", {
                    name: a.name,
                    phone: a.phone,
                  });
                  setMade({ id: a.id, password: r.password });
                  await onCreated?.();
                } catch (e) {
                  setError(
                    (e as Error).message === "accountExists"
                      ? "Ученик с таким телефоном уже есть."
                      : "Не получилось создать ученика.",
                  );
                }
              }}
            >
              Создать ученика
            </button>
          )}
          {made?.id === a.id && (
            <div className="temp-password" role="status">
              <small>
                Ученик создан. Вход по его телефону и временному паролю (показан
                один раз). Теперь откройте его в «Ученики», чтобы записать на
                занятия и принять оплату.
              </small>
              <code>{made?.password}</code>
              <button
                type="button"
                className="button small"
                onClick={() => onOpen?.(a.phone)}
              >
                Открыть ученика
              </button>
            </div>
          )}
          <select
            value={a.status}
            aria-label={t("status")}
            onChange={async (e) => {
              try {
                await api("applications/update", {
                  id: a.id,
                  status: e.target.value,
                });
                await load();
              } catch (err) {
                setError(t((err as Error).message));
              }
            }}
          >
            <option value="new">{t("appNew")}</option>
            <option value="contacted">{t("appContacted")}</option>
            <option value="closed">{t("appClosed")}</option>
          </select>
        </article>
      ))}
    </div>
  );
}
