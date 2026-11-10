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
  assert.equal(p.lessonMinutes, 60);
  assert.equal(packageSchema.parse({ ...p, price: "450" }).price, 450);
  assert.equal(packageSchema.safeParse({ ...p, lessons: 0 }).success, false);
});
