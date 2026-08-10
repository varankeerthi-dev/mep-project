-- Payments Hub soft-delete support.
--
-- The accountant Payments Hub gets a non-destructive bulk "Delete" action:
-- instead of physically removing rows, we flag them with is_deleted and keep
-- the deletion reason + audit trail. Existing table consumers keep working
-- because the columns are nullable/defaulted.

ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deletion_reason text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

ALTER TABLE public.purchase_payments
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deletion_reason text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

ALTER TABLE public.subcontractor_payments
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deletion_reason text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

-- Keep the "show only live rows" filter fast.
CREATE INDEX IF NOT EXISTS payment_requests_is_deleted_idx
  ON public.payment_requests (is_deleted);
CREATE INDEX IF NOT EXISTS purchase_payments_is_deleted_idx
  ON public.purchase_payments (is_deleted);
CREATE INDEX IF NOT EXISTS subcontractor_payments_is_deleted_idx
  ON public.subcontractor_payments (is_deleted);
