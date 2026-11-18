"use client";
import { useState } from "react";
import {
  Copy,
  KeyRound,
  Pencil,
  Plus,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import { api, Field, type Item } from "./Site";
import { formatPhone } from "../lib/phone";

const ROLE: Record<string, string> = {
  admin: "Администратор (полный доступ)",
  manager: "Менеджмент",
  operator: "Оператор",
  instructor: "Инструктор",
  lecturer: "Лектор",
};
const STAFF = Object.keys(ROLE);

/**
 * Accounts of employees. The administrator creates them, sets or resets a password, replaces the
 * person (name and phone), closes access or deletes an account that has no history yet.
 */
export default function Staff({
  users,
  me,
  onChange,
}: {
  users: Item[];
  me: string;
  onChange: () => Promise<void>;
}) {
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );
  const [issued, setIssued] = useState<{ id: string; password: string } | null>(
    null,
  );
  const [editing, setEditing] = useState<string | null>(null);
  const people = users.filter((u) => STAFF.includes(u.role));
  const ERR: Record<string, string> = {
    accountExists: "Этот телефон уже занят другим аккаунтом.",
    hasHistory:
      "У этого человека есть история (занятия, оплаты, записи). Удалить нельзя, закройте доступ.",
    lastAdmin: "Нельзя закрыть доступ последнему администратору.",
    forbidden: "Для этого действия нет прав.",
    invalid: "Проверьте данные.",
    badPhone: "Неверный номер телефона.",
  };
  async function call(
    path: string,
    body: Record<string, any>,
    ok = "Сохранено",
  ) {
    setMsg(null);
    try {
      const r = await api(path, body);
      await onChange();
      setMsg({ kind: "ok", text: ok });
      return r;
    } catch (e) {
      setMsg({
        kind: "err",
        text: ERR[(e as Error).message] || "Не получилось. Попробуйте ещё раз.",
      });
      return null;
    }
  }
  return (
    <div className="finance">
      {msg && (
        <p
          className={msg.kind === "ok" ? "success" : "error"}
          role={msg.kind === "ok" ? "status" : "alert"}
        >
          {msg.text}
        </p>
      )}
      <form
        className="form-card staff-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = e.currentTarget;
          const d = Object.fromEntries(new FormData(f));
          const r = await call("admin/staff", d, "Аккаунт создан");
          if (r) {
            setIssued({ id: r.id, password: r.password });
            f.reset();
          }
        }}
      >
        <h3>Добавить сотрудника</h3>
        <div className="form-grid">
          <Field label="Имя и фамилия">
            <input name="name" minLength={2} maxLength={100} required />
          </Field>
          <Field label="Телефон (это логин)">
            <input name="phone" type="tel" inputMode="tel" required />
          </Field>
          <Field label="Должность">
            <select name="role" defaultValue="operator">
              {STAFF.map((r) => (
                <option key={r} value={r}>
                  {ROLE[r]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <button className="button small">
          <Plus size={16} />
          Создать
        </button>
        {issued && (
          <div className="temp-password" role="status">
            <small>
              Временный пароль (показан один раз). Сотрудник сменит его при
              первом входе:
            </small>
            <code>{issued.password}</code>
            <button
              type="button"
              className="icon-button"
              aria-label="Копировать"
              onClick={() => navigator.clipboard?.writeText(issued.password)}
            >
              <Copy size={16} />
            </button>
          </div>
        )}
      </form>

      <div className="debt-list">
        {people.map((u) => {
          const closed = Number(u.active) === 0;
          const mine = u.id === me;
          return (
            <article
              key={u.id}
              className={"debt-card" + (closed ? " app-closed" : "")}
            >
              <div>
                <strong>{u.name}</strong>
                <small>
                  {ROLE[u.role]}
                  {closed ? " · доступ закрыт" : ""}
                </small>
                {u.phone && (
                  <a href={"tel:" + u.phone}>{formatPhone(u.phone)}</a>
                )}
              </div>
              {editing === u.id && (
                <form
                  className="staff-edit"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const d = Object.fromEntries(new FormData(e.currentTarget));
                    if (
                      await call("admin/staff-update", {
                        id: u.id,
                        name: d.name,
                        phone: d.phone,
                      })
                    )
                      setEditing(null);
                  }}
                >
                  <Field label="Имя и фамилия">
                    <input
                      name="name"
                      defaultValue={u.name}
                      minLength={2}
                      required
                    />
                  </Field>
                  <Field label="Телефон">
                    <input
                      name="phone"
                      defaultValue={u.phone || ""}
                      type="tel"
                      required
                    />
                  </Field>
                  <button className="button small">Сохранить</button>
                </form>
              )}
              <div className="staff-actions">
                <button
                  type="button"
                  className="button small outline-dark"
                  onClick={() => setEditing(editing === u.id ? null : u.id)}
                >
                  <Pencil size={14} /> Заменить человека
                </button>
                {!(u.role === "admin" && !mine) && (
                  <button
                    type="button"
                    className="button small outline-dark"
                    onClick={async () => {
                      const password = prompt(
                        "Новый пароль (минимум 8 символов). Человек сменит его при входе.",
                      );
                      if (password)
                        await call(
                          "admin/set-password",
                          { id: u.id, password },
                          "Пароль задан",
                        );
                    }}
                  >
                    <KeyRound size={14} /> Задать пароль
                  </button>
                )}
                {u.role !== "admin" && (
                  <button
                    type="button"
                    className="button small outline-dark"
                    onClick={async () => {
                      if (
                        !confirm(
                          "Выдать новый временный пароль? Старый перестанет работать.",
                        )
                      )
                        return;
                      const r = await call(
                        "admin/reset-password",
                        { id: u.id },
                        "Временный пароль выдан",
                      );
                      if (r) setIssued({ id: u.id, password: r.password });
                    }}
                  >
                    <KeyRound size={14} /> Сбросить пароль
                  </button>
                )}
                {!mine && (
                  <button
                    type="button"
                    className="button small outline-dark"
                    onClick={() =>
                      confirm(
                        closed
                          ? "Открыть доступ?"
                          : "Закрыть доступ? Человек сразу выйдет из системы.",
                      ) &&
                      call("admin/staff-update", { id: u.id, active: closed })
                    }
                  >
                    {closed ? <UserCheck size={14} /> : <UserX size={14} />}{" "}
                    {closed ? "Открыть доступ" : "Закрыть доступ"}
                  </button>
                )}
                {!mine && u.role !== "admin" && (
                  <button
                    type="button"
                    className="button small outline-dark"
                    onClick={() =>
                      confirm(`Удалить ${u.name}? Это нельзя отменить.`) &&
                      call("admin/delete-user", { id: u.id }, "Удалено")
                    }
                  >
                    <Trash2 size={14} /> Удалить
                  </button>
                )}
              </div>
              {issued && issued.id === u.id && (
                <div className="temp-password" role="status">
                  <small>Временный пароль (показан один раз):</small>
                  <code>{issued.password}</code>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Копировать"
                    onClick={() =>
                      navigator.clipboard?.writeText(issued.password)
                    }
                  >
                    <Copy size={16} />
                  </button>
                </div>
              )}
              {u.role !== "admin" && (
                <label className="staff-role">
                  Должность
                  <select
                    value={u.role}
                    onChange={(e) =>
                      call("admin/role", { id: u.id, role: e.target.value })
                    }
                  >
                    {STAFF.map((r) => (
                      <option key={r} value={r}>
                        {ROLE[r]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
