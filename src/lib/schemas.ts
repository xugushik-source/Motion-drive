import { z } from "zod";
import { normalizePhone } from "./phone";
export const locales = ["ka", "hy", "ru", "en"] as const;
export const localeSchema = z.enum(locales);
export const phoneSchema = z
  .string()
  .max(40)
  .transform((v, ctx) => {
    const phone = normalizePhone(v);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "badPhone" });
      return z.NEVER;
    }
    return phone;
  });
// Students sign up with a phone number and a simple password; no SMS by owner decision.
export const passwordSchema = z.string().min(6).max(128);
export const registerSchema = z.object({
  phone: phoneSchema,
  password: passwordSchema,
  name: z.string().trim().min(2).max(100),
  locale: localeSchema,
});
export const loginSchema = z.object({
  login: z.string().trim().min(3).max(180),
  password: z.string().max(128),
});
export const bookingSchema = z.object({
  city: z.enum(["akhalkalaki", "ninotsminda"]),
  program: z.enum(["theory", "practice", "individual", "group", "exam"]),
  gearbox: z.enum(["manual", "automatic", "none"]),
  instructor_id: z.string().max(80).nullable().optional(),
  slot_id: z.string().max(80).nullable().optional(),
  slot_ids: z.array(z.string().max(80)).min(1).max(30).optional(),
  package_id: z.string().max(100).nullable().optional(),
  name: z.string().trim().min(2).max(100),
  contact: z.string().trim().min(5).max(180),
  note: z.string().max(1200).default(""),
  consent: z.literal(true),
  website: z.string().max(0).default(""),
});
export const questionSchema = z
  .object({
    question: z.string().min(5).max(2000),
    options: z.array(z.string().min(1).max(1000)).min(2).max(6),
    correct: z.number().int().min(0).max(5),
    explanation: z.string().min(1).max(3000),
    topic: z.string().max(100),
    locale: localeSchema,
    source: z.url(),
    verified: z.literal(true),
    status: z.enum(["draft", "published"]),
    verifiedAt: z.iso.date(),
  })
  .refine((v) => v.correct < v.options.length);
export function anonymize(s: string) {
  return s
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email]")
    .replace(/(?:\+?\d[\d\s()\-]{7,}\d)/g, "[phone]")
    .replace(/https?:\/\/\S+/g, "[url]")
    .replace(/@[\p{L}\p{N}_.]+/gu, "[account]");
}
const blankToUndefined = (v: unknown) =>
  v === "" || v === null ? undefined : v;
// An empty price stays empty ("price on request"); it must never become 0 ₾.
const optionalPrice = z.preprocess(
  (v) => (v === null || v === undefined ? "" : v),
  z.union([z.literal(""), z.coerce.number().min(0).max(100000)]),
);
export const packageSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().max(1500).default(""),
  lessons: z.coerce.number().int().min(1).max(30),
  lessonMinutes: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().min(15).max(240).default(60),
  ),
  price: optionalPrice,
  oldPrice: optionalPrice,
  program: z
    .enum(["theory", "practice", "individual", "group", "exam"])
    .default("practice"),
  gearbox: z.enum(["manual", "automatic", "none"]).default("none"),
  features: z.array(z.string().trim().min(1).max(160)).max(12).default([]),
  featured: z.boolean().default(false),
  order: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().min(0).max(999).default(0),
  ),
  locale: localeSchema,
  status: z.enum(["draft", "published"]),
});
