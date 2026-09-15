-- ============================================================================
-- Invoice Tracking Program — Supabase schema
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Safe to re-run: uses IF NOT EXISTS / DROP ... IF EXISTS guards throughout.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. projects — one row per proposal/invoice document
-- ----------------------------------------------------------------------------
create table if not exists public.projects (
  id                     uuid primary key default gen_random_uuid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  company_name           text,                                 -- Issuing company: "Whitespace Partners" or "Whitespaceconnect"
  project_name           text not null,
  area                   text,                                 -- deprecated, no longer written by the app
  scope_of_work          text,                                 -- deprecated, no longer written by the app
  total_fee              numeric(14, 2) not null default 0,   -- entered directly; the only fee figure the app tracks
  special_discount       numeric(14, 2) not null default 0,   -- deprecated, no longer written by the app
  vat_amount             numeric(14, 2) not null default 0,   -- deprecated, no longer written by the app
  grand_total            numeric(14, 2) not null default 0,   -- deprecated, no longer written by the app
  total_design_duration  text,
  pdf_url                text,
  pdf_file_name          text,
  status                 text not null default 'verified'
                           check (status in ('pending', 'draft', 'verified', 'approved')),
  start_date             date,                                 -- Operations tab: project kickoff date, drives the Roadmap Gantt position
  department             text,                                 -- Operations tab: studio-1/studio-2/studio-3/studio-4/Signage/Branding
  approved_at            timestamptz,                           -- Set when status is switched to 'approved'
  on_hold                boolean not null default false,       -- Approved only: stays on the Roadmap but excluded from monthly totals
  roadmap_note           text                                   -- Free-text note editable from the Project Roadmap page
);

comment on table public.projects is 'One row per proposal/invoice document extracted or entered in the app.';

-- ----------------------------------------------------------------------------
-- 2. project_design_fee_items — itemized Design Fees table rows
--    Deprecated: the app no longer writes to this table (Total Fee is now
--    entered directly, not built up from a line-item breakdown).
-- ----------------------------------------------------------------------------
create table if not exists public.project_design_fee_items (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  item         text not null,
  description  text,
  amount       numeric(14, 2) not null default 0,
  sort_order   int not null default 0
);

-- ----------------------------------------------------------------------------
-- 3. project_timeframes — Estimated Time Frame phases
-- ----------------------------------------------------------------------------
create table if not exists public.project_timeframes (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  phase        text not null,
  description  text,
  duration     text,
  sort_order   int not null default 0
);

-- ----------------------------------------------------------------------------
-- 4. project_payment_terms — Payment Term & Milestone Schedule
-- ----------------------------------------------------------------------------
create table if not exists public.project_payment_terms (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects(id) on delete cascade,
  milestone           text not null,
  payment_percentage  numeric(6, 2) not null default 0,
  amount              numeric(14, 2) not null default 0,
  payment_week        int,                                  -- Which week (within the project's total duration) this milestone is planned to be collected
  invoice_date        date,                                  -- Scheduled invoice/collection date
  payment_status      text check (payment_status in ('wait', 'invoice', 'paid', 'hold', 'cancelled')),
  invoice_issued_date date,                                  -- Set when status moves to Invoice
  paid_date           date,                                  -- Set when status moves to Paid
  sort_order          int not null default 0
);

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
create index if not exists idx_design_fee_items_project on public.project_design_fee_items(project_id);
create index if not exists idx_timeframes_project        on public.project_timeframes(project_id);
create index if not exists idx_payment_terms_project      on public.project_payment_terms(project_id);
create index if not exists idx_projects_created_at        on public.projects(created_at desc);

-- ----------------------------------------------------------------------------
-- updated_at auto-touch trigger on projects
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security
--
-- The app talks to Supabase directly from the browser using the anon key
-- (no auth/login flow yet), so these policies simply allow the anon role to
-- read/write everything. Tighten this later (e.g. require auth.uid()) once
-- user accounts are added — do not leave this fully open in a production
-- deployment with sensitive data.
-- ----------------------------------------------------------------------------
alter table public.projects                  enable row level security;
alter table public.project_design_fee_items  enable row level security;
alter table public.project_timeframes        enable row level security;
alter table public.project_payment_terms     enable row level security;

drop policy if exists "Allow all access" on public.projects;
create policy "Allow all access" on public.projects
  for all using (true) with check (true);

drop policy if exists "Allow all access" on public.project_design_fee_items;
create policy "Allow all access" on public.project_design_fee_items
  for all using (true) with check (true);

drop policy if exists "Allow all access" on public.project_timeframes;
create policy "Allow all access" on public.project_timeframes
  for all using (true) with check (true);

drop policy if exists "Allow all access" on public.project_payment_terms;
create policy "Allow all access" on public.project_payment_terms
  for all using (true) with check (true);

-- ----------------------------------------------------------------------------
-- Storage bucket for uploaded PDF proposals
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('pdf-documents', 'pdf-documents', true)
on conflict (id) do nothing;

drop policy if exists "Public read pdf-documents" on storage.objects;
create policy "Public read pdf-documents" on storage.objects
  for select using (bucket_id = 'pdf-documents');

drop policy if exists "Anon upload pdf-documents" on storage.objects;
create policy "Anon upload pdf-documents" on storage.objects
  for insert with check (bucket_id = 'pdf-documents');

drop policy if exists "Anon manage pdf-documents" on storage.objects;
create policy "Anon manage pdf-documents" on storage.objects
  for update using (bucket_id = 'pdf-documents');

-- ============================================================================
-- Migration: run this if `projects` already exists from an earlier version
-- of this script (safe / idempotent to re-run).
-- ============================================================================
alter table public.projects add column if not exists start_date  date;
alter table public.projects add column if not exists department  text;
alter table public.projects add column if not exists approved_at timestamptz;
alter table public.project_payment_terms add column if not exists payment_week int;
alter table public.project_payment_terms add column if not exists invoice_date date;
alter table public.project_payment_terms add column if not exists payment_status text;
alter table public.project_payment_terms drop constraint if exists project_payment_terms_payment_status_check;
alter table public.project_payment_terms add constraint project_payment_terms_payment_status_check
  check (payment_status in ('wait', 'invoice', 'paid'));
alter table public.project_payment_terms add column if not exists invoice_issued_date date;
alter table public.project_payment_terms add column if not exists paid_date date;
alter table public.projects add column if not exists on_hold boolean not null default false; -- deprecated, no longer written by the app (superseded by per-installment payment_status)
alter table public.projects add column if not exists roadmap_note text;
alter table public.project_payment_terms drop constraint if exists project_payment_terms_payment_status_check;
alter table public.project_payment_terms add constraint project_payment_terms_payment_status_check
  check (payment_status in ('wait', 'invoice', 'paid', 'hold', 'cancelled'));

-- ============================================================================
-- Done. In the app's Settings page, set:
--   Supabase Project URL  -> https://<your-project-ref>.supabase.co
--   Supabase Anon Key     -> the anon/public API key
--   Storage Bucket Name   -> pdf-documents
-- ============================================================================
