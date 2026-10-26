-- ============================================================================
-- Invoices — issuer company profiles, customers, invoices, running numbers,
-- and private storage for logos / signatures.
--
-- Requires access-control-1-setup.sql (app_users + app_* helper functions).
-- Safe to re-run.
-- ============================================================================

alter table public.app_users add column if not exists signature_path text;

-- ----------------------------------------------------------------------------
-- Issuer company profiles — one row per company that issues invoices. These
-- are managed on the invoice page itself and are unrelated to the
-- Whitespace Partners / WSCN companies used by projects and the Roadmap.
-- company_key is just an id (a uuid string for companies added in the app).
-- ----------------------------------------------------------------------------
create table if not exists public.issuer_companies (
  company_key        text primary key,
  name_th            text not null default '',
  name_en            text not null default '',
  address            text not null default '',
  tax_id             text not null default '',
  branch             text not null default 'สำนักงานใหญ่',
  phone              text not null default '',
  email              text not null default '',
  bank_account_name  text not null default '',
  bank_name          text not null default '',
  bank_account_no    text not null default '',
  bank_account_type  text not null default '',
  bank_branch        text not null default '',
  notes              text not null default '',
  logo_path          text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.issuer_companies add column if not exists created_at timestamptz not null default now();


-- ----------------------------------------------------------------------------
-- Customers — shared between both issuing companies.
-- ----------------------------------------------------------------------------
create table if not exists public.customers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  tax_id        text not null default '',
  branch        text not null default 'สำนักงานใหญ่',
  address       text not null default '',
  phone         text not null default '',
  contact_name  text not null default '',
  contact_phone text not null default '',
  contact_email text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Invoices. Company and customer details are copied into the invoice when it
-- is issued, so later edits to a profile never change an issued document.
-- ----------------------------------------------------------------------------
create table if not exists public.invoices (
  id               uuid primary key default gen_random_uuid(),
  company_key      text not null references public.issuer_companies(company_key),
  doc_no           text,                                   -- set when issued: IN-YYYYMM###
  status           text not null default 'draft' check (status in ('draft', 'issued', 'void')),
  issue_date       date not null default current_date,
  credit_term_days int  not null default 30,
  due_date         date,
  salesman         text not null default '',
  project_name     text not null default '',
  quotation_no     text not null default '',
  ref_document     text not null default '',
  ship_to          text not null default '',
  customer_id      uuid references public.customers(id) on delete set null,
  customer         jsonb not null default '{}'::jsonb,     -- name, tax_id, branch, address, phone, contact_*
  company          jsonb,                                  -- issuer profile snapshot, set when issued
  items            jsonb not null default '[]'::jsonb,     -- [{description, detail, quantity, unit_price, discount}]
  discount         numeric(14, 2) not null default 0,
  vat_rate         numeric(5, 2)  not null default 0,
  wht_rate         numeric(5, 2)  not null default 0,
  subtotal         numeric(14, 2) not null default 0,
  after_discount   numeric(14, 2) not null default 0,
  vat_amount       numeric(14, 2) not null default 0,
  total            numeric(14, 2) not null default 0,
  wht_amount       numeric(14, 2) not null default 0,
  net_total        numeric(14, 2) not null default 0,
  notes            text not null default '',
  created_by       text,
  issued_by        text,
  issued_by_name   text,
  signature_path   text,                                   -- issuer's signature at the moment of issue
  issued_at        timestamptz,
  voided_at        timestamptz,
  voided_by        text,
  void_reason      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (company_key, doc_no)
);
create index if not exists idx_invoices_created_at on public.invoices(created_at desc);
alter table public.invoices add column if not exists quotation_no text not null default '';
alter table public.invoices add column if not exists ref_document text not null default '';
alter table public.invoices add column if not exists ship_to      text not null default '';
alter table public.invoices alter column vat_rate set default 0;

-- An earlier version of this script pre-created two placeholder rows named
-- after the project companies. Remove them if they were never filled in or
-- used, so the list starts empty.
delete from public.issuer_companies c
 where c.company_key in ('Whitespace Partners', 'Whitespaceconnect')
   and c.name_th = '' and c.name_en = ''
   and not exists (select 1 from public.invoices i where i.company_key = c.company_key);

-- ----------------------------------------------------------------------------
-- Policies
-- ----------------------------------------------------------------------------
alter table public.issuer_companies enable row level security;
alter table public.customers        enable row level security;
alter table public.invoices         enable row level security;

-- Everyone with the "issue documents" permission works with every issuer
-- company and every invoice — not tied to the project company ticks.
drop policy if exists "issuer companies read" on public.issuer_companies;
drop policy if exists "issuer companies write" on public.issuer_companies;
drop policy if exists "issuer companies all" on public.issuer_companies;
create policy "issuer companies all" on public.issuer_companies
  for all using (public.app_has_perm('issue_documents')) with check (public.app_has_perm('issue_documents'));

drop policy if exists "customers all" on public.customers;
create policy "customers all" on public.customers
  for all using (public.app_has_perm('issue_documents')) with check (public.app_has_perm('issue_documents'));

-- Drafts can be created, edited and deleted. Issued invoices can't be
-- edited from the app at all — issuing and voiding go through the
-- functions below.
drop policy if exists "invoices read" on public.invoices;
drop policy if exists "invoices insert draft" on public.invoices;
drop policy if exists "invoices update draft" on public.invoices;
drop policy if exists "invoices delete draft" on public.invoices;
create policy "invoices read" on public.invoices
  for select using (public.app_has_perm('issue_documents'));
create policy "invoices insert draft" on public.invoices
  for insert with check (status = 'draft' and doc_no is null and public.app_has_perm('issue_documents'));
create policy "invoices update draft" on public.invoices
  for update using (status = 'draft' and public.app_has_perm('issue_documents'))
  with check (status = 'draft' and doc_no is null and public.app_has_perm('issue_documents'));
create policy "invoices delete draft" on public.invoices
  for delete using (status = 'draft' and public.app_has_perm('issue_documents'));

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_invoices_touch on public.invoices;
create trigger trg_invoices_touch before update on public.invoices
  for each row execute function public.touch_updated_at();
drop trigger if exists trg_customers_touch on public.customers;
create trigger trg_customers_touch before update on public.customers
  for each row execute function public.touch_updated_at();
drop trigger if exists trg_issuer_companies_touch on public.issuer_companies;
create trigger trg_issuer_companies_touch before update on public.issuer_companies
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- Issue a draft: assigns the next running number for that company and the
-- issue month (IN-YYYYMM001, restarting each month), snapshots the company
-- profile, and stamps the issuer and their signature.
-- ----------------------------------------------------------------------------
create or replace function public.issue_invoice(p_invoice_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_inv     public.invoices%rowtype;
  v_prefix  text;
  v_next    int;
  v_doc_no  text;
  v_user    public.app_users%rowtype;
begin
  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'ไม่พบเอกสาร'; end if;
  if v_inv.status <> 'draft' then raise exception 'เอกสารนี้ออกไปแล้ว'; end if;
  if not public.app_has_perm('issue_documents') then
    raise exception 'ไม่มีสิทธิ์ออกเอกสาร';
  end if;

  select * into v_user from public.app_users where email = public.app_current_email();

  v_prefix := 'IN-' || to_char(v_inv.issue_date, 'YYYYMM');
  -- One issuer at a time per company + month, so two people can't take the same number.
  perform pg_advisory_xact_lock(hashtext(v_inv.company_key || v_prefix));
  select coalesce(max(substring(doc_no from length(v_prefix) + 1)::int), 0) + 1
    into v_next
    from public.invoices
   where company_key = v_inv.company_key and doc_no like v_prefix || '%';
  v_doc_no := v_prefix || lpad(v_next::text, 3, '0');

  update public.invoices set
    status         = 'issued',
    doc_no         = v_doc_no,
    company        = (select to_jsonb(c) - 'updated_at' from public.issuer_companies c where c.company_key = v_inv.company_key),
    issued_by      = public.app_current_email(),
    issued_by_name = coalesce(nullif(v_user.display_name, ''), public.app_current_email()),
    signature_path = v_user.signature_path,
    issued_at      = now()
  where id = p_invoice_id;

  return v_doc_no;
end;
$$;

create or replace function public.void_invoice(p_invoice_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_inv public.invoices%rowtype;
begin
  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'ไม่พบเอกสาร'; end if;
  if v_inv.status <> 'issued' then raise exception 'ยกเลิกได้เฉพาะเอกสารที่ออกแล้ว'; end if;
  if not public.app_has_perm('issue_documents') then
    raise exception 'ไม่มีสิทธิ์ยกเลิกเอกสาร';
  end if;
  update public.invoices set
    status = 'void', voided_at = now(), voided_by = public.app_current_email(), void_reason = nullif(trim(p_reason), '')
  where id = p_invoice_id;
end;
$$;

revoke execute on function public.issue_invoice(uuid) from public, anon;
revoke execute on function public.void_invoice(uuid, text) from public, anon;
grant execute on function public.issue_invoice(uuid) to authenticated;
grant execute on function public.void_invoice(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Private storage for company logos (logos/...) and user signatures
-- (signatures/...). Anyone who can issue documents can view both; logos can
-- be changed by issuers, signatures only by Admins.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('invoice-assets', 'invoice-assets', false)
on conflict (id) do nothing;

drop policy if exists "invoice assets read" on storage.objects;
drop policy if exists "invoice assets write logos" on storage.objects;
drop policy if exists "invoice assets update logos" on storage.objects;
drop policy if exists "invoice assets write signatures" on storage.objects;
drop policy if exists "invoice assets update signatures" on storage.objects;

create policy "invoice assets read" on storage.objects
  for select using (bucket_id = 'invoice-assets' and public.app_has_perm('issue_documents'));
create policy "invoice assets write logos" on storage.objects
  for insert with check (bucket_id = 'invoice-assets' and (storage.foldername(name))[1] = 'logos'
    and public.app_has_perm('issue_documents'));
create policy "invoice assets update logos" on storage.objects
  for update using (bucket_id = 'invoice-assets' and (storage.foldername(name))[1] = 'logos'
    and public.app_has_perm('issue_documents'));
create policy "invoice assets write signatures" on storage.objects
  for insert with check (bucket_id = 'invoice-assets' and (storage.foldername(name))[1] = 'signatures'
    and public.app_is_admin());
create policy "invoice assets update signatures" on storage.objects
  for update using (bucket_id = 'invoice-assets' and (storage.foldername(name))[1] = 'signatures'
    and public.app_is_admin());

notify pgrst, 'reload schema';
