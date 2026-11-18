import { normalizePhone } from "./phone";

export type SeedStaff = { name: string; phone: string; role: string };
const ROLES = ["admin", "manager", "operator", "instructor", "lecturer"];
/**
 * SEED_STAFF is a JSON list kept only in the hosting settings (never in the repository), so that
 * staff phone numbers stay private: [{"name":"…","phone":"+995…","role":"admin"}].
 * Invalid entries are skipped.
 */
export function parseSeedStaff(raw?: string): SeedStaff[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    const out: SeedStaff[] = [];
    for (const e of list) {
      const phone = normalizePhone(String(e?.phone || ""));
      const name = String(e?.name || "").trim();
      if (phone && name.length >= 2 && ROLES.includes(e?.role))
        out.push({ name, phone, role: e.role });
    }
    return out;
  } catch {
    return [];
  }
}
