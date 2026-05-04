-- Simple Terms & Conditions Data for Supabase
-- ==========================================
-- This script creates default T&C data for an existing organisation
-- Run each query individually and replace IDs manually

-- STEP 1: Get your organisation ID first
-- Run this query and copy the ID:
SELECT id, name FROM organisations ORDER BY created_at DESC LIMIT 1;

-- STEP 2: Create the template (replace with your actual organisation ID)
INSERT INTO terms_conditions_templates (organisation_id, name, description, is_default, is_active)
VALUES (
    'PASTE_YOUR_ORGANISATION_ID_HERE', -- Replace this with your actual UUID
    'Standard Terms & Conditions',
    'Default terms and conditions template for quotations',
    true,
    true
);

-- STEP 3: Get the template ID you just created
-- Run this query and copy the ID:
SELECT id FROM terms_conditions_templates WHERE name = 'Standard Terms & Conditions' AND organisation_id = 'PASTE_YOUR_ORGANISATION_ID_HERE';

-- STEP 4: Create sections (replace with your actual template and organisation IDs)
INSERT INTO terms_conditions_sections (template_id, organisation_id, title, display_order, is_configurable)
VALUES 
    ('PASTE_TEMPLATE_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'TAXES', 1, true),
    ('PASTE_TEMPLATE_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'Payment Terms', 2, true),
    ('PASTE_TEMPLATE_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'Delivery', 3, true),
    ('PASTE_TEMPLATE_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'Freight', 4, true),
    ('PASTE_TEMPLATE_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'General Terms and Conditions', 5, true),
    ('PASTE_TEMPLATE_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'Project related scope', 6, true),
    ('PASTE_TEMPLATE_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'Warranty', 7, true),
    ('PASTE_TEMPLATE_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'Exclusions', 8, true);

-- STEP 5: Get all section IDs you just created
-- Run this query and copy the IDs:
SELECT id, title FROM terms_conditions_sections WHERE template_id = 'PASTE_TEMPLATE_ID_HERE' ORDER BY display_order;

-- STEP 6: Create items for each section (replace with actual IDs)

-- TAXES section items (replace TAXES_SECTION_ID_HERE)
INSERT INTO terms_conditions_items (section_id, organisation_id, content, display_order, item_type, is_configurable)
VALUES 
    ('PASTE_TAXES_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', '18% EXTRA', 1, 'bullet', true),
    ('PASTE_TAXES_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'HSN: 39172200 18% GST', 2, 'bullet', true),
    ('PASTE_TAXES_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'SAC: 995462 18% GST', 3, 'bullet', true);

-- Payment Terms section items (replace PAYMENT_TERMS_SECTION_ID_HERE)
INSERT INTO terms_conditions_items (section_id, organisation_id, content, display_order, item_type, is_configurable)
VALUES 
    ('PASTE_PAYMENT_TERMS_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'Material: 100% advance against Proforma Invoice', 1, 'bullet', true),
    ('PASTE_PAYMENT_TERMS_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'Erection: 30% advance, 70% immediate after work completion', 2, 'bullet', true);

-- Delivery section items (replace DELIVERY_SECTION_ID_HERE)
INSERT INTO terms_conditions_items (section_id, organisation_id, content, display_order, item_type, is_configurable)
VALUES 
    ('PASTE_DELIVERY_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'Supply: Two Weeks from the date of advance', 1, 'bullet', true);

-- Freight section items (replace FREIGHT_SECTION_ID_HERE)
INSERT INTO terms_conditions_items (section_id, organisation_id, content, display_order, item_type, is_configurable)
VALUES 
    ('PASTE_FREIGHT_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', '20000 + 18% GST -', 1, 'bullet', true);

-- General Terms and Conditions section items (replace GENERAL_TERMS_SECTION_ID_HERE)
INSERT INTO terms_conditions_items (section_id, organisation_id, content, display_order, item_type, is_configurable)
VALUES 
    ('PASTE_GENERAL_TERMS_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'Bill of Materials may vary 15% as per site conditions. Any additional material required need a prior approval.', 1, 'bullet', true),
    ('PASTE_GENERAL_TERMS_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'Additional material supplied will be charged extra', 2, 'bullet', true),
    ('PASTE_GENERAL_TERMS_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'Submission of As built drawings, Shop Drawings will be charged extra.', 3, 'bullet', true),
    ('PASTE_GENERAL_TERMS_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'Providing drinking water, Electrical supply will be at client scope.', 4, 'bullet', true),
    ('PASTE_GENERAL_TERMS_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'At Client Scope', 5, 'text', true),
    ('PASTE_GENERAL_TERMS_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'Electrical Supply to Welding Machines - Single Phase', 6, 'bullet', true),
    ('PASTE_GENERAL_TERMS_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'Ladder, Scoffolding, All Civil Work - Floor Breaking, Excavation, Sheet Cutting', 7, 'bullet', true),
    ('PASTE_GENERAL_TERMS_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'Crane, Boom Lift if required at any stage of the project', 8, 'bullet', true),
    ('PASTE_GENERAL_TERMS_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'Dedicated Storage place for pipes, fittings, valuable items, Tools', 9, 'bullet', true),
    ('PASTE_GENERAL_TERMS_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'Installation of Conveying Pipes, Electrical Tray.', 10, 'bullet', true),
    ('PASTE_GENERAL_TERMS_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'At Our Scope', 11, 'text', true),
    ('PASTE_GENERAL_TERMS_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'Our scope of Work is limited upto Provision of Ball Valves near to the Machines. (Hose fixing additional)', 12, 'bullet', true),
    ('PASTE_GENERAL_TERMS_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'MS Structural - Provisions for PIPING & Cable Trays in Injection Moulding Machine area only.', 13, 'bullet', true);

-- Project related scope section items (replace PROJECT_SCOPE_SECTION_ID_HERE)
INSERT INTO terms_conditions_items (section_id, organisation_id, content, display_order, item_type, is_configurable)
VALUES 
    ('PASTE_PROJECT_SCOPE_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'At Client Scope', 1, 'text', true),
    ('PASTE_PROJECT_SCOPE_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'Chiller, Tank, Cabling, final positioning of Equipments.', 2, 'bullet', true),
    ('PASTE_PROJECT_SCOPE_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'Physical Floor marking of Injection Moulding Machines', 3, 'bullet', true),
    ('PASTE_PROJECT_SCOPE_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'Supply and Positioning of Rental Chillers, Cooling Towers', 4, 'bullet', true),
    ('PASTE_PROJECT_SCOPE_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'Providing Hoses for Rental Chiller', 5, 'bullet', true),
    ('PASTE_PROJECT_SCOPE_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'MS Structural Supporting for piping related for the project', 6, 'bullet', true);

-- Warranty section items (replace WARRANTY_SECTION_ID_HERE)
INSERT INTO terms_conditions_items (section_id, organisation_id, content, display_order, item_type, is_configurable)
VALUES 
    ('PASTE_WARRANTY_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'PPR Pipes & Fittings: 2years from the date of Handover as in-built Conditions', 1, 'bullet', true),
    ('PASTE_WARRANTY_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'Valves and Gauges: 1 year from the date of Installation', 2, 'bullet', true);

-- Exclusions section items (replace EXCLUSIONS_SECTION_ID_HERE)
INSERT INTO terms_conditions_items (section_id, organisation_id, content, display_order, item_type, is_configurable)
VALUES 
    ('PASTE_EXCLUSIONS_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'Insulation for Branch Tapping Pipes', 1, 'bullet', true),
    ('PASTE_EXCLUSIONS_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'DG, Hydraulic Hoses, Hydraulic Nipples', 2, 'bullet', true),
    ('PASTE_EXCLUSIONS_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'MS STRUCTURAL SUPPORT', 3, 'bullet', true),
    ('PASTE_EXCLUSIONS_SECTION_ID_HERE', 'PASTE_YOUR_ORGANISATION_ID_HERE', 'All disputes shall be subject to Cheyyar Jurisdiction.', 4, 'bullet', true);

-- STEP 7: Verify data was inserted correctly
SELECT 
    t.name as template_name,
    COUNT(s.id) as section_count,
    COUNT(i.id) as item_count
FROM terms_conditions_templates t
LEFT JOIN terms_conditions_sections s ON t.id = s.template_id
LEFT JOIN terms_conditions_items i ON s.id = i.section_id
WHERE t.organisation_id = 'PASTE_YOUR_ORGANISATION_ID_HERE'
GROUP BY t.id, t.name;
