begin;

alter table public.purchase_payments
add column if not exists has_vendor_proforma boolean not null default false,
add column if not exists vendor_proforma_invoice text,
add column if not exists vendor_proforma_date date,
add column if not exists vendor_proforma_amount numeric(15,2);

commit;
