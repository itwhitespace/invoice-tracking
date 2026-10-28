-- ============================================================================
-- Invoices — editing an issued invoice in place (same doc_no).
--
-- Requires invoices-setup.sql and invoices-payments.sql. Safe to re-run.
--
-- An issued invoice that hasn't been paid yet (and has no receipt) can be
-- edited through update_issued_invoice(). Before every edit the whole
-- previous version is copied into invoice_revisions, with who, when and
-- why, so the version a customer already received can always be looked up.
-- The document number and the issuing company never change.
-- ============================================================================

alter table public.invoices add column if not exists revision            int not null default 0;
alter table public.invoices add column if not exists last_edited_at      timestamptz;
alter table public.invoices add column if not exists last_edited_by_name text;

create table if not exists public.invoice_revisions (
  id              uuid primary key default gen_random_uuid(),
  invoice_id      uuid not null references public.invoices(id) on delete cascade,
  revision_no     int  not null,                 -- 1 = the version before the first edit
  snapshot        jsonb not null,                -- the full invoice row as it was before this edit
  reason          text,
  edited_by       text,
  edited_by_name  text,
  edited_at       timestamptz not null default now(),
  unique (invoice_id, revision_no)
);
create index if not exists idx_invoice_revisions_invoice on public.invoice_revisions(invoice_id, revision_no desc);

alter table public.invoice_revisions enable row level security;
drop policy if exists "invoice revisions read" on public.invoice_revisions;
create policy "invoice revisions read" on public.invoice_revisions
  for select using (public.app_has_perm('issue_documents'));
-- No insert/update/delete policies: rows are only written by the function below.

create or replace function public.update_issued_invoice(p_invoice_id uuid, p_data jsonb, p_reason text)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_inv   public.invoices%rowtype;
  v_user  public.app_users%rowtype;
  v_rev   int;
  v_date  date;
begin
  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'ไม่พบเอกสาร'; end if;
  if not public.app_has_perm('issue_documents') then
    raise exception 'ไม่มีสิทธิ์แก้ไขเอกสาร';
  end if;
  if v_inv.status <> 'issued' then raise exception 'แก้ไขได้เฉพาะใบที่ออกแล้วและยังไม่ถูกยกเลิก'; end if;
  if v_inv.payment_status = 'paid' then
    raise exception 'ใบนี้รับชำระแล้ว — ต้องยกเลิกการรับชำระก่อนถึงจะแก้ไขได้';
  end if;
  if exists (select 1 from public.receipts r where r.invoice_id = p_invoice_id and r.status = 'issued') then
    raise exception 'ใบนี้ออกใบเสร็จแล้ว — ต้องยกเลิกใบเสร็จก่อนถึงจะแก้ไขได้';
  end if;

  -- The running number carries the issue month (IN-YYYYMM###), so the date
  -- may only move within that month.
  v_date := coalesce((p_data->>'issue_date')::date, v_inv.issue_date);
  if to_char(v_date, 'YYYYMM') <> to_char(v_inv.issue_date, 'YYYYMM') then
    raise exception 'วันที่เอกสารต้องอยู่ในเดือนเดียวกับเลขที่เอกสาร (%)', v_inv.doc_no;
  end if;

  select * into v_user from public.app_users where email = public.app_current_email();
  v_rev := v_inv.revision + 1;

  insert into public.invoice_revisions (invoice_id, revision_no, snapshot, reason, edited_by, edited_by_name)
  values (
    p_invoice_id, v_rev, to_jsonb(v_inv), nullif(trim(p_reason), ''),
    public.app_current_email(), coalesce(nullif(v_user.display_name, ''), public.app_current_email())
  );

  update public.invoices set
    issue_date          = v_date,
    credit_term_days    = coalesce((p_data->>'credit_term_days')::int, credit_term_days),
    due_date            = (p_data->>'due_date')::date,
    salesman            = coalesce(p_data->>'salesman', salesman),
    project_name        = coalesce(p_data->>'project_name', project_name),
    quotation_no        = coalesce(p_data->>'quotation_no', quotation_no),
    ref_document        = coalesce(p_data->>'ref_document', ref_document),
    customer_id         = (p_data->>'customer_id')::uuid,
    customer            = coalesce(p_data->'customer', customer),
    items               = coalesce(p_data->'items', items),
    discount            = coalesce((p_data->>'discount')::numeric, discount),
    vat_rate            = coalesce((p_data->>'vat_rate')::numeric, vat_rate),
    wht_rate            = coalesce((p_data->>'wht_rate')::numeric, wht_rate),
    subtotal            = coalesce((p_data->>'subtotal')::numeric, subtotal),
    after_discount      = coalesce((p_data->>'after_discount')::numeric, after_discount),
    vat_amount          = coalesce((p_data->>'vat_amount')::numeric, vat_amount),
    total               = coalesce((p_data->>'total')::numeric, total),
    wht_amount          = coalesce((p_data->>'wht_amount')::numeric, wht_amount),
    net_total           = coalesce((p_data->>'net_total')::numeric, net_total),
    notes               = coalesce(p_data->>'notes', notes),
    revision            = v_rev,
    last_edited_at      = now(),
    last_edited_by_name = coalesce(nullif(v_user.display_name, ''), public.app_current_email())
  where id = p_invoice_id;

  return v_rev;
end;
$$;

revoke execute on function public.update_issued_invoice(uuid, jsonb, text) from public, anon;
grant execute on function public.update_issued_invoice(uuid, jsonb, text) to authenticated;

notify pgrst, 'reload schema';
