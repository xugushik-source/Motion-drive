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
  return knowledge.find(
    (q) =>
      Array.isArray(q.aliases) &&
      q.aliases.some((alias: string) =>
        normalizeQuestion(alias)
          .split(" ")
          .every((word) => words.has(word)),
      ),
  );
}
