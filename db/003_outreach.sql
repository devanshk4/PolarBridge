CREATE TABLE outreach_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), family_id uuid NOT NULL,
 version integer NOT NULL, owner_id text NOT NULL REFERENCES "user"(id),
 payload jsonb NOT NULL, status text NOT NULL DEFAULT 'draft'
 CHECK(status IN ('draft','in_review','changes_requested','approved','published','superseded','withdrawn')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(family_id,version)
);
CREATE TABLE outreach_sources (
 output_id uuid NOT NULL REFERENCES outreach_revisions(id),
 resource_id uuid NOT NULL, revision_id uuid NOT NULL,
 PRIMARY KEY(output_id,revision_id),
 FOREIGN KEY(resource_id,revision_id) REFERENCES catalogue_revisions(resource_id,id)
);
CREATE TABLE outreach_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), output_id uuid NOT NULL REFERENCES outreach_revisions(id),
 actor_id text NOT NULL REFERENCES "user"(id), action text NOT NULL,
 comment text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE outreach_ai_clearance (
 revision_id uuid PRIMARY KEY REFERENCES catalogue_revisions(id),
 cleared_by text NOT NULL REFERENCES "user"(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE outreach_generation_runs (
 id uuid PRIMARY KEY, actor_id text NOT NULL REFERENCES "user"(id),
 model text NOT NULL, prompt_version text NOT NULL, source_ids jsonb NOT NULL,
 status text NOT NULL CHECK(status IN ('running','completed','failed')),
 usage jsonb, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
CREATE INDEX outreach_owner_idx ON outreach_revisions(owner_id,created_at DESC);
CREATE INDEX outreach_source_idx ON outreach_sources(resource_id,revision_id);
CREATE OR REPLACE FUNCTION protect_outreach_content() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.payload IS DISTINCT FROM OLD.payload OR NEW.family_id IS DISTINCT FROM OLD.family_id OR NEW.version IS DISTINCT FROM OLD.version OR NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
 RAISE EXCEPTION 'Outreach content is immutable; save a new revision'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_outreach BEFORE UPDATE ON outreach_revisions FOR EACH ROW EXECUTE FUNCTION protect_outreach_content();
CREATE TRIGGER immutable_outreach_events BEFORE UPDATE OR DELETE ON outreach_events FOR EACH ROW EXECUTE FUNCTION protect_editorial_history();
CREATE TRIGGER immutable_outreach_sources BEFORE UPDATE OR DELETE ON outreach_sources FOR EACH ROW EXECUTE FUNCTION protect_editorial_history();
CREATE OR REPLACE FUNCTION invalidate_outreach_sources() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.published_revision_id IS DISTINCT FROM NEW.published_revision_id THEN
 UPDATE outreach_revisions SET status=CASE WHEN status='published' THEN 'withdrawn' ELSE 'changes_requested' END
 WHERE status IN ('published','approved','in_review') AND id IN
 (SELECT output_id FROM outreach_sources WHERE resource_id=OLD.id AND revision_id=OLD.published_revision_id);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER outreach_source_changed AFTER UPDATE OF published_revision_id ON catalogue_resources FOR EACH ROW EXECUTE FUNCTION invalidate_outreach_sources();
