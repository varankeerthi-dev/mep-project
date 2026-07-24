# Ticket: Database Schema for Returns
Status: closed
Type: grilling

## Question

What is the database schema for the `returns`, `return_items`, and `return_sources` tables?

### Context

We need to track:
1. The return header (project_id, organisation_id, return_date, returned_by, status, etc.).
2. Mapped items and quantities.
3. The sources (invoices or delivery challans) that each item's return quantity is credited against.

### Open Choices

- Should `return_sources` be a separate table mapping `return_item_id` to `invoice_id`/`invoice_item_id` or `dc_id`/`dc_item_id` with a type indicator and quantity?
- How should RLS policies be structured? (e.g. standard organization-based security).

## Resolution

We will implement three new database tables (`returns`, `return_items`, `return_sources`) and create indexes/RLS policies for security and performance.

### 1. Header Table: `returns`
```sql
CREATE TABLE IF NOT EXISTS returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  return_number VARCHAR(100) NOT NULL,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'completed'
  remarks TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_return_number_per_org UNIQUE(organisation_id, return_number)
);

ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable RLS for returns by organisation" ON returns
  FOR ALL USING (organisation_id = auth.jwt() ->> 'organisation_id') WITH CHECK (organisation_id = auth.jwt() ->> 'organisation_id');
```

### 2. Items Table: `return_items`
```sql
CREATE TABLE IF NOT EXISTS return_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES materials(id), -- direct link to materials
  variant_id UUID REFERENCES company_variants(id),
  quantity DECIMAL(10,2) NOT NULL CHECK (quantity > 0),
  unit VARCHAR(50) NOT NULL,
  rate DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable RLS for return_items by organisation" ON return_items
  FOR ALL USING (organisation_id = auth.jwt() ->> 'organisation_id') WITH CHECK (organisation_id = auth.jwt() ->> 'organisation_id');

CREATE INDEX IF NOT EXISTS idx_return_items_return_id ON return_items(return_id);
```

### 3. Source Mapping Table: `return_sources`
Tracks the breakdown of return quantities mapped to Invoices or Delivery Challans.
```sql
CREATE TABLE IF NOT EXISTS return_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_item_id UUID NOT NULL REFERENCES return_items(id) ON DELETE CASCADE,
  source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('invoice', 'dc')),
  source_id UUID NOT NULL, -- references invoices.id or delivery_challans.id
  source_item_id UUID,     -- references invoice_items.id or delivery_challan_items.id
  quantity DECIMAL(10,2) NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE return_sources ENABLE ROW LEVEL SECURITY;
-- Mapped security through return_item_id -> return_items.organisation_id check
CREATE POLICY "Enable RLS for return_sources" ON return_sources
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM return_items 
      WHERE return_items.id = return_sources.return_item_id 
        AND return_items.organisation_id = auth.jwt() ->> 'organisation_id'
    )
  );

CREATE INDEX IF NOT EXISTS idx_return_sources_item_id ON return_sources(return_item_id);
```
