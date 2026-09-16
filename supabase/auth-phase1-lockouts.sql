-- ============================================================================
-- PIN Login — Phase 1: lockout tracking + helper functions
-- Run this in the Supabase SQL Editor now. Safe to run immediately — this
-- does NOT change access to projects/timeframes/payment_terms/targets, so
-- the live app keeps working exactly as before while you roll out login.
--
-- Phase 2 (supabase/auth-phase2-tighten-rls.sql) is what actually requires
-- login to use the app — run it only after every teammate has an account
-- and you've confirmed the login page works end to end.
-- ============================================================================

create table if not exists public.login_lockouts (
  username        text primary key,
  failed_count    int not null default 0,
  locked_until    timestamptz,
  updated_at      timestamptz not null default now()
);

alter table public.login_lockouts enable row level security;
-- No policies granting direct table access to anon/authenticated — only the
-- SECURITY DEFINER functions below may read/write it, so a client can never
-- reset its own lockout or peek at other usernames' attempt counts directly.

-- Checks whether a username is currently locked out.
create or replace function public.check_login_lockout(p_username text)
returns table (is_locked boolean, locked_until timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select
      (l.locked_until is not null and l.locked_until > now()) as is_locked,
      l.locked_until
    from public.login_lockouts l
    where l.username = p_username;
end;
$$;

-- Called after a failed PIN attempt. Locks the username for 15 minutes once
-- it reaches 5 failed attempts (adjust the numbers below to taste).
create or replace function public.record_failed_login(p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.login_lockouts (username, failed_count, updated_at)
  values (p_username, 1, now())
  on conflict (username) do update
    set failed_count = login_lockouts.failed_count + 1,
        updated_at = now()
  returning failed_count into v_count;

  if v_count >= 5 then
    update public.login_lockouts
      set locked_until = now() + interval '15 minutes',
          failed_count = 0
      where username = p_username;
  end if;
end;
$$;

-- Called after a successful PIN login — clears the failed-attempt count.
create or replace function public.reset_login_lockout(p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.login_lockouts (username, failed_count, locked_until, updated_at)
  values (p_username, 0, null, now())
  on conflict (username) do update
    set failed_count = 0, locked_until = null, updated_at = now();
end;
$$;

-- The login page calls these before a Supabase Auth session exists, so the
-- anon role needs execute rights (the table itself stays locked down above).
grant execute on function public.check_login_lockout(text) to anon, authenticated;
grant execute on function public.record_failed_login(text) to anon, authenticated;
grant execute on function public.reset_login_lockout(text) to anon, authenticated;
