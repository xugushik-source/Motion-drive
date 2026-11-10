import { PGlite } from "@electric-sql/pglite";
import test from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { postgresQuery } from "../src/lib/db.ts";
test("PostgreSQL migration and booking/rate-limit constraints", async () => {
  const pg = new PGlite();
  await pg.exec("CREATE ROLE anon; CREATE ROLE authenticated;");
  await pg.exec(readFileSync("db/postgres.sql", "utf8"));
  await pg.exec(
    "INSERT INTO motion_drive.users(id,email,name,password) VALUES('a','a@test.invalid','A','!'),('b','b@test.invalid','B','!');",
  );
  const run = (s: string, ...args: any[]) =>
    pg.query<Record<string, any>>(postgresQuery(s), args);
  await run(
    "INSERT INTO slots(id,instructor_id,city,start,end) VALUES(?,?,?,?,?)",
    "slot",
    null,
    "akhalkalaki",
    "2030-11-10T06:00:00.000Z",
    "2030-11-10T07:00:00.000Z",
  );
  const result = await run(
    "SELECT s.id,s.city,s.start,s.end,s.instructor_id FROM slots s LEFT JOIN bookings b ON b.slot_id=s.id AND b.status IN ('pending','confirmed','completed') WHERE s.available=1 AND s.start>? AND b.id IS NULL ORDER BY s.start",
    new Date().toISOString(),
  );
  assert.equal(result.rows.length, 1);
  await run(
    "INSERT INTO bookings(id,user_id,city,program,gearbox,slot_id,name,contact) VALUES(?,?,?,?,?,?,?,?)",
    "booking",
    "a",
    "akhalkalaki",
    "practice",
    "none",
    "slot",
    "A",
    "A@test.invalid",
  );
  await assert.rejects(
    run(
      "INSERT INTO bookings(id,user_id,city,program,gearbox,slot_id,name,contact) VALUES(?,?,?,?,?,?,?,?)",
      "booking2",
      "b",
      "akhalkalaki",
      "practice",
      "none",
      "slot",
      "B",
      "B@test.invalid",
    ),
  );
  assert.equal(
    (
      await run(
        "SELECT id FROM bookings WHERE slot_id=? AND status IN ('pending','confirmed','completed')",
        "slot",
      )
    ).rows.length,
    1,
  );
  await run("UPDATE bookings SET status='cancelled' WHERE id=?", "booking");
  await run(
    "INSERT INTO bookings(id,user_id,city,program,gearbox,slot_id,name,contact) VALUES(?,?,?,?,?,?,?,?)",
    "booking2",
    "b",
    "akhalkalaki",
    "practice",
    "none",
    "slot",
    "B",
    "B@test.invalid",
  );
  const sql =
    "INSERT INTO limits(key,count,reset) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN limits.reset<? THEN 1 ELSE limits.count+1 END,reset=CASE WHEN limits.reset<? THEN excluded.reset ELSE limits.reset END RETURNING count";
  const now = Date.now();
  await run(sql, "test", now + 60000, now, now);
  assert.equal(
    (await run(sql, "test", now + 60000, now, now)).rows[0].count,
    2,
  );
  await run(
    "SELECT * FROM slots WHERE instructor_id=? AND start<? AND end>?",
    "a",
    "2031-01-01",
    "2020-01-01",
  );
  await run(
    "SELECT COALESCE(SUM(usd),0) AS n FROM usage WHERE created>=date('now','start of month')",
  );
  console.log(
    "PostgreSQL migration, query bindings, slot uniqueness, cancellation/reuse, shared rate limit: PASS",
  );
  // Upgrade path is idempotent and supports phone accounts and lesson series.
  await pg.exec(readFileSync("db/postgres.sql", "utf8"));
  await run(
    "INSERT INTO users(id,phone,name,password) VALUES(?,?,?,?)",
    "p1",
    "+995597000001",
    "Phone",
    "!",
  );
  await assert.rejects(
    run(
      "INSERT INTO users(id,phone,name,password) VALUES(?,?,?,?)",
      "p2",
      "+995597000001",
      "Dup",
      "!",
    ),
  );
  await run(
    "INSERT INTO bookings(id,user_id,city,program,gearbox,slot_id,name,contact,series_id,package_title) VALUES(?,?,?,?,?,?,?,?,?,?)",
    "series-1",
    "p1",
    "akhalkalaki",
    "practice",
    "none",
    null,
    "Phone",
    "+995597000001",
    "s1",
    "Practice 10",
  );
  assert.equal(
    (await run("SELECT id FROM bookings WHERE series_id=?", "s1")).rows.length,
    1,
  );
  await run("UPDATE users SET must_change_password=1 WHERE id=?", "p1");
  await pg.exec(readFileSync("db/access.sql", "utf8"));
  await pg.exec("SET ROLE anon");
  await assert.rejects(pg.query("SELECT * FROM motion_drive.users"));
  await pg.exec("RESET ROLE; SET ROLE motion_drive_app");
  assert.equal((await run("SELECT id FROM users")).rows.length, 3);
  await assert.rejects(
    pg.exec("ALTER TABLE motion_drive.users ADD COLUMN forbidden text"),
  );
  await pg.exec("RESET ROLE");
  await pg.close();
});
