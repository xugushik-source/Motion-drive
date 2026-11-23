"use client";
import { useState } from "react";

type Item = Record<string, any>;
type Act = (path: string, body: any) => Promise<any>;

export const SCOPE_NAME: Record<string, string> = {
  akhalkalaki: "Ахалкалаки",
  ninotsminda: "Ниноцминда",
  visiting: "Выездная",
};

/** Named theory groups ("10:00, Ахалкалаки"): the office picks a group by name and puts students in it. */
export default function TheoryGroups({
  groups,
  enrollments,
  users,
  act,
  goStudents,
}: {
  groups: Item[];
  enrollments: Item[];
  users: Item[];
  act: Act;
  goStudents: () => void;
}) {
  const lecturers = users.filter((u) => u.role === "lecturer");
  const students = users.filter((u) => u.role === "student");
  const [adding, setAdding] = useState(false);
  return (
    <section className="groups">
      <div className="section-head">
        <h2>Группы теории</h2>
        <p className="muted">
          У каждой группы есть название, например «10:00, Ахалкалаки, пн/ср/пт».
          Чтобы записать ученика, выберите нужную группу ниже и нажмите
          «Добавить». Ученик в карточке тоже записывается в группу по названию.
        </p>
        <button
          type="button"
          className="button small"
          onClick={() => setAdding(!adding)}
        >
          {adding ? "Закрыть форму" : "Создать группу"}
        </button>
      </div>
      {adding && (
        <GroupForm
          lecturers={lecturers}
          act={act}
          done={() => setAdding(false)}
        />
      )}
      {!groups.length && !adding && (
        <p className="muted">Групп пока нет. Нажмите «Создать группу».</p>
      )}
      {groups.map((g) => (
        <GroupCard
          key={g.id}
          group={g}
          members={enrollments.filter((e) => e.group_id === g.id)}
          students={students}
          enrolledIds={new Set(enrollments.map((e) => e.user_id))}
          lecturers={lecturers}
          users={users}
          act={act}
          goStudents={goStudents}
        />
      ))}
    </section>
  );
}

function GroupForm({
  group,
  lecturers,
  act,
  done,
}: {
  group?: Item;
  lecturers: Item[];
  act: Act;
  done: () => void;
}) {
  return (
    <form
      className="form-card"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget));
        const r = await act("theory/group-set", {
          id: group?.id,
          name: f.name,
          lecturer_id: f.lecturer_id || null,
          scope: f.scope,
          price: f.price === "" ? 150 : f.price,
          starts: f.starts || "",
          note: f.note || "",
          active: group ? group.active !== 0 : true,
        });
        if (r) done();
      }}
    >
      <input
        name="name"
        required
        minLength={2}
        maxLength={80}
        placeholder="Название, например: 10:00, Ахалкалаки, пн/ср/пт"
        aria-label="Название группы"
        defaultValue={group?.name || ""}
      />
      <select
        name="scope"
        defaultValue={group?.scope || "akhalkalaki"}
        aria-label="Филиал"
      >
        {Object.entries(SCOPE_NAME).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <select
        name="lecturer_id"
        defaultValue={group?.lecturer_id || ""}
        aria-label="Лектор"
      >
        <option value="">— лектор не назначен —</option>
        {lecturers.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <input
        name="price"
        type="number"
        step="0.01"
        min="0"
        inputMode="decimal"
        defaultValue={group ? Number(group.price) / 100 : 150}
        aria-label="Стоимость курса, ₾"
      />
      <input
        name="starts"
        placeholder="Начало, например: с 23 ноября"
        aria-label="Начало"
        defaultValue={group?.starts || ""}
      />
      <input
        name="note"
        placeholder="Заметка (необязательно)"
        aria-label="Заметка"
        defaultValue={group?.note || ""}
      />
      <button className="button small">Сохранить группу</button>
    </form>
  );
}

function GroupCard({
  group: g,
  members,
  students,
  enrolledIds,
  lecturers,
  users,
  act,
  goStudents,
}: {
  group: Item;
  members: Item[];
  students: Item[];
  enrolledIds: Set<string>;
  lecturers: Item[];
  users: Item[];
  act: Act;
  goStudents: () => void;
}) {
  const [q, setQ] = useState("");
  const [student, setStudent] = useState("");
  const [edit, setEdit] = useState(false);
  const lecturer = lecturers.find((l) => l.id === g.lecturer_id);
  const free = students
    .filter((u) => !enrolledIds.has(u.id))
    .filter(
      (u) =>
        !q ||
        (u.name + " " + (u.phone || ""))
          .toLowerCase()
          .includes(q.toLowerCase()),
    )
    .slice(0, 40);
  const active = Number(g.active) !== 0;
  return (
    <article className="form-card group-card">
      <header>
        <strong>{g.name}</strong>
        {!active && <span className="status cancelled"> закрыта</span>}
        <p className="muted">
          {SCOPE_NAME[g.scope] || g.scope}
          {lecturer ? " · лектор " + lecturer.name : " · лектор не назначен"}
          {" · "}
          {Number(g.price) / 100} ₾{g.starts ? " · " + g.starts : ""}
          {g.note ? " · " + g.note : ""}
        </p>
        <p>
          <b>В группе: {members.length}</b>
        </p>
      </header>
      {members.length > 0 && (
        <ul className="plain-list">
          {members.map((m) => {
            const u = users.find((x) => x.id === m.user_id);
            return (
              <li key={m.id}>
                {u?.name || "ученик"}
                {u?.phone ? " · " + u.phone : ""}{" "}
                <button
                  type="button"
                  className="link-button"
                  onClick={() =>
                    confirm(
                      "Убрать " +
                        (u?.name || "ученика") +
                        " из группы? Долг за курс снимется.",
                    ) && act("theory/unenroll", { id: m.id })
                  }
                >
                  убрать
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {active && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!student) return;
            const r = await act("theory/enroll", {
              user_id: student,
              scope: g.scope,
              group_id: g.id,
              price: Number(g.price) / 100,
              lecturer_id: g.lecturer_id || null,
            });
            if (r) {
              setStudent("");
              setQ("");
            }
          }}
        >
          <input
            type="search"
            placeholder="Найти ученика по имени или телефону"
            aria-label="Поиск ученика"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            value={student}
            onChange={(e) => setStudent(e.target.value)}
            required
            aria-label="Ученик"
          >
            <option value="">— выберите ученика —</option>
            {free.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.phone ? " · " + u.phone : ""}
              </option>
            ))}
          </select>
          <button className="button small">Добавить в «{g.name}»</button>
          <small className="muted">
            Нет ученика в списке? Он уже записан в другую группу или его ещё
            нет.{" "}
            <button type="button" className="link-button" onClick={goStudents}>
              Добавить в «Ученики»
            </button>
          </small>
        </form>
      )}
      <div className="row-actions">
        <button
          type="button"
          className="button small outline-dark"
          onClick={() => setEdit(!edit)}
        >
          {edit ? "Закрыть" : "Изменить группу"}
        </button>
        <button
          type="button"
          className="button small outline-dark"
          onClick={() =>
            act("theory/group-set", {
              id: g.id,
              name: g.name,
              lecturer_id: g.lecturer_id || null,
              scope: g.scope,
              price: Number(g.price) / 100,
              starts: g.starts || "",
              note: g.note || "",
              active: !active,
            })
          }
        >
          {active ? "Закрыть группу" : "Открыть группу снова"}
        </button>
      </div>
      {edit && (
        <GroupForm
          group={g}
          lecturers={lecturers}
          act={act}
          done={() => setEdit(false)}
        />
      )}
    </article>
  );
}
