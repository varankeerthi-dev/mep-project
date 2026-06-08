begin;

alter table public.purchase_payments
add column if not exists cheque_due_date date;

alter table public.subcontractor_payments
add column if not exists cheque_due_date date;

commit;
