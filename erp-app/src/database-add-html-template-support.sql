-- Add HTML template support to document_templates table
ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS template_content TEXT;
ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS template_type VARCHAR(20) DEFAULT 'config'; -- 'config' or 'html'

-- Update existing templates to have template_type
UPDATE document_templates SET template_type = 'config' WHERE template_type IS NULL;
