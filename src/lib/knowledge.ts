import type { Row } from "./db";
export const normalizeQuestion = (s: string) =>
  s
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
// Conservative deterministic retrieval. New knowledge is never published automatically.
export function findKnowledge(message: string, knowledge: Row[]) {
  const normalized = normalizeQuestion(message),
    words = new Set(normalized.split(" "));
  const exact = knowledge.find(
    (q) => normalizeQuestion(String(q.question)) === normalized,
  );
  if (exact) return exact;
  // Russian, Georgian and Armenian inflect words ("возраст" → "возраста"), so an
  // alias word of 4+ letters also matches as a word stem; short ones stay exact.
  const hasWord = (alias: string) =>
    words.has(alias) ||
    (alias.length >= 4 && [...words].some((w) => w.startsWith(alias)));
  // Several entries can share a word ("занятия"), so pick the entry with the
  // most matched aliases, then the most specific (longest) ones, not the first.
  let best: Row | undefined,
    bestScore = 0;
  for (const q of knowledge) {
    if (!Array.isArray(q.aliases)) continue;
    const hits = q.aliases
      .map((alias: string) => normalizeQuestion(alias))
      .filter((alias: string) => alias && alias.split(" ").every(hasWord));
    const score =
      hits.length * 1000 +
      hits.reduce((n: number, alias: string) => n + alias.length, 0);
    if (score > bestScore) {
      best = q;
      bestScore = score;
    }
  }
  return best;
}

// Armenian typed with Latin letters ("Barev dzez arjeqy inchqan e?") is how most
// clients write in chat. A few words that exist in no other language of the site
// are enough to recognise it; neutral words such as "lari" are left out on purpose.
const ARMENIAN_LATIN = new Set([
  "barev",
  "dzez",
  "cez",
  "inchqan",
  "arje",
  "arjeq",
  "arjeqy",
  "grancvel",
  "grancvem",
  "grancvelu",
  "krancvel",
  "krancvem",
  "krancvelu",
  "uzum",
  "kuzem",
  "guzeq",
  "kuzeq",
  "qaxaq",
  "urtex",
  "shnorhakalutyun",
  "shat",
  "hayeren",
  "ruseren",
  "vraceren",
  "xumb",
  "xmb",
  "xmbin",
  "qnnutyun",
  "qnnutyuny",
  "qani",
  "sorvel",
  "sorvesnel",
  "sorvecnel",
  "sorvim",
  "amis",
  "amsi",
  "arden",
  "ksksvi",
  "sksvi",
  "sksvum",
  "greceq",
  "azganun",
  "heraxosi",
  "heraxos",
  "erkushabti",
  "choreqshabti",
  "urbat",
  "ynker",
  "petq",
  "hemi",
  "aravot",
  "zangeceq",
  "motavorapes",
  "teveky",
  "tevoxutyuny",
  "grancvac",
]);
export const looksLikeArmenianLatin = (message: string) =>
  !/[^\p{Script=Latin}\p{N}\p{P}\p{S}\s]/u.test(message) &&
  normalizeQuestion(message)
    .split(" ")
    .some((word) => ARMENIAN_LATIN.has(word));
/** Language of a chat message: its script, else Armenian-in-Latin, else the page language. */
type Lang = "ka" | "hy" | "ru" | "en";
export function detectLanguage(message: string, fallback: Lang): Lang {
  if (/[ა-ჰ]/.test(message)) return "ka";
  if (/[Ա-ֆ]/.test(message)) return "hy";
  if (/[а-яё]/i.test(message)) return "ru";
  return looksLikeArmenianLatin(message) ? "hy" : fallback;
}
