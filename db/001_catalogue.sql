CREATE TABLE IF NOT EXISTS staff_members (
 user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE RESTRICT,
 role text NOT NULL CHECK(role IN ('contributor','reviewer','publisher')),
 active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS catalogue_resources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL UNIQUE,
 owner_id text NOT NULL REFERENCES "user"(id),
 current_revision_id uuid, published_revision_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS catalogue_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), resource_id uuid NOT NULL REFERENCES catalogue_resources(id),
 revision_no integer NOT NULL CHECK(revision_no>0), payload jsonb NOT NULL,
 created_by text NOT NULL REFERENCES "user"(id),
 status text NOT NULL CHECK(status IN ('draft','in_review','changes_requested','approved','published','superseded','withdrawn')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(resource_id,revision_no), UNIQUE(resource_id,id)
);
ALTER TABLE catalogue_resources ADD CONSTRAINT catalogue_current_revision_fk FOREIGN KEY(id,current_revision_id) REFERENCES catalogue_revisions(resource_id,id);
ALTER TABLE catalogue_resources ADD CONSTRAINT catalogue_published_revision_fk FOREIGN KEY(id,published_revision_id) REFERENCES catalogue_revisions(resource_id,id);
CREATE TABLE IF NOT EXISTS editorial_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), revision_id uuid NOT NULL REFERENCES catalogue_revisions(id),
 reviewer_id text NOT NULL REFERENCES "user"(id), decision text NOT NULL CHECK(decision IN ('approve','request_changes')),
 comment text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS editorial_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), resource_id uuid NOT NULL REFERENCES catalogue_resources(id),
 revision_id uuid NOT NULL REFERENCES catalogue_revisions(id), actor_id text NOT NULL REFERENCES "user"(id),
 action text NOT NULL, comment text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX catalogue_owner_idx ON catalogue_resources(owner_id);
CREATE INDEX catalogue_status_idx ON catalogue_revisions(status);
CREATE INDEX editorial_review_idx ON editorial_reviews(revision_id,created_at DESC);
CREATE INDEX editorial_event_idx ON editorial_events(resource_id,created_at DESC);
CREATE INDEX catalogue_search_idx ON catalogue_revisions USING GIN(to_tsvector('english', coalesce(payload->>'title','') || ' ' || coalesce(payload->>'summary','') || ' ' || coalesce(payload->>'body','')));
CREATE OR REPLACE FUNCTION protect_revision_content() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.payload IS DISTINCT FROM OLD.payload OR NEW.resource_id IS DISTINCT FROM OLD.resource_id OR NEW.revision_no IS DISTINCT FROM OLD.revision_no OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
  RAISE EXCEPTION 'Revision content is immutable; create a new revision';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_revision BEFORE UPDATE ON catalogue_revisions FOR EACH ROW EXECUTE FUNCTION protect_revision_content();
CREATE OR REPLACE FUNCTION protect_editorial_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Editorial history is append only'; END $$;
CREATE TRIGGER immutable_events BEFORE UPDATE OR DELETE ON editorial_events FOR EACH ROW EXECUTE FUNCTION protect_editorial_history();
CREATE TRIGGER immutable_reviews BEFORE UPDATE OR DELETE ON editorial_reviews FOR EACH ROW EXECUTE FUNCTION protect_editorial_history();
