-- ============================================================================
-- PIN Login — Phase 2: require login to read/write app data
--
-- DO NOT run this until:
--   1. supabase/auth-phase1-lockouts.sql has been run
--   2. Every teammate has a Supabase Auth account created (see the app's
--      handoff instructions for the exact steps)
--   3. You've confirmed the login page on the live site actually works
--
-- Running this before that point locks EVERYONE out of the app's data —
-- the anon key access every page currently relies on stops working the
-- moment this runs.
-- ============================================================================

drop policy if exists "Allow all access" on public.projects;
create policy "Authenticated access" on public.projects
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "Allow all access" on public.project_design_fee_items;
create policy "Authenticated access" on public.project_design_fee_items
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "Allow all access" on public.project_timeframes;
create policy "Authenticated access" on public.project_timeframes
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "Allow all access" on public.project_payment_terms;
create policy "Authenticated access" on public.project_payment_terms
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "Allow all access" on public.department_targets;
create policy "Authenticated access" on public.department_targets
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- Storage: PDFs stay publicly readable (so an already-shared link keeps
-- working), but only logged-in users may upload/replace files.
drop policy if exists "Anon upload pdf-documents" on storage.objects;
create policy "Authenticated upload pdf-documents" on storage.objects
  for insert with check (bucket_id = 'pdf-documents' and auth.uid() is not null);

drop policy if exists "Anon manage pdf-documents" on storage.objects;
create policy "Authenticated manage pdf-documents" on storage.objects
  for update using (bucket_id = 'pdf-documents' and auth.uid() is not null);
