-- ============================================================================
-- Invoices — payment status and receipts (ใบเสร็จรับเงิน).
--
-- Requires invoices-setup.sql. Safe to re-run.
--
-- An issued invoice is "unpaid" until someone with the issue_documents
-- permission marks it paid (one payment per invoice). A paid invoice can
-- then get one receipt, numbered RE-YYYYMM### per issuing company.
-- All payment / receipt changes go through the functions below; the app
-- cannot write these columns or the receipts table directly.
-- ============================================================================

alter table public.invoices add column if not exists payment_status text not null default 'unpaid';
alter table public.invoices drop constraint if exists invoices_payment_status_check;
alter table public.invoices add constraint invoices_payment_status_check check (payment_status in ('unpaid', 'paid'));
alter table public.invoices add column if not exists paid_at        date;
alter table public.invoices add column if not exists payment_method text;
alter table public.invoices add column if not exists paid_amount    numeric(14, 2);
alter table public.invoices add column if not exists payment_note   text;
alter table public.invoices add column if not exists paid_by        text;
alter table public.invoices add column if not exists paid_by_name   text;
alter table public.invoices add column if not exists paid_recorded_at timestamptz;

-- ----------------------------------------------------------------------------
-- Receipts. `data` is a copy of the invoice's document content (customer,
-- company snapshot, items, totals ...) so the receipt never changes later.
-- ----------------------------------------------------------------------------
create table if not exists public.receipts (
  id              uuid primary key default gen_random_uuid(),
  invoice_id      uuid not null references public.invoices(id),
  company_key     text not null references public.issuer_companies(company_key),
  doc_no          text not null,
  status          text not null default 'issued' check (status in ('issued', 'void')),
  issue_date      date not null,
  invoice_doc_no  text not null,
  paid_at         date,
  payment_method  text,
  paid_amount     numeric(14, 2),
  payment_note    text,
  data            jsonb not null,
  issued_by       text,
  issued_by_name  text,
  signature_path  text,
  issued_at       timestamptz not null default now(),
  voided_at       timestamptz,
  voided_by       text,
  void_reason     text,
  created_at      timestamptz not null default now(),
  unique (company_key, doc_no)
);
-- At most one non-voided receipt per invoice.
create unique index if not exists uq_receipts_active_invoice on public.receipts(invoice_id) where status = 'issued';
create index if not exists idx_receipts_created_at on public.receipts(created_at desc);

alter table public.receipts enable row level security;
drop policy if exists "receipts read" on public.receipts;
create policy "receipts read" on public.receipts
  for select using (public.app_has_perm('issue_documents'));

-- ----------------------------------------------------------------------------
-- Mark an issued invoice as paid / undo it.
-- ----------------------------------------------------------------------------
create or replace function public.mark_invoice_paid(
  p_invoice_id uuid, p_paid_at date, p_method text, p_amount numeric, p_note text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_inv  public.invoices%rowtype;
  v_user public.app_users%rowtype;
begin
  if not public.app_has_perm('issue_documents') then raise exception 'ไม่มีสิทธิ์บันทึกการชำระเงิน'; end if;
  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'ไม่พบเอกสาร'; end if;
  if v_inv.status <> 'issued' then raise exception 'บันทึกการชำระได้เฉพาะใบแจ้งหนี้ที่ออกแล้ว'; end if;
  if v_inv.payment_status = 'paid' then raise exception 'ใบแจ้งหนี้นี้บันทึกชำระเงินแล้ว'; end if;
  select * into v_user from public.app_users where email = public.app_current_email();

  update public.invoices set
    payment_status   = 'paid',
    paid_at          = coalesce(p_paid_at, current_date),
    payment_method   = nullif(trim(p_method), ''),
    paid_amount      = coalesce(p_amount, v_inv.net_total),
    payment_note     = nullif(trim(p_note), ''),
    paid_by          = public.app_current_email(),
    paid_by_name     = coalesce(nullif(v_user.display_name, ''), public.app_current_email()),
    paid_recorded_at = now()
  where id = p_invoice_id;
end;
$$;

create or replace function public.unmark_invoice_paid(p_invoice_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.app_has_perm('issue_documents') then raise exception 'ไม่มีสิทธิ์แก้สถานะการชำระเงิน'; end if;
  if exists (select 1 from public.receipts r where r.invoice_id = p_invoice_id and r.status = 'issued') then
    raise exception 'ออกใบเสร็จแล้ว — ต้องยกเลิกใบเสร็จก่อน';
  end if;
  update public.invoices set
    payment_status = 'unpaid', paid_at = null, payment_method = null, paid_amount = null,
    payment_note = null, paid_by = null, paid_by_name = null, paid_recorded_at = null
  where id = p_invoice_id and status = 'issued';
end;
$$;

-- Voiding a paid invoice that already has a receipt would leave the receipt
-- pointing at a cancelled document, so that's blocked.
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
  if exists (select 1 from public.receipts r where r.invoice_id = p_invoice_id and r.status = 'issued') then
    raise exception 'ใบแจ้งหนี้นี้ออกใบเสร็จแล้ว — ต้องยกเลิกใบเสร็จก่อน';
  end if;
  update public.invoices set
    status = 'void', voided_at = now(), voided_by = public.app_current_email(), void_reason = nullif(trim(p_reason), '')
  where id = p_invoice_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Issue the receipt for a paid invoice.
-- ----------------------------------------------------------------------------
create or replace function public.issue_receipt(p_invoice_id uuid, p_issue_date date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_inv    public.invoices%rowtype;
  v_user   public.app_users%rowtype;
  v_date   date := coalesce(p_issue_date, current_date);
  v_prefix text := 'RE-' || to_char(coalesce(p_issue_date, current_date), 'YYYYMM');
  v_next   int;
  v_id     uuid;
begin
  if not public.app_has_perm('issue_documents') then raise exception 'ไม่มีสิทธิ์ออกใบเสร็จ'; end if;
  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'ไม่พบใบแจ้งหนี้'; end if;
  if v_inv.status <> 'issued' or v_inv.payment_status <> 'paid' then
    raise exception 'ออกใบเสร็จได้เฉพาะใบแจ้งหนี้ที่ชำระเงินแล้ว';
  end if;
  if exists (select 1 from public.receipts r where r.invoice_id = p_invoice_id and r.status = 'issued') then
    raise exception 'ใบแจ้งหนี้นี้ออกใบเสร็จไปแล้ว';
  end if;

  select * into v_user from public.app_users where email = public.app_current_email();

  perform pg_advisory_xact_lock(hashtext(v_inv.company_key || v_prefix));
  select coalesce(max(substring(doc_no from length(v_prefix) + 1)::int), 0) + 1
    into v_next
    from public.receipts
   where company_key = v_inv.company_key and doc_no like v_prefix || '%';

  insert into public.receipts (
    invoice_id, company_key, doc_no, issue_date, invoice_doc_no,
    paid_at, payment_method, paid_amount, payment_note, data,
    issued_by, issued_by_name, signature_path
  ) values (
    v_inv.id, v_inv.company_key, v_prefix || lpad(v_next::text, 3, '0'), v_date, v_inv.doc_no,
    v_inv.paid_at, v_inv.payment_method, v_inv.paid_amount, v_inv.payment_note,
    jsonb_build_object(
      'customer', v_inv.customer, 'company', v_inv.company, 'items', v_inv.items,
      'salesman', v_inv.salesman, 'project_name', v_inv.project_name,
      'quotation_no', v_inv.quotation_no, 'ref_document', v_inv.ref_document,
      'credit_term_days', v_inv.credit_term_days, 'due_date', v_inv.due_date,
      'discount', v_inv.discount, 'vat_rate', v_inv.vat_rate, 'wht_rate', v_inv.wht_rate,
      'subtotal', v_inv.subtotal, 'after_discount', v_inv.after_discount, 'vat_amount', v_inv.vat_amount,
      'total', v_inv.total, 'wht_amount', v_inv.wht_amount, 'net_total', v_inv.net_total, 'notes', v_inv.notes
    ),
    public.app_current_email(),
    coalesce(nullif(v_user.display_name, ''), public.app_current_email()),
    v_user.signature_path
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.void_receipt(p_receipt_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.app_has_perm('issue_documents') then raise exception 'ไม่มีสิทธิ์ยกเลิกใบเสร็จ'; end if;
  update public.receipts set
    status = 'void', voided_at = now(), voided_by = public.app_current_email(), void_reason = nullif(trim(p_reason), '')
  where id = p_receipt_id and status = 'issued';
  if not found then raise exception 'ไม่พบใบเสร็จ หรือถูกยกเลิกไปแล้ว'; end if;
end;
$$;

revoke execute on function public.mark_invoice_paid(uuid, date, text, numeric, text) from public, anon;
revoke execute on function public.unmark_invoice_paid(uuid) from public, anon;
revoke execute on function public.issue_receipt(uuid, date) from public, anon;
revoke execute on function public.void_receipt(uuid, text) from public, anon;
revoke execute on function public.void_invoice(uuid, text) from public, anon;
grant execute on function public.mark_invoice_paid(uuid, date, text, numeric, text) to authenticated;
grant execute on function public.unmark_invoice_paid(uuid) to authenticated;
grant execute on function public.issue_receipt(uuid, date) to authenticated;
grant execute on function public.void_receipt(uuid, text) to authenticated;
grant execute on function public.void_invoice(uuid, text) to authenticated;

notify pgrst, 'reload schema';
