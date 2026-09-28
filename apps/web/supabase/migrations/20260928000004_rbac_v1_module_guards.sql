-- WEL-44 Phase 4 (increment 1): module write-guards + salary field guard.
-- Applied directly to the live database via Supabase MCP on 2026-09-28.
--
-- Trigger-based (overload-proof) enforcement at mutation boundaries:
--   invoices status -> final            => invoices.edit
--   quotation_header INSERT / UPDATE    => quotations.create / edit
--   purchase_bills INSERT               => purchase_orders.create
--   payroll_runs status transitions     => hr.edit
-- Service-role/server flows (no auth.uid) pass through; their own DEFINER
-- RPC authorization remains the boundary (documented CTO-8 pattern).
--
-- hr.salary: interactive writes to employees.monthly_salary require the
-- field grant; reads are NOT yet redacted at the query layer (follow-up).

CREATE OR REPLACE FUNCTION public.trg_require_perm()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_org uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    v_org := OLD.organisation_id;
  ELSE
    v_org := NEW.organisation_id;
  END IF;
  PERFORM public.require_permission(v_org, TG_ARGV[0], TG_ARGV[1]);
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

DROP TRIGGER IF EXISTS trg_invoices_finalize_guard ON public.invoices;
CREATE TRIGGER trg_invoices_finalize_guard
BEFORE UPDATE ON public.invoices
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM 'final' AND NEW.status = 'final')
EXECUTE FUNCTION public.trg_require_perm('invoices', 'edit');

DROP TRIGGER IF EXISTS trg_quotation_insert_guard ON public.quotation_header;
CREATE TRIGGER trg_quotation_insert_guard
BEFORE INSERT ON public.quotation_header
FOR EACH ROW EXECUTE FUNCTION public.trg_require_perm('quotations', 'create');

DROP TRIGGER IF EXISTS trg_quotation_update_guard ON public.quotation_header;
CREATE TRIGGER trg_quotation_update_guard
BEFORE UPDATE ON public.quotation_header
FOR EACH ROW EXECUTE FUNCTION public.trg_require_perm('quotations', 'edit');

DROP TRIGGER IF EXISTS trg_purchase_bill_insert_guard ON public.purchase_bills;
CREATE TRIGGER trg_purchase_bill_insert_guard
BEFORE INSERT ON public.purchase_bills
FOR EACH ROW EXECUTE FUNCTION public.trg_require_perm('purchase_orders', 'create');

DROP TRIGGER IF EXISTS trg_payroll_status_guard ON public.payroll_runs;
CREATE TRIGGER trg_payroll_status_guard
BEFORE UPDATE ON public.payroll_runs
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.trg_require_perm('hr', 'edit');

CREATE OR REPLACE FUNCTION public.trg_employees_salary_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.monthly_salary IS NOT NULL
       AND NOT public.can_view_field(NEW.organisation_id, 'hr.salary') THEN
      RAISE EXCEPTION 'You do not have permission to perform this action.';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.monthly_salary IS DISTINCT FROM NEW.monthly_salary THEN
    IF NOT public.can_view_field(COALESCE(NEW.organisation_id, OLD.organisation_id), 'hr.salary') THEN
      RAISE EXCEPTION 'You do not have permission to perform this action.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_employees_salary_guard ON public.employees;
CREATE TRIGGER trg_employees_salary_guard
BEFORE INSERT OR UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.trg_employees_salary_guard();
