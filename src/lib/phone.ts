// One person = one account: every spelling of a number is reduced to +<digits>.
// Georgian mobiles may be typed locally (5XX XXX XXX); other countries need a code.
export function normalizePhone(input: string): string | null {
  let s = String(input || "")
    .trim()
    .replace(/[\s\-().]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("+")) {
    const digits = s.slice(1);
    return /^\d{8,15}$/.test(digits) ? "+" + digits : null;
  }
  if (!/^\d+$/.test(s)) return null;
  if (s.length === 9 && s.startsWith("5")) return "+995" + s;
  if (s.length === 10 && s.startsWith("05")) return "+995" + s.slice(1);
  if (s.length === 12 && s.startsWith("995")) return "+" + s;
  if (s.length >= 10 && s.length <= 15) return "+" + s;
  return null;
}
export function formatPhone(phone: string) {
  const m = /^\+995(\d{3})(\d{3})(\d{3})$/.exec(phone || "");
  return m ? `+995 ${m[1]} ${m[2]} ${m[3]}` : phone || "";
}
