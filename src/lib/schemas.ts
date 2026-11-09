import { z } from "zod";
export const locales = ["ka", "hy", "ru", "en"] as const;
export const localeSchema = z.enum(locales);
export const registerSchema = z.object({
  email: z.email().max(180),
  password: z.string().min(12).max(128),
  name: z.string().trim().min(2).max(100),
  locale: localeSchema,
});
export const bookingSchema = z.object({
  city: z.enum(["akhalkalaki", "ninotsminda"]),
  program: z.enum(["theory", "practice", "individual", "group", "exam"]),
  gearbox: z.enum(["manual", "automatic", "none"]),
  instructor_id: z.string().max(80).nullable().optional(),
  slot_id: z.string().max(80).nullable().optional(),
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
