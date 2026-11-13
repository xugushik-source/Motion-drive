import type { Row } from "./db";
export const normalizeQuestion = (s: string) =>
  s
    .toLocaleLowerCase()
    // Armenian puts "?", "!" and the emphasis mark INSIDE a word ("Որքա՞ն"):
    // they must not split it. Only real punctuation separates words.
    .replace(/[\u055A-\u055F]/g, "")
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
  // Alias weights. Plain = the topic's own word. "~word" = weak: a question word
  // ("сколько", "where") that settles the topic alone but never beats a plain
  // word. "~~word" = generic ("теория", "when"): it only supports other hits.
  // A stem and the full word it belongs to count once.
  type Kind = "strong" | "weak" | "generic";
  let best: Row | undefined,
    bestScore = 0;
  for (const q of knowledge) {
    if (!Array.isArray(q.aliases)) continue;
    const matched = new Map<string, Kind>();
    for (const raw of q.aliases as string[]) {
      const kind: Kind = raw.startsWith("~~")
        ? "generic"
        : raw.startsWith("~")
          ? "weak"
          : "strong";
      const alias = normalizeQuestion(raw.replace(/^~+/, ""));
      if (!alias || !alias.split(" ").every(hasWord)) continue;
      const old = matched.get(alias);
      if (!old || kind === "strong" || (kind === "weak" && old === "generic"))
        matched.set(alias, kind);
    }
    let score = 0,
      strong = 0,
      weak = 0,
      generic = 0;
    for (const [alias, kind] of matched) {
      if ([...matched.keys()].some((o) => o !== alias && o.startsWith(alias)))
        continue;
      score += (kind === "strong" ? 1000 : 400) + alias.length;
      if (kind === "strong") strong++;
      else if (kind === "weak") weak++;
      else generic++;
    }
    // enough evidence: a plain word, a question word, or two supporting words
    const enough = strong > 0 || weak > 0 || generic >= 2;
    if (enough && score > bestScore) {
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
  "toxac",
  "toxnel",
  "toxnem",
  "chtoxneq",
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
