-- 005_security_and_signup_trigger.sql
-- Run AFTER 001-004, in Supabase Dashboard -> SQL Editor. Safe to re-run.
--
-- Fixes found in the build review:
--  A. Signup never created profile rows when RLS was on (no INSERT policies, errors ignored),
--     so users could sign in but had no role. A trigger now creates the rows.
--  B. Users could set their own profiles.role = 'admin' (UPDATE policy had no column limit).
--  C. Consultants could mark themselves verified / pro / rate themselves (same cause).
--  D. Contractors could insert a she_files row as status='paid' with price_zar=0, and
--     consultants could rewrite any column of an assigned file, straight from the browser.
--     Every legitimate write already goes through API routes using the service role.

-- ─── A. Create profile rows when an auth user is created ─────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r user_role;
  meta JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
BEGIN
  -- Never trust the client for 'admin': only contractor or consultant can self-register.
  r := CASE WHEN meta->>'role' = 'consultant' THEN 'consultant'::user_role ELSE 'contractor'::user_role END;

  INSERT INTO profiles (id, role, full_name, company_name, phone)
  VALUES (
    NEW.id, r,
    COALESCE(NULLIF(meta->>'full_name', ''), split_part(NEW.email, '@', 1)),
    NULLIF(meta->>'company_name', ''),
    NULLIF(meta->>'phone', '')
  )
  ON CONFLICT (id) DO NOTHING;

  IF r = 'contractor' THEN
    INSERT INTO contractors (id, cidb_number)
    VALUES (NEW.id, NULLIF(meta->>'cidb_number', ''))
    ON CONFLICT (id) DO NOTHING;
  ELSE
    INSERT INTO consultants (id, sacpcmp_number, verification_status)
    VALUES (NEW.id, COALESCE(NULLIF(meta->>'sacpcmp_number', ''), 'NOT PROVIDED'), 'pending')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: auth users that already exist but have no profile (signed up while inserts were failing).
INSERT INTO profiles (id, role, full_name)
SELECT u.id,
       CASE WHEN u.raw_user_meta_data->>'role' = 'consultant' THEN 'consultant'::user_role ELSE 'contractor'::user_role END,
       COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1))
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL;

INSERT INTO contractors (id)
SELECT p.id FROM profiles p LEFT JOIN contractors c ON c.id = p.id
WHERE p.role = 'contractor' AND c.id IS NULL;

INSERT INTO consultants (id, sacpcmp_number, verification_status)
SELECT p.id, 'NOT PROVIDED', 'pending' FROM profiles p LEFT JOIN consultants c ON c.id = p.id
WHERE p.role = 'consultant' AND c.id IS NULL;

-- ─── B + C. Column-level UPDATE: users may edit only harmless fields ─────────
REVOKE UPDATE ON profiles    FROM anon, authenticated;
REVOKE UPDATE ON contractors FROM anon, authenticated;
REVOKE UPDATE ON consultants FROM anon, authenticated;

GRANT UPDATE (full_name, phone, company_name, updated_at)                        ON profiles    TO authenticated;
GRANT UPDATE (cidb_number, cidb_grade, vat_number, address, city, province)       ON contractors TO authenticated;
GRANT UPDATE (bio, city, province, is_available)                                  ON consultants TO authenticated;
-- role, verification_status, tier, sacpcmp_*, ratings and counters can now only change via the service role.

-- ─── D. she_files: no direct browser writes ──────────────────────────────────
DROP POLICY IF EXISTS "Contractors insert files"          ON she_files;
DROP POLICY IF EXISTS "Consultants update assigned files" ON she_files;
REVOKE INSERT, UPDATE, DELETE ON she_files          FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON she_file_sections  FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON transactions       FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON reviews            FROM anon, authenticated;

-- ─── E. Consultant directory: stop exposing registration numbers to anonymous visitors ─
DROP POLICY IF EXISTS "Anyone can view verified consultants" ON consultants;
CREATE POLICY "Signed-in users can view verified consultants"
  ON consultants FOR SELECT TO authenticated
  USING (verification_status = 'verified');

-- ─── Sanity check (run separately; every row should read as shown) ───────────
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' ORDER BY 1;   -- all true
-- SELECT count(*) AS users_without_profile FROM auth.users u LEFT JOIN profiles p ON p.id=u.id WHERE p.id IS NULL;  -- 0
