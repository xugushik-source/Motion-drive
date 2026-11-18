-- A private schema: browser/Data API roles have no access.
CREATE SCHEMA IF NOT EXISTS motion_drive;
REVOKE ALL ON SCHEMA motion_drive FROM PUBLIC;
-- Supabase API roles exist only on Supabase; other PostgreSQL hosts (Neon, ...) lack them.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON SCHEMA motion_drive FROM anon; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON SCHEMA motion_drive FROM authenticated; END IF;
END $$;
CREATE TABLE IF NOT EXISTS motion_drive.users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('student','operator','instructor','admin')),locale TEXT NOT NULL DEFAULT 'ru');
CREATE TABLE IF NOT EXISTS motion_drive.sessions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES motion_drive.users(id) ON DELETE CASCADE,expires BIGINT NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_user ON motion_drive.sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry ON motion_drive.sessions(expires);
CREATE TABLE IF NOT EXISTS motion_drive.records(id TEXT PRIMARY KEY,kind TEXT NOT NULL,data TEXT NOT NULL,updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS records_kind ON motion_drive.records(kind);
CREATE TABLE IF NOT EXISTS motion_drive.bookings(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES motion_drive.users(id),city TEXT NOT NULL,program TEXT NOT NULL,gearbox TEXT NOT NULL,instructor_id TEXT,slot_id TEXT,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled','completed')),name TEXT NOT NULL,contact TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS bookings_user ON motion_drive.bookings(user_id,created);
CREATE INDEX IF NOT EXISTS bookings_instructor ON motion_drive.bookings(instructor_id,created);
CREATE TABLE IF NOT EXISTS motion_drive.slots(id TEXT PRIMARY KEY,instructor_id TEXT REFERENCES motion_drive.users(id),city TEXT NOT NULL,start TEXT NOT NULL,"end" TEXT NOT NULL,available INTEGER NOT NULL DEFAULT 1 CHECK(available IN (0,1)),UNIQUE(instructor_id,start));
CREATE UNIQUE INDEX IF NOT EXISTS occupied_slot ON motion_drive.bookings(slot_id) WHERE slot_id IS NOT NULL AND status IN ('pending','confirmed','completed');
CREATE INDEX IF NOT EXISTS slot_calendar ON motion_drive.slots(city,start);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bookings_slot_fk' AND connamespace='motion_drive'::regnamespace) THEN
 ALTER TABLE motion_drive.bookings ADD CONSTRAINT bookings_slot_fk FOREIGN KEY(slot_id) REFERENCES motion_drive.slots(id);
 END IF;
END $$;
-- Phone sign-in, operator password reset and multi-lesson series (idempotent upgrades).
ALTER TABLE motion_drive.users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE motion_drive.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE motion_drive.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE motion_drive.users ADD CONSTRAINT users_role_check CHECK(role IN ('student','operator','manager','instructor','lecturer','admin'));
ALTER TABLE motion_drive.users ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE motion_drive.users ADD COLUMN IF NOT EXISTS birth_year INTEGER;
ALTER TABLE motion_drive.users ADD COLUMN IF NOT EXISTS active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE motion_drive.users ADD COLUMN IF NOT EXISTS lesson_rate INTEGER;
ALTER TABLE motion_drive.users ADD COLUMN IF NOT EXISTS personal_id TEXT;
ALTER TABLE motion_drive.users ADD COLUMN IF NOT EXISTS pay_method TEXT;
ALTER TABLE motion_drive.users ADD COLUMN IF NOT EXISTS must_change_password INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS users_phone ON motion_drive.users(phone) WHERE phone IS NOT NULL;
ALTER TABLE motion_drive.bookings ADD COLUMN IF NOT EXISTS series_id TEXT;
ALTER TABLE motion_drive.bookings ADD COLUMN IF NOT EXISTS package_title TEXT NOT NULL DEFAULT '';
ALTER TABLE motion_drive.bookings ADD COLUMN IF NOT EXISTS conducted_at TEXT;
ALTER TABLE motion_drive.bookings ADD COLUMN IF NOT EXISTS accepted_at TEXT;
ALTER TABLE motion_drive.bookings ADD COLUMN IF NOT EXISTS accepted_by TEXT;
ALTER TABLE motion_drive.bookings ADD COLUMN IF NOT EXISTS pay_amount INTEGER;
ALTER TABLE motion_drive.bookings ADD COLUMN IF NOT EXISTS lesson_kind TEXT;
ALTER TABLE motion_drive.bookings ADD COLUMN IF NOT EXISTS package_id TEXT;
CREATE INDEX IF NOT EXISTS bookings_series ON motion_drive.bookings(series_id);
CREATE TABLE IF NOT EXISTS motion_drive.charges(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES motion_drive.users(id),series_id TEXT,title TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>=0),created_by TEXT NOT NULL,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,voided INTEGER NOT NULL DEFAULT 0,void_reason TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS charges_user ON motion_drive.charges(user_id);
CREATE TABLE IF NOT EXISTS motion_drive.payments(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES motion_drive.users(id),charge_id TEXT,amount INTEGER NOT NULL CHECK(amount>0),method TEXT NOT NULL CHECK(method IN ('cash','card','transfer')),note TEXT NOT NULL DEFAULT '',created_by TEXT NOT NULL,paid_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,voided INTEGER NOT NULL DEFAULT 0,void_reason TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS payments_user ON motion_drive.payments(user_id);
CREATE TABLE IF NOT EXISTS motion_drive.applications(id TEXT PRIMARY KEY,category TEXT NOT NULL CHECK(category IN ('B','C')),course TEXT NOT NULL CHECK(course IN ('theory','yard','city')),city TEXT NOT NULL,name TEXT NOT NULL,phone TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',locale TEXT NOT NULL DEFAULT 'ru',status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','closed')),created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS applications_status ON motion_drive.applications(status,created);
CREATE TABLE IF NOT EXISTS motion_drive.pay_items(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES motion_drive.users(id) ON DELETE CASCADE,kind TEXT NOT NULL CHECK(kind IN ('salary','bonus','percent','per_lesson','premium')),title TEXT NOT NULL DEFAULT '',amount INTEGER,percent DOUBLE PRECISION,from_month TEXT NOT NULL,to_month TEXT,created_by TEXT NOT NULL,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,voided INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS pay_items_user ON motion_drive.pay_items(user_id);
CREATE TABLE IF NOT EXISTS motion_drive.payouts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES motion_drive.users(id) ON DELETE CASCADE,amount INTEGER NOT NULL CHECK(amount>0),kind TEXT NOT NULL CHECK(kind IN ('salary','advance')),note TEXT NOT NULL DEFAULT '',created_by TEXT NOT NULL,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,confirmed_at TEXT,voided INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS payouts_user ON motion_drive.payouts(user_id);
CREATE TABLE IF NOT EXISTS motion_drive.theory_enrollments(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES motion_drive.users(id) ON DELETE CASCADE,lecturer_id TEXT REFERENCES motion_drive.users(id) ON DELETE SET NULL,scope TEXT NOT NULL CHECK(scope IN ('akhalkalaki','ninotsminda','visiting','individual')),price INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,created_by TEXT NOT NULL,voided INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS theory_enrollments_lecturer ON motion_drive.theory_enrollments(lecturer_id);
ALTER TABLE motion_drive.pay_items ADD COLUMN IF NOT EXISTS scope TEXT;
ALTER TABLE motion_drive.pay_items DROP CONSTRAINT IF EXISTS pay_items_kind_check;
ALTER TABLE motion_drive.pay_items ADD CONSTRAINT pay_items_kind_check CHECK(kind IN ('salary','bonus','percent','per_lesson','per_student','premium'));
CREATE TABLE IF NOT EXISTS motion_drive.expenses(id TEXT PRIMARY KEY,category TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>0),note TEXT NOT NULL DEFAULT '',city TEXT NOT NULL DEFAULT '',spent_on TEXT NOT NULL,created_by TEXT NOT NULL,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,voided INTEGER NOT NULL DEFAULT 0,void_reason TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS expenses_day ON motion_drive.expenses(spent_on);
CREATE TABLE IF NOT EXISTS motion_drive.collections(id TEXT PRIMARY KEY,from_user TEXT NOT NULL REFERENCES motion_drive.users(id),to_user TEXT NOT NULL REFERENCES motion_drive.users(id),amount INTEGER NOT NULL CHECK(amount>0),note TEXT NOT NULL DEFAULT '',created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,confirmed_at TEXT,voided INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS collections_to ON motion_drive.collections(to_user);
ALTER TABLE motion_drive.slots ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'any';
CREATE TABLE IF NOT EXISTS motion_drive.results(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES motion_drive.users(id),answers TEXT NOT NULL,score INTEGER NOT NULL,total INTEGER NOT NULL,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS motion_drive.attempts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES motion_drive.users(id),questions TEXT NOT NULL,deadline BIGINT NOT NULL,finished INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS motion_drive.messages(id TEXT PRIMARY KEY,user_id TEXT REFERENCES motion_drive.users(id),guest_id TEXT,locale TEXT NOT NULL,text TEXT NOT NULL,answer TEXT NOT NULL,admin_reply TEXT NOT NULL DEFAULT '',escalated INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS messages_user ON motion_drive.messages(user_id,created);
CREATE INDEX IF NOT EXISTS messages_guest ON motion_drive.messages(guest_id,created);
CREATE TABLE IF NOT EXISTS motion_drive.audit(id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,before_value TEXT,after_value TEXT,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS motion_drive.usage(id TEXT PRIMARY KEY,usd DOUBLE PRECISION NOT NULL,tokens INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS motion_drive.limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,reset BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS motion_drive.uploads(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES motion_drive.users(id),mime TEXT NOT NULL,name TEXT NOT NULL,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
-- RLS is defense in depth, including for the private schema. An app-only role is
-- granted DML and policies separately; no browser key can access this schema.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['users','sessions','records','bookings','slots','results','attempts','messages','audit','usage','limits','uploads','charges','payments','applications','pay_items','payouts','theory_enrollments','expenses','collections'] LOOP
 EXECUTE format('ALTER TABLE motion_drive.%I ENABLE ROW LEVEL SECURITY',t);
 END LOOP;
END $$;
