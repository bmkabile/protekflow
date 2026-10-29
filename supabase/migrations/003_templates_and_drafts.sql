-- 003_templates_and_drafts.sql
-- Templates as data, richer intake, AI draft tracking, and private storage for signed PDFs.
-- Safe to re-run. Review the notes at the bottom if your live database already has
-- project_types / she_templates tables with different columns (they were referenced by the
-- app but never created by a migration).

-- 1. Project types and versioned templates
CREATE TABLE IF NOT EXISTS project_types (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code          TEXT UNIQUE NOT NULL,
  label         TEXT NOT NULL,
  requires_chsm BOOLEAN NOT NULL DEFAULT false,   -- needs a Construction H&S Manager level signer
  high_risk     BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS she_templates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_type_id UUID NOT NULL REFERENCES project_types(id),
  version         TEXT NOT NULL DEFAULT '1.0',
  content         TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_type_id, version)
);

-- 2. Columns on she_files used by intake, drafting and storage
ALTER TABLE she_files
  ADD COLUMN IF NOT EXISTS project_type_id     UUID REFERENCES project_types(id),
  ADD COLUMN IF NOT EXISTS template_id         UUID REFERENCES she_templates(id),
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

-- 3. Access: templates are your IP and only the server (service role) reads them.
--    Project types are readable by signed-in users (intake dropdown).
ALTER TABLE project_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE she_templates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Signed-in users can read active project types" ON project_types
    FOR SELECT TO authenticated USING (is_active);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Signed PDFs: private bucket. Downloads go through /api/files/[id]/download,
--    which checks ownership and issues a short-lived signed link.
INSERT INTO storage.buckets (id, name, public)
VALUES ('signed-files', 'signed-files', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- NOTE: if the app already created she_templates / project_types in your live database with
-- other columns or NOT NULL columns (e.g. prices), CREATE TABLE IF NOT EXISTS leaves them
-- unchanged and the seed in 004 may need adjusting. Also remove any old storage policies on
-- bucket 'signed-files' that allow public reads (Supabase dashboard -> Storage -> Policies).
