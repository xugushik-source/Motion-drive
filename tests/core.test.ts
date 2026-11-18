import test from "node:test";
import assert from "node:assert/strict";
import {
  registerSchema,
  bookingSchema,
  questionSchema,
  anonymize,
} from "../src/lib/schemas.ts";
import { readFileSync } from "node:fs";
import { normalizePhone } from "../src/lib/phone.ts";
import { autoPick, georgiaDay } from "../src/lib/schedule.ts";
import { packageSchema } from "../src/lib/schemas.ts";
test("all four dictionaries have the same nonempty keys", () => {
  const all = ["ru", "en", "ka", "hy"].map((l) =>
    JSON.parse(readFileSync(`messages/${l}.json`, "utf8")),
  );
  for (const d of all) {
    assert.deepEqual(Object.keys(d).sort(), Object.keys(all[0]).sort());
    assert.ok(
      Object.values(d).every((x) => typeof x === "string" && x.length > 0),
    );
  }
});
test("registration uses a phone, cannot set a role and enforces a 6+ password", () => {
  const parsed = registerSchema.parse({
    phone: "597 93 93 27",
    password: "simple",
    name: "Student",
    locale: "ru",
    role: "admin",
    personal_id: "01001012345",
  });
  assert.equal("role" in parsed, false);
  assert.equal(parsed.phone, "+995597939327");
  assert.equal(
    registerSchema.safeParse({ ...parsed, password: "short" }).success,
    false,
  );
  assert.equal(
    registerSchema.safeParse({ ...parsed, phone: "12" }).success,
    false,
  );
});
test("booking requires consent and rejects spam honeypot", () => {
  const b = {
    city: "akhalkalaki",
    program: "theory",
    gearbox: "none",
    name: "Student",
    contact: "test@example.com",
    consent: true,
  };
  assert.ok(bookingSchema.safeParse(b).success);
  assert.equal(
    bookingSchema.safeParse({ ...b, consent: false }).success,
    false,
  );
  assert.equal(
    bookingSchema.safeParse({ ...b, website: "spam" }).success,
    false,
  );
});
test("question bank requires verification, source and a valid answer index", () => {
  const q = {
    question: "Verified training question?",
    options: ["A", "B"],
    correct: 0,
    explanation: "Reviewed explanation",
    topic: "Signs",
    locale: "en",
    source: "https://www.sa.gov.ge/",
    verified: true,
    status: "draft",
    verifiedAt: "2026-11-09",
  };
  assert.ok(questionSchema.safeParse(q).success);
  assert.equal(questionSchema.safeParse({ ...q, correct: 3 }).success, false);
  assert.equal(
    questionSchema.safeParse({ ...q, verified: false }).success,
    false,
  );
});
test("import masks contact identifiers", () => {
  const s = anonymize(
    "Write user@example.com or +995 597 93 93 27 @username https://example.com/profile",
  );
  assert.ok(!s.includes("user@example.com"));
  assert.ok(!s.includes("597"));
  assert.ok(!s.includes("@username"));
  assert.ok(s.includes("[url]"));
});

test("phone numbers in any common spelling map to one account key", () => {
  for (const v of [
    "+995 597 93 93 27",
    "597939327",
    "0597 93-93-27",
    "995597939327",
    "00995597939327",
    "(+995) 597-939-327",
  ])
    assert.equal(normalizePhone(v), "+995597939327", v);
  assert.equal(normalizePhone("+374 91 123456"), "+37491123456");
  for (const v of ["", "abc", "12345", "+12", "59793932a"])
    assert.equal(normalizePhone(v), null, v);
});

// Free slots: Mon 2030-11-04 … in Georgia time (UTC+4), 09:00 and 18:00 daily.
const slots = Array.from({ length: 14 }, (_, d) =>
  [5, 14].map((utcHour) => {
    const start = new Date(Date.UTC(2030, 10, 4 + d, utcHour)).toISOString();
    return {
      id: `${d}-${utcHour}`,
      start,
      end: new Date(Date.parse(start) + 3600000).toISOString(),
    };
  }),
).flat();
test("auto-pick respects weekdays, part of day, one per day and weekly limit", () => {
  const r = autoPick(slots, {
    count: 4,
    weekdays: [0, 2, 4],
    parts: ["evening"],
    perWeek: 2,
  });
  assert.equal(r.missing, 0);
  assert.deepEqual(
    r.picked.map((s) => georgiaDay(s.start)),
    ["2030-11-04", "2030-11-06", "2030-11-11", "2030-11-13"],
  );
  assert.ok(
    r.picked.every((s) => s.id.endsWith("-14")),
    "evening slots only",
  );
});
test("auto-pick keeps the same hour and reports the shortfall", () => {
  const r = autoPick(slots, { count: 20, weekdays: [], parts: [], perWeek: 7 });
  assert.equal(r.picked.length, 14);
  assert.equal(r.missing, 6);
  assert.equal(new Set(r.picked.map((s) => s.id.split("-")[1])).size, 1);
  assert.equal(new Set(r.picked.map((s) => georgiaDay(s.start))).size, 14);
});
test("package prices stay empty instead of becoming 0 GEL", () => {
  const p = packageSchema.parse({
    title: "Practice 10",
    lessons: "10",
    lessonMinutes: "",
    price: "",
    oldPrice: undefined,
    order: "",
    locale: "ru",
    status: "published",
  });
  assert.equal(p.price, "");
  assert.equal(p.oldPrice, "");
  assert.equal(p.lessons, 10);
  assert.equal(p.lessonMinutes, "", "no invented lesson length");
  assert.equal(packageSchema.parse({ ...p, price: "450" }).price, 450);
  assert.equal(packageSchema.safeParse({ ...p, lessons: 0 }).success, false);
});

test("the published price list is valid and identical in every language", async () => {
  const { publicRecords } = await import("../src/lib/public-content.ts");
  const { serviceSchema } = await import("../src/lib/schemas.ts");
  const byLocale = (kind: string) => {
    const map: Record<string, string> = {};
    for (const r of publicRecords[kind]) {
      const parsed =
        kind === "packages" ? packageSchema.parse(r) : serviceSchema.parse(r);
      const key = r.id.replace(/-(ru|en|ka|hy)$/, "");
      const facts = JSON.stringify([
        parsed.price,
        "lessons" in parsed
          ? [parsed.lessons, parsed.weeks, parsed.priceType]
          : 0,
      ]);
      map[r.locale + ":" + key] = facts;
    }
    for (const k of Object.keys(map)) {
      const base = map["ru:" + k.split(":")[1]];
      assert.equal(map[k], base, k + " differs from ru");
    }
    return Object.keys(map).length;
  };
  assert.equal(byLocale("packages"), 44);
  assert.equal(byLocale("services"), 12);
  const price = (id: string) =>
    publicRecords.packages.find((p) => p.id === id)!.price;
  assert.equal(price("city-automatic-ru"), 60);
  assert.equal(price("city-manual-ru"), 80);
  assert.equal(price("yard-ru"), 40);
  assert.equal(price("theory-group-ru"), 150);
  assert.equal(price("individual-auto-ru"), 80);
  assert.equal(price("individual-manual-ru"), 90);
  assert.equal(price("individual-yard-ru"), 60);
  assert.equal(price("individual-yard2-ru"), 100);
});

test("group starts repeat every 15 days from the school's first date", async () => {
  const { nextStarts } = await import("../src/lib/schedule.ts");
  const g = { startDate: "2026-11-23", cycleDays: 15 };
  const day = (d: Date) => d.toISOString().slice(0, 10);
  assert.deepEqual(
    nextStarts(g, 3, new Date("2026-11-10T12:00:00Z")).map(day),
    ["2026-11-23", "2026-12-08", "2026-12-23"],
  );
  // 19:59 UTC is 23:59 in Georgia (still the start day); 20:00 UTC is already the next day there
  assert.equal(
    day(nextStarts(g, 1, new Date("2026-12-08T19:59:00Z"))[0]),
    "2026-12-08",
  );
  assert.equal(
    day(nextStarts(g, 1, new Date("2026-12-08T20:00:00Z"))[0]),
    "2026-12-23",
  );
  assert.deepEqual(nextStarts({ startDate: "" }), []);
});

test("the chatbot finds inflected questions in all four languages", async () => {
  const { findKnowledge } = await import("../src/lib/knowledge.ts");
  const { publicRecords } = await import("../src/lib/public-content.ts");
  const ask = (q: string, l: string) =>
    findKnowledge(
      q,
      publicRecords.faq.filter((f) => f.locale === l),
    )?.id;
  assert.equal(ask("С какого возраста можно учиться?", "ru"), "faq-ru-5");
  assert.equal(ask("Как оплатить занятия?", "ru"), "faq-ru-6");
  assert.equal(ask("Когда начинается новая группа?", "ru"), "faq-ru-7");
  assert.equal(ask("რა ასაკიდან შეიძლება?", "ka"), "faq-ka-5");
  assert.equal(ask("Քանի՞ տարեկանից կարելի է", "hy"), "faq-hy-5");
  assert.equal(ask("What is the minimum age?", "en"), "faq-en-5");
  assert.equal(ask("Сколько стоит обучение?", "ru"), "faq-ru-4");
  // short words never match as stems
  assert.equal(ask("абв", "ru"), undefined);
});

test("the chatbot understands Armenian typed in Latin letters, as clients write it", async () => {
  const { findKnowledge, detectLanguage } =
    await import("../src/lib/knowledge.ts");
  const { publicRecords } = await import("../src/lib/public-content.ts");
  const answer = (message: string, page: "ru" | "en" = "ru") => {
    const lang = detectLanguage(message, page);
    return findKnowledge(
      message,
      publicRecords.faq.filter((f) => f.locale === lang),
    )?.id;
  };
  // real client phrases from the school's Instagram chats
  assert.equal(answer("Barev dzez arjeqy inchqan e?"), "faq-hy-4");
  assert.equal(answer("Sorvesnel qani amis e / U qani lari e"), "faq-hy-4");
  assert.equal(answer("Dex ka krancvelu"), "faq-hy-3");
  assert.equal(answer("Amsi 9 arden ksksvi?"), "faq-hy-7");
  assert.equal(answer("Ploshadka arje inchqan"), "faq-hy-4");
  assert.equal(answer("Inch qnnutyun uni"), "faq-hy-11");
  // the language is recognised, ordinary text is not hijacked
  assert.equal(detectLanguage("Barev dzez", "ru"), "hy");
  assert.equal(detectLanguage("How much is 50 lari?", "en"), "en");
  assert.equal(detectLanguage("Сколько стоит", "en"), "ru");
  assert.equal(detectLanguage("Barev, kuzem grancvel", "en"), "hy");
});

test("answers from the school: documents, missed lessons, seats, exams, new address", async () => {
  const { findKnowledge } = await import("../src/lib/knowledge.ts");
  const { publicRecords } = await import("../src/lib/public-content.ts");
  const ask = (q: string) =>
    findKnowledge(
      q,
      publicRecords.faq.filter((f) => f.locale === "ru"),
    );
  assert.equal(ask("Что, если я пропущу занятие?")?.id, "faq-ru-8");
  assert.equal(ask("Сколько занятий на площадке нужно?")?.id, "faq-ru-9");
  assert.equal(ask("Есть ли свободные места?")?.id, "faq-ru-10");
  assert.equal(ask("Где сдают экзамены?")?.id, "faq-ru-11");
  assert.match(ask("Какие нужны документы?")!.answer, /фото/);
  const nin = publicRecords.branches.filter((b) => b.city === "ninotsminda");
  assert.equal(nin.length, 4);
  for (const b of nin) {
    assert.ok(!/19|Свобод|Freedom|თავისუფლ|Ազատ/.test(b.address), b.address);
    assert.equal(b.coords, "41.2625579,43.5899200");
  }
  const all = JSON.stringify(publicRecords);
  assert.ok(!/Свободы, 19|19 Freedom/.test(all), "old address left somewhere");
});

test("the database address is found under any integration prefix", async () => {
  const { pickDatabaseUrl } = await import("../src/lib/deployment.ts");
  assert.equal(
    pickDatabaseUrl({ DATABASE_URL: "postgres://a" }),
    "postgres://a",
  );
  assert.equal(
    pickDatabaseUrl({ POSTGRES_URL: "postgres://b" }),
    "postgres://b",
  );
  assert.equal(
    pickDatabaseUrl({
      STORAGE_DATABASE_URL_UNPOOLED: "postgres://direct",
      STORAGE_DATABASE_URL: "postgres://pooled",
    }),
    "postgres://pooled",
  );
  assert.equal(
    pickDatabaseUrl({ NEON_POSTGRES_URL: "postgres://c" }),
    "postgres://c",
  );
  assert.equal(
    pickDatabaseUrl({ STORAGE_DATABASE_URL_UNPOOLED: "postgres://x" }),
    "",
  );
  assert.equal(pickDatabaseUrl({ BLOB_READ_WRITE_TOKEN: "t" }), "");
});

test("roles: managers see everything staff see, but never finance", async () => {
  const { isStaff, canSeeFinance, canManageRoles, ROLES } =
    await import("../src/lib/roles.ts");
  assert.ok(ROLES.includes("manager"));
  for (const r of ["admin", "manager", "operator"]) assert.ok(isStaff(r), r);
  for (const r of ["student", "instructor", undefined, null, ""])
    assert.ok(!isStaff(r as string), String(r));
  assert.ok(canSeeFinance("admin"));
  assert.ok(!canSeeFinance("manager") && !canSeeFinance("operator"));
  assert.ok(canManageRoles("admin") && !canManageRoles("manager"));
});

test("theory timetable: one lecturer, 10:00–22:00, 75+15 blocks", async () => {
  const t = await import("../src/lib/theory.ts");
  assert.deepEqual(
    t
      .blockStarts()
      .map((m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`),
    ["10:00", "11:30", "13:00", "14:30", "16:00", "17:30", "19:00", "20:30"],
  );
  const plan = t.dayPlan();
  assert.equal(plan.length, 8);
  assert.equal(plan.at(-1)!.start, "20:30");
  assert.ok(plan.at(-1)!.end <= "22:00");
  assert.ok(t.breaksOk(plan));
  // closed 13:00–15:00 break keeps only 13:00/14:30 out
  assert.deepEqual(
    t.dayPlan({ openMidday: false }).map((b) => b.start),
    ["10:00", "11:30", "16:00", "17:30", "19:00", "20:30"],
  );
  assert.deepEqual(
    plan.filter((b) => b.kind === "individual").map((b) => b.start),
    ["13:00", "14:30", "20:30"],
  );
  // the lecturer alternates cities, never two cities on one day, Sunday is free
  assert.equal(t.cityOnWeekday(1), "akhalkalaki");
  assert.equal(t.cityOnWeekday(2), "ninotsminda");
  assert.equal(t.cityOnWeekday(0), null);
  for (let d = 1; d <= 6; d++) assert.ok(t.cityOnWeekday(d));
  assert.deepEqual(
    [t.GROUP_CAPACITY.akhalkalaki, t.GROUP_CAPACITY.ninotsminda],
    [23, 35],
  );
  // supply follows the demand split: 3 of 5 group times are evenings = 60%
  const load = t.weeklyLoad();
  assert.equal(load.groupBlocksPerDay, 5);
  assert.equal(load.eveningShare, 0.6);
  assert.equal(load.hoursPerDay, 5 * 1.25 + 3);
  assert.equal(load.hoursPerWeek, load.hoursPerDay * 6);
});

test("roles: staff edit photos and content, never prices, roles or reports", async () => {
  const r = await import("../src/lib/roles.ts");
  for (const role of ["operator", "manager"]) {
    assert.ok(r.canEditKind(role, "media"));
    assert.ok(r.canEditKind(role, "instructors"));
    assert.ok(!r.canEditKind(role, "packages"));
    assert.ok(!r.canEditKind(role, "services"));
    assert.ok(!r.canEditKind(role, "settings"));
    assert.ok(r.canRecordPayments(role));
    assert.ok(!r.canSeeFinance(role));
    assert.ok(!r.canManageRoles(role));
  }
  assert.ok(r.canEditKind("admin", "packages") && r.canSeeFinance("admin"));
  assert.ok(
    !r.canEditKind("student", "media") && !r.canRecordPayments("instructor"),
  );
  assert.ok(
    r.isTeacher("instructor") &&
      r.isTeacher("lecturer") &&
      !r.isTeacher("operator"),
  );
  assert.ok(
    !r.isStaff("lecturer"),
    "a lecturer is a teacher, not office staff",
  );
});

test("training programmes: B and C, three courses each, same content in all four languages", async () => {
  const { publicRecords } = await import("../src/lib/public-content.ts");
  const all = publicRecords.programs!;
  const key = (p: any) => `${p.category}-${p.stage}`;
  const langs = ["ru", "en", "ka", "hy"];
  for (const cat of ["B", "C"])
    for (const stage of ["theory", "yard", "city", "official"]) {
      const group = all.filter((p) => key(p) === `${cat}-${stage}`);
      assert.deepEqual(
        group.map((p) => p.locale).sort(),
        [...langs].sort(),
        `${cat}-${stage}`,
      );
      const counts = new Set(group.map((p) => p.items.length));
      assert.equal(
        counts.size,
        1,
        `${cat}-${stage} item counts differ between languages`,
      );
      for (const p of group) {
        assert.ok(p.items.every((x: string) => x.trim().length > 2));
        assert.ok(p.title.trim() && p.status === "published");
        // no invented prices or durations: the school fills them in
        assert.equal(p.price, "");
        assert.equal(p.duration, "");
      }
    }
  const items = (c: string, s: string) =>
    all.find((p) => p.category === c && p.stage === s && p.locale === "ru")!
      .items.length;
  assert.deepEqual(
    [items("B", "theory"), items("B", "yard"), items("B", "city")],
    [10, 10, 10],
  );
  assert.deepEqual(
    [items("C", "theory"), items("C", "yard"), items("C", "city")],
    [10, 9, 10],
  );
  // official exam figures (sa.gov.ge, checked 2026-11-18) in every language
  for (const l of langs) {
    const exam = (c: string) =>
      all.find(
        (p) => p.category === c && p.stage === "theory" && p.locale === l,
      )!.exam;
    assert.ok(exam("B").includes("30") && exam("B").includes("25"), l);
    assert.ok(exam("C").includes("40") && exam("C").includes("36"), l);
    for (const c of ["B", "C"]) {
      const o = all.find(
        (p) => p.category === c && p.stage === "official" && p.locale === l,
      )!;
      assert.match(o.source, /^https:\/\/www\.sa\.gov\.ge\//);
      assert.equal(o.verifiedAt, "2026-11-18");
    }
  }
});

test("group start dates are formatted from a fixed table, identical on server and browser", async () => {
  const { formatDayMonth } = await import("../src/lib/schedule.ts");
  const d = new Date(Date.UTC(2026, 10, 23));
  assert.equal(formatDayMonth(d, "ru"), "23 ноября");
  assert.equal(formatDayMonth(d, "en"), "November 23");
  assert.equal(formatDayMonth(d, "ka"), "23 ნოემბერი");
  assert.equal(formatDayMonth(d, "hy"), "23 նոյեմբերի");
});

test("people and photos are one record each, with names in every language inside it", async () => {
  const { publicRecords } = await import("../src/lib/public-content.ts");
  const { pick, pickText } = await import("../src/lib/pick.ts");
  const people = publicRecords.instructors!;
  assert.equal(people.length, 4);
  assert.equal(new Set(people.map((p) => p.id)).size, 4);
  for (const p of people) {
    assert.ok(!p.locale, "a person is not tied to one language");
    for (const l of ["ru", "en", "ka", "hy"])
      assert.ok(pick(p, "title", l).trim(), `${p.id} ${l}`);
    assert.notEqual(pick(p, "title", "ka"), pick(p, "title", "ru"));
  }
  assert.deepEqual(
    people.filter((p) => p.role === "lecturer").map((p) => p.id),
    ["lecturer-levon"],
  );
  const media = publicRecords.media!;
  assert.equal(media.length, 10);
  for (const m of media) assert.ok(!m.locale && pick(m, "title", "hy"));
  // fallbacks: a missing translation shows the Russian name, free text only in the language written
  assert.equal(pick({ title: "Иван" }, "title", "en"), "Иван");
  assert.equal(pickText({ description: "Текст" }, "description", "en"), "");
  assert.equal(
    pickText({ description: "Текст" }, "description", "ru"),
    "Текст",
  );
});

test("payroll: Georgian month ranges and KPI-style pay (salary, bonus, percent, per lesson, premium)", async () => {
  const { dayRange, monthRange, currentMonth, previousMonth, computePay } =
    await import("../src/lib/payroll.ts");
  const [d0, d1] = dayRange(new Date("2026-11-18T22:30:00Z"));
  assert.equal(d0, "2026-11-18T20:00:00.000Z");
  assert.equal(d1, "2026-11-19T20:00:00.000Z");
  const [m0, m1] = monthRange("2026-11", new Date("2026-11-18T10:00:00Z"));
  assert.equal(m0, "2026-10-31T20:00:00.000Z");
  assert.equal(m1, "2026-11-30T20:00:00.000Z");
  assert.equal(currentMonth(new Date("2026-12-31T21:00:00Z")), "2027-01");
  assert.equal(previousMonth("2027-01"), "2026-12");
  assert.equal(previousMonth("2026-11"), "2026-10");
  const items: any[] = [
    { kind: "salary", amount: 100000, from_month: "2026-01" },
    { kind: "bonus", amount: 5000, from_month: "2026-11" },
    {
      kind: "percent",
      percent: 10,
      from_month: "2026-11",
      to_month: "2026-12",
    },
    { kind: "per_lesson", amount: 2000, from_month: "2026-11" },
    {
      kind: "premium",
      amount: 30000,
      from_month: "2026-11",
      to_month: "2026-11",
    },
    { kind: "bonus", amount: 99999, from_month: "2026-11", voided: 1 },
  ];
  const nov = computePay(items, "2026-11", 12);
  assert.deepEqual(
    [nov.salary, nov.bonus, nov.percent, nov.perLesson, nov.premium, nov.total],
    [100000, 5000, 10000, 24000, 30000, 169000],
  );
  // December: the premium was one-time, the percent still runs; October: only the salary
  const dec = computePay(items, "2026-12", 0);
  assert.deepEqual(
    [dec.premium, dec.percent, dec.perLesson, dec.total],
    [0, 10000, 0, 115000],
  );
  assert.equal(computePay(items, "2026-10", 5).total, 100000);
  // a percent with no salary pays nothing; nothing set means zero
  assert.equal(
    computePay(
      [{ kind: "percent", percent: 50, from_month: "2026-01" }],
      "2026-11",
    ).total,
    0,
  );
  assert.equal(computePay([], "2026-11", 5).total, 0);
});

test("staff accounts can be seeded from a private setting, invalid entries are skipped", async () => {
  const { parseSeedStaff } = await import("../src/lib/seed-staff.ts");
  const list = parseSeedStaff(
    JSON.stringify([
      { name: "Имя Фамилия", phone: "+995 568 00 00 00", role: "admin" },
      { name: "X", phone: "+995591000000", role: "admin" },
      { name: "Без Роли", phone: "+995591000001", role: "root" },
      { name: "Плохой Телефон", phone: "123", role: "operator" },
    ]),
  );
  assert.deepEqual(list, [
    { name: "Имя Фамилия", phone: "+995568000000", role: "admin" },
  ]);
  assert.deepEqual(parseSeedStaff("not json"), []);
  assert.deepEqual(parseSeedStaff(undefined), []);
});

test("payouts: a debt stays until the employee confirms the money, a surplus is an advance used later", async () => {
  const { accrualSince, balanceOf, nextMonth } =
    await import("../src/lib/payroll.ts");
  assert.equal(nextMonth("2026-12"), "2027-01");
  assert.equal(nextMonth("2026-03"), "2026-04");
  const items: any[] = [
    { kind: "salary", amount: 100000, from_month: "2026-09" },
  ];
  const nov = accrualSince(items, "2026-11");
  assert.equal(nov.accrued, 300000);
  assert.deepEqual(
    nov.months.map((m) => m.month),
    ["2026-09", "2026-10", "2026-11"],
  );
  assert.deepEqual(balanceOf(nov.accrued, 100000), {
    balance: 200000,
    debt: 200000,
    advance: 0,
    closed: false,
  });
  const closed = balanceOf(nov.accrued, 300000);
  assert.deepEqual([closed.debt, closed.advance, closed.closed], [0, 0, true]);
  // paid ahead: 3500 against 3000 earned is an advance of 500 …
  const ahead = balanceOf(nov.accrued, 350000);
  assert.deepEqual([ahead.debt, ahead.advance], [0, 50000]);
  // … and December's pay uses it up, leaving 500 owed
  const dec = accrualSince(items, "2026-12");
  assert.deepEqual(
    [
      balanceOf(dec.accrued, 350000).debt,
      balanceOf(dec.accrued, 350000).advance,
    ],
    [50000, 0],
  );
  // lessons per month feed the per-lesson item; voided items and nothing-set pay nothing
  const kpi = accrualSince(
    [
      { kind: "per_lesson", amount: 2000, from_month: "2026-11" },
      { kind: "bonus", amount: 999, from_month: "2026-11", voided: 1 },
    ] as any[],
    "2026-11",
    { "2026-11": 7 },
  );
  assert.equal(kpi.accrued, 14000);
  assert.equal(accrualSince([], "2026-11").accrued, 0);
});

test("personal number: 11 digits for Georgian citizens, a passport number only when marked foreign", async () => {
  const base = {
    phone: "597 93 93 27",
    password: "simple",
    name: "Student",
    locale: "ru",
  };
  const ok = (extra: object) =>
    registerSchema.safeParse({ ...base, ...extra }).success;
  assert.ok(ok({ personal_id: "01001012345" }));
  assert.ok(!ok({ personal_id: "0100101234" }), "10 digits");
  assert.ok(!ok({ personal_id: "010010123456" }), "12 digits");
  assert.ok(!ok({ personal_id: "0100101234A" }), "letters for a citizen");
  assert.ok(!ok({}), "required");
  assert.ok(
    ok({ personal_id: "AB1234567", foreign: "on" }),
    "foreign passport",
  );
  assert.ok(!ok({ personal_id: "12", foreign: "on" }), "too short");
  assert.ok(
    !ok({ personal_id: "AB 123 45", foreign: true }),
    "no spaces or symbols",
  );
});

test("auto plan: one instructor, the same hour, more lessons on the same days when a week is short, whatever exists when there is little room", async () => {
  const { autoPlan, georgiaHour, georgiaDay } =
    await import("../src/lib/schedule.ts");
  const mk = (id: string, day: number, hourUtc: number, ins: string) => ({
    id,
    start: `2026-12-${String(day).padStart(2, "0")}T${String(hourUtc).padStart(2, "0")}:00:00.000Z`,
    end: `2026-12-${String(day).padStart(2, "0")}T${String(hourUtc + 1).padStart(2, "0")}:00:00.000Z`,
    instructor_id: ins,
  });
  // Mon 7 Dec … Sat 12 Dec 2026; instructor A has 10:00, 11:00, 12:00 (local) every day, B only two slots
  const slots: any[] = [];
  for (let d = 7; d <= 12; d++)
    for (const h of [6, 7, 8]) slots.push(mk(`a${d}-${h}`, d, h, "A"));
  slots.push(mk("b7-6", 7, 6, "B"), mk("b8-6", 8, 6, "B"));
  const week = autoPlan(slots, {
    count: 10,
    weekdays: [],
    parts: [],
    weeks: 1,
  });
  assert.equal(week.picked.length, 10);
  assert.equal(week.missing, 0);
  assert.equal(
    week.instructor_id,
    "A",
    "the instructor who can take most lessons",
  );
  assert.ok(
    week.picked.every((s) => s.instructor_id === "A"),
    "one instructor for the whole series",
  );
  assert.ok(
    week.picked.every((s) => georgiaDay(s.start) <= "2026-12-12"),
    "all inside the week",
  );
  const at10 = week.picked.filter((s) => georgiaHour(s.start) === 10).length;
  assert.equal(at10, 6, "one lesson per day at the usual 10:00 first");
  assert.equal(
    week.picked.filter((s) => georgiaHour(s.start) === 11).length,
    4,
    "the rest right after, on the same days",
  );
  // a chosen instructor is respected
  const b = autoPlan(slots, {
    count: 5,
    weekdays: [],
    parts: [],
    weeks: 1,
    instructor: "B",
  });
  assert.equal(b.picked.length, 2);
  assert.equal(b.missing, 3, "takes what exists and reports the shortfall");
  // preferences narrow the choice; nothing free gives an empty proposal
  const evening = autoPlan(slots, {
    count: 3,
    weekdays: [],
    parts: ["evening"],
    weeks: 1,
  });
  assert.deepEqual([evening.picked.length, evening.missing], [0, 3]);
  assert.deepEqual(
    autoPlan([], { count: 4, weekdays: [], parts: [], weeks: 2 }).picked,
    [],
  );
  // not enough room inside the window: continues after it rather than giving up
  const longer = autoPlan(slots, {
    count: 18,
    weekdays: [],
    parts: [],
    weeks: 1,
  });
  assert.equal(longer.picked.length, 18);
});

test("the school's rates: instructor 15/20 per yard/city lesson; lecturer per student by group, 50% for individual", async () => {
  const { computePay, DEFAULT_RATES, lessonKindOf } =
    await import("../src/lib/payroll.ts");
  const items = (role: string) =>
    DEFAULT_RATES[role]!.map((r) => ({ ...r, from_month: "2026-11" })) as any[];
  // instructor: 10 yard lessons and 20 city lessons
  const ins = computePay(items("instructor"), "2026-11", {
    lessons: { all: 30, yard: 10, city: 20 },
  });
  assert.equal(ins.perLesson, 10 * 1500 + 20 * 2000);
  assert.equal(ins.total, 55000, "550 ₾");
  // lecturer: Akhalkalaki 12 × 50, Ninotsminda 8 × 60, visiting 5 × 60, individual/mini-groups 50% of 3 × 300
  const lec = computePay(items("lecturer"), "2026-11", {
    students: {
      akhalkalaki: { n: 12, price: 12 * 15000 },
      ninotsminda: { n: 8, price: 8 * 15000 },
      visiting: { n: 5, price: 5 * 15000 },
      individual: { n: 3, price: 3 * 30000 },
    },
  });
  assert.equal(lec.perStudent, 12 * 5000 + 8 * 6000 + 5 * 6000 + 45000);
  assert.equal(lec.total, 183000, "1830 ₾");
  // no counts, no pay; an older call with a plain number still works for "all lessons"
  assert.equal(computePay(items("instructor"), "2026-11", {}).total, 0);
  assert.equal(
    computePay(
      [{ kind: "per_lesson", amount: 2000, from_month: "2026-11" }] as any,
      "2026-11",
      4,
    ).total,
    8000,
  );
  // what kind of lesson a booking is
  assert.equal(lessonKindOf("yard-ru"), "yard");
  assert.equal(lessonKindOf("individual-yard2-ru"), "yard");
  assert.equal(lessonKindOf("city-manual-ru"), "city");
  assert.equal(lessonKindOf("individual-auto-ru"), "city");
  assert.equal(lessonKindOf("exam-automatic-ru"), "exam");
  assert.equal(lessonKindOf("theory-individual-ru"), "theory");
  assert.equal(lessonKindOf(null, "practice"), "city");
});

test("driving hours follow the daylight in Akhalkalaki", async () => {
  const { sunsetUtc, daylightLessons, AKHALKALAKI } =
    await import("../src/lib/sun.ts");
  const local = (d: Date) =>
    ((d.getUTCHours() + 4) % 24) + d.getUTCMinutes() / 60;
  const nov = sunsetUtc(2026, 11, 18, AKHALKALAKI.lat, AKHALKALAKI.lon)!;
  assert.ok(
    local(nov) > 17.4 && local(nov) < 18.1,
    "mid-November sunset about 17:45: " + local(nov),
  );
  const jun = sunsetUtc(2026, 6, 21, AKHALKALAKI.lat, AKHALKALAKI.lon)!;
  assert.ok(
    local(jun) > 19.8 && local(jun) < 21.2,
    "midsummer sunset after 20:00: " + local(jun),
  );
  const all = daylightLessons(2026, 11, 18);
  const winter = all.filter((l) => l.kind === "any");
  const summer = daylightLessons(2026, 6, 21).filter((l) => l.kind === "any");
  assert.equal(all[0]!.start, "2026-11-18T05:00:00.000Z", "09:00 local");
  assert.ok(Date.parse(winter.at(-1)!.end) <= nov.getTime());
  assert.equal(winter.length, 8, "yard lessons end before 17:45");
  // summer: the last yard lesson starts at 18:00 at the latest
  assert.equal(summer.length, 10);
  assert.equal(local(new Date(summer.at(-1)!.start)), 18);
  // after the yard window only city driving, until 21:00
  const evening = all.filter((l) => l.kind === "city");
  assert.ok(evening.length >= 3);
  assert.equal(local(new Date(all.at(-1)!.end)), 21);
  // lessons are back to back, one hour each
  for (let i = 1; i < all.length; i++)
    assert.equal(all[i]!.start, all[i - 1]!.end);
});

test("debts are aged first-in-first-out and pay is split by direction", async () => {
  const { ageDebt, change } = await import("../src/lib/books.ts");
  const { payByDirection, DEFAULT_RATES } =
    await import("../src/lib/payroll.ts");
  const now = Date.parse("2026-11-30T12:00:00Z");
  const day = (n: number) => new Date(now - n * 86400000).toISOString();
  // 100 (50 days old) + 200 (20 days) + 300 (3 days), 150 paid: the old one is cleared first
  const a = ageDebt(
    [
      { amount: 10000, created: day(50) },
      { amount: 20000, created: day(20) },
      { amount: 30000, created: day(3) },
    ],
    15000,
    now,
  );
  assert.equal(a.total, 45000);
  assert.equal(a.old, 0, "the 50-day-old charge is settled first");
  assert.equal(a.month, 15000, "what remains of the 20-day-old one");
  assert.equal(a.current, 30000);
  assert.equal(a.oldestDays, 20);
  assert.equal(ageDebt([{ amount: 5000, created: day(40) }], 0, now).old, 5000);
  assert.equal(
    ageDebt([{ amount: 5000, created: day(1) }], 9000, now).total,
    0,
  );
  assert.equal(change(150, 100), 50);
  assert.equal(change(5, 0), null);
  // an instructor: 10 yard (15 ₾) + 20 city (20 ₾) lessons, plus a fixed salary of 300 ₾
  const items = [
    ...DEFAULT_RATES.instructor.map((r: any) => ({
      ...r,
      from_month: "2026-11",
    })),
    { kind: "salary", amount: 30000, from_month: "2026-11" },
  ] as any;
  const d = payByDirection(items, "2026-11", {
    lessons: { yard: 10, city: 20 },
  });
  assert.equal(d.yard, 15000);
  assert.equal(d.city, 40000);
  assert.equal(d.fixed, 30000);
  // a lecturer: 2 students in an Akhalkalaki group go to theory
  const lec = DEFAULT_RATES.lecturer.map((r: any) => ({
    ...r,
    from_month: "2026-11",
  })) as any;
  const t = payByDirection(lec, "2026-11", {
    students: {
      akhalkalaki: { n: 2, price: 30000 },
      all: { n: 2, price: 30000 },
    },
  });
  assert.equal(t.theory, 10000);
});
