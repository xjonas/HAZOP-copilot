-- ============================================================
-- HAZOP-copilot — AWS RDS PostgreSQL Schema
-- No RLS, no auth.users, no Supabase storage
-- User identity = Cognito sub (UUID stored as text)
-- ============================================================

-- ─── Extensions ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- for gen_random_uuid()

-- ============================================================
-- CORE IDENTITY & ORG TABLES
-- ============================================================

-- ─── Users (replaces auth.users + profiles) ─────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cognito_sub    TEXT NOT NULL UNIQUE,           -- Cognito User Pool sub (immutable)
  email          TEXT NOT NULL UNIQUE,
  full_name      TEXT,
  avatar_url     TEXT,
  org_id         UUID,                           -- populated after org_members FK below
  role           TEXT NOT NULL DEFAULT 'member'
                   CHECK (role IN ('owner', 'admin', 'member')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Orgs ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orgs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Now add the FK from users.org_id → orgs.id
ALTER TABLE public.users
  ADD CONSTRAINT fk_users_org
  FOREIGN KEY (org_id) REFERENCES public.orgs(id);

-- ============================================================
-- APPLICATION DATA TABLES
-- ============================================================

-- ─── Projects ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'planning'
                        CHECK (status IN ('planning','active','in-progress','review','completed')),
  process_description TEXT,
  deadline            DATE,
  location            TEXT,
  responsible_person  TEXT,
  progress            INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  workflow_stage      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Project Files (metadata — actual files in S3) ──────────
CREATE TABLE IF NOT EXISTS public.project_files (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name    TEXT NOT NULL,
  storage_path TEXT NOT NULL,            -- S3 key, e.g. "pid-files/<project_id>/<uuid>.pdf"
  mime_type    TEXT NOT NULL DEFAULT 'application/pdf',
  size_bytes   BIGINT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Tasks (objects + nodes from P&ID) ───────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_type            TEXT NOT NULL CHECK (task_type IN ('object','node')),
  title                TEXT NOT NULL,
  description          TEXT,
  status               TEXT NOT NULL DEFAULT 'pending',
  display_order        INTEGER NOT NULL DEFAULT 0,
  -- structured node fields
  operating_conditions TEXT,
  position             TEXT,
  connections          TEXT,
  chemicals            TEXT,
  design_intent        TEXT,
  boundaries           TEXT,
  equipment_tags       TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── HAZOP Rows (analysis per node-task) ─────────────────────
CREATE TABLE IF NOT EXISTS public.hazop_rows (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_task_id    UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  guide_word      TEXT NOT NULL DEFAULT '',
  parameter       TEXT NOT NULL DEFAULT '',
  deviation       TEXT NOT NULL DEFAULT '',
  causes          TEXT NOT NULL DEFAULT '',
  consequences    TEXT NOT NULL DEFAULT '',
  safeguards      TEXT NOT NULL DEFAULT '',
  recommendations TEXT NOT NULL DEFAULT '',
  severity        INTEGER NOT NULL DEFAULT 1 CHECK (severity BETWEEN 1 AND 5),
  likelihood      INTEGER NOT NULL DEFAULT 1 CHECK (likelihood BETWEEN 1 AND 5),
  display_order   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ─── Meetings ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meetings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  date           TIMESTAMPTZ NOT NULL DEFAULT now(),
  attendees      JSONB NOT NULL DEFAULT '[]',
  notes          TEXT NOT NULL DEFAULT '',
  summary        TEXT,
  transcript     TEXT,
  recording      BOOLEAN NOT NULL DEFAULT false,
  recording_path TEXT,                    -- S3 key for recording file
  duration       TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- ─── Auto-update updated_at ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.hazop_rows
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_users_cognito_sub    ON public.users(cognito_sub);
CREATE INDEX idx_projects_org         ON public.projects(org_id);
CREATE INDEX idx_project_files_proj   ON public.project_files(project_id);
CREATE INDEX idx_tasks_proj           ON public.tasks(project_id);
CREATE INDEX idx_tasks_type           ON public.tasks(project_id, task_type);
CREATE INDEX idx_hazop_rows_node      ON public.hazop_rows(node_task_id);
CREATE INDEX idx_meetings_proj        ON public.meetings(project_id);
