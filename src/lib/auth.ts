import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db, one } from "./db";
import { hashPassword, checkPassword } from "./password";
export { hashPassword, checkPassword };
export async function currentUser() {
  const token = (await cookies()).get("md_session")?.value;
  if (!token) return null;
  return (
    (await one(
      "SELECT u.id,u.email,u.phone,u.name,u.role,u.locale,u.must_change_password FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.id=? AND s.expires>?",
      token,
      Date.now(),
    )) || null
  );
}
export async function startSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  await db
    .prepare("INSERT INTO sessions VALUES(?,?,?)")
    .run(token, userId, Date.now() + 7 * 86400000);
  (await cookies()).set("md_session", token, {
    httpOnly: true,
    secure:
      process.env.VERCEL === "1" ||
      process.env.APP_URL?.startsWith("https://") ||
      false,
    sameSite: "lax",
    path: "/",
    maxAge: 604800,
  });
}
// Unambiguous characters only: the operator dictates this password over the phone.
export function temporaryPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(randomBytes(8), (b) => alphabet[b % alphabet.length]).join(
    "",
  );
}
