-- Reset and Create Sample Data for Terms & Conditions System
-- =======================================================
-- This script clears existing sample data and creates fresh sample data

-- First, delete existing sample data (only for current user's organisation)
DELETE FROM terms_conditions_items 
WHERE organisation_id = (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1);

DELETE FROM terms_conditions_sections 
WHERE organisation_id = (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1);

DELETE FROM terms_conditions_templates 
WHERE organisation_id = (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1);

-- Now create fresh sample data with new UUIDs
-- Sample Template 1: Standard Construction Terms
INSERT INTO terms_conditions_templates (
    id, 
    organisation_id, 
    name, 
    description, 
    is_default, 
    is_active,
    created_at
) VALUES (
    uuid_generate_v4(),
    (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1),
    'Standard Construction Terms',
    'Default terms and conditions for construction projects',
    true,
    true,
    NOW()
) RETURNING id INTO template1_id;

-- Sample Template 2: Simple Terms
INSERT INTO terms_conditions_templates (
    id, 
    organisation_id, 
    name, 
    description, 
    is_default, 
    is_active,
    created_at
) VALUES (
    uuid_generate_v4(),
    (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1),
    'Simple Terms',
    'Basic terms for small projects',
    false,
    true,
    NOW()
) RETURNING id INTO template2_id;

-- Sections for Standard Construction Terms
INSERT INTO terms_conditions_sections (
    id,
    template_id,
    organisation_id,
    title,
    display_order,
    is_configurable,
    created_at
) VALUES 
(uuid_generate_v4(), template1_id, (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), 'Payment Terms', 0, true, NOW()),
(uuid_generate_v4(), template1_id, (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), 'Delivery Terms', 1, true, NOW()),
(uuid_generate_v4(), template1_id, (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), 'Warranty Terms', 2, true, NOW()),
(uuid_generate_v4(), template1_id, (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), 'Cancellation Policy', 3, true, NOW());

-- Get the section IDs for Standard Construction Terms
SELECT id INTO section1_id FROM terms_conditions_sections 
WHERE template_id = template1_id AND title = 'Payment Terms' LIMIT 1;
SELECT id INTO section2_id FROM terms_conditions_sections 
WHERE template_id = template1_id AND title = 'Delivery Terms' LIMIT 1;
SELECT id INTO section3_id FROM terms_conditions_sections 
WHERE template_id = template1_id AND title = 'Warranty Terms' LIMIT 1;
SELECT id INTO section4_id FROM terms_conditions_sections 
WHERE template_id = template1_id AND title = 'Cancellation Policy' LIMIT 1;

-- Items for Payment Terms Section
INSERT INTO terms_conditions_items (
    id,
    section_id,
    organisation_id,
    content,
    display_order,
    item_type,
    is_configurable,
    created_at
) VALUES 
(uuid_generate_v4(), section1_id, (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), '50% advance payment required before project commencement', 0, 'bullet', true, NOW()),
(uuid_generate_v4(), section1_id, (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), '40% payment upon completion of 50% work', 1, 'bullet', true, NOW()),
(uuid_generate_v4(), section1_id, (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), '10% final payment upon project completion and handover', 2, 'bullet', true, NOW());

-- Items for Delivery Terms Section
INSERT INTO terms_conditions_items (
    id,
    section_id,
    organisation_id,
    content,
    display_order,
    item_type,
    is_configurable,
    created_at
) VALUES 
(uuid_generate_v4(), section2_id, (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), 'Materials to be delivered within 7 days of order confirmation', 0, 'bullet', true, NOW()),
(uuid_generate_v4(), section2_id, (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), 'Delivery charges applicable as per distance', 1, 'bullet', true, NOW()),
(uuid_generate_v4(), section2_id, (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), 'Site inspection required before final delivery', 2, 'bullet', true, NOW());

-- Items for Warranty Terms Section
INSERT INTO terms_conditions_items (
    id,
    section_id,
    organisation_id,
    content,
    display_order,
    item_type,
    is_configurable,
    created_at
) VALUES 
(uuid_generate_v4(), section3_id, (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), '12 months warranty on all construction work', 0, 'bullet', true, NOW()),
(uuid_generate_v4(), section3_id, (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), 'Warranty covers manufacturing defects and workmanship', 1, 'bullet', true, NOW()),
(uuid_generate_v4(), section3_id, (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), 'Normal wear and tear excluded from warranty', 2, 'bullet', true, NOW());

-- Items for Cancellation Policy Section
INSERT INTO terms_conditions_items (
    id,
    section_id,
    organisation_id,
    content,
    display_order,
    item_type,
    is_configurable,
    created_at
) VALUES 
(uuid_generate_v4(), section4_id, (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), 'Cancellation allowed within 48 hours of order confirmation', 0, 'bullet', true, NOW()),
(uuid_generate_v4(), section4_id, (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), '25% cancellation charges applicable after 48 hours', 1, 'bullet', true, NOW()),
(uuid_generate_v4(), section4_id, (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), 'No refund after work commencement', 2, 'bullet', true, NOW());

-- Sections for Simple Terms
INSERT INTO terms_conditions_sections (
    id,
    template_id,
    organisation_id,
    title,
    display_order,
    is_configurable,
    created_at
) VALUES 
(uuid_generate_v4(), template2_id, (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), 'Basic Terms', 0, true, NOW());

-- Get the section ID for Simple Terms
SELECT id INTO section5_id FROM terms_conditions_sections 
WHERE template_id = template2_id AND title = 'Basic Terms' LIMIT 1;

-- Items for Simple Terms
INSERT INTO terms_conditions_items (
    id,
    section_id,
    organisation_id,
    content,
    display_order,
    item_type,
    is_configurable,
    created_at
) VALUES 
(uuid_generate_v4(), section5_id, (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), '50% advance payment required', 0, 'bullet', true, NOW()),
(uuid_generate_v4(), section5_id, (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), 'Balance payment on completion', 1, 'bullet', true, NOW()),
(uuid_generate_v4(), section5_id, (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), '6 months warranty on workmanship', 2, 'bullet', true, NOW());

-- Test Query to verify data insertion
SELECT 
    t.name as template_name,
    COUNT(s.id) as sections_count,
    COUNT(i.id) as items_count
FROM terms_conditions_templates t
LEFT JOIN terms_conditions_sections s ON t.id = s.template_id
LEFT JOIN terms_conditions_items i ON s.id = i.section_id
WHERE t.organisation_id = (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1)
GROUP BY t.id, t.name
ORDER BY t.name;
