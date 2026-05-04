-- Sample Data for Terms & Conditions System
-- ========================================
-- This script creates sample templates, sections, and items

-- First, let's check if we can access the tables
-- Run this to test: SELECT * FROM terms_conditions_templates LIMIT 1;

-- Sample Template 1: Standard Construction Terms
INSERT INTO terms_conditions_templates (
    id, 
    organisation_id, 
    name, 
    description, 
    is_default, 
    is_active,
    created_at,
    updated_at
) VALUES (
    '550e8400-e29b-41d4-a716-446655440001',
    '77c7f8a6-938e-42da-bdf4-cef9c35838c1', -- Replace with your actual organisation_id
    'Standard Construction Terms',
    'Default terms and conditions for construction projects',
    true,
    true,
    NOW(),
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
    created_at,
    updated_at
) VALUES (
    '550e8400-e29b-41d4-a716-446655440002',
    '77c7f8a6-938e-42da-bdf4-cef9c35838c1', -- Replace with your actual organisation_id
    'Simple Terms',
    'Basic terms for small projects',
    false,
    true,
    NOW(),
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
    created_at,
    updated_at
) VALUES 
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '77c7f8a6-938e-42da-bdf4-cef9c35838c1', 'Payment Terms', 0, true, NOW(), NOW()),
('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', '77c7f8a6-938e-42da-bdf4-cef9c35838c1', 'Delivery Terms', 1, true, NOW(), NOW()),
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', '77c7f8a6-938e-42da-bdf4-cef9c35838c1', 'Warranty Terms', 2, true, NOW(), NOW()),
('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', '77c7f8a6-938e-42da-bdf4-cef9c35838c1', 'Cancellation Policy', 3, true, NOW(), NOW());

-- Items for Payment Terms Section
INSERT INTO terms_conditions_items (
    id,
    section_id,
    organisation_id,
    content,
    display_order,
    item_type,
    is_configurable,
    created_at,
    updated_at
) VALUES 
('770e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', '77c7f8a6-938e-42da-bdf4-cef9c35838c1', '50% advance payment required before project commencement', 0, 'bullet', true, NOW(), NOW()),
('770e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440001', '77c7f8a6-938e-42da-bdf4-cef9c35838c1', '40% payment upon completion of 50% work', 1, 'bullet', true, NOW(), NOW()),
('770e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440001', '77c7f8a6-938e-42da-bdf4-cef9c35838c1', '10% final payment upon project completion and handover', 2, 'bullet', true, NOW(), NOW());

-- Items for Delivery Terms Section
INSERT INTO terms_conditions_items (
    id,
    section_id,
    organisation_id,
    content,
    display_order,
    item_type,
    is_configurable,
    created_at,
    updated_at
) VALUES 
('770e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440002', '77c7f8a6-938e-42da-bdf4-cef9c35838c1', 'Materials to be delivered within 7 days of order confirmation', 0, 'bullet', true, NOW(), NOW()),
('770e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440002', '77c7f8a6-938e-42da-bdf4-cef9c35838c1', 'Delivery charges applicable as per distance', 1, 'bullet', true, NOW(), NOW()),
('770e8400-e29b-41d4-a716-446655440006', '660e8400-e29b-41d4-a716-446655440002', '77c7f8a6-938e-42da-bdf4-cef9c35838c1', 'Site inspection required before final delivery', 2, 'bullet', true, NOW(), NOW());

-- Items for Warranty Terms Section
INSERT INTO terms_conditions_items (
    id,
    section_id,
    organisation_id,
    content,
    display_order,
    item_type,
    is_configurable,
    created_at,
    updated_at
) VALUES 
('770e8400-e29b-41d4-a716-446655440007', '660e8400-e29b-41d4-a716-446655440003', '77c7f8a6-938e-42da-bdf4-cef9c35838c1', '12 months warranty on all construction work', 0, 'bullet', true, NOW(), NOW()),
('770e8400-e29b-41d4-a716-446655440008', '660e8400-e29b-41d4-a716-446655440003', '77c7f8a6-938e-42da-bdf4-cef9c35838c1', 'Warranty covers manufacturing defects and workmanship', 1, 'bullet', true, NOW(), NOW()),
('770e8400-e29b-41d4-a716-446655440009', '660e8400-e29b-41d4-a716-446655440003', '77c7f8a6-938e-42da-bdf4-cef9c35838c1', 'Normal wear and tear excluded from warranty', 2, 'bullet', true, NOW(), NOW());

-- Items for Cancellation Policy Section
INSERT INTO terms_conditions_items (
    id,
    section_id,
    organisation_id,
    content,
    display_order,
    item_type,
    is_configurable,
    created_at,
    updated_at
) VALUES 
('770e8400-e29b-41d4-a716-446655440010', '660e8400-e29b-41d4-a716-446655440004', '77c7f8a6-938e-42da-bdf4-cef9c35838c1', 'Cancellation allowed within 48 hours of order confirmation', 0, 'bullet', true, NOW(), NOW()),
('770e8400-e29b-41d4-a716-446655440011', '660e8400-e29b-41d4-a716-446655440004', '77c7f8a6-938e-42da-bdf4-cef9c35838c1', '25% cancellation charges applicable after 48 hours', 1, 'bullet', true, NOW(), NOW()),
('770e8400-e29b-41d4-a716-446655440012', '660e8400-e29b-41d4-a716-446655440004', '77c7f8a6-938e-42da-bdf4-cef9c35838c1', 'No refund after work commencement', 2, 'bullet', true, NOW(), NOW());

-- Sections for Simple Terms
INSERT INTO terms_conditions_sections (
    id,
    template_id,
    organisation_id,
    title,
    display_order,
    is_configurable,
    created_at,
    updated_at
) VALUES 
('660e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440002', '77c7f8a6-938e-42da-bdf4-cef9c35838c1', 'Basic Terms', 0, true, NOW(), NOW());

-- Items for Simple Terms
INSERT INTO terms_conditions_items (
    id,
    section_id,
    organisation_id,
    content,
    display_order,
    item_type,
    is_configurable,
    created_at,
    updated_at
) VALUES 
('770e8400-e29b-41d4-a716-446655440013', '660e8400-e29b-41d4-a716-446655440005', '77c7f8a6-938e-42da-bdf4-cef9c35838c1', '50% advance payment required', 0, 'bullet', true, NOW(), NOW()),
('770e8400-e29b-41d4-a716-446655440014', '660e8400-e29b-41d4-a716-446655440005', '77c7f8a6-938e-42da-bdf4-cef9c35838c1', 'Balance payment on completion', 1, 'bullet', true, NOW(), NOW()),
('770e8400-e29b-41d4-a716-446655440015', '660e8400-e29b-41d4-a716-446655440005', '77c7f8a6-938e-42da-bdf4-cef9c35838c1', '6 months warranty on workmanship', 2, 'bullet', true, NOW(), NOW());

-- Test Query to verify data insertion
-- SELECT 
--     t.name as template_name,
--     s.title as section_title,
--     i.content as item_content
-- FROM terms_conditions_templates t
-- LEFT JOIN terms_conditions_sections s ON t.id = s.template_id
-- LEFT JOIN terms_conditions_items i ON s.id = i.section_id
-- WHERE t.organisation_id = '77c7f8a6-938e-42da-bdf4-cef9c35838c1'
-- ORDER BY t.name, s.display_order, i.display_order;
