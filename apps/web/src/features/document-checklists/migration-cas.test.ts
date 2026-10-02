import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261002000000_document_checklists.sql'), 'utf8');
const getFunctionStart = migration.indexOf('CREATE OR REPLACE FUNCTION public.get_document_checklist_configuration');
const getFunctionEnd = migration.indexOf('$function$;', getFunctionStart) + '$function$;'.length;
const getFunction = migration.slice(getFunctionStart, getFunctionEnd);
const saveFunctionStart = migration.indexOf('CREATE OR REPLACE FUNCTION public.save_document_checklist_configuration');
const saveFunctionEnd = migration.indexOf('$function$;', saveFunctionStart) + '$function$;'.length;
const saveFunction = migration.slice(saveFunctionStart, saveFunctionEnd);
const forwardMigration = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261002000001_document_checklist_po_invoice_v2.sql'), 'utf8');
const forwardGetFunctionStart = forwardMigration.indexOf('CREATE OR REPLACE FUNCTION public.get_document_checklist_configuration');
const forwardGetFunctionEnd = forwardMigration.indexOf('$function$;', forwardGetFunctionStart) + '$function$;'.length;
const forwardGetFunction = forwardMigration.slice(forwardGetFunctionStart, forwardGetFunctionEnd);
const forwardSaveFunctionStart = forwardMigration.indexOf('CREATE OR REPLACE FUNCTION public.save_document_checklist_configuration');
const forwardSaveFunctionEnd = forwardMigration.indexOf('$function$;', forwardSaveFunctionStart) + '$function$;'.length;
const forwardSaveFunction = forwardMigration.slice(forwardSaveFunctionStart, forwardSaveFunctionEnd);

describe('document checklist configuration CAS migration contract', () => {
  it('stores one revision row per organization and seeds existing organizations', () => {
    expect(migration).toMatch(/CREATE TABLE public\.document_checklist_configuration_revisions/);
    expect(migration).toMatch(/organisation_id uuid PRIMARY KEY REFERENCES public\.organisations\(id\) ON DELETE CASCADE/);
    expect(migration).toMatch(/INSERT INTO public\.document_checklist_configuration_revisions[\s\S]*SELECT id, 0 FROM public\.organisations/);
    expect(migration).toMatch(/ALTER TABLE public\.document_checklist_configuration_revisions ENABLE ROW LEVEL SECURITY/);
    expect(migration).toMatch(/REVOKE ALL ON public\.document_checklist_configuration_revisions FROM PUBLIC, anon, authenticated/);
  });

  it('returns a stable revision/configuration envelope from reads', () => {
    expect(getFunction).toMatch(/RETURNS jsonb[\s\S]*LANGUAGE plpgsql\s+STABLE/);
    expect(getFunction).toMatch(/'revision', v_revision/);
    expect(getFunction).toMatch(/'configuration', jsonb_build_object/);
    expect(getFunction).not.toMatch(/FOR UPDATE|INSERT INTO/);
  });

  it('checks expected revision before destructive replacement and increments after it succeeds', () => {
    expect(saveFunction).toMatch(/p_expected_revision integer/);
    expect(saveFunction).toMatch(/FOR UPDATE/);
    expect(saveFunction).toMatch(/CHECKLIST_REVISION_CONFLICT/);
    const lock = saveFunction.indexOf('FOR UPDATE');
    const conflict = saveFunction.indexOf('CHECKLIST_REVISION_CONFLICT');
    const deletion = saveFunction.indexOf('DELETE FROM public.document_checklist_groups');
    const increment = saveFunction.indexOf('UPDATE public.document_checklist_configuration_revisions');
    const returnedRevision = saveFunction.indexOf('RETURN v_revision + 1;');
    expect(lock).toBeGreaterThan(-1);
    expect(conflict).toBeGreaterThan(-1);
    expect(lock).toBeLessThan(conflict);
    expect(deletion).toBeGreaterThan(conflict);
    expect(increment).toBeGreaterThan(deletion);
    expect(saveFunction.slice(increment)).toMatch(/SET revision = v_revision \+ 1/);
    expect(returnedRevision).toBeGreaterThan(increment);
  });

  it('widens the SQL assignment constraint and getter to exactly four keys', () => {
    expect(forwardMigration.startsWith('BEGIN;')).toBe(true);
    expect(forwardMigration.trimEnd().endsWith('COMMIT;')).toBe(true);
    expect(forwardMigration).not.toMatch(/CREATE TABLE/i);
    expect(forwardMigration).toMatch(/CHECK \(document_type IN \('quotation', 'sales_order', 'purchase_order', 'invoice_v2'\)\)/);
    expect(forwardGetFunction).toMatch(/'quotation', v_quotation_assignments/);
    expect(forwardGetFunction).toMatch(/'sales_order', v_sales_order_assignments/);
    expect(forwardGetFunction).toMatch(/'purchase_order', v_purchase_order_assignments/);
    expect(forwardGetFunction).toMatch(/'invoice_v2', v_invoice_v2_assignments/);
    expect(forwardGetFunction).toMatch(/v_purchase_order_assignments[\s\S]*COALESCE\(jsonb_agg[\s\S]*'\[\]'::jsonb/);
    expect(forwardGetFunction).toMatch(/v_invoice_v2_assignments[\s\S]*COALESCE\(jsonb_agg[\s\S]*'\[\]'::jsonb/);
  });

  it('accepts legacy two-key saves but validates unknown keys before replacement', () => {
    expect(forwardSaveFunction).toMatch(/jsonb_typeof\(p_config->'assignments'->'quotation'\) IS DISTINCT FROM 'array'[\s\S]*jsonb_typeof\(p_config->'assignments'->'sales_order'\) IS DISTINCT FROM 'array'/);
    expect(forwardSaveFunction).toMatch(/\? 'purchase_order'[\s\S]*jsonb_typeof\(p_config->'assignments'->'purchase_order'\) IS DISTINCT FROM 'array'/);
    expect(forwardSaveFunction).toMatch(/\? 'invoice_v2'[\s\S]*jsonb_typeof\(p_config->'assignments'->'invoice_v2'\) IS DISTINCT FROM 'array'/);
    expect(forwardSaveFunction).toMatch(/assignment_key\.key_name NOT IN \('quotation', 'sales_order', 'purchase_order', 'invoice_v2'\)/);
    expect(forwardSaveFunction).toMatch(/v_document_type NOT IN \('quotation', 'sales_order', 'purchase_order', 'invoice_v2'\)/);
    expect(forwardSaveFunction.indexOf('Unsupported checklist document type')).toBeLessThan(
      forwardSaveFunction.indexOf('DELETE FROM public.document_checklist_groups'),
    );
  });

  it('preserves omitted new assignments only for retained group IDs before destructive replacement', () => {
    const deletion = forwardSaveFunction.indexOf('DELETE FROM public.document_checklist_groups');
    const purchaseOrderPreservation = forwardSaveFunction.indexOf("a.document_type = 'purchase_order'");
    const invoiceV2Preservation = forwardSaveFunction.indexOf("a.document_type = 'invoice_v2'");

    expect(forwardSaveFunction).toMatch(/v_assignments := p_config->'assignments';[\s\S]*IF \(v_assignments \? 'purchase_order'\) IS FALSE/);
    expect(forwardSaveFunction).toMatch(/IF \(v_assignments \? 'purchase_order'\) IS FALSE[\s\S]*jsonb_array_elements\(p_config->'groups'\)/);
    expect(forwardSaveFunction).toMatch(/IF \(v_assignments \? 'invoice_v2'\) IS FALSE[\s\S]*jsonb_array_elements\(p_config->'groups'\)/);
    expect(purchaseOrderPreservation).toBeGreaterThan(-1);
    expect(invoiceV2Preservation).toBeGreaterThan(-1);
    expect(purchaseOrderPreservation).toBeLessThan(deletion);
    expect(invoiceV2Preservation).toBeLessThan(deletion);
    expect(forwardSaveFunction).toMatch(/FOR v_document_type, v_assignment_ids IN[\s\S]*SELECT key, value FROM jsonb_each\(v_assignments\)[\s\S]*DELETE FROM public\.document_checklist_groups/);
  });

  it('treats supplied empty new-key arrays as intentional clears', () => {
    expect(forwardSaveFunction).toMatch(/v_assignments := p_config->'assignments';[\s\S]*IF \(v_assignments \? 'purchase_order'\) IS FALSE THEN/);
    expect(forwardSaveFunction).toMatch(/IF \(v_assignments \? 'invoice_v2'\) IS FALSE THEN/);
    expect(forwardSaveFunction).toMatch(/jsonb_array_elements_text\(v_assignment_ids\) WITH ORDINALITY/);
  });

  it('retains the existing authorization, CAS, and revision increment contract', () => {
    expect(forwardSaveFunction).toMatch(/public\.user_can_access_org\(p_organisation_id\)/);
    expect(forwardSaveFunction).toMatch(/public\.has_permission\(p_organisation_id, 'org\.settings'\)/);
    const lock = forwardSaveFunction.indexOf('FOR UPDATE');
    const conflict = forwardSaveFunction.indexOf('CHECKLIST_REVISION_CONFLICT');
    const deletion = forwardSaveFunction.indexOf('DELETE FROM public.document_checklist_groups');
    const increment = forwardSaveFunction.indexOf('UPDATE public.document_checklist_configuration_revisions');
    expect(lock).toBeGreaterThan(-1);
    expect(lock).toBeLessThan(conflict);
    expect(conflict).toBeLessThan(deletion);
    expect(increment).toBeGreaterThan(deletion);
    expect(forwardSaveFunction.slice(increment)).toMatch(/SET revision = v_revision \+ 1/);
  });
});
