-- Sample Data for Terms & Conditions System (Auto Organisation)
-- ==========================================================
-- This script creates sample templates using the current user's organisation automatically

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
    '550e8400-e29b-41d4-a716-446655440001',
    (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1),
    'Standard Construction Terms',
    'Default terms and conditions for construction projects',
    true,
    true,
    NOW()
);

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
    '550e8400-e29b-41d4-a716-446655440002',
    (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1),
    'Simple Terms',
    'Basic terms for small projects',
    false,
    true,
    NOW()
);

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
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), 'Payment Terms', 0, true, NOW()),
('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), 'Delivery Terms', 1, true, NOW()),
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), 'Warranty Terms', 2, true, NOW()),
('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), 'Cancellation Policy', 3, true, NOW());

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
('770e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), '50% advance payment required before project commencement', 0, 'bullet', true, NOW()),
('770e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440001', (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), '40% payment upon completion of 50% work', 1, 'bullet', true, NOW()),
('770e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440001', (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), '10% final payment upon project completion and handover', 2, 'bullet', true, NOW());

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
('770e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440002', (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), 'Materials to be delivered within 7 days of order confirmation', 0, 'bullet', true, NOW()),
('770e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440002', (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), 'Delivery charges applicable as per distance', 1, 'bullet', true, NOW()),
('770e8400-e29b-41d4-a716-446655440006', '660e8400-e29b-41d4-a716-446655440002', (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), 'Site inspection required before final delivery', 2, 'bullet', true, NOW());

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
('770e8400-e29b-41d4-a716-446655440007', '660e8400-e29b-41d4-a716-446655440003', (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), '12 months warranty on all construction work', 0, 'bullet', true, NOW()),
('770e8400-e29b-41d4-a716-446655440008', '660e8400-e29b-41d4-a716-446655440003', (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), 'Warranty covers manufacturing defects and workmanship', 1, 'bullet', true, NOW()),
('770e8400-e29b-41d4-a716-446655440009', '660e8400-e29b-41d4-a716-446655440003', (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), 'Normal wear and tear excluded from warranty', 2, 'bullet', true, NOW());

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
('770e8400-e29b-41d4-a716-446655440010', '660e8400-e29b-41d4-a716-446655440004', (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), 'Cancellation allowed within 48 hours of order confirmation', 0, 'bullet', true, NOW()),
('770e8400-e29b-41d4-a716-446655440011', '660e8400-e29b-41d4-a716-446655440004', (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), '25% cancellation charges applicable after 48 hours', 1, 'bullet', true, NOW()),
('770e8400-e29b-41d4-a716-446655440012', '660e8400-e29b-41d4-a716-446655440004', (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), 'No refund after work commencement', 2, 'bullet', true, NOW());

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
('660e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440002', (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), 'Basic Terms', 0, true, NOW());

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
('770e8400-e29b-41d4-a716-446655440013', '660e8400-e29b-41d4-a716-446655440005', (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), '50% advance payment required', 0, 'bullet', true, NOW()),
('770e8400-e29b-41d4-a716-446655440014', '660e8400-e29b-41d4-a716-446655440005', (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), 'Balance payment on completion', 1, 'bullet', true, NOW()),
('770e8400-e29b-41d4-a716-446655440015', '660e8400-e29b-41d4-a716-446655440005', (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1), '6 months warranty on workmanship', 2, 'bullet', true, NOW());

-- Test Query to verify data insertion
-- SELECT 
--     t.name as template_name,
--     s.title as section_title,
--     i.content as item_content
-- FROM terms_conditions_templates t
-- LEFT JOIN terms_conditions_sections s ON t.id = s.template_id
-- LEFT JOIN terms_conditions_items i ON s.id = i.section_id
-- WHERE t.organisation_id = (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1)
-- ORDER BY t.name, s.display_order, i.display_order;
