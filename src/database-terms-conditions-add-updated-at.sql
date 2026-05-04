-- Add missing updated_at columns to Terms & Conditions tables
-- =====================================================

-- Add updated_at column to terms_conditions_templates if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'terms_conditions_templates' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE terms_conditions_templates 
        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Add updated_at column to terms_conditions_sections if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'terms_conditions_sections' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE terms_conditions_sections 
        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Add updated_at column to terms_conditions_items if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'terms_conditions_items' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE terms_conditions_items 
        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Create trigger to automatically update updated_at column on templates
DROP TRIGGER IF EXISTS update_terms_conditions_templates_updated_at ON terms_conditions_templates;
CREATE TRIGGER update_terms_conditions_templates_updated_at
    BEFORE UPDATE ON terms_conditions_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger to automatically update updated_at column on sections
DROP TRIGGER IF EXISTS update_terms_conditions_sections_updated_at ON terms_conditions_sections;
CREATE TRIGGER update_terms_conditions_sections_updated_at
    BEFORE UPDATE ON terms_conditions_sections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger to automatically update updated_at column on items
DROP TRIGGER IF EXISTS update_terms_conditions_items_updated_at ON terms_conditions_items;
CREATE TRIGGER update_terms_conditions_items_updated_at
    BEFORE UPDATE ON terms_conditions_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Verify the columns were added
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('terms_conditions_templates', 'terms_conditions_sections', 'terms_conditions_items')
AND column_name = 'updated_at'
ORDER BY table_name;
