-- ============================================================================
-- Access control — STEP 2: lock every table down to the signed-in user's
-- companies and permissions.
--
-- Run ONLY AFTER the login version of the app is deployed and you have
-- confirmed you can sign in. Running it while the old no-login app is live
-- makes that app read and write nothing.
-- Requires access-control-1-setup.sql to have been run first.
-- Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- projects
-- ----------------------------------------------------------------------------
drop policy if exists "Allow all access" on public.projects;
drop policy if exists "projects select" on public.projects;
drop policy if exists "projects insert" on public.projects;
drop policy if exists "projects update" on public.projects;
drop policy if exists "projects delete" on public.projects;

create policy "projects select" on public.projects
  for select using (public.app_can_see(company_name));
create policy "projects insert" on public.projects
  for insert with check (public.app_has_perm('create_proposal') and public.app_can_see(company_name));
create policy "projects update" on public.projects
  for update using (public.app_can_see(company_name)) with check (public.app_can_see(company_name));
create policy "projects delete" on public.projects
  for delete using (public.app_has_perm('delete_project') and public.app_can_see(company_name));

-- The app saves a whole project row at once, so which permission an update
-- needs depends on which columns actually changed.
create or replace function public.projects_permission_guard()
returns trigger language plpgsql as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.total_fee is distinct from old.total_fee and not public.app_has_perm('edit_total_fee') then
    raise exception 'ไม่มีสิทธิ์แก้ Total Fee';
  end if;

  if (new.status, new.approved_at) is distinct from (old.status, old.approved_at)
     and not public.app_has_perm('approve') then
    raise exception 'ไม่มีสิทธิ์ Approve / Not Approved';
  end if;

  if (new.project_name, new.company_name, new.start_date, new.department, new.total_design_duration,
      new.roadmap_hidden, new.pdf_url, new.pdf_file_name)
     is distinct from
     (old.project_name, old.company_name, old.start_date, old.department, old.total_design_duration,
      old.roadmap_hidden, old.pdf_url, old.pdf_file_name)
     and not public.app_has_perm('edit_project') then
    raise exception 'ไม่มีสิทธิ์แก้ไขรายละเอียดโครงการ';
  end if;

  if new.roadmap_note is distinct from old.roadmap_note and not public.app_has_perm('edit_payment') then
    raise exception 'ไม่มีสิทธิ์แก้ไข Note';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_projects_permission_guard on public.projects;
create trigger trg_projects_permission_guard
  before update on public.projects
  for each row execute function public.projects_permission_guard();

-- ----------------------------------------------------------------------------
-- project_timeframes
-- ----------------------------------------------------------------------------
drop policy if exists "Allow all access" on public.project_timeframes;
drop policy if exists "timeframes select" on public.project_timeframes;
drop policy if exists "timeframes insert" on public.project_timeframes;
drop policy if exists "timeframes update" on public.project_timeframes;
drop policy if exists "timeframes delete" on public.project_timeframes;

create policy "timeframes select" on public.project_timeframes
  for select using (public.app_can_see_project(project_id));
create policy "timeframes insert" on public.project_timeframes
  for insert with check (
    (public.app_has_perm('create_proposal') or public.app_has_perm('edit_project'))
    and public.app_can_see_project(project_id));
create policy "timeframes update" on public.project_timeframes
  for update using (public.app_has_perm('edit_project') and public.app_can_see_project(project_id))
  with check (public.app_can_see_project(project_id));
create policy "timeframes delete" on public.project_timeframes
  for delete using (public.app_has_perm('edit_project') and public.app_can_see_project(project_id));

-- ----------------------------------------------------------------------------
-- project_payment_terms
-- ----------------------------------------------------------------------------
drop policy if exists "Allow all access" on public.project_payment_terms;
drop policy if exists "payment terms select" on public.project_payment_terms;
drop policy if exists "payment terms insert" on public.project_payment_terms;
drop policy if exists "payment terms update" on public.project_payment_terms;
drop policy if exists "payment terms delete" on public.project_payment_terms;

create policy "payment terms select" on public.project_payment_terms
  for select using (public.app_can_see_project(project_id));
create policy "payment terms insert" on public.project_payment_terms
  for insert with check (
    (public.app_has_perm('create_proposal') or public.app_has_perm('edit_project'))
    and public.app_can_see_project(project_id));
create policy "payment terms update" on public.project_payment_terms
  for update using (public.app_can_see_project(project_id)) with check (public.app_can_see_project(project_id));
create policy "payment terms delete" on public.project_payment_terms
  for delete using (public.app_has_perm('edit_project') and public.app_can_see_project(project_id));

create or replace function public.payment_terms_permission_guard()
returns trigger language plpgsql as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if (new.project_id, new.sort_order) is distinct from (old.project_id, old.sort_order)
     and not public.app_has_perm('edit_project') then
    raise exception 'ไม่มีสิทธิ์แก้ไขรายละเอียดโครงการ';
  end if;

  -- Amounts can also move as a side effect of a Total Fee edit.
  if (new.milestone, new.payment_percentage, new.amount)
     is distinct from (old.milestone, old.payment_percentage, old.amount)
     and not (public.app_has_perm('edit_project') or public.app_has_perm('edit_total_fee')) then
    raise exception 'ไม่มีสิทธิ์แก้ไขงวดเงิน';
  end if;

  -- The week is set in the detail window (edit_project) or by dragging on
  -- the Roadmap (edit_payment).
  if new.payment_week is distinct from old.payment_week
     and not (public.app_has_perm('edit_project') or public.app_has_perm('edit_payment')) then
    raise exception 'ไม่มีสิทธิ์ย้ายสัปดาห์เก็บเงิน';
  end if;

  if (new.payment_status, new.invoice_date, new.invoice_issued_date, new.paid_date)
     is distinct from (old.payment_status, old.invoice_date, old.invoice_issued_date, old.paid_date)
     and not public.app_has_perm('edit_payment') then
    raise exception 'ไม่มีสิทธิ์เปลี่ยนสถานะจ่ายเงิน';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_payment_terms_permission_guard on public.project_payment_terms;
create trigger trg_payment_terms_permission_guard
  before update on public.project_payment_terms
  for each row execute function public.payment_terms_permission_guard();

-- ----------------------------------------------------------------------------
-- project_design_fee_items — deprecated, read-only
-- ----------------------------------------------------------------------------
drop policy if exists "Allow all access" on public.project_design_fee_items;
drop policy if exists "design fee items select" on public.project_design_fee_items;
create policy "design fee items select" on public.project_design_fee_items
  for select using (public.app_can_see_project(project_id));

-- ----------------------------------------------------------------------------
-- department_targets
-- ----------------------------------------------------------------------------
drop policy if exists "Allow all access" on public.department_targets;
drop policy if exists "targets select" on public.department_targets;
drop policy if exists "targets write" on public.department_targets;

create policy "targets select" on public.department_targets
  for select using (public.app_can_see(company_name));
create policy "targets write" on public.department_targets
  for all using (public.app_has_perm('edit_target') and public.app_can_see(company_name))
  with check (public.app_has_perm('edit_target') and public.app_can_see(company_name));

-- ----------------------------------------------------------------------------
-- project_activity_log — anyone who can see the project can add an entry;
-- the actor is always stamped from the login, never trusted from the app.
-- Nobody can edit or delete history from the app.
-- ----------------------------------------------------------------------------
drop policy if exists "Allow all access" on public.project_activity_log;
drop policy if exists "activity select" on public.project_activity_log;
drop policy if exists "activity insert" on public.project_activity_log;

create policy "activity select" on public.project_activity_log
  for select using (public.app_can_see_project(project_id));
create policy "activity insert" on public.project_activity_log
  for insert with check (public.app_can_see_project(project_id));

create or replace function public.activity_log_stamp_actor()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.actor := nullif(public.app_current_email(), '');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_activity_log_stamp_actor on public.project_activity_log;
create trigger trg_activity_log_stamp_actor
  before insert on public.project_activity_log
  for each row execute function public.activity_log_stamp_actor();

-- ----------------------------------------------------------------------------
-- PDF storage — uploads need create_proposal. Reading stays public for now
-- (existing PDF links keep working); making the bucket private is a
-- separate later step.
-- ----------------------------------------------------------------------------
drop policy if exists "Anon upload pdf-documents" on storage.objects;
drop policy if exists "Anon manage pdf-documents" on storage.objects;
drop policy if exists "Upload pdf-documents" on storage.objects;
drop policy if exists "Manage pdf-documents" on storage.objects;

create policy "Upload pdf-documents" on storage.objects
  for insert with check (bucket_id = 'pdf-documents' and public.app_has_perm('create_proposal'));
create policy "Manage pdf-documents" on storage.objects
  for update using (bucket_id = 'pdf-documents' and public.app_has_perm('create_proposal'));

-- Make the API pick up new functions/policies right away.
notify pgrst, 'reload schema';
