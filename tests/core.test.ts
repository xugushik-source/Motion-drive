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
  assert.equal(byLocale("packages"), 28);
  assert.equal(byLocale("services"), 12);
  const price = (id: string) =>
    publicRecords.packages.find((p) => p.id === id)!.price;
  assert.equal(price("city-automatic-ru"), 60);
  assert.equal(price("city-manual-ru"), 80);
  assert.equal(price("yard-ru"), 40);
  assert.equal(price("theory-group-ru"), 150);
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
