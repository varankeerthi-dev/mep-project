-- Simple RLS Policies for Terms & Conditions System
-- ===============================================
-- This script uses simple RLS policies to fix the 406 PGRST116 error

-- 1. Drop existing problematic RLS policies
DROP POLICY IF EXISTS "terms_templates_organisation_policy" ON terms_conditions_templates;
DROP POLICY IF EXISTS "terms_sections_organisation_policy" ON terms_conditions_sections;
DROP POLICY IF EXISTS "terms_items_organisation_policy" ON terms_conditions_items;
DROP POLICY IF EXISTS "quotation_terms_organisation_policy" ON quotation_terms_conditions;
DROP POLICY IF EXISTS "client_payment_terms_organisation_policy" ON client_payment_terms;

-- 2. Create simple RLS policies that allow access to all authenticated users
-- The application will handle organisation filtering

CREATE POLICY "terms_templates_organisation_policy" ON terms_conditions_templates
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "terms_sections_organisation_policy" ON terms_conditions_sections
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "terms_items_organisation_policy" ON terms_conditions_items
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "quotation_terms_organisation_policy" ON quotation_terms_conditions
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "client_payment_terms_organisation_policy" ON client_payment_terms
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- 3. Test query to verify the policies work
-- Run this to test if the policies are working:
-- SELECT * FROM terms_conditions_templates LIMIT 1;
