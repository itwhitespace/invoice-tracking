-- ============================================================================
-- Access control — STEP 1: users table + permission helper functions.
--
-- Safe to run while the current (no-login) app is still live: it only adds
-- new objects and does not touch any existing table's policies.
-- Safe to re-run.
--
-- BEFORE RUNNING: replace admin@example.com near the bottom with your own
-- email so you become the first Admin.
-- ============================================================================

create table if not exists public.app_users (
  email        text primary key,
  display_name text,
  companies    text[] not null default '{}',   -- company_name values this user can see
  permissions  text[] not null default '{}',   -- keys from lib/permissions.ts
  is_admin     boolean not null default false, -- every permission + every company + manage users/settings
  template     text,                           -- template last applied (informational only)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint app_users_email_lowercase check (email = lower(email))
);

-- ----------------------------------------------------------------------------
-- Helper functions — read the signed-in user's row. SECURITY DEFINER so they
-- can be used inside other tables' policies without tripping app_users' own
-- RLS.
-- ----------------------------------------------------------------------------
create or replace function public.app_current_email()
returns text language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.app_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select u.is_admin from public.app_users u where u.email = public.app_current_email()), false)
$$;

create or replace function public.app_has_perm(p_perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select u.is_admin or p_perm = any(u.permissions) from public.app_users u where u.email = public.app_current_email()),
    false)
$$;

create or replace function public.app_can_see(p_company text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select u.is_admin or p_company = any(u.companies) from public.app_users u where u.email = public.app_current_email()),
    false)
$$;

create or replace function public.app_can_see_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select public.app_can_see(p.company_name) from public.projects p where p.id = p_project_id), false)
$$;

-- Called by the login page before sending a code, so people who aren't on
-- the list get a clear message instead of an email.
create or replace function public.app_is_invited(p_email text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_users u where u.email = lower(trim(p_email)))
$$;
grant execute on function public.app_is_invited(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- app_users policies — each user can read their own row; only Admins can
-- read everyone and add/edit/remove users.
-- ----------------------------------------------------------------------------
alter table public.app_users enable row level security;

drop policy if exists "Read own row or admin" on public.app_users;
create policy "Read own row or admin" on public.app_users
  for select using (email = public.app_current_email() or public.app_is_admin());

drop policy if exists "Admin manage users" on public.app_users;
create policy "Admin manage users" on public.app_users
  for all using (public.app_is_admin()) with check (public.app_is_admin());

-- Guard rails, enforced only for requests from the app (the SQL Editor runs
-- as postgres and can always fix things by hand):
--   * an Admin cannot remove their own Admin flag or delete themselves
--   * there must always be at least one Admin left
create or replace function public.app_users_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    new.email := lower(trim(new.email));
    new.updated_at := now();
  end if;

  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;

  if old.is_admin and (tg_op = 'DELETE' or not new.is_admin) then
    if old.email = public.app_current_email() then
      raise exception 'ไม่สามารถถอดสิทธิ์ผู้ดูแลระบบของตัวเองได้';
    end if;
    if not exists (select 1 from public.app_users u where u.is_admin and u.email <> old.email) then
      raise exception 'ต้องมีผู้ดูแลระบบอย่างน้อยหนึ่งคนเสมอ';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_app_users_guard on public.app_users;
create trigger trg_app_users_guard
  before update or delete on public.app_users
  for each row execute function public.app_users_guard();

create or replace function public.app_users_normalize_email()
returns trigger language plpgsql as $$
begin
  new.email := lower(trim(new.email));
  return new;
end;
$$;

drop trigger if exists trg_app_users_normalize on public.app_users;
create trigger trg_app_users_normalize
  before insert on public.app_users
  for each row execute function public.app_users_normalize_email();

-- ----------------------------------------------------------------------------
-- Last sign-in time per user, for the Admin's user list. Reads auth.users,
-- which the app can't see directly; returns nothing for non-Admins.
-- ----------------------------------------------------------------------------
create or replace function public.app_user_last_sign_ins()
returns table (email text, last_sign_in_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select lower(au.email)::text, au.last_sign_in_at
  from auth.users au
  where public.app_is_admin()
$$;
revoke execute on function public.app_user_last_sign_ins() from public, anon;
grant execute on function public.app_user_last_sign_ins() to authenticated;

-- ----------------------------------------------------------------------------
-- First Admin — REPLACE THE EMAIL BELOW before running.
-- ----------------------------------------------------------------------------
insert into public.app_users (email, display_name, companies, permissions, is_admin, template)
values (
  lower('it@whitesp-ce.com'),
  'Admin',
  array['Whitespace Partners', 'Whitespaceconnect'],
  array['export_excel', 'create_proposal', 'edit_project', 'edit_payment', 'edit_total_fee', 'approve', 'edit_target', 'delete_project'],
  true,
  'admin'
)
on conflict (email) do update set is_admin = true;

-- Make the API pick up new functions/policies right away.
notify pgrst, 'reload schema';
