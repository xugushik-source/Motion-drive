import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("an existing email-only SQLite database upgrades without losing users", async () => {
  const path = join(mkdtempSync(join(tmpdir(), "md-")), "old.sqlite");
  const old = new DatabaseSync(path);
  // Schema exactly as shipped before phone sign-in.
  old.exec(
    "CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'student',locale TEXT NOT NULL DEFAULT 'ru');" +
      "CREATE TABLE bookings(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),city TEXT NOT NULL,program TEXT NOT NULL,gearbox TEXT NOT NULL,instructor_id TEXT,slot_id TEXT,status TEXT NOT NULL DEFAULT 'pending',name TEXT NOT NULL,contact TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);" +
      "INSERT INTO users VALUES('admin','owner@test.invalid','Owner','x','admin','ru');" +
      "INSERT INTO bookings(id,user_id,city,program,gearbox,name,contact) VALUES('b1','admin','akhalkalaki','theory','none','Owner','owner@test.invalid');",
  );
  old.close();
  process.env.DATABASE_PATH = path;
  const { all, db } = await import("../src/lib/db.ts");
  const users = await all(
    "SELECT id,email,phone,must_change_password FROM users",
  );
  assert.deepEqual(
    users.map((u) => ({ ...u })),
    [
      {
        id: "admin",
        email: "owner@test.invalid",
        phone: null,
        must_change_password: 0,
      },
    ],
  );
  await db
    .prepare("INSERT INTO users(id,phone,name,password) VALUES(?,?,?,?)")
    .run("s1", "+995597000001", "Student", "x");
  await assert.rejects(
    db
      .prepare("INSERT INTO users(id,phone,name,password) VALUES(?,?,?,?)")
      .run("s2", "+995597000001", "Dup", "x"),
  );
  const b = await all("SELECT id,series_id,package_title FROM bookings");
  assert.deepEqual(
    b.map((x) => ({ ...x })),
    [{ id: "b1", series_id: null, package_title: "" }],
  );
});
