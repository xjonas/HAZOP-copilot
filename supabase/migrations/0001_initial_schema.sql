-- ============================================================
-- FULL MIGRATION — paste this entire block into Supabase SQL Editor
-- ============================================================

-- 1. Create ALL tables
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now() not null
);

create table if not exists public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz default now() not null,
  unique (org_id, user_id)
);

-- 2. Enable RLS
alter table public.profiles enable row level security;
alter table public.orgs enable row level security;
alter table public.org_members enable row level security;

-- 3. RLS Policies
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Org members can view org"
  on public.orgs for select
  using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = orgs.id
        and org_members.user_id = auth.uid()
    )
  );

create policy "Users can view own org memberships"
  on public.org_members for select
  using (auth.uid() = user_id);

create policy "Org admins can add members"
  on public.org_members for insert
  with check (
    exists (
      select 1 from public.org_members
      where org_members.org_id = org_id
        and org_members.user_id = auth.uid()
        and org_members.role in ('owner', 'admin')
    )
  );

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as '
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> ''full_name'',
    new.raw_user_meta_data ->> ''avatar_url''
  );
  return new;
end;
';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

ALTER TABLE public.profiles
  ADD COLUMN org_id UUID REFERENCES public.orgs(id);
-- ============================================================
-- MIGRATION 0002: Application Data Tables
-- Paste this entire block into Supabase SQL Editor
-- ============================================================
-- ALSO: Create a Storage bucket called "pid-files" via Dashboard:
--   - Public: No (private)
--   - File size limit: 50 MB
--   - Allowed MIME types: application/pdf
-- ============================================================

-- ─── Projects ───────────────────────────────────────────────
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs(id) on delete cascade,
  created_by    uuid not null references auth.users(id) on delete set null,
  name          text not null,
  description   text,
  status        text not null default 'planning'
                  check (status in ('planning','active','in-progress','review','completed')),
  process_description text,
  deadline      date,
  location      text,
  lead_person   text,
  responsible_person text,
  progress      integer not null default 0 check (progress between 0 and 100),
  workflow_stage text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── Project Files (PDF metadata — actual files in Storage) ─
create table if not exists public.project_files (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  file_name     text not null,
  storage_path  text not null,
  mime_type     text not null default 'application/pdf',
  size_bytes    bigint,
  uploaded_by   uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- ─── Tasks (objects + nodes detected from P&ID) ─────────────
create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  task_type     text not null check (task_type in ('object','node')),
  title         text not null,
  description   text,
  status        text not null default 'pending',
  display_order integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── HAZOP Rows (analysis per node-task) ─────────────────────
create table if not exists public.hazop_rows (
  id               uuid primary key default gen_random_uuid(),
  node_task_id     uuid not null references public.tasks(id) on delete cascade,
  guide_word       text not null default '',
  parameter        text not null default '',
  deviation        text not null default '',
  causes           text not null default '',
  consequences     text not null default '',
  safeguards       text not null default '',
  recommendations  text not null default '',
  severity         integer not null default 1 check (severity between 1 and 5),
  likelihood       integer not null default 1 check (likelihood between 1 and 5),
  display_order    integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ─── Team Members ────────────────────────────────────────────
create table if not exists public.team_members (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  name          text not null,
  role          text not null default 'member',
  created_at    timestamptz not null default now()
);

-- ─── Meetings ────────────────────────────────────────────────
create table if not exists public.meetings (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  title         text not null,
  date          timestamptz not null default now(),
  attendees     jsonb not null default '[]',
  notes         text not null default '',
  summary       text,
  transcript    text,
  recording     boolean not null default false,
  duration      text,
  created_at    timestamptz not null default now()
);


-- ─── Enable RLS on all tables ────────────────────────────────
alter table public.projects      enable row level security;
alter table public.project_files enable row level security;
alter table public.tasks         enable row level security;
alter table public.hazop_rows    enable row level security;
alter table public.team_members  enable row level security;
alter table public.meetings      enable row level security;


-- ─── RLS Helper: "user is member of project's org" ──────────
create or replace function public.user_has_project_access(p_project_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.projects p
    join public.org_members om on om.org_id = p.org_id
    where p.id = p_project_id
      and om.user_id = auth.uid()
  );
$$;


-- ─── RLS Policies: projects ─────────────────────────────────
create policy "Org members can view projects"
  on public.projects for select
  using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = projects.org_id
        and org_members.user_id = auth.uid()
    )
  );

create policy "Org members can insert projects"
  on public.projects for insert
  with check (
    exists (
      select 1 from public.org_members
      where org_members.org_id = projects.org_id
        and org_members.user_id = auth.uid()
    )
  );

create policy "Org members can update projects"
  on public.projects for update
  using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = projects.org_id
        and org_members.user_id = auth.uid()
    )
  );

create policy "Org members can delete projects"
  on public.projects for delete
  using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = projects.org_id
        and org_members.user_id = auth.uid()
    )
  );


-- ─── RLS Policies: child tables (via helper function) ────────
create policy "Access project files" on public.project_files
  for all using (public.user_has_project_access(project_id));

create policy "Access tasks" on public.tasks
  for all using (public.user_has_project_access(project_id));

create policy "Access hazop rows" on public.hazop_rows
  for all using (
    exists (
      select 1 from public.tasks t
      where t.id = hazop_rows.node_task_id
        and public.user_has_project_access(t.project_id)
    )
  );

create policy "Access team members" on public.team_members
  for all using (public.user_has_project_access(project_id));

create policy "Access meetings" on public.meetings
  for all using (public.user_has_project_access(project_id));


-- ─── Auto-update updated_at trigger ─────────────────────────
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.projects
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.tasks
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.hazop_rows
  for each row execute function public.handle_updated_at();


-- ─── Indexes ─────────────────────────────────────────────────
create index idx_projects_org       on public.projects(org_id);
create index idx_projects_created_by on public.projects(created_by);
create index idx_project_files_proj on public.project_files(project_id);
create index idx_tasks_proj         on public.tasks(project_id);
create index idx_tasks_type         on public.tasks(project_id, task_type);
create index idx_hazop_rows_node    on public.hazop_rows(node_task_id);
create index idx_team_members_proj  on public.team_members(project_id);
create index idx_meetings_proj      on public.meetings(project_id);
-- ============================================================
-- MIGRATION 0003: Storage RLS Policies for pid-files bucket
-- Run this in Supabase SQL Editor
-- ============================================================

-- Allow authenticated users to upload files to pid-files bucket
create policy "Authenticated users can upload pid files"
on storage.objects for insert
to authenticated
with check (
    bucket_id = 'pid-files'
);

-- Allow authenticated users to read/download files from pid-files bucket
create policy "Authenticated users can read pid files"
on storage.objects for select
to authenticated
using (
    bucket_id = 'pid-files'
);

-- Allow authenticated users to update (overwrite) files in pid-files bucket
create policy "Authenticated users can update pid files"
on storage.objects for update
to authenticated
using (
    bucket_id = 'pid-files'
);

-- Allow authenticated users to delete files from pid-files bucket
create policy "Authenticated users can delete pid files"
on storage.objects for delete
to authenticated
using (
    bucket_id = 'pid-files'
);
-- ============================================================
-- MIGRATION 0004: AI/Agent Call Tracker
-- ============================================================

create table if not exists public.ai_runs (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  run_type      text not null check (run_type in (
                  'object_detection', 'node_detection', 'hazop_analysis', 'other'
                )),
  status        text not null default 'pending' check (status in (
                  'pending', 'running', 'completed', 'failed'
                )),
  model         text not null,
  provider      text not null default 'dedalus',

  -- Request metadata
  prompt_tokens     integer,
  completion_tokens integer,
  total_tokens      integer,
  latency_ms        integer,

  -- Input/output snapshots for debugging
  input_summary   text,
  output_summary  text,
  raw_response    jsonb,
  error_message   text,

  -- Audit
  triggered_by  uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

-- Index for fast lookups
create index idx_ai_runs_project on public.ai_runs(project_id, created_at desc);
create index idx_ai_runs_status  on public.ai_runs(status) where status in ('pending', 'running');

-- RLS
alter table public.ai_runs enable row level security;

create policy "Access AI runs" on public.ai_runs
  for all using (public.user_has_project_access(project_id));

-- Updated_at trigger (reuse existing function)
create trigger set_updated_at_ai_runs
  before update on public.ai_runs
  for each row execute function public.handle_updated_at();
-- ============================================================
-- MIGRATION 0005: Enhance AI/Task Scheme
-- ============================================================

-- 1. Add ocr_text to ai_runs for debugging OCR quality
alter table public.ai_runs
add column if not exists ocr_text text;

-- 2. Add structured data columns to tasks for better HAZOP analysis
alter table public.tasks
add column if not exists operating_conditions text,
add column if not exists position text,
add column if not exists connections text,
add column if not exists chemicals text;
-- Add recording_path to meetings table
ALTER TABLE public.meetings 
ADD COLUMN IF NOT EXISTS recording_path text;
-- Create a private bucket for meeting recordings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('meeting-recordings', 'meeting-recordings', false, 104857600, ARRAY['audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/mp4', 'video/mp4', 'video/webm', 'audio/webm', 'audio/ogg'])
ON CONFLICT (id) DO UPDATE SET allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS Policies for meeting-recordings bucket

-- POLICY: Authenticated users can upload to meeting-recordings
CREATE POLICY "Authenticated users can upload meeting recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'meeting-recordings'
);

-- POLICY: Authenticated users can read valid meeting recordings
CREATE POLICY "Authenticated users can read meeting recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'meeting-recordings'
);

-- POLICY: Authenticated users can update their recordings (if needed)
CREATE POLICY "Authenticated users can update meeting recordings"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'meeting-recordings'
);

-- POLICY: Authenticated users can delete recordings
CREATE POLICY "Authenticated users can delete meeting recordings"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'meeting-recordings'
);
-- Ensure recording_path column exists
ALTER TABLE public.meetings 
ADD COLUMN IF NOT EXISTS recording_path text;
-- Add meeting_summary and transcription to run_type check constraint
ALTER TABLE public.ai_runs DROP CONSTRAINT IF EXISTS ai_runs_run_type_check;

ALTER TABLE public.ai_runs ADD CONSTRAINT ai_runs_run_type_check 
    CHECK (run_type IN ('object_detection', 'node_detection', 'hazop_analysis', 'other', 'planning', 'chat', 'meeting_summary', 'transcription'));
-- ============================================================
-- MIGRATION: Enhance AI Runs for Observability (Alignment)
-- ============================================================

-- 1. Add missing observability columns to existing table
ALTER TABLE public.ai_runs
ADD COLUMN IF NOT EXISTS input_context JSONB,    -- Context like file names, user intent
ADD COLUMN IF NOT EXISTS prompt_messages JSONB;  -- Full array of messages sent to LLM

-- 2. Drop strict constraints if they block new usage (optional but safer for "clean" schema)
-- Removing the strict check on run_type to allow flexibility (e.g. 'hazop', 'agent_planning')
ALTER TABLE public.ai_runs DROP CONSTRAINT IF EXISTS ai_runs_run_type_check;
ALTER TABLE public.ai_runs ADD CONSTRAINT ai_runs_run_type_check 
    CHECK (run_type IN ('object_detection', 'node_detection', 'hazop_analysis', 'other', 'planning', 'chat'));

-- 3. Ensure status constraint encompasses our needs
ALTER TABLE public.ai_runs DROP CONSTRAINT IF EXISTS ai_runs_status_check;
ALTER TABLE public.ai_runs ADD CONSTRAINT ai_runs_status_check 
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'success')); -- Adding 'success' to align with my code or just usage

-- Note: We keep 'raw_response', 'prompt_tokens', 'latency_ms' from previous migration (0004).
-- We renamed 'triggered_by' -> 'user_id' in my previous thought, but better to keep existing schema
-- and just alias it in API code if needed. 'triggered_by' is fine.

-- Add structured fields for HAZOP Nodes
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS design_intent text,
ADD COLUMN IF NOT EXISTS boundaries text;
-- Add new fields for Node Definition
-- We are keeping operating_conditions for now to avoid data loss.
-- We are keeping operating_conditions for now to avoid data loss.

alter table tasks
add column equipment_tags text; -- e.g. "R-101, P-102"
