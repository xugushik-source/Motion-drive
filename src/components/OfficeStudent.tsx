"use client";
import { useState } from "react";
import { Copy, UserPlus } from "lucide-react";
import { api, Field } from "./Site";
import { normalizePhone } from "../lib/phone";

const ERR: Record<string, string> = {
  accountExists: "Ученик с таким телефоном уже есть.",
  badPhone: "Неверный номер телефона.",
  badPersonalId:
    "Личный номер: 11 цифр. У иностранца отметьте «иностранный паспорт» и впишите номер паспорта.",
  invalid: "Проверьте данные.",
};

/** The office registers a student who cannot (or does not want to) do it himself. */
export function AddStudent({
  onCreated,
  preset,
}: {
  onCreated: (phone: string) => Promise<void> | void;
  preset?: { name?: string; phone?: string };
}) {
  const [error, setError] = useState("");
  const [done, setDone] = useState<{
    name: string;
    phone: string;
    password: string;
  } | null>(null);
  return (
    <details className="pay-add add-student" open={!!preset}>
      <summary>
        <UserPlus size={15} /> Добавить ученика (если сам не может)
      </summary>
      <form
        className="staff-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = e.currentTarget;
          const d = Object.fromEntries(new FormData(f)) as Record<string, any>;
          setError("");
          // a typo is easy to make: a number that is not Georgian must be confirmed
          const normalized = normalizePhone(String(d.phone));
          if (
            normalized &&
            !normalized.startsWith("+995") &&
            !confirm(
              `Номер ${normalized} не грузинский (не начинается с +995). Он набран верно?`,
            )
          )
            return;
          try {
            const r = await api("student/create", {
              name: d.name,
              phone: d.phone,
              personal_id: d.personal_id || undefined,
              foreign: d.foreign === "on",
              gender: d.gender || undefined,
              birth_year: d.birth_year || undefined,
            });
            setDone({
              name: d.name,
              phone: normalized || d.phone,
              password: r.password,
            });
            f.reset();
            await onCreated(normalized || d.phone);
          } catch (err) {
            const code = (err as Error).message;
            setError(ERR[code] || "Не получилось. Проверьте данные.");
            if (code === "accountExists")
              await onCreated(normalized || d.phone);
          }
        }}
      >
        <div className="form-grid">
          <Field label="Имя и фамилия">
            <input
              name="name"
              minLength={2}
              maxLength={100}
              required
              defaultValue={preset?.name}
            />
          </Field>
          <Field label="Телефон (логин ученика)">
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              required
              defaultValue={preset?.phone}
            />
          </Field>
          <Field label="Личный номер (можно позже)">
            <input
              name="personal_id"
              inputMode="numeric"
              autoComplete="off"
              maxLength={20}
              placeholder="01001012345"
            />
          </Field>
          <Field label="Пол">
            <select name="gender" defaultValue="">
              <option value="">—</option>
              <option value="m">Мужской</option>
              <option value="f">Женский</option>
            </select>
          </Field>
          <Field label="Год рождения">
            <input
              name="birth_year"
              type="number"
              inputMode="numeric"
              min={1930}
              max={new Date().getFullYear()}
              placeholder="2000"
            />
          </Field>
        </div>
        <label className="checkbox foreign-id">
          <input type="checkbox" name="foreign" />
          <span>
            Иностранный паспорт (вместо личного номера впишите номер паспорта)
          </span>
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="button small">Создать ученика</button>
      </form>
      {done && (
        <div className="temp-password" role="status">
          <small>
            Ученик {done.name} создан. Вход по телефону {done.phone} и
            временному паролю (показан один раз). Ученик может войти и сменить
            пароль, а может и не входить: всё можно сделать за него.
          </small>
          <code>{done.password}</code>
          <button
            type="button"
            className="icon-button"
            aria-label="Копировать"
            onClick={() => navigator.clipboard?.writeText(done.password)}
          >
            <Copy size={16} />
          </button>
        </div>
      )}
    </details>
  );
}

/** Personal number of a student who has none yet: the office types it in. */
export function SetPersonalId({
  id,
  onSaved,
}: {
  id: string;
  onSaved: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  if (!open)
    return (
      <p className="muted">
        Личный номер: —{" "}
        <button
          type="button"
          className="link-button"
          onClick={() => setOpen(true)}
        >
          ввести
        </button>
      </p>
    );
  return (
    <form
      className="inline-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<
          string,
          any
        >;
        setError("");
        try {
          await api("student/personal-id-set", {
            id,
            personal_id: d.personal_id,
            foreign: d.foreign === "on",
          });
          setOpen(false);
          await onSaved();
        } catch {
          setError(ERR.badPersonalId!);
        }
      }}
    >
      <input
        name="personal_id"
        inputMode="numeric"
        autoComplete="off"
        maxLength={20}
        placeholder="11 цифр"
        aria-label="Личный номер"
        required
      />
      <label className="checkbox foreign-id">
        <input type="checkbox" name="foreign" />
        <span>иностранный паспорт</span>
      </label>
      <button className="button small">Сохранить</button>
      {error && <small className="error">{error}</small>}
    </form>
  );
}
