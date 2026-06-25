-- Migration: 088_accounting_rls_policies.sql
-- Description: Adds open RLS policies to accounting tables to match the rest of the application.

DO $$ 
DECLARE
    tbl TEXT;
    table_list TEXT[] := ARRAY['accounts', 'journal_entries', 'journal_entry_lines', 'journal_audit_logs', 'posting_rules', 'posting_rule_lines', 'pdc_register', 'asset_register', 'depreciation_schedules', 'asset_disposal_entries'];
BEGIN
    FOREACH tbl IN ARRAY table_list LOOP
        -- Enable RLS
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

        -- Add Policies
        EXECUTE format('
            DROP POLICY IF EXISTS "Users can view %1$s" ON %1$I;
            CREATE POLICY "Users can view %1$s" ON %1$I FOR SELECT USING (true);
            
            DROP POLICY IF EXISTS "Users can insert %1$s" ON %1$I;
            CREATE POLICY "Users can insert %1$s" ON %1$I FOR INSERT WITH CHECK (true);
            
            DROP POLICY IF EXISTS "Users can update %1$s" ON %1$I;
            CREATE POLICY "Users can update %1$s" ON %1$I FOR UPDATE USING (true);
            
            DROP POLICY IF EXISTS "Users can delete %1$s" ON %1$I;
            CREATE POLICY "Users can delete %1$s" ON %1$I FOR DELETE USING (true);
        ', tbl);
    END LOOP;
END $$;
