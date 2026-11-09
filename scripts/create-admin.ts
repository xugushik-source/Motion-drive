import { randomUUID } from "node:crypto";
import { db, one } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
async function main() {
  // Provision an owner account from a protected terminal environment, never browser input.
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase(),
    password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 12)
    throw Error(
      "Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ chars) in a protected terminal environment.",
    );
  if (await one("SELECT id FROM users WHERE email=?", email))
    throw Error(
      "Account already exists. Use manage-user.ts to assign a role without changing its password.",
    );
  await db
    .prepare(
      "INSERT INTO users(id,email,name,password,role) VALUES(?,?,?,?, 'admin')",
    )
    .run(randomUUID(), email, "Motion Drive", hashPassword(password));
  console.log("Administrator created.");
  process.exit(0);
}
main().catch(() => {
  console.error(
    "Account setup failed. Check environment variables and database access.",
  );
  process.exit(1);
});
