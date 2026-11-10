import { supabaseRootCa } from "./certificates/supabase-root-2021";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Pool, type PoolClient } from "pg";
import { contactOnly } from "./deployment";
import { publicRecords } from "./public-content";
import { sqliteSchema } from "./sqlite-schema";

export type Row = Record<string, any>;
let sqlite: DatabaseSync | undefined;
let pool: Pool | undefined;
const context = new AsyncLocalStorage<{ client?: PoolClient; local?: true }>();
let localQueue = Promise.resolve();
function localDb() {
  if (!sqlite) {
    const path = contactOnly
      ? ":memory:"
      : resolve(process.env.DATABASE_PATH || "./data/motion-drive.sqlite");
    if (!contactOnly)
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
  }
  return sqlite;
}
function getPool() {
  if (!process.env.DATABASE_URL) throw Error("Database is not configured");
  return (pool ||= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: true, ca: supabaseRootCa },
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
  return sql
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
    .replace(/\?/g, () => "$" + ++index);
}
async function query(sql: string, args: any[] = []) {
  if (process.env.DATABASE_URL) {
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
  if (process.env.DATABASE_URL) {
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
