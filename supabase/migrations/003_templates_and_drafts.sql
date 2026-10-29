-- 003_templates_and_drafts.sql
-- Templates as data, richer intake, AI draft tracking. Matches the live database, where
-- project_types and she_templates use integer ids. Safe to re-run, and also builds them
-- from scratch on a fresh database created from 001.

-- 1. Project types and versioned templates
CREATE TABLE IF NOT EXISTS project_types (
  id            SERIAL PRIMARY KEY,
  code          TEXT UNIQUE NOT NULL,
  label         TEXT NOT NULL,
  description   TEXT,
  requires_chsm BOOLEAN DEFAULT false,
  high_risk     BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE project_types ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
-- Pricing is flat now (see pricing.ts), so the per-type prices are retired
ALTER TABLE project_types DROP COLUMN IF EXISTS price_standard;
ALTER TABLE project_types DROP COLUMN IF EXISTS price_complex;

CREATE TABLE IF NOT EXISTS she_templates (
  id                        SERIAL PRIMARY KEY,
  project_type_id           INTEGER REFERENCES project_types(id),
  version                   TEXT NOT NULL DEFAULT '1.0',
  content                   TEXT NOT NULL,
  section_count             INTEGER,
  customisation_minutes_min INTEGER DEFAULT 30,
  customisation_minutes_max INTEGER DEFAULT 45,
  is_active                 BOOLEAN DEFAULT true,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE she_templates ADD COLUMN IF NOT EXISTS notes TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS she_templates_type_version_key ON she_templates (project_type_id, version);

-- 2. Columns on she_files used by intake, drafting, review and storage
ALTER TABLE she_files
  ADD COLUMN IF NOT EXISTS project_type_id     INTEGER REFERENCES project_types(id),
  ADD COLUMN IF NOT EXISTS template_id         INTEGER REFERENCES she_templates(id),
  ADD COLUMN IF NOT EXISTS template_version    TEXT,
  ADD COLUMN IF NOT EXISTS wizard_data         JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_complex          BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS generated_draft     TEXT,
  ADD COLUMN IF NOT EXISTS draft_status        TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS draft_attempts      INT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS draft_started_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS draft_generated_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS draft_report        JSONB,
  ADD COLUMN IF NOT EXISTS review_state        JSONB,
  ADD COLUMN IF NOT EXISTS signed_pdf_path     TEXT,
  ADD COLUMN IF NOT EXISTS signed_pdf_sha256   TEXT;

DO $$ BEGIN
  ALTER TABLE she_files ADD CONSTRAINT she_files_draft_status_check
    CHECK (draft_status IN ('pending','generating','ready','failed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Row-level security. Templates are your IP: no policy at all, so only the server
--    (service role) can read them. Project types may be read by anyone signed in or not.
ALTER TABLE project_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE she_templates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Anyone can read project types" ON project_types FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Signed PDFs live in a private bucket, reached only through /api/files/[id]/download
INSERT INTO storage.buckets (id, name, public)
VALUES ('signed-files', 'signed-files', false)
ON CONFLICT (id) DO UPDATE SET public = false;
