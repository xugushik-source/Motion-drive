import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
const path = resolve(process.env.DATABASE_PATH || "./data/motion-drive.sqlite");
mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
export const db = new DatabaseSync(path);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'student',locale TEXT NOT NULL DEFAULT 'ru');
CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,kind TEXT NOT NULL,data TEXT NOT NULL,updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS records_kind ON records(kind);
CREATE TABLE IF NOT EXISTS bookings(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),city TEXT NOT NULL,program TEXT NOT NULL,gearbox TEXT NOT NULL,instructor_id TEXT,slot_id TEXT,status TEXT NOT NULL DEFAULT 'pending',name TEXT NOT NULL,contact TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX IF NOT EXISTS occupied_slot ON bookings(slot_id) WHERE slot_id IS NOT NULL AND status IN ('pending','confirmed');
CREATE TABLE IF NOT EXISTS slots(id TEXT PRIMARY KEY,instructor_id TEXT NOT NULL REFERENCES users(id),city TEXT NOT NULL,start TEXT NOT NULL,end TEXT NOT NULL,available INTEGER NOT NULL DEFAULT 1,UNIQUE(instructor_id,start));
CREATE TABLE IF NOT EXISTS results(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),answers TEXT NOT NULL,score INTEGER NOT NULL,total INTEGER NOT NULL,created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS attempts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),questions TEXT NOT NULL,deadline INTEGER NOT NULL,finished INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,user_id TEXT,locale TEXT NOT NULL,text TEXT NOT NULL,answer TEXT NOT NULL,escalated INTEGER NOT NULL DEFAULT 0,created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,before_value TEXT,after_value TEXT,created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS usage(id TEXT PRIMARY KEY,usd REAL NOT NULL,tokens INTEGER NOT NULL DEFAULT 0,created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,reset INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS uploads(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),mime TEXT NOT NULL,name TEXT NOT NULL,created TEXT DEFAULT CURRENT_TIMESTAMP);
`);
const messageColumns = db.prepare("PRAGMA table_info(messages)").all() as {
  name: string;
}[];
for (const [name, type] of [
  ["guest_id", "TEXT"],
  ["admin_reply", "TEXT NOT NULL DEFAULT ''"],
])
  if (!messageColumns.some((c) => c.name === name))
    db.exec(`ALTER TABLE messages ADD COLUMN ${name} ${type}`);
export type Row = Record<string, any>;
export const all = (sql: string, ...args: any[]) =>
  db.prepare(sql).all(...args) as Row[];
export const one = (sql: string, ...args: any[]) =>
  db.prepare(sql).get(...args) as Row | undefined;
export function records(kind: string) {
  return all(
    "SELECT * FROM records WHERE kind=? ORDER BY updated DESC",
    kind,
  ).map((r) => ({ id: r.id, ...JSON.parse(r.data) }));
}
export function saveRecord(kind: string, id: string, data: Row, actor: string) {
  const before = one(
    "SELECT data FROM records WHERE id=? AND kind=?",
    id,
    kind,
  );
  db.prepare(
    "INSERT INTO records(id,kind,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=CURRENT_TIMESTAMP",
  ).run(id, kind, JSON.stringify(data));
  db.prepare(
    "INSERT INTO audit(actor,action,before_value,after_value) VALUES(?,?,?,?)",
  ).run(actor, kind + ":" + id, before?.data || null, JSON.stringify(data));
}
export function limit(key: string, max: number, seconds = 60) {
  const now = Date.now();
  db.prepare(
    "INSERT INTO limits(key,count,reset) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset<? THEN 1 ELSE count+1 END,reset=CASE WHEN reset<? THEN excluded.reset ELSE reset END",
  ).run(key, now + seconds * 1000, now, now);
  return (one("SELECT count FROM limits WHERE key=?", key)?.count || 0) <= max;
}
