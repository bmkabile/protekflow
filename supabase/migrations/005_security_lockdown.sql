-- 005_security_lockdown.sql
-- Closes holes found in the live database, and fixes account creation.
-- All writes now go through the app's server routes (service role), so browser-side
-- INSERT/UPDATE policies are removed. Safe to re-run.

-- 1. No browser-side writes. Before this, any signed-in user could, with the public key:
--    make themselves admin (profiles), self-verify as a consultant (consultants),
--    create files with any price or status (she_files) or edit assigned files freely.
DROP POLICY IF EXISTS "Users insert own profile"        ON profiles;
DROP POLICY IF EXISTS "Users update own profile"        ON profiles;
DROP POLICY IF EXISTS "Contractors insert own"          ON contractors;
DROP POLICY IF EXISTS "Contractors update own"          ON contractors;
DROP POLICY IF EXISTS "Consultants insert own"          ON consultants;
DROP POLICY IF EXISTS "Consultants update own"          ON consultants;
DROP POLICY IF EXISTS "Contractors insert files"        ON she_files;
DROP POLICY IF EXISTS "Consultants update assigned"     ON she_files;

-- 2. Templates are your IP: no public read
DROP POLICY IF EXISTS "Anyone can read active templates" ON she_templates;

-- 3. Storage: the server uses the service role (which bypasses these rules), so browsers get no
--    access to any of these buckets. The old rules let anyone upload to / overwrite / read
--    signed files.
DROP POLICY IF EXISTS "Authenticated users can read signed files" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update signed files"      ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload signed files"      ON storage.objects;
DROP POLICY IF EXISTS "consultant own signature"                  ON storage.objects;
DROP POLICY IF EXISTS "consultant upload pdf"                     ON storage.objects;
DROP POLICY IF EXISTS "contractor read pdf"                       ON storage.objects;
UPDATE storage.buckets SET public = false WHERE id IN ('signed-files', 'signed-pdfs', 'signatures');

-- 4. Account creation: create the profile (and contractor/consultant row) inside the database
--    when a user signs up. Doing it from the browser failed whenever email confirmation was on,
--    leaving accounts with no profile. The role comes from sign-up metadata but can only ever be
--    contractor or consultant; admin is granted manually.
CREATE OR REPLACE FUNCTION public.create_profile_for_user(uid uuid, user_email text, meta jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.user_role;
BEGIN
  r := CASE WHEN meta->>'role' = 'consultant'
            THEN 'consultant'::public.user_role ELSE 'contractor'::public.user_role END;

  INSERT INTO public.profiles (id, role, full_name, company_name, phone)
  VALUES (
    uid, r,
    COALESCE(NULLIF(btrim(meta->>'full_name'), ''), split_part(user_email, '@', 1)),
    NULLIF(btrim(meta->>'company_name'), ''),
    NULLIF(btrim(meta->>'phone'), '')
  ) ON CONFLICT (id) DO NOTHING;

  IF r = 'contractor' THEN
    INSERT INTO public.contractors (id, cidb_number)
    VALUES (uid, NULLIF(btrim(meta->>'cidb_number'), ''))
    ON CONFLICT (id) DO NOTHING;
  ELSE
    INSERT INTO public.consultants (id, sacpcmp_number)
    VALUES (uid, COALESCE(NULLIF(btrim(meta->>'sacpcmp_number'), ''), 'NOT PROVIDED'))
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.create_profile_for_user(NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data, '{}'::jsonb));
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.create_profile_for_user(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Backfill accounts created before the trigger existed (they have no profile)
DO $$
DECLARE u RECORD;
BEGIN
  FOR u IN SELECT a.id, a.email, a.raw_user_meta_data FROM auth.users a
           WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = a.id)
  LOOP
    PERFORM public.create_profile_for_user(u.id, u.email, COALESCE(u.raw_user_meta_data, '{}'::jsonb));
  END LOOP;
END $$;

-- 6. Internal functions are for the server only
REVOKE EXECUTE ON FUNCTION public.increment_consultant_files(uuid) FROM PUBLIC, anon, authenticated;
