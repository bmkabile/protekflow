-- 002_flat_pricing_and_integrity.sql
-- Flat R7,500 file price with a 20% platform fee, payment integrity, and closing RLS gaps.
-- Run in the Supabase SQL editor (or `supabase db push`). Safe to re-run.

-- 1. Pricing config
UPDATE platform_config SET value = '750000', note = 'ZAR cents - R7,500' WHERE key = 'file_price_standard';
DELETE FROM platform_config WHERE key IN (
  'file_price_volume_a', 'file_price_volume_b', 'file_price_volume_c',
  'pro_monthly_fee', 'platform_fee_free_pct', 'platform_fee_pro_pct'
);
INSERT INTO platform_config (key, value, note)
VALUES ('platform_fee_pct', '20', 'Percentage - flat platform fee (professional receives the rest)')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, note = EXCLUDED.note;
ALTER TABLE she_files ALTER COLUMN price_zar SET DEFAULT 750000;

-- 2. One ledger row per payment and per file (stops duplicate ITNs double-recording).
--    If this fails, you have duplicate rows already: resolve them, then re-run.
CREATE UNIQUE INDEX IF NOT EXISTS transactions_payfast_payment_id_key
  ON transactions (payfast_payment_id) WHERE payfast_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS transactions_she_file_id_key ON transactions (she_file_id);

-- 3. These tables had no row-level security, so the public anon key could read/write them.
--    The app uses the service role for them, which bypasses RLS.
ALTER TABLE platform_config   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_subscriptions ENABLE ROW LEVEL SECURITY;

-- 4. The summary view joins profiles/files; run it with the caller's permissions (Postgres 15+)
ALTER VIEW v_file_summary SET (security_invoker = true);

-- 5. RPC used by the app after a file is signed (was only a comment in the code).
CREATE OR REPLACE FUNCTION increment_consultant_files(consultant_uuid UUID)
RETURNS void AS $$
  UPDATE consultants
  SET files_completed = files_completed + 1,
      files_this_month = files_this_month + 1
  WHERE id = consultant_uuid;
$$ LANGUAGE sql;
REVOKE EXECUTE ON FUNCTION increment_consultant_files(UUID) FROM PUBLIC, anon, authenticated;
