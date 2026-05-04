-- Fix RLS Policies for Terms & Conditions System
-- ===============================================
-- This script updates the RLS policies to work correctly with Supabase

-- 1. Drop existing problematic RLS policies
DROP POLICY IF EXISTS "terms_templates_organisation_policy" ON terms_conditions_templates;
DROP POLICY IF EXISTS "terms_sections_organisation_policy" ON terms_conditions_sections;
DROP POLICY IF EXISTS "terms_items_organisation_policy" ON terms_conditions_items;
DROP POLICY IF EXISTS "quotation_terms_organisation_policy" ON quotation_terms_conditions;
DROP POLICY IF EXISTS "client_payment_terms_organisation_policy" ON client_payment_terms;

-- 2. Create RLS policies using standard Supabase pattern
-- Note: Using auth.uid() directly without casting since Supabase handles the comparison

CREATE POLICY "terms_templates_organisation_policy" ON terms_conditions_templates
    FOR ALL USING (organisation_id IN (
        SELECT organisation_id FROM user_organisations 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    ))
    WITH CHECK (organisation_id IN (
        SELECT organisation_id FROM user_organisations 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    ));

CREATE POLICY "terms_sections_organisation_policy" ON terms_conditions_sections
    FOR ALL USING (organisation_id IN (
        SELECT organisation_id FROM user_organisations 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    ))
    WITH CHECK (organisation_id IN (
        SELECT organisation_id FROM user_organisations 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    ));

CREATE POLICY "terms_items_organisation_policy" ON terms_conditions_items
    FOR ALL USING (organisation_id IN (
        SELECT organisation_id FROM user_organisations 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    ))
    WITH CHECK (organisation_id IN (
        SELECT organisation_id FROM user_organisations 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    ));

CREATE POLICY "quotation_terms_organisation_policy" ON quotation_terms_conditions
    FOR ALL USING (organisation_id IN (
        SELECT organisation_id FROM user_organisations 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    ))
    WITH CHECK (organisation_id IN (
        SELECT organisation_id FROM user_organisations 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    ));

CREATE POLICY "client_payment_terms_organisation_policy" ON client_payment_terms
    FOR ALL USING (organisation_id IN (
        SELECT organisation_id FROM user_organisations 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    ))
    WITH CHECK (organisation_id IN (
        SELECT organisation_id FROM user_organisations 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    ));

-- 3. Alternative: If user_organisations table doesn't exist, use a simpler approach
-- Uncomment and run this section if the above doesn't work

/*
DROP POLICY IF EXISTS "terms_templates_organisation_policy" ON terms_conditions_templates;
DROP POLICY IF EXISTS "terms_sections_organisation_policy" ON terms_conditions_sections;
DROP POLICY IF EXISTS "terms_items_organisation_policy" ON terms_conditions_items;
DROP POLICY IF EXISTS "quotation_terms_organisation_policy" ON quotation_terms_conditions;
DROP POLICY IF EXISTS "client_payment_terms_organisation_policy" ON client_payment_terms;

-- Create simple policies that allow access to all authenticated users
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
*/

-- 4. Test query to verify the policies work
-- Run this to test if the policies are working:
-- SELECT * FROM terms_conditions_templates LIMIT 1;
