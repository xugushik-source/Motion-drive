import { supabaseRootCa } from "./certificates/supabase-root-2021";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Pool, type PoolClient } from "pg";
import { contactOnly, databaseUrl, demoMode } from "./deployment";
import { DEMO } from "./demo";
import { hashPassword } from "./password";
import { postgresSchema } from "./postgres-schema";
import { publicRecords } from "./public-content";
import { sqliteSchema } from "./sqlite-schema";

export type Row = Record<string, any>;
let sqlite: DatabaseSync | undefined;
let pool: Pool | undefined;
const context = new AsyncLocalStorage<{ client?: PoolClient; local?: true }>();
let localQueue = Promise.resolve();
function localDb() {
  if (!sqlite) {
    const path =
      contactOnly || demoMode
        ? ":memory:"
        : resolve(process.env.DATABASE_PATH || "./data/motion-drive.sqlite");
    if (!contactOnly && !demoMode)
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    sqlite = new DatabaseSync(path);
    sqlite.exec(sqliteSchema);
    const slotColumns = sqlite.prepare("PRAGMA table_info(slots)").all() as {
      name: string;
      notnull: number;
    }[];
    if (slotColumns.some((c) => c.name === "instructor_id" && c.notnull)) {
      sqlite.exec(`PRAGMA foreign_keys=OFF;
      BEGIN;
      CREATE TABLE slots_nullable(id TEXT PRIMARY KEY,instructor_id TEXT REFERENCES users(id),city TEXT NOT NULL,start TEXT NOT NULL,end TEXT NOT NULL,available INTEGER NOT NULL DEFAULT 1,UNIQUE(instructor_id,start));
      INSERT INTO slots_nullable SELECT * FROM slots;
      DROP TABLE slots;
      ALTER TABLE slots_nullable RENAME TO slots;
      COMMIT;
      PRAGMA foreign_keys=ON;`);
    }
    // Phone sign-in: email becomes optional, phone unique, operator-issued temporary passwords.
    const userColumns = sqlite.prepare("PRAGMA table_info(users)").all() as {
      name: string;
    }[];
    if (!userColumns.some((c) => c.name === "phone")) {
      sqlite.exec(`PRAGMA foreign_keys=OFF;
      BEGIN;
      CREATE TABLE users_phone(id TEXT PRIMARY KEY,email TEXT UNIQUE,name TEXT NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'student',locale TEXT NOT NULL DEFAULT 'ru',phone TEXT,must_change_password INTEGER NOT NULL DEFAULT 0);
      INSERT INTO users_phone(id,email,name,password,role,locale) SELECT id,email,name,password,role,locale FROM users;
      DROP TABLE users;
      ALTER TABLE users_phone RENAME TO users;
      COMMIT;
      PRAGMA foreign_keys=ON;`);
    }
    const bookingColumns = sqlite
      .prepare("PRAGMA table_info(bookings)")
      .all() as { name: string }[];
    if (!bookingColumns.some((c) => c.name === "series_id"))
      sqlite.exec("ALTER TABLE bookings ADD COLUMN series_id TEXT");
    if (!bookingColumns.some((c) => c.name === "package_title"))
      sqlite.exec(
        "ALTER TABLE bookings ADD COLUMN package_title TEXT NOT NULL DEFAULT ''",
      );
    sqlite.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS users_phone ON users(phone) WHERE phone IS NOT NULL; CREATE INDEX IF NOT EXISTS bookings_series ON bookings(series_id);",
    );
    const columns = sqlite.prepare("PRAGMA table_info(messages)").all() as {
      name: string;
    }[];
    if (!columns.some((c) => c.name === "guest_id"))
      sqlite.exec("ALTER TABLE messages ADD COLUMN guest_id TEXT");
    if (!columns.some((c) => c.name === "admin_reply"))
      sqlite.exec(
        "ALTER TABLE messages ADD COLUMN admin_reply TEXT NOT NULL DEFAULT ''",
      );
    if (demoMode) seedDemo(sqlite);
  }
  return sqlite;
}
// Demo only: sample accounts, a two-week timetable in both branches and one
// pending course, so every screen shows something real straight away.
function seedDemo(d: DatabaseSync) {
  const user = d.prepare(
    "INSERT INTO users(id,email,phone,name,password,role,locale) VALUES(?,?,?,?,?,?,'ru')",
  );
  const hash = hashPassword(DEMO.password);
  user.run(
    "demo-admin",
    DEMO.adminEmail,
    null,
    "Демо Админ",
    hashPassword(DEMO.adminPassword),
    "admin",
  );
  user.run(
    "demo-operator",
    null,
    DEMO.operatorPhone,
    "Демо Оператор",
    hash,
    "operator",
  );
  user.run(
    "demo-student",
    null,
    DEMO.studentPhone,
    "Демо Ученик",
    hash,
    "student",
  );
  const slot = d.prepare(
    "INSERT INTO slots(id,instructor_id,city,start,end,available) VALUES(?,NULL,?,?,?,1)",
  );
  const first: string[] = [];
  for (let day = 1; day <= 14; day++) {
    // Georgia is UTC+4 all year; skip Sundays there
    const local = new Date(Date.now() + 4 * 3600000 + day * 86400000);
    if (local.getUTCDay() === 0) continue;
    for (const city of ["akhalkalaki", "ninotsminda"])
      for (let h = 10; h < 18; h++) {
        const start = Date.UTC(
          local.getUTCFullYear(),
          local.getUTCMonth(),
          local.getUTCDate(),
          h - 4,
        );
        const id = randomUUID();
        slot.run(
          id,
          city,
          new Date(start).toISOString(),
          new Date(start + 3600000).toISOString(),
        );
        if (city === "akhalkalaki" && h === 10 && first.length < 4)
          first.push(id);
      }
  }
  const booking = d.prepare(
    "INSERT INTO bookings(id,user_id,city,program,gearbox,slot_id,name,contact,note,series_id,package_title) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
  );
  const series = randomUUID();
  for (const slotId of first)
    booking.run(
      randomUUID(),
      "demo-student",
      "akhalkalaki",
      "practice",
      "manual",
      slotId,
      "Демо Ученик",
      DEMO.studentPhone,
      "",
      series,
      "Вождение по городу · механика · 4×60 · 4 × 80 ₾ = 320 ₾",
    );
}
function poolConfig() {
  const url = new URL(databaseUrl);
  const local =
    ["localhost", "127.0.0.1", "::1"].includes(url.hostname) ||
    url.searchParams.get("sslmode") === "disable";
  // The ssl option below decides about TLS; URL flags would silently override it.
  url.searchParams.delete("sslmode");
  url.searchParams.delete("channel_binding");
  const supabase = /(^|\.)supabase\.(co|com)$/.test(url.hostname);
  return {
    connectionString: url.toString(),
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 15000,
    // Supabase signs with its own root; every other host (Neon, ...) uses public CAs.
    ssl: local
      ? false
      : supabase
        ? { rejectUnauthorized: true, ca: supabaseRootCa }
        : { rejectUnauthorized: true },
  };
}
function getPool() {
  if (!databaseUrl) throw Error("Database is not configured");
  return (pool ||= new Pool(poolConfig()));
}
// First start on a fresh database: create the tables, then the first administrator
// from BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD (set them in Vercel, delete after).
// Idempotent; guarded by a transaction-level lock so parallel cold starts do not collide.
let schemaReady: Promise<void> | undefined;
async function bootstrapAdmin(client: PoolClient) {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) return;
  if (password.length < 12) {
    console.error(
      "BOOTSTRAP_ADMIN_PASSWORD needs 12+ characters; no admin created",
    );
    return;
  }
  if (
    (
      await client.query(
        "SELECT 1 FROM motion_drive.users WHERE role='admin' LIMIT 1",
      )
    ).rowCount
  )
    return;
  await client.query(
    "INSERT INTO motion_drive.users(id,email,name,password,role,locale) VALUES($1,$2,'Motion Drive',$3,'admin','ru') ON CONFLICT (email) DO NOTHING",
    [randomUUID(), email, hashPassword(password)],
  );
  await client.query(
    "INSERT INTO motion_drive.audit(actor,action) VALUES('bootstrap','admin:create')",
  );
}
export function ensureSchema() {
  if (!databaseUrl) return Promise.resolve();
  return (schemaReady ||= (async () => {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(727274)");
      await client.query("CREATE SCHEMA IF NOT EXISTS motion_drive");
      await client.query(
        "CREATE TABLE IF NOT EXISTS motion_drive.meta(key TEXT PRIMARY KEY, value TEXT NOT NULL)",
      );
      const version = createHash("sha256").update(postgresSchema).digest("hex");
      const known = await client.query(
        "SELECT value FROM motion_drive.meta WHERE key='schema'",
      );
      if (known.rows[0]?.value !== version) {
        await client.query(postgresSchema);
        await client.query(
          "INSERT INTO motion_drive.meta(key,value) VALUES('schema',$1) ON CONFLICT (key) DO UPDATE SET value=excluded.value",
          [version],
        );
      }
      await bootstrapAdmin(client);
      await client.query("COMMIT");
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      throw error;
    } finally {
      client.release();
    }
  })().catch((error) => {
    schemaReady = undefined;
    throw error;
  }));
}
const tables = new Set([
  "users",
  "sessions",
  "records",
  "bookings",
  "slots",
  "results",
  "attempts",
  "messages",
  "audit",
  "usage",
  "limits",
  "uploads",
]);
// Queries are internal literals; values always travel as separate bound parameters.
export function postgresQuery(sql: string) {
  let index = 0;
  return (
    sql
      .replace(
        /date\('now','start of month'\)/g,
        "to_char(date_trunc('month',now()), 'YYYY-MM-DD')",
      )
      .replace(/date\('now'\)/g, "to_char(now(), 'YYYY-MM-DD')")
      .replace(/\bend(?=\s*[<>=,)]|\s+TEXT)/g, '"end"')
      .replace(
        /\b(?:FROM|JOIN|INTO|UPDATE|DELETE FROM)\s+([a-z_]+)/gi,
        (match, table) =>
          tables.has(table)
            ? match.slice(0, -table.length) + "motion_drive." + table
            : match,
      )
      // PostgreSQL cannot guess the type of a bare parameter in "? IS NULL".
      .replace(
        /\?(\s+IS\s+NULL)?/g,
        (_m, isNull) => "$" + ++index + (isNull ? "::text" + isNull : ""),
      )
  );
}
async function query(sql: string, args: any[] = []) {
  if (databaseUrl) {
    if (!context.getStore()?.client) await ensureSchema();
    const client = context.getStore()?.client || getPool();
    const result = await client.query(postgresQuery(sql), args);
    return { rows: result.rows as Row[], changes: result.rowCount || 0 };
  }
  const execute = () => {
    const statement = localDb().prepare(sql.replace(/ FOR UPDATE/g, ""));
    if (/^\s*(SELECT|WITH|PRAGMA)/i.test(sql) || /RETURNING/i.test(sql)) {
      const rows = statement.all(...args) as Row[];
      return { rows, changes: rows.length };
    }
    const result = statement.run(...args);
    return { rows: [] as Row[], changes: Number(result.changes) };
  };
  if (context.getStore()?.local) return execute();
  let release!: () => void;
  const previous = localQueue;
  localQueue = new Promise((r) => {
    release = r;
  });
  await previous;
  try {
    return execute();
  } finally {
    release();
  }
}
export const all = async (sql: string, ...args: any[]) =>
  (await query(sql, args)).rows;
export const one = async (sql: string, ...args: any[]) =>
  (await all(sql, ...args))[0];
export const db = {
  prepare: (sql: string) => ({
    run: async (...args: any[]) => query(sql, args),
  }),
};
export async function transaction<T>(work: () => Promise<T>): Promise<T> {
  if (context.getStore()) return work();
  if (databaseUrl) {
    await ensureSchema();
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const result = await context.run({ client }, work);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  let release!: () => void;
  const previous = localQueue;
  localQueue = new Promise((r) => {
    release = r;
  });
  await previous;
  const local = localDb();
  local.exec("BEGIN IMMEDIATE");
  try {
    const result = await context.run({ local: true }, work);
    local.exec("COMMIT");
    return result;
  } catch (error) {
    local.exec("ROLLBACK");
    throw error;
  } finally {
    release();
  }
}
export async function records(kind: string): Promise<Row[]> {
  const defaults = publicRecords[kind] || [];
  if (contactOnly) return defaults;
  const rows = await all(
    "SELECT * FROM records WHERE kind=? ORDER BY updated DESC",
    kind,
  );
  const merged = new Map(defaults.map((r) => [r.id, r]));
  for (const r of rows) merged.set(r.id, { id: r.id, ...JSON.parse(r.data) });
  return [...merged.values()];
}
export async function saveRecord(
  kind: string,
  id: string,
  data: Row,
  actor: string,
) {
  return transaction(async () => {
    const before = await one(
      "SELECT data FROM records WHERE id=? AND kind=?",
      id,
      kind,
    );
    await db
      .prepare(
        "INSERT INTO records(id,kind,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=CURRENT_TIMESTAMP",
      )
      .run(id, kind, JSON.stringify(data));
    await db
      .prepare(
        "INSERT INTO audit(actor,action,before_value,after_value) VALUES(?,?,?,?)",
      )
      .run(actor, kind + ":" + id, before?.data || null, JSON.stringify(data));
  });
}
export async function limit(key: string, max: number, seconds = 60) {
  const now = Date.now();
  const row = await one(
    "INSERT INTO limits(key,count,reset) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN limits.reset<? THEN 1 ELSE limits.count+1 END,reset=CASE WHEN limits.reset<? THEN excluded.reset ELSE limits.reset END RETURNING count",
    key,
    now + seconds * 1000,
    now,
    now,
  );
  return row.count <= max;
}
