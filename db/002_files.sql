CREATE TABLE media_files (
 id uuid PRIMARY KEY, owner_id text NOT NULL REFERENCES "user"(id),
 original_name text NOT NULL, mime text NOT NULL, byte_size integer NOT NULL CHECK(byte_size>0 AND byte_size<=52428800),
 sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
 quarantine_key text NOT NULL UNIQUE, clean_key text UNIQUE, clean_size integer, clean_sha256 text,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','queued','scanning','clean','rejected','failed')),
 scan_note text NOT NULL DEFAULT '', attempts integer NOT NULL DEFAULT 0,
 lease_id uuid, lease_until timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX media_owner_idx ON media_files(owner_id,created_at DESC);
CREATE INDEX media_queue_idx ON media_files(status,lease_until);
CREATE TABLE media_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), file_id uuid NOT NULL REFERENCES media_files(id),
 action text NOT NULL, note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER immutable_media_events BEFORE UPDATE OR DELETE ON media_events FOR EACH ROW EXECUTE FUNCTION protect_editorial_history();
CREATE FUNCTION protect_clean_media() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status IN ('clean','rejected') THEN RAISE EXCEPTION 'Terminal file records are immutable'; END IF;
 IF NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.quarantine_key IS DISTINCT FROM OLD.quarantine_key OR NEW.sha256 IS DISTINCT FROM OLD.sha256 OR NEW.byte_size IS DISTINCT FROM OLD.byte_size OR NEW.mime IS DISTINCT FROM OLD.mime OR NEW.original_name IS DISTINCT FROM OLD.original_name THEN RAISE EXCEPTION 'Upload identity is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_clean_media BEFORE UPDATE ON media_files FOR EACH ROW EXECUTE FUNCTION protect_clean_media();
