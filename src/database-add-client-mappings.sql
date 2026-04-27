-- Table to store client-specific mapping for materials
CREATE TABLE IF NOT EXISTS material_client_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID REFERENCES materials(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    client_part_no TEXT,
    client_description TEXT,
    organisation_id UUID REFERENCES organisations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Ensure an item can only have one mapping per client
    UNIQUE(material_id, client_id)
);

-- Enable RLS
ALTER TABLE material_client_mappings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see/edit mappings for their organization
CREATE POLICY "Users can manage mappings in their organisation" 
ON material_client_mappings
FOR ALL
USING (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
))
WITH CHECK (organisation_id IN (
    SELECT organisation_id FROM org_members WHERE user_id = auth.uid()
));

-- Function to update updated_at timestamp
CREATE TRIGGER set_updated_at_mappings
BEFORE UPDATE ON material_client_mappings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
