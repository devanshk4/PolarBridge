ALTER TABLE outreach_ai_clearance ADD COLUMN provider text NOT NULL DEFAULT 'openai' CHECK(provider IN ('openai','gemini'));
ALTER TABLE outreach_ai_clearance DROP CONSTRAINT outreach_ai_clearance_pkey;
ALTER TABLE outreach_ai_clearance ADD PRIMARY KEY(revision_id,provider);
ALTER TABLE outreach_generation_runs ADD COLUMN provider text NOT NULL DEFAULT 'openai' CHECK(provider IN ('openai','gemini'));
