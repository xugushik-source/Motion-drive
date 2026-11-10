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
