-- Default Terms & Conditions Data
-- ==============================
-- Run this script after creating an organisation to populate default T&C data
-- REPLACE 'YOUR_ORGANISATION_ID_HERE' with your actual organisation ID

-- 1. Insert default template
-- First, run this query to get your organisation ID:
-- SELECT id, name FROM organisations ORDER BY created_at DESC LIMIT 1;

INSERT INTO terms_conditions_templates (organisation_id, name, description, is_default, is_active)
VALUES (
    'YOUR_ORGANISATION_ID_HERE', -- <-- REPLACE THIS WITH YOUR ACTUAL ORGANISATION ID
    'Standard Terms & Conditions',
    'Default terms and conditions template for quotations',
    true,
    true
);

-- 2. Insert sections for the default template
INSERT INTO terms_conditions_sections (template_id, organisation_id, title, display_order, is_configurable)
VALUES 
    (template_id, :organisation_id, 'TAXES', 1, true),
    (template_id, :organisation_id, 'Payment Terms', 2, true),
    (template_id, :organisation_id, 'Delivery', 3, true),
    (template_id, :organisation_id, 'Freight', 4, true),
    (template_id, :organisation_id, 'General Terms and Conditions', 5, true),
    (template_id, :organisation_id, 'Project related scope', 6, true),
    (template_id, :organisation_id, 'Warranty', 7, true),
    (template_id, :organisation_id, 'Exclusions', 8, true)
RETURNING id INTO section_ids;

-- 3. Insert items for TAXES section
INSERT INTO terms_conditions_items (section_id, organisation_id, content, display_order, item_type, is_configurable)
SELECT 
    id, 
    :organisation_id, 
    unnest(ARRAY[
        '18% EXTRA',
        'HSN: 39172200 18% GST',
        'SAC: 995462 18% GST'
    ]),
    unnest(ARRAY[1, 2, 3]),
    'bullet',
    true
FROM terms_conditions_sections 
WHERE template_id = template_id AND title = 'TAXES';

-- 4. Insert items for Payment Terms section
INSERT INTO terms_conditions_items (section_id, organisation_id, content, display_order, item_type, is_configurable)
SELECT 
    id, 
    :organisation_id, 
    unnest(ARRAY[
        'Material: 100% advance against Proforma Invoice',
        'Erection: 30% advance, 70% immediate after work completion'
    ]),
    unnest(ARRAY[1, 2]),
    'bullet',
    true
FROM terms_conditions_sections 
WHERE template_id = template_id AND title = 'Payment Terms';

-- 5. Insert items for Delivery section
INSERT INTO terms_conditions_items (section_id, organisation_id, content, display_order, item_type, is_configurable)
SELECT 
    id, 
    :organisation_id, 
    'Supply: Two Weeks from the date of advance',
    1,
    'bullet',
    true
FROM terms_conditions_sections 
WHERE template_id = template_id AND title = 'Delivery';

-- 6. Insert items for Freight section
INSERT INTO terms_conditions_items (section_id, organisation_id, content, display_order, item_type, is_configurable)
SELECT 
    id, 
    :organisation_id, 
    '20000 + 18% GST -',
    1,
    'bullet',
    true
FROM terms_conditions_sections 
WHERE template_id = template_id AND title = 'Freight';

-- 7. Insert items for General Terms and Conditions section
INSERT INTO terms_conditions_items (section_id, organisation_id, content, display_order, item_type, is_configurable)
SELECT 
    id, 
    :organisation_id, 
    unnest(ARRAY[
        'Bill of Materials may vary 15% as per site conditions. Any additional material required need a prior approval.',
        'Additional material supplied will be charged extra',
        'Submission of As built drawings, Shop Drawings will be charged extra.',
        'Providing drinking water, Electrical supply will be at client scope.',
        'At Client Scope',
        'Electrical Supply to Welding Machines - Single Phase',
        'Ladder, Scoffolding, All Civil Work - Floor Breaking, Excavation, Sheet Cutting',
        'Crane, Boom Lift if required at any stage of the project',
        'Dedicated Storage place for pipes, fittings, valuable items, Tools',
        'Installtion of Conveying Pipes, Electrical Tray.',
        'At Our Scope',
        'Our scope of Work is limited upto Provision of Ball Valves near to the Machines. (Hose fixing additional)',
        'MS Structural - Provisions for PIPING & Cable Trays in Injection Moulding Machine area only.'
    ]),
    unnest(ARRAY[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]),
    unnest(ARRAY['bullet', 'bullet', 'bullet', 'bullet', 'text', 'bullet', 'bullet', 'bullet', 'bullet', 'bullet', 'text', 'bullet', 'bullet']),
    true
FROM terms_conditions_sections 
WHERE template_id = template_id AND title = 'General Terms and Conditions';

-- 8. Insert items for Project related scope section
INSERT INTO terms_conditions_items (section_id, organisation_id, content, display_order, item_type, is_configurable)
SELECT 
    id, 
    :organisation_id, 
    unnest(ARRAY[
        'At Client Scope',
        'Chiller, Tank, Cabling, final positioning of Equipments.',
        'Physical Floor marking of Injection Moudling Machines',
        'Supply and Positioning of Rental Chillers, Cooling Towers',
        'Providing Hoses for Rental Chiller',
        'MS Structural Supporting for piping related for the project'
    ]),
    unnest(ARRAY[1, 2, 3, 4, 5, 6]),
    unnest(ARRAY['text', 'bullet', 'bullet', 'bullet', 'bullet', 'bullet']),
    true
FROM terms_conditions_sections 
WHERE template_id = template_id AND title = 'Project related scope';

-- 9. Insert items for Warranty section
INSERT INTO terms_conditions_items (section_id, organisation_id, content, display_order, item_type, is_configurable)
SELECT 
    id, 
    :organisation_id, 
    unnest(ARRAY[
        'PPR Pipes & Fittings: 2years from the date of Handover as in-built Conditions',
        'Valves and Gauges: 1 year from the date of Installation'
    ]),
    unnest(ARRAY[1, 2]),
    'bullet',
    true
FROM terms_conditions_sections 
WHERE template_id = template_id AND title = 'Warranty';

-- 10. Insert items for Exclusions section
INSERT INTO terms_conditions_items (section_id, organisation_id, content, display_order, item_type, is_configurable)
SELECT 
    id, 
    :organisation_id, 
    unnest(ARRAY[
        'Insulation for Branch Tapping Pipes',
        'DG, Hydraulic Hoses, Hydraulic Nipples',
        'MS STRUCTURAL SUPPORT',
        'All disputes shall be subject to Cheyyar Jurisdiction.'
    ]),
    unnest(ARRAY[1, 2, 3, 4]),
    'bullet',
    true
FROM terms_conditions_sections 
WHERE template_id = template_id AND title = 'Exclusions';

-- Verification query
SELECT 
    t.name as template_name,
    COUNT(s.id) as section_count,
    COUNT(i.id) as item_count
FROM terms_conditions_templates t
LEFT JOIN terms_conditions_sections s ON t.id = s.template_id
LEFT JOIN terms_conditions_items i ON s.id = i.section_id
WHERE t.organisation_id = :organisation_id
GROUP BY t.id, t.name;
