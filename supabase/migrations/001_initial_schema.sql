-- ============================================================
-- ProtekFlow — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Enable UUID extension (already enabled on Supabase by default)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── ENUMS ────────────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('contractor', 'consultant', 'admin');
CREATE TYPE consultant_tier AS ENUM ('free', 'pro');
CREATE TYPE file_status AS ENUM (
  'draft',          -- contractor filling in wizard
  'payment_pending',-- awaiting PayFast payment
  'paid',           -- payment confirmed, queued for consultant
  'matched',        -- consultant assigned
  'in_review',      -- consultant working on it
  'awaiting_sign',  -- uploaded to DocuSeal, awaiting e-signature
  'signed',         -- e-signed by consultant
  'completed',      -- delivered to contractor
  'cancelled',      -- cancelled before completion
  'overdue'         -- 48h SLA breached
);
CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'paid', 'failed');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected', 'suspended');

-- ─── PROFILES (extends Supabase auth.users) ──────────────────────────────────

CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role            user_role NOT NULL DEFAULT 'contractor',
  full_name       TEXT NOT NULL,
  phone           TEXT,
  company_name    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CONTRACTORS ─────────────────────────────────────────────────────────────

CREATE TABLE contractors (
  id              UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  cidb_number     TEXT,
  cidb_grade      SMALLINT CHECK (cidb_grade BETWEEN 1 AND 9),
  vat_number      TEXT,
  address         TEXT,
  city            TEXT DEFAULT 'East London',
  province        TEXT DEFAULT 'Eastern Cape',
  total_files     INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CONSULTANTS ─────────────────────────────────────────────────────────────

CREATE TABLE consultants (
  id                    UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  sacpcmp_number        TEXT NOT NULL,               -- e.g. CHSO-12345
  sacpcmp_category      TEXT,                        -- CHSO, CHSE, CHSM
  sacpcmp_expiry        DATE,
  verification_status   verification_status DEFAULT 'pending',
  tier                  consultant_tier DEFAULT 'free',
  pro_started_at        TIMESTAMPTZ,
  bio                   TEXT,
  city                  TEXT DEFAULT 'East London',
  province              TEXT DEFAULT 'Eastern Cape',
  rating_avg            NUMERIC(3,2) DEFAULT 0,
  rating_count          INT DEFAULT 0,
  files_completed       INT DEFAULT 0,
  files_this_month      INT DEFAULT 0,
  is_available          BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SHE FILES (core entity) ─────────────────────────────────────────────────

CREATE TABLE she_files (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_number           TEXT UNIQUE,                 -- e.g. SHE-2025-0034
  contractor_id         UUID NOT NULL REFERENCES contractors(id),
  consultant_id         UUID REFERENCES consultants(id),

  -- Project details (from intake wizard)
  project_name          TEXT NOT NULL,
  project_address       TEXT NOT NULL,
  project_value         NUMERIC(12,2),               -- ZAR
  project_start_date    DATE,
  project_end_date      DATE,
  principal_contractor  TEXT,
  client_name           TEXT,
  site_agent            TEXT,

  -- Pricing
  price_zar             INT NOT NULL DEFAULT 450000,  -- cents
  volume_tier           TEXT DEFAULT 'standard',      -- standard, volume_a, volume_b, volume_c

  -- Status & workflow
  status                file_status DEFAULT 'draft',
  sla_deadline          TIMESTAMPTZ,                 -- set when status → paid
  matched_at            TIMESTAMPTZ,
  review_started_at     TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,

  -- DocuSeal integration
  docuseal_submission_id TEXT,
  docuseal_document_url  TEXT,                       -- signed PDF download URL
  docuseal_status        TEXT,                       -- 'pending', 'completed'

  -- PayFast
  payfast_payment_id     TEXT,
  paid_at                TIMESTAMPTZ,

  -- Meta
  notes                  TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generate file number trigger
CREATE SEQUENCE she_file_seq START 1;
CREATE OR REPLACE FUNCTION set_file_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.file_number := 'SHE-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('she_file_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_file_number
  BEFORE INSERT ON she_files
  FOR EACH ROW WHEN (NEW.file_number IS NULL)
  EXECUTE FUNCTION set_file_number();

-- ─── TRANSACTIONS ─────────────────────────────────────────────────────────────

CREATE TABLE transactions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  she_file_id           UUID NOT NULL REFERENCES she_files(id),
  contractor_id         UUID NOT NULL REFERENCES contractors(id),
  consultant_id         UUID REFERENCES consultants(id),

  -- Amounts in ZAR cents
  gross_amount          INT NOT NULL,               -- what contractor paid
  platform_fee_pct      SMALLINT NOT NULL,          -- 25 or 15
  platform_fee_amount   INT NOT NULL,               -- fee taken
  consultant_amount     INT NOT NULL,               -- consultant earns

  payfast_payment_id    TEXT,
  payout_status         payout_status DEFAULT 'pending',
  payout_reference      TEXT,
  paid_to_consultant_at TIMESTAMPTZ,

  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PRO SUBSCRIPTIONS ────────────────────────────────────────────────────────

CREATE TABLE pro_subscriptions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consultant_id         UUID NOT NULL REFERENCES consultants(id),
  started_at            TIMESTAMPTZ DEFAULT NOW(),
  ends_at               TIMESTAMPTZ,
  amount_cents          INT DEFAULT 99900,           -- R999.00
  payfast_token         TEXT,                       -- for recurring billing
  is_active             BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─── REVIEWS ──────────────────────────────────────────────────────────────────

CREATE TABLE reviews (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  she_file_id           UUID NOT NULL REFERENCES she_files(id),
  contractor_id         UUID NOT NULL REFERENCES contractors(id),
  consultant_id         UUID NOT NULL REFERENCES consultants(id),
  rating                SMALLINT CHECK (rating BETWEEN 1 AND 5),
  comment               TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Update consultant rating avg on new review
CREATE OR REPLACE FUNCTION update_consultant_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE consultants
  SET
    rating_avg = (
      SELECT ROUND(AVG(rating)::NUMERIC, 2)
      FROM reviews WHERE consultant_id = NEW.consultant_id
    ),
    rating_count = (
      SELECT COUNT(*) FROM reviews WHERE consultant_id = NEW.consultant_id
    )
  WHERE id = NEW.consultant_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_rating
  AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_consultant_rating();

-- ─── SHE FILE SECTIONS (JSON content from wizard) ────────────────────────────

CREATE TABLE she_file_sections (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  she_file_id           UUID NOT NULL REFERENCES she_files(id) ON DELETE CASCADE,
  section_key           TEXT NOT NULL,  -- e.g. 'site_info', 'hazard_identification', 'emergency_plan'
  content               JSONB,
  is_complete           BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(she_file_id, section_key)
);

-- ─── ROW LEVEL SECURITY (RLS) ────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultants ENABLE ROW LEVEL SECURITY;
ALTER TABLE she_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE she_file_sections ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read their own
CREATE POLICY "Users read own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Contractors: read own data
CREATE POLICY "Contractors read own"
  ON contractors FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Contractors update own"
  ON contractors FOR UPDATE USING (auth.uid() = id);

-- Consultants: read own data; contractors can read verified consultants
CREATE POLICY "Consultants read own"
  ON consultants FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Anyone can view verified consultants"
  ON consultants FOR SELECT
  USING (verification_status = 'verified');

-- SHE Files: contractor sees own, consultant sees assigned
CREATE POLICY "Contractors see own files"
  ON she_files FOR SELECT USING (
    auth.uid() = contractor_id
  );
CREATE POLICY "Contractors insert files"
  ON she_files FOR INSERT WITH CHECK (auth.uid() = contractor_id);
CREATE POLICY "Consultants see assigned files"
  ON she_files FOR SELECT USING (
    auth.uid() = consultant_id
  );
CREATE POLICY "Consultants update assigned files"
  ON she_files FOR UPDATE USING (auth.uid() = consultant_id);

-- Transactions: own role only
CREATE POLICY "Contractors see own transactions"
  ON transactions FOR SELECT USING (auth.uid() = contractor_id);
CREATE POLICY "Consultants see own transactions"
  ON transactions FOR SELECT USING (auth.uid() = consultant_id);

-- ─── ADMIN BYPASS POLICIES ────────────────────────────────────────────────────
-- Admins use service_role key — bypasses RLS entirely. No extra policies needed.

-- ─── USEFUL VIEWS ────────────────────────────────────────────────────────────

CREATE VIEW v_file_summary AS
SELECT
  sf.id,
  sf.file_number,
  sf.status,
  sf.price_zar,
  sf.volume_tier,
  sf.sla_deadline,
  sf.completed_at,
  sf.docuseal_document_url,
  sf.created_at,
  -- Contractor
  cp.full_name        AS contractor_name,
  cp.company_name     AS contractor_company,
  -- Consultant
  csp.full_name       AS consultant_name,
  cs.sacpcmp_number   AS consultant_sacpcmp,
  cs.tier             AS consultant_tier,
  -- Project
  sf.project_name,
  sf.project_address,
  sf.project_value
FROM she_files sf
JOIN profiles cp ON cp.id = sf.contractor_id
LEFT JOIN profiles csp ON csp.id = sf.consultant_id
LEFT JOIN consultants cs ON cs.id = sf.consultant_id;

-- ─── PLATFORM CONFIG ─────────────────────────────────────────────────────────

CREATE TABLE platform_config (
  key     TEXT PRIMARY KEY,
  value   TEXT NOT NULL,
  note    TEXT
);

INSERT INTO platform_config (key, value, note) VALUES
  ('file_price_standard',    '450000',  'ZAR cents — R4,500'),
  ('file_price_volume_a',    '412500',  'ZAR cents — R4,125 (3–5 files)'),
  ('file_price_volume_b',    '362500',  'ZAR cents — R3,625 (6–11 files)'),
  ('file_price_volume_c',    '312500',  'ZAR cents — R3,125 (12+ files)'),
  ('pro_monthly_fee',        '99900',   'ZAR cents — R999/month'),
  ('platform_fee_free_pct',  '25',      'Percentage — Free tier'),
  ('platform_fee_pro_pct',   '15',      'Percentage — Pro tier'),
  ('sla_hours',              '48',      'Hours — SHE file delivery SLA');
