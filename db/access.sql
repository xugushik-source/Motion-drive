-- Run after postgres.sql. Credentials are provisioned separately, never committed.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='motion_drive_app') THEN
 CREATE ROLE motion_drive_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
 END IF;
END $$;
GRANT USAGE ON SCHEMA motion_drive TO motion_drive_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA motion_drive TO motion_drive_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA motion_drive TO motion_drive_app;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['users','sessions','records','bookings','slots','results','attempts','messages','audit','usage','limits','uploads'] LOOP
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='motion_drive' AND tablename=t AND policyname='server_only') THEN
 EXECUTE format('CREATE POLICY server_only ON motion_drive.%I TO motion_drive_app USING (true) WITH CHECK (true)',t);
 END IF;
 END LOOP;
END $$;
