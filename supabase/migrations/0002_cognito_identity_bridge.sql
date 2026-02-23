-- Cognito identity bridge for MVP auth migration
-- Allows mapping AWS Cognito `sub` values while keeping existing Supabase/Postgres data.

ALTER TABLE public.org_members
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.org_members
  ADD COLUMN IF NOT EXISTS external_user_id TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT;

CREATE INDEX IF NOT EXISTS idx_org_members_external_user_id
  ON public.org_members (external_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_org_members_org_external_user
  ON public.org_members (org_id, external_user_id)
  WHERE external_user_id IS NOT NULL;
