import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function checkPassword(password: string, stored: string) {
  try {
    const [salt, h] = stored.split(":");
    return timingSafeEqual(
      Buffer.from(h, "hex"),
      scryptSync(password, salt, 64),
    );
  } catch {
    return false;
  }
}
