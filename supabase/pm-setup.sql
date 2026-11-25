-- ============================================================================
-- APP CORE Tracking (Project Management) — shared data in Supabase.
--
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- Only ADDS new objects (pm_* tables, pm_* functions, policies on pm_* tables).
-- It does not change or remove any existing table, function or policy.
--
-- Needs access-control-1-setup.sql (app_users, app_has_perm, app_current_email).
-- Access: anyone whose app_users row has the "project_management" permission
-- (the "APP CORE Tracking" tick on the Users page), or any Admin.
-- Apple / Partner reviewers never read these tables: they only call the two
-- pm_review_* functions with their link token.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------
create table if not exists public.pm_projects (
  id          text primary key,
  data        jsonb not null,                 -- one store: details, documents, all six stages
  rev         integer not null default 1,     -- bumped on every save; stops two people overwriting each other
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  text
);

create table if not exists public.pm_notifications (
  id          bigserial primary key,
  project_id  text references public.pm_projects(id) on delete cascade,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_pm_notifications_created on public.pm_notifications(created_at desc);

create table if not exists public.pm_review_links (
  token       text primary key,               -- random, unguessable; one per version and party
  project_id  text not null references public.pm_projects(id) on delete cascade,
  stage       integer not null check (stage between 1 and 3),
  version     integer not null,
  party       text not null check (party in ('apple','partner')),
  created_at  timestamptz not null default now(),
  created_by  text
);
create index if not exists idx_pm_review_links_project on public.pm_review_links(project_id);

-- ----------------------------------------------------------------------------
-- Stamps: who saved and when
-- ----------------------------------------------------------------------------
create or replace function public.pm_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(nullif(public.app_current_email(), ''), new.updated_by);
  return new;
end;
$$;
drop trigger if exists trg_pm_projects_touch on public.pm_projects;
create trigger trg_pm_projects_touch before insert or update on public.pm_projects
  for each row execute function public.pm_touch();

create or replace function public.pm_link_stamp()
returns trigger language plpgsql as $$
begin
  new.created_by := coalesce(nullif(public.app_current_email(), ''), new.created_by);
  return new;
end;
$$;
drop trigger if exists trg_pm_review_links_stamp on public.pm_review_links;
create trigger trg_pm_review_links_stamp before insert on public.pm_review_links
  for each row execute function public.pm_link_stamp();

-- ----------------------------------------------------------------------------
-- Row level security: APP CORE Tracking permission (or Admin) only
-- ----------------------------------------------------------------------------
alter table public.pm_projects      enable row level security;
alter table public.pm_notifications enable row level security;
alter table public.pm_review_links  enable row level security;

drop policy if exists "pm projects access" on public.pm_projects;
create policy "pm projects access" on public.pm_projects
  for all using (public.app_has_perm('project_management'))
  with check (public.app_has_perm('project_management'));

drop policy if exists "pm notifications access" on public.pm_notifications;
create policy "pm notifications access" on public.pm_notifications
  for all using (public.app_has_perm('project_management'))
  with check (public.app_has_perm('project_management'));

drop policy if exists "pm review links access" on public.pm_review_links;
create policy "pm review links access" on public.pm_review_links
  for all using (public.app_has_perm('project_management'))
  with check (public.app_has_perm('project_management'));

-- ----------------------------------------------------------------------------
-- Apple / Partner review page (no sign-in). Returns only what the reviewer
-- needs: store facts and this stage's versions. Nothing else about the store.
-- ----------------------------------------------------------------------------
create or replace function public.pm_review_get(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  l  public.pm_review_links%rowtype;
  d  jsonb;
  st jsonb;
begin
  select * into l from public.pm_review_links where token = p_token;
  if not found then return null; end if;
  select data into d from public.pm_projects where id = l.project_id;
  if d is null then return null; end if;
  st := d->'stages'->(l.stage - 1);
  return jsonb_build_object(
    'token',      l.token,
    'party',      l.party,
    'stage',      l.stage,
    'version',    l.version,
    'project_id', l.project_id,
    'store', jsonb_build_object(
      'store', d->'store', 'appleId', d->'appleId', 'sfo', d->'sfo', 'country', d->'country',
      'client', d->'client', 'kit', d->'kit', 'target', d->'target'),
    'status', st->'status',
    'versions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'v', x->'v', 'sentAt', x->'sentAt', 'link', x->'link', 'links', x->'links',
               'note', x->'note', 'pnote', x->'pnote', 'psentAt', x->'psentAt', 'reviews', x->'reviews')
             order by (x->>'v')::int)
      from jsonb_array_elements(coalesce(st->'versions', '[]'::jsonb)) x), '[]'::jsonb)
  );
end;
$$;

create or replace function public.pm_review_reply(p_token text, p_outcome text, p_name text, p_comment text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  l       public.pm_review_links%rowtype;
  d       jsonb;
  st      jsonb;
  v       jsonb;
  idx     integer;
  n       integer;
  ok      boolean := (p_outcome = 'approved');
  nm      text := btrim(coalesce(p_name, ''));
  cm      text := btrim(coalesce(p_comment, ''));
  today   text := to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM-DD');
  stamp   text := to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI');
  stages  text[] := array['Layout Proposal', 'IDK Review', 'FDK Review'];
  who     text;
begin
  select * into l from public.pm_review_links where token = p_token;
  if not found then return jsonb_build_object('ok', false, 'msg', 'This review link is not valid.'); end if;
  select data into d from public.pm_projects where id = l.project_id for update;
  if d is null then return jsonb_build_object('ok', false, 'msg', 'This review link is not valid.'); end if;

  st := d->'stages'->(l.stage - 1);
  n  := jsonb_array_length(coalesce(st->'versions', '[]'::jsonb));
  select (o - 1)::int into idx
    from jsonb_array_elements(coalesce(st->'versions', '[]'::jsonb)) with ordinality e(x, o)
   where (x->>'v')::int = l.version;
  if idx is null then return jsonb_build_object('ok', false, 'msg', 'This review link is not valid.'); end if;
  if idx <> n - 1 or st->>'status' <> 'with_reviewers' then
    return jsonb_build_object('ok', false, 'msg', 'This version is no longer open for review.');
  end if;

  v := st->'versions'->idx;
  if jsonb_typeof(v->'reviews'->l.party) = 'object' then
    return jsonb_build_object('ok', false, 'msg', 'A reply was already sent for this version.');
  end if;
  if l.party = 'partner' and coalesce(v->'reviews'->'apple'->>'outcome', '') <> 'approved' then
    return jsonb_build_object('ok', false, 'msg', 'This version is waiting for Apple first.');
  end if;
  if nm = '' then return jsonb_build_object('ok', false, 'msg', 'Add your name.'); end if;
  if not ok and cm = '' then return jsonb_build_object('ok', false, 'msg', 'Tell us what to change.'); end if;
  if length(nm) > 200 or length(cm) > 4000 then return jsonb_build_object('ok', false, 'msg', 'Your reply is too long.'); end if;

  d := jsonb_set(d, array['stages', (l.stage - 1)::text, 'versions', idx::text, 'reviews', l.party],
                 jsonb_build_object('outcome', case when ok then 'approved' else 'changes' end,
                                    'at', today, 'note', cm, 'by', nm, 'via', 'link'));
  if not ok then
    d := jsonb_set(d, array['stages', (l.stage - 1)::text, 'status'], to_jsonb('changes_requested'::text));
    d := jsonb_set(d, array['stages', (l.stage - 1)::text, 'since'], to_jsonb(stamp));
  end if;
  update public.pm_projects set data = d, rev = rev + 1, updated_by = l.party || ': ' || nm where id = l.project_id;

  who := case when l.party = 'apple' then 'Apple' else 'Partner' end;
  insert into public.pm_notifications(project_id, data) values (l.project_id, jsonb_build_object(
    'to', jsonb_build_array('coord'),
    'text', who || ' (' || nm || ') ' || case when ok then 'approved ' else 'requested changes on ' end ||
            stages[l.stage] || ' v' || l.version || ' for ' || coalesce(d->>'store', '') ||
            case when cm <> '' then ': “' || cm || '”' else '' end,
    'pid', l.project_id, 'n', l.stage, 'at', stamp, 'email', false, 'read', '[]'::jsonb));

  return jsonb_build_object('ok', true, 'msg',
    case when ok then 'Thank you. Your approval was sent.' else 'Thank you. Your change request was sent.' end);
end;
$$;

revoke all on function public.pm_review_get(text) from public;
revoke all on function public.pm_review_reply(text, text, text, text) from public;
grant execute on function public.pm_review_get(text) to anon, authenticated;
grant execute on function public.pm_review_reply(text, text, text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Live updates: other people's changes appear without reloading
-- ----------------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.pm_projects;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.pm_notifications;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- ----------------------------------------------------------------------------
-- Before go-live, to remove test data only (run separately, on purpose):
--   delete from public.pm_projects;   -- also removes its notifications and review links
-- ----------------------------------------------------------------------------
