import { db, one } from "../src/lib/db";
async function main() {
  // Role assignment requires database credentials and a trusted terminal, not a public API.
  const email = process.env.MOTION_USER_EMAIL?.trim().toLowerCase(),
    role = process.env.MOTION_USER_ROLE;
  if (
    !email ||
    !["admin", "operator", "instructor", "student"].includes(role || "")
  )
    throw Error("Set MOTION_USER_EMAIL and MOTION_USER_ROLE in the terminal.");
  const user = await one("SELECT id FROM users WHERE email=?", email);
  if (!user) throw Error("Create the account in the website first.");
  await db.prepare("UPDATE users SET role=? WHERE id=?").run(role, user.id);
  await db
    .prepare("INSERT INTO audit(actor,action,after_value) VALUES(?,?,?)")
    .run("owner-cli", "role:" + user.id, role);
  console.log("Role assigned.");
  process.exit(0);
}
main().catch(() => {
  console.error(
    "Account setup failed. Check environment variables and database access.",
  );
  process.exit(1);
});
