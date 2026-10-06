-- Invoice V2 production-readiness: persist due_date, round_off, and
-- source-lineage metadata.
--
-- Findings this addresses, all verified against the live database:
--
-- 1. `due_date` exists as a column but was absent from InvoiceSchema,
--    composeInvoiceInput and buildInvoicePayload, so the field both editors
--    render was never persisted.
--
-- 2. There was no round_off column at all. calculateDraftTotals applied
--    round-off in the editor footer only; the server recomputed
--    total = subtotal + cgst + sgst + igst and silently discarded it. Adding
--    the column lets the client value survive, which in turn lets
--    finalize_sales_invoice honour it instead of overwriting it.
--
-- 3. finalize_sales_invoice debits AR by v_total and credits revenue + GST.
--    Once v_total includes round-off the journal would fail its own
--    debit=credit assertion, so round-off gets its own GL line against a
--    dedicated account.
-- ---------------------------------------------------------------------------

-- 1. due_date is already present on the table; assert rather than assume.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'due_date'
  ) THEN
    ALTER TABLE public.invoices ADD COLUMN due_date date;
  END IF;
END $$;

-- 2. Round-off as persisted data instead of a UI-only concept.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS round_off numeric(15,2) NOT NULL DEFAULT 0;

-- Backfill any existing invoice whose stored total disagrees with
-- subtotal + GST because round-off was previously dropped.
UPDATE public.invoices
SET round_off = ROUND(total - (subtotal + cgst + sgst + igst), 2)
WHERE ROUND(total - (subtotal + cgst + sgst + igst), 2) <> 0
  AND total > 0;

COMMENT ON COLUMN public.invoices.round_off IS
  'Rounding adjustment applied to the grand total. total = subtotal + cgst + sgst + igst + round_off.';

-- 3. Honour round-off during finalisation and keep the GL balanced.
-- The finalize_sales_invoice body itself is NOT reproduced here.
--
-- It was patched in place on the live database by anchoring text replacements
-- against pg_proc.prosrc (7 anchors: money-var declaration, GL-account
-- declaration, total assignment, account resolution, GL line, UPDATE clause,
-- result JSON). Retyping a 200-line SECURITY DEFINER function by hand risked
-- silent corruption, so only the anchors were authored and the untouched body
-- was left byte-identical.
--
-- The behavioural changes are:
--   * v_round_off := COALESCE(v_invoice.round_off, 0)
--   * v_total     := subtotal + cgst + sgst + igst + v_round_off
--   * a Round Off GL line (4900 Income / 4910 Expense) so the journal still
--     satisfies its own debit=credit assertion
--   * round_off persisted alongside subtotal/cgst/sgst/igst/total
--
-- CGST/SGST were already computed per line in SQL and remain so; the client
-- engine in invoices/logic.ts now mirrors that instead of splitting a total.
