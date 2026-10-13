-- 20261009000001_finalize_repost_on_edit.sql
-- Re-finalize after an edit left the GL stale: finalize_sales_invoice skipped
-- posting whenever ANY prior Sales journal existed for the voucher, so edited
-- amounts updated stock + header while books kept the old numbers.
-- Fix: void the previous Sales journal (audit preserved) and repost fresh,
-- all inside the same finalize transaction. Edits to finalized invoices now
-- keep books exact; audit trail shows Voided + replacement journals.
--
-- Technique: self-modifying migration (verbatim snippet replace + drift
-- guard). No full-function transcription, fails loud if the live body moved.
-- Run in Supabase SQL editor.

DO $$
DECLARE
  src TEXT;
  old_snippet TEXT;
  new_snippet TEXT;
BEGIN
  SELECT pg_get_functiondef(oid) INTO src
  FROM pg_proc
  WHERE proname = 'finalize_sales_invoice'
    AND pronamespace = 'public'::regnamespace;

  IF src IS NULL THEN
    RAISE EXCEPTION 'finalize_sales_invoice not found; aborting';
  END IF;

  old_snippet := E'  -- F. Atomic Double-Entry GL Journal Posting\n' ||
    E'  SELECT id INTO v_journal_id\n' ||
    E'  FROM public.journal_entries\n' ||
    E'  WHERE (company_id = p_organisation_id OR organisation_id = p_organisation_id)\n' ||
    E'    AND voucher_no = COALESCE(v_invoice.invoice_no, p_invoice_id::TEXT)\n' ||
    E'    AND voucher_type = ''Sales'';\n' ||
    E'\n' ||
    E'  IF v_journal_id IS NULL THEN';

  IF position(old_snippet IN src) = 0 THEN
    RAISE EXCEPTION 'finalize_sales_invoice body changed since audit; aborting repost patch (re-audit first)';
  END IF;

  new_snippet := E'  -- F. Atomic Double-Entry GL Journal Posting\n' ||
    E'  SELECT id INTO v_journal_id\n' ||
    E'  FROM public.journal_entries\n' ||
    E'  WHERE (company_id = p_organisation_id OR organisation_id = p_organisation_id)\n' ||
    E'    AND voucher_no = COALESCE(v_invoice.invoice_no, p_invoice_id::TEXT)\n' ||
    E'    AND voucher_type = ''Sales''\n' ||
    E'    AND COALESCE(status, '''') <> ''Void'';\n' ||
    E'\n' ||
    E'  -- Re-finalize after an edit: void the previous Sales journal so the\n' ||
    E'  -- books always reflect the current document. Voided journals stay as audit.\n' ||
    E'  IF v_journal_id IS NOT NULL THEN\n' ||
    E'    UPDATE public.journal_entries\n' ||
    E'    SET status = ''Void'',\n' ||
    E'        narration = narration || '' [Voided by re-finalize '' || to_char(NOW(), ''YYYY-MM-DD HH24:MI'') || '']'',\n' ||
    E'        updated_at = NOW()\n' ||
    E'    WHERE id = v_journal_id;\n' ||
    E'    v_journal_id := NULL;\n' ||
    E'  END IF;\n' ||
    E'\n' ||
    E'  IF v_journal_id IS NULL THEN';

  src := replace(src, old_snippet, new_snippet);
  EXECUTE src;

  RAISE NOTICE 'finalize_sales_invoice patched: void-and-repost on re-finalize';
END
$$;
