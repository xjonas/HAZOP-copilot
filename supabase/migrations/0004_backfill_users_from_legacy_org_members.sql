-- Optional backfill for environments migrating from legacy org_members mapping.
-- Safe for fresh 0001 schema: this migration no-ops when legacy table/columns are missing.

DO $$
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE NOTICE 'Skipping backfill: public.users does not exist';
    RETURN;
  END IF;

  IF to_regclass('public.org_members') IS NULL THEN
    RAISE NOTICE 'Skipping backfill: public.org_members does not exist';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'org_members'
      AND column_name = 'external_user_id'
  ) THEN
    RAISE NOTICE 'Skipping backfill: public.org_members.external_user_id does not exist';
    RETURN;
  END IF;

  INSERT INTO public.users (cognito_sub, email, full_name, org_id, role)
  SELECT DISTINCT
    om.external_user_id,
    CONCAT(om.external_user_id, '@mvp.local') AS email,
    NULLIF(om.display_name, '') AS full_name,
    om.org_id,
    CASE
      WHEN om.role IN ('owner', 'admin', 'member') THEN om.role
      ELSE 'member'
    END AS role
  FROM public.org_members om
  WHERE om.external_user_id IS NOT NULL
    AND om.external_user_id <> ''
  ON CONFLICT (cognito_sub)
  DO UPDATE SET
    org_id = COALESCE(public.users.org_id, EXCLUDED.org_id),
    full_name = COALESCE(public.users.full_name, EXCLUDED.full_name),
    role = CASE
      WHEN public.users.role IN ('owner', 'admin', 'member') THEN public.users.role
      ELSE EXCLUDED.role
    END,
    updated_at = now();
END;
$$;
