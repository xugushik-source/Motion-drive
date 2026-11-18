import { normalizePhone } from "./phone";
import { loginFromName, loginPattern } from "./translit";

export type SeedStaff = {
  name: string;
  phone: string | null;
  username: string;
  role: string;
};
const ROLES = ["admin", "manager", "operator", "instructor", "lecturer"];
/**
 * SEED_STAFF is a JSON list kept only in the hosting settings (never in the repository):
 * [{"name":"…","role":"admin","login":"optional.login","phone":"+995… (optional)"}].
 * Without a login one is made from the name. Invalid entries are skipped.
 */
export function parseSeedStaff(raw?: string): SeedStaff[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    const out: SeedStaff[] = [];
    for (const e of list) {
      const name = String(e?.name || "").trim();
      if (name.length < 2 || !ROLES.includes(e?.role)) continue;
      const phone = e?.phone ? normalizePhone(String(e.phone)) : null;
      if (e?.phone && !phone) continue;
      const wanted = String(e?.login || "")
        .trim()
        .toLowerCase();
      out.push({
        name,
        phone,
        username: loginPattern.test(wanted) ? wanted : loginFromName(name),
        role: e.role,
      });
    }
    return out;
  } catch {
    return [];
  }
}
const norm = (x: unknown) =>
  String(x || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
/** The public team card that belongs to this person, tied to the new account (by role and name). */
export function cardFor(
  staff: Pick<SeedStaff, "name" | "role">,
  cards: Record<string, any>[],
  userId: string,
) {
  const cardRole = (
    {
      instructor: "instructor",
      lecturer: "lecturer",
      operator: "administrator",
    } as Record<string, string>
  )[staff.role];
  if (!cardRole) return null;
  const card = cards.find(
    (c) =>
      c.role === cardRole && !c.userId && norm(c.title) === norm(staff.name),
  );
  if (!card) return null;
  const { id, ...data } = card;
  return { id: String(id), data: { ...data, userId } };
}
