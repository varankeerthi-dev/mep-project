-- Clear and Create Sample Data for Terms & Conditions System
-- ==========================================================
-- This script clears existing data and creates fresh sample data

-- First, delete all existing data for current user's organisation
DELETE FROM terms_conditions_items 
WHERE organisation_id = (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1);

DELETE FROM terms_conditions_sections 
WHERE organisation_id = (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1);

DELETE FROM terms_conditions_templates 
WHERE organisation_id = (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1);

-- Now create fresh sample data using uuid_generate_v4() for unique IDs
-- Sample Template 1: Standard Construction Terms
INSERT INTO terms_conditions_templates (
    id, 
    organisation_id, 
    name, 
    description, 
    is_default, 
    is_active,
    created_at
) SELECT 
    uuid_generate_v4(),
    (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1),
    'Standard Construction Terms',
    'Default terms and conditions for construction projects',
    true,
    true,
    NOW();

-- Sample Template 2: Simple Terms
INSERT INTO terms_conditions_templates (
    id, 
    organisation_id, 
    name, 
    description, 
    is_default, 
    is_active,
    created_at
) SELECT 
    uuid_generate_v4(),
    (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1),
    'Simple Terms',
    'Basic terms for small projects',
    false,
    true,
    NOW();

-- Get the template IDs we just created
WITH template_ids AS (
    SELECT id, name FROM terms_conditions_templates 
    WHERE organisation_id = (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1)
    ORDER BY created_at
),

-- Sections for Standard Construction Terms
standard_sections AS (
    SELECT 
        uuid_generate_v4() as id,
        (SELECT id FROM template_ids WHERE name = 'Standard Construction Terms' LIMIT 1) as template_id,
        (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1) as organisation_id,
        unnest(ARRAY['Payment Terms', 'Delivery Terms', 'Warranty Terms', 'Cancellation Policy']) as title,
        unnest(ARRAY[0, 1, 2, 3]) as display_order,
        true as is_configurable,
        NOW() as created_at
),

-- Sections for Simple Terms  
simple_sections AS (
    SELECT 
        uuid_generate_v4() as id,
        (SELECT id FROM template_ids WHERE name = 'Simple Terms' LIMIT 1) as template_id,
        (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1) as organisation_id,
        'Basic Terms' as title,
        0 as display_order,
        true as is_configurable,
        NOW() as created_at
)

-- Insert all sections
INSERT INTO terms_conditions_sections (id, template_id, organisation_id, title, display_order, is_configurable, created_at)
SELECT * FROM standard_sections
UNION ALL
SELECT * FROM simple_sections;

-- Insert items for each section
WITH all_sections AS (
    SELECT s.id, s.title FROM terms_conditions_sections s
    WHERE s.organisation_id = (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1)
),

payment_items AS (
    SELECT 
        uuid_generate_v4() as id,
        (SELECT id FROM all_sections WHERE title = 'Payment Terms' LIMIT 1) as section_id,
        (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1) as organisation_id,
        unnest(ARRAY['50% advance payment required before project commencement', 
                     '40% payment upon completion of 50% work', 
                     '10% final payment upon project completion and handover']) as content,
        unnest(ARRAY[0, 1, 2]) as display_order,
        'bullet' as item_type,
        true as is_configurable,
        NOW() as created_at
),

delivery_items AS (
    SELECT 
        uuid_generate_v4() as id,
        (SELECT id FROM all_sections WHERE title = 'Delivery Terms' LIMIT 1) as section_id,
        (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1) as organisation_id,
        unnest(ARRAY['Materials to be delivered within 7 days of order confirmation',
                     'Delivery charges applicable as per distance',
                     'Site inspection required before final delivery']) as content,
        unnest(ARRAY[0, 1, 2]) as display_order,
        'bullet' as item_type,
        true as is_configurable,
        NOW() as created_at
),

warranty_items AS (
    SELECT 
        uuid_generate_v4() as id,
        (SELECT id FROM all_sections WHERE title = 'Warranty Terms' LIMIT 1) as section_id,
        (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1) as organisation_id,
        unnest(ARRAY['12 months warranty on all construction work',
                     'Warranty covers manufacturing defects and workmanship',
                     'Normal wear and tear excluded from warranty']) as content,
        unnest(ARRAY[0, 1, 2]) as display_order,
        'bullet' as item_type,
        true as is_configurable,
        NOW() as created_at
),

cancellation_items AS (
    SELECT 
        uuid_generate_v4() as id,
        (SELECT id FROM all_sections WHERE title = 'Cancellation Policy' LIMIT 1) as section_id,
        (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1) as organisation_id,
        unnest(ARRAY['Cancellation allowed within 48 hours of order confirmation',
                     '25% cancellation charges applicable after 48 hours',
                     'No refund after work commencement']) as content,
        unnest(ARRAY[0, 1, 2]) as display_order,
        'bullet' as item_type,
        true as is_configurable,
        NOW() as created_at
),

basic_items AS (
    SELECT 
        uuid_generate_v4() as id,
        (SELECT id FROM all_sections WHERE title = 'Basic Terms' LIMIT 1) as section_id,
        (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1) as organisation_id,
        unnest(ARRAY['50% advance payment required',
                     'Balance payment on completion',
                     '6 months warranty on workmanship']) as content,
        unnest(ARRAY[0, 1, 2]) as display_order,
        'bullet' as item_type,
        true as is_configurable,
        NOW() as created_at
)

-- Insert all items
INSERT INTO terms_conditions_items (id, section_id, organisation_id, content, display_order, item_type, is_configurable, created_at)
SELECT * FROM payment_items
UNION ALL
SELECT * FROM delivery_items
UNION ALL
SELECT * FROM warranty_items
UNION ALL
SELECT * FROM cancellation_items
UNION ALL
SELECT * FROM basic_items;

-- Test Query to verify data insertion
SELECT 
    t.name as template_name,
    COUNT(DISTINCT s.id) as sections_count,
    COUNT(DISTINCT i.id) as items_count
FROM terms_conditions_templates t
LEFT JOIN terms_conditions_sections s ON t.id = s.template_id
LEFT JOIN terms_conditions_items i ON s.id = i.section_id
WHERE t.organisation_id = (SELECT organisation_id FROM user_organisations WHERE user_id = auth.uid() LIMIT 1)
GROUP BY t.id, t.name
ORDER BY t.name;
