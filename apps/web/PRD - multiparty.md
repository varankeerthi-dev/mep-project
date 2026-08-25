
Objective: Enable issuance of business documents (Quotation, Invoice, Debit Note, Credit Note, Delivery Challan) to vendors and subcontractors while maintaining the existing client-centric UI pattern.

Current State: Documents can only be issued to clients via client_id field. Users issuing to vendors/subcontractors is infrequent but operationally critical for purchase returns, subcontractor payments, and reverse logistics.

Target State: Unified party selection interface that intelligently handles clients, vendors, and subcontractors while preserving existing UI patterns and adding comprehensive financial tracking via ledger integration.

1. Current Architecture Analysis
1.1 Existing Document Schema Structure
Document Tables (Client-Only Pattern):



sql
-- quotation_header
CREATE TABLE quotation_header (
  id UUID PRIMARY KEY,
  organisation_id UUID NOT NULL,
  quotation_no VARCHAR(50) UNIQUE NOT NULL,
  client_id UUID REFERENCES clients(id),
  project_id UUID REFERENCES projects(id),
  -- ... other fields
);
 
-- invoice_header  
CREATE TABLE invoice_header (
  id UUID PRIMARY KEY,
  organisation_id UUID NOT NULL,
  invoice_no VARCHAR(50) UNIQUE NOT NULL,
  client_id UUID REFERENCES clients(id),
  -- ... other fields
);
 
-- delivery_challans
CREATE TABLE delivery_challans (
  id UUID PRIMARY KEY,
  organisation_id UUID NOT NULL,
  dc_number VARCHAR(50) UNIQUE NOT NULL,
  client_name VARCHAR(255), -- Text field, not FK
  project_id UUID REFERENCES projects(id),
  -- ... other fields
);
1.2 Existing Party Tables
Clients (Customers):



sql
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  organisation_id UUID REFERENCES organisations(id),
  client_name VARCHAR(255) NOT NULL,
  gstin VARCHAR(50),
  state VARCHAR(100),
  email VARCHAR(255),
  contact VARCHAR(50),
  linked_vendor_id UUID, -- Optional vendor link
  -- ... other fields
);
Purchase Vendors (Suppliers):



sql
CREATE TABLE purchase_vendors (
  id UUID PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  vendor_code VARCHAR(20) UNIQUE NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(100),
  gstin VARCHAR(50),
  state VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  status VARCHAR(20) DEFAULT 'Active',
  -- ... banking & MSME fields
);
Subcontractors:



sql
CREATE TABLE subcontractors (
  id UUID PRIMARY KEY,
  organisation_id UUID REFERENCES organisations(id),
  company_name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(100),
  gstin VARCHAR(50),
  state VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  status VARCHAR(50) DEFAULT 'Active',
  -- ... work order & contract fields
);
1.3 Current Ledger Integration
Ledger Client Model:



typescript
export type LedgerClient = {
  id: string;
  name: string;
  org_id: string | null;
  gstin?: string | null;
  state?: string | null;
  email?: string | null;
  contact?: string | null;
  linked_vendor_id?: string | null; // Optional vendor association
};
Current Ledger Tracking:

Only client-based transactions are tracked
linked_vendor_id provides loose vendor association
No subcontractor ledger tracking
Document flows are client-centric
1.4 Current UI Pattern
Client Selection (Quotation Example):



typescript
// Current implementation in QuotationHeaderForm.tsx
<div style={{ position: 'relative' }} className="client-dropdown-container">
  <input
    type="text"
    placeholder="Search or select client..."
    value={clientSearch !== null ? clientSearch : (formData.client_id ? 
      clients.find(c => c.id === formData.client_id)?.client_name || '' : '')}
    onChange={(e) => { setClientSearch(e.target.value); setIsClientDropdownOpen(true); }}
  />
  {isClientDropdownOpen && (
    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50 }}>
      {clients
        .filter(c => !clientSearch || c.client_name.toLowerCase().includes(clientSearch.toLowerCase()))
        .map(c => (
          <div key={c.id} onClick={() => { handleClientChange(c.id); }}>
            {c.client_name}
          </div>
        ))}
    </div>
  )}
</div>
2. Proposed Architecture
2.1 Unified Party Model
Core Concept: Introduce a unified party abstraction that treats clients, vendors, and subcontractors as interchangeable document recipients while maintaining their distinct data models.

Party Type Enumeration:



sql
CREATE TYPE party_type AS ENUM ('client', 'vendor', 'subcontractor');
2.2 Schema Enhancements
Document Header Modifications:



sql
-- Add to all document header tables
ALTER TABLE quotation_header 
  ADD COLUMN party_type party_type DEFAULT 'client',
  ADD COLUMN vendor_id UUID REFERENCES purchase_vendors(id),
  ADD COLUMN subcontractor_id UUID REFERENCES subcontractors(id),
  ADD CONSTRAINT party_reference_check CHECK (
    (party_type = 'client' AND client_id IS NOT NULL AND vendor_id IS NULL AND subcontractor_id IS NULL) OR
    (party_type = 'vendor' AND vendor_id IS NOT NULL AND client_id IS NULL AND subcontractor_id IS NULL) OR
    (party_type = 'subcontractor' AND subcontractor_id IS NOT NULL AND client_id IS NULL AND vendor_id IS NULL)
  );
 
-- Apply same pattern to:
-- invoice_header, debit_note_header, credit_note_header, delivery_challans
Unified Party Search Index:



sql
-- Create materialized view for unified party search
CREATE MATERIALIZED VIEW mv_party_search AS
SELECT 
  'client' as party_type,
  id as party_id,
  client_name as party_name,
  gstin,
  state,
  email,
  contact,
  organisation_id
FROM clients
WHERE status IS NULL OR status = 'Active'
 
UNION ALL
 
SELECT 
  'vendor' as party_type,
  id as party_id,
  company_name as party_name,
  gstin,
  state,
  email,
  phone as contact,
  organisation_id
FROM purchase_vendors
WHERE status = 'Active'
 
UNION ALL
 
SELECT 
  'subcontractor' as party_type,
  id as party_id,
  company_name as party_name,
  gstin,
  state,
  email,
  phone as contact,
  organisation_id
FROM subcontractors
WHERE status = 'Active';
 
CREATE UNIQUE INDEX idx_party_search ON mv_party_search(party_type, party_id);
CREATE INDEX idx_party_search_org_name ON mv_party_search(organisation_id, party_name);
CREATE INDEX idx_party_search_name ON mv_party_search(party_name);
 
-- Refresh function
CREATE OR REPLACE FUNCTION refresh_party_search()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_party_search;
END;
$$ LANGUAGE plpgsql;
2.3 RPC Architecture
Party Resolution RPC:



sql
CREATE OR REPLACE FUNCTION resolve_party_document(
  p_organisation_id UUID,
  p_party_name TEXT,
  p_party_type party_type DEFAULT NULL
)
RETURNS TABLE (
  party_type party_type,
  party_id UUID,
  party_name TEXT,
  gstin TEXT,
  state TEXT,
  contact TEXT,
  confidence_score NUMERIC
) AS $$
DECLARE
  v_exact_match RECORD;
  v_fuzzy_matches RECORD;
BEGIN
  -- Try exact match first
  SELECT party_type, party_id, party_name, gstin, state, contact, 1.0 as confidence_score
  INTO v_exact_match
  FROM mv_party_search
  WHERE organisation_id = p_organisation_id
    AND party_name = p_party_name
    AND (p_party_type IS NULL OR party_type = p_party_type)
  LIMIT 1;
  
  IF FOUND THEN
    RETURN NEXT v_exact_match;
    RETURN;
  END IF;
  
  -- Fuzzy matching using trigram similarity
  FOR v_fuzzy_matches IN
    SELECT party_type, party_id, party_name, gstin, state, contact, 
           similarity(party_name, p_party_name) as confidence_score
    FROM mv_party_search
    WHERE organisation_id = p_organisation_id
      AND (p_party_type IS NULL OR party_type = p_party_type)
      AND similarity(party_name, p_party_name) > 0.6
    ORDER BY similarity(party_name, p_party_name) DESC
    LIMIT 3
  LOOP
    RETURN NEXT v_fuzzy_matches;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;
Document Creation RPC:



sql
CREATE OR REPLACE FUNCTION create_document_with_party(
  p_document_type TEXT,
  p_organisation_id UUID,
  p_party_type party_type,
  p_party_id UUID,
  p_document_data JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_document_id UUID;
  v_party_name TEXT;
  v_party_gstin TEXT;
  v_party_state TEXT;
BEGIN
  -- Extract party details
  CASE p_party_type
    WHEN 'client' THEN
      SELECT client_name, gstin, state INTO v_party_name, v_party_gstin, v_party_state
      FROM clients WHERE id = p_party_id;
    WHEN 'vendor' THEN
      SELECT company_name, gstin, state INTO v_party_name, v_party_gstin, v_party_state
      FROM purchase_vendors WHERE id = p_party_id;
    WHEN 'subcontractor' THEN
      SELECT company_name, gstin, state INTO v_party_name, v_party_gstin, v_party_state
      FROM subcontractors WHERE id = p_party_id;
  END CASE;
  
  -- Insert document based on type
  CASE p_document_type
    WHEN 'quotation' THEN
      INSERT INTO quotation_header (
        organisation_id, party_type, client_id, vendor_id, subcontractor_id,
        quotation_no, date, gstin, state, -- map party details
        -- other fields from p_document_data
      )
      VALUES (
        p_organisation_id, p_party_type, 
        CASE WHEN p_party_type = 'client' THEN p_party_id ELSE NULL END,
        CASE WHEN p_party_type = 'vendor' THEN p_party_id ELSE NULL END,
        CASE WHEN p_party_type = 'subcontractor' THEN p_party_id ELSE NULL END,
        -- other values
      )
      RETURNING id INTO v_document_id;
    
    -- Similar cases for invoice, debit_note, credit_note, delivery_challan
  END CASE;
  
  -- Trigger ledger entry
  PERFORM create_ledger_entry_for_document(
    p_document_type, v_document_id, p_organisation_id, 
    p_party_type, p_party_id, p_document_data
  );
  
  RETURN jsonb_build_object(
    'document_id', v_document_id,
    'party_type', p_party_type,
    'party_id', p_party_id,
    'party_name', v_party_name
  );
END;
$$ LANGUAGE plpgsql;
Ledger Integration RPC:



sql
CREATE OR REPLACE FUNCTION create_ledger_entry_for_document(
  p_document_type TEXT,
  p_document_id UUID,
  p_organisation_id UUID,
  p_party_type party_type,
  p_party_id UUID,
  p_document_data JSONB
)
RETURNS void AS $$
DECLARE
  v_ledger_account_id UUID;
  v_amount NUMERIC;
  v_party_ledger_id UUID;
BEGIN
  -- Determine amount from document data
  v_amount := (p_document_data->>'grand_total')::NUMERIC;
  
  -- Get or create party ledger account
  CASE p_party_type
    WHEN 'client' THEN
      -- Use existing client ledger logic
      SELECT id INTO v_party_ledger_id FROM ledger_clients 
      WHERE client_id = p_party_id;
      
    WHEN 'vendor' THEN
      -- Create vendor ledger account if not exists
      INSERT INTO ledger_vendors (vendor_id, organisation_id, name, gstin, state)
      SELECT id, p_organisation_id, company_name, gstin, state
      FROM purchase_vendors WHERE id = p_party_id
      ON CONFLICT (vendor_id) DO UPDATE SET 
        name = EXCLUDED.company_name,
        gstin = EXCLUDED.gstin,
        state = EXCLUDED.state
      RETURNING id INTO v_party_ledger_id;
      
    WHEN 'subcontractor' THEN
      -- Create subcontractor ledger account if not exists
      INSERT INTO ledger_subcontractors (subcontractor_id, organisation_id, name, gstin, state)
      SELECT id, p_organisation_id, company_name, gstin, state
      FROM subcontractors WHERE id = p_party_id
      ON CONFLICT (subcontractor_id) DO UPDATE SET 
        name = EXCLUDED.company_name,
        gstin = EXCLUDED.gstin,
        state = EXCLUDED.state
      RETURNING id INTO v_party_ledger_id;
  END CASE;
  
  -- Create ledger entry based on document type
  CASE p_document_type
    WHEN 'invoice' THEN
      -- Debit party (receivable)
      INSERT INTO ledger_entries (
        organisation_id, party_type, party_ledger_id, 
        entry_type, amount, document_type, document_id,
        debit_amount, credit_amount
      )
      VALUES (
        p_organisation_id, p_party_type, v_party_ledger_id,
        'invoice', v_amount, 'invoice', p_document_id,
        v_amount, 0
      );
      
    WHEN 'debit_note' THEN
      -- Credit party (reduces receivable or increases payable)
      INSERT INTO ledger_entries (
        organisation_id, party_type, party_ledger_id,
        entry_type, amount, document_type, document_id,
        debit_amount, credit_amount
      )
      VALUES (
        p_organisation_id, p_party_type, v_party_ledger_id,
        'debit_note', v_amount, 'debit_note', p_document_id,
        0, v_amount
      );
      
    -- Similar logic for credit_note, etc.
  END CASE;
END;
$$ LANGUAGE plpgsql;
2.4 Enhanced RLS Policies
Party Search RLS:



sql
-- Party search RLS
CREATE POLICY party_search_org_policy ON mv_party_search
  FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM org_members 
      WHERE user_id = auth.uid()
    )
  );
Document Creation RLS:



sql
-- Enhanced document policies to support multi-party
CREATE POLICY document_create_party_policy ON quotation_header
  FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM org_members 
      WHERE user_id = auth.uid()
    )
    AND (
      (party_type = 'client' AND client_id IN (
        SELECT id FROM clients WHERE organisation_id = quotation_header.organisation_id
      ))
      OR (party_type = 'vendor' AND vendor_id IN (
        SELECT id FROM purchase_vendors WHERE organisation_id = quotation_header.organisation_id
      ))
      OR (party_type = 'subcontractor' AND subcontractor_id IN (
        SELECT id FROM subcontractors WHERE organisation_id = quotation_header.organisation_id
      ))
    )
  );
3. API Layer Design
3.1 TypeScript Types
Unified Party Types:



typescript
export type PartyType = 'client' | 'vendor' | 'subcontractor';
 
export interface UnifiedParty {
  party_type: PartyType;
  party_id: string;
  party_name: string;
  gstin?: string | null;
  state?: string | null;
  contact?: string | null;
  email?: string | null;
  confidence_score?: number;
}
 
export interface PartyResolutionRequest {
  organisation_id: string;
  party_name: string;
  party_type?: PartyType;
}
 
export interface PartyResolutionResult {
  party_type: PartyType;
  party_id: string;
  party_name: string;
  gstin?: string | null;
  state?: string | null;
  contact?: string | null;
  confidence_score: number;
}
 
export interface DocumentCreationRequest {
  document_type: 'quotation' | 'invoice' | 'debit_note' | 'credit_note' | 'delivery_challan';
  organisation_id: string;
  party_type: PartyType;
  party_id: string;
  document_data: Record<string, any>;
}
 
export interface DocumentCreationResult {
  document_id: string;
  party_type: PartyType;
  party_id: string;
  party_name: string;
}
3.2 RPC Client Functions
Party Resolution:



typescript
export async function resolvePartyDocument(
  request: PartyResolutionRequest
): Promise<PartyResolutionResult[]> {
  const { data, error } = await supabase.rpc('resolve_party_document', {
    p_organisation_id: request.organisation_id,
    p_party_name: request.party_name,
    p_party_type: request.party_type,
  });
 
  if (error) throw error;
  return data as PartyResolutionResult[];
}
Document Creation:



typescript
export async function createDocumentWithParty(
  request: DocumentCreationRequest
): Promise<DocumentCreationResult> {
  const { data, error } = await supabase.rpc('create_document_with_party', {
    p_document_type: request.document_type,
    p_organisation_id: request.organisation_id,
    p_party_type: request.party_type,
    p_party_id: request.party_id,
    p_document_data: request.document_data,
  });
 
  if (error) throw error;
  return data as DocumentCreationResult;
}
Party Search Hook:



typescript
export function usePartySearch(
  organisationId: string,
  searchTerm: string,
  partyType?: PartyType
) {
  return useQuery({
    queryKey: ['party-search', organisationId, searchTerm, partyType],
    queryFn: () => resolvePartyDocument({
      organisation_id: organisationId,
      party_name: searchTerm,
      party_type: partyType,
    }),
    enabled: searchTerm.length >= 2,
    staleTime: 30000, // 30 seconds
  });
}
4. UI/UX Design
4.1 Enhanced Client Field
Smart Party Dropdown Component:



typescript
interface SmartPartyDropdownProps {
  value: string;
  onChange: (party: UnifiedParty) => void;
  organisationId: string;
  documentType: 'quotation' | 'invoice' | 'debit_note' | 'credit_note' | 'delivery_challan';
  disabled?: boolean;
}
 
export function SmartPartyDropdown({
  value,
  onChange,
  organisationId,
  documentType,
  disabled = false
}: SmartPartyDropdownProps) {
  const [searchTerm, setSearchTerm] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  
  const { data: partyResults, isLoading } = usePartySearch(
    organisationId,
    searchTerm,
    undefined // Auto-detect party type
  );
 
  // Group results by party type
  const groupedResults = useMemo(() => {
    if (!partyResults) return {};
    return partyResults.reduce((acc, party) => {
      if (!acc[party.party_type]) acc[party.party_type] = [];
      acc[party.party_type].push(party);
      return acc;
    }, {} as Record<PartyType, UnifiedParty[]>);
  }, [partyResults]);
 
  const handlePartySelect = (party: UnifiedParty) => {
    onChange(party);
    setSearchTerm(party.party_name);
    setIsOpen(false);
  };
 
  return (
    <div className="smart-party-dropdown">
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => setIsOpen(true)}
        placeholder="Search client, vendor, or subcontractor..."
        disabled={disabled}
      />
      
      {isOpen && !isLoading && (
        <div className="party-dropdown-results">
          {Object.entries(groupedResults).map(([type, parties]) => (
            <div key={type} className="party-group">
              <div className="party-group-header">
                {type === 'client' ? 'Clients' : 
                 type === 'vendor' ? 'Vendors' : 'Subcontractors'}
              </div>
              {parties.map((party) => (
                <div
                  key={party.party_id}
                  className="party-option"
                  onClick={() => handlePartySelect(party)}
                >
                  <div className="party-name">{party.party_name}</div>
                  <div className="party-meta">
                    {party.gstin && <span>GST: {party.gstin}</span>}
                    {party.state && <span>{party.state}</span>}
                  </div>
                  {party.confidence_score && party.confidence_score < 1.0 && (
                    <div className="confidence-indicator">
                      Match: {Math.round(party.confidence_score * 100)}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
          
          {partyResults.length === 0 && searchTerm.length >= 2 && (
            <div className="no-results">
              No matches found. "{searchTerm}" will be saved as new party name.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
4.2 Integration Pattern
Minimal UI Changes:



typescript
// Existing QuotationHeaderForm.tsx - minimal change
export function QuotationHeaderForm({
  formData,
  setFormData,
  // Remove existing client-specific props
  // clients, clientSearch, setClientSearch, etc.
  organisationId,
}: QuotationHeaderFormProps) {
  
  const handlePartyChange = (party: UnifiedParty) => {
    setFormData({
      ...formData,
      party_type: party.party_type,
      [party.party_type === 'client' ? 'client_id' : 
       party.party_type === 'vendor' ? 'vendor_id' : 'subcontractor_id']: party.party_id,
      party_name: party.party_name,
      gstin: party.gstin,
      state: party.state,
    });
  };
 
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
      <div>
        <span>Party:</span>
        <SmartPartyDropdown
          value={formData.party_name || ''}
          onChange={handlePartyChange}
          organisationId={organisationId}
          documentType="quotation"
        />
      </div>
      {/* Rest of the form remains unchanged */}
    </div>
  );
}
5. Implementation Plan
Phase 1: Database Foundation (Week 1)
Migration 1: Schema Enhancements



sql
-- Create party type enum
CREATE TYPE party_type AS ENUM ('client', 'vendor', 'subcontractor');
 
-- Add party fields to document tables
ALTER TABLE quotation_header 
  ADD COLUMN party_type party_type DEFAULT 'client',
  ADD COLUMN vendor_id UUID REFERENCES purchase_vendors(id),
  ADD COLUMN subcontractor_id UUID REFERENCES subcontractors(id),
  ADD CONSTRAINT quotation_party_check CHECK (
    (party_type = 'client' AND client_id IS NOT NULL AND vendor_id IS NULL AND subcontractor_id IS NULL) OR
    (party_type = 'vendor' AND vendor_id IS NOT NULL AND client_id IS NULL AND subcontractor_id IS NULL) OR
    (party_type = 'subcontractor' AND subcontractor_id IS NOT NULL AND client_id IS NULL AND vendor_id IS NULL)
  );
 
-- Repeat for invoice_header, debit_note_header, credit_note_header, delivery_challans
Migration 2: Unified Party Search



sql
-- Create materialized view and functions (as defined in Section 2.2)
-- Create refresh triggers on party tables
CREATE OR REPLACE FUNCTION trigger_refresh_party_search()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_party_search;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
 
CREATE TRIGGER trigger_party_search_client
  AFTER INSERT OR UPDATE OR DELETE ON clients
  FOR EACH STATEMENT EXECUTE FUNCTION trigger_refresh_party_search();
 
-- Similar triggers for purchase_vendors and subcontractors
Migration 3: Ledger Extensions



sql
-- Create ledger_vendors table
CREATE TABLE IF NOT EXISTS ledger_vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES purchase_vendors(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  gstin VARCHAR(50),
  state VARCHAR(100),
  opening_balance DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(vendor_id, organisation_id)
);
 
-- Create ledger_subcontractors table
CREATE TABLE IF NOT EXISTS ledger_subcontractors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subcontractor_id UUID NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  gstin VARCHAR(50),
  state VARCHAR(100),
  opening_balance DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(subcontractor_id, organisation_id)
);
 
-- Extend ledger_entries for party_type
ALTER TABLE ledger_entries 
  ADD COLUMN party_type party_type,
  ADD COLUMN party_ledger_id UUID;
 
-- Add constraints and indexes
CREATE INDEX idx_ledger_entries_party ON ledger_entries(party_type, party_ledger_id);
Phase 2: RPC Functions (Week 2)
RPC 1: Party Resolution

Implement resolve_party_document function
Add trigram extension for fuzzy matching
Create confidence scoring logic
Add comprehensive error handling
RPC 2: Document Creation

Implement create_document_with_party function
Add party detail mapping logic
Implement document-type-specific field mapping
Add validation and business rules
RPC 3: Ledger Integration

Implement create_ledger_entry_for_document function
Add party-specific ledger account creation
Implement document-type-specific debit/credit logic
Add financial year handling
Phase 3: API Layer (Week 3)
TypeScript Implementation:

Create unified party types
Implement RPC client functions
Add React Query hooks
Create party search hook
Add error handling and validation
Service Layer:

Create party resolution service
Implement document creation service
Add ledger integration service
Create party mapping utilities
Phase 4: UI Integration (Week 4)
Component Development:

Create SmartPartyDropdown component
Implement party grouping and display
Add confidence indicators
Create party type badges
Form Integration:

Update QuotationHeaderForm
Update Invoice creation forms
Update Debit/Credit note forms
Update Delivery Challan forms
Testing:

Test party search functionality
Test document creation with different party types
Test ledger integration
Test RLS policies
Phase 5: Testing & Validation (Week 5)
Unit Tests:

Party resolution accuracy tests
Document creation validation tests
Ledger integration tests
RLS policy tests
Integration Tests:

End-to-end document flows
Multi-party document scenarios
Ledger reconciliation tests
Performance tests
User Acceptance Testing:

User workflow validation
UI/UX testing
Performance validation
Security testing
6. Security & RLS Strategy
6.1 Organization Isolation
Party Search RLS:



sql
CREATE POLICY party_search_org_isolation ON mv_party_search
  FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM org_members 
      WHERE user_id = auth.uid()
      AND status = 'active'
    )
  );
Document Creation RLS:



sql
CREATE POLICY document_party_create_isolation ON quotation_header
  FOR INSERT
  WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM org_members 
      WHERE user_id = auth.uid()
      AND status = 'active'
    )
    AND (
      -- Client validation
      (party_type = 'client' AND client_id IN (
        SELECT id FROM clients WHERE organisation_id = quotation_header.organisation_id
      ))
      -- Vendor validation
      OR (party_type = 'vendor' AND vendor_id IN (
        SELECT id FROM purchase_vendors WHERE organisation_id = quotation_header.organisation_id
      ))
      -- Subcontractor validation
      OR (party_type = 'subcontractor' AND subcontractor_id IN (
        SELECT id FROM subcontractors WHERE organisation_id = quotation_header.organisation_id
      ))
    )
  );
6.2 Role-Based Access
RBAC Integration:



sql
-- Add party-specific permissions to rbac_permissions
INSERT INTO rbac_permissions (permission, description) VALUES
  ('documents.create_vendor', 'Create documents for vendors'),
  ('documents.create_subcontractor', 'Create documents for subcontractors'),
  ('ledger.view_vendor', 'View vendor ledger accounts'),
  ('ledger.view_subcontractor', 'View subcontractor ledger accounts');
 
-- Grant permissions based on roles
-- Procurement managers get vendor document permissions
-- Project managers get subcontractor document permissions
6.3 Audit Trail
Document Party Tracking:



sql
CREATE TABLE document_party_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_type TEXT NOT NULL,
  document_id UUID NOT NULL,
  party_type party_type NOT NULL,
  party_id UUID NOT NULL,
  party_name TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  change_type TEXT NOT NULL, -- 'created', 'updated', 'deleted'
  old_party_type party_type,
  old_party_id UUID,
  old_party_name TEXT
);
 
-- Create trigger for audit logging
CREATE OR REPLACE FUNCTION log_document_party_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO document_party_audit (
      document_type, document_id, party_type, party_id, party_name, 
      changed_by, change_type
    )
    VALUES (
      TG_TABLE_NAME, NEW.id, NEW.party_type, 
      CASE NEW.party_type 
        WHEN 'client' THEN NEW.client_id::TEXT
        WHEN 'vendor' THEN NEW.vendor_id::TEXT
        WHEN 'subcontractor' THEN NEW.subcontractor_id::TEXT
      END,
      -- party name resolution
      auth.uid(), 'created'
    );
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO document_party_audit (
      document_type, document_id, party_type, party_id, party_name,
      changed_by, change_type, old_party_type, old_party_id, old_party_name
    )
    VALUES (
      TG_TABLE_NAME, NEW.id, NEW.party_type,
      CASE NEW.party_type 
        WHEN 'client' THEN NEW.client_id::TEXT
        WHEN 'vendor' THEN NEW.vendor_id::TEXT
        WHEN 'subcontractor' THEN NEW.subcontractor_id::TEXT
      END,
      -- party name resolution
      auth.uid(), 'updated',
      OLD.party_type,
      CASE OLD.party_type 
        WHEN 'client' THEN OLD.client_id::TEXT
        WHEN 'vendor' THEN OLD.vendor_id::TEXT
        WHEN 'subcontractor' THEN OLD.subcontractor_id::TEXT
      END,
      -- old party name resolution
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
7. Performance Considerations
7.1 Search Optimization
Trigram Index Implementation:



sql
-- Add pg_trgm extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
 
-- Create trigram indexes on party name fields
CREATE INDEX idx_clients_name_trgm ON clients USING gin (client_name gin_trgm_ops);
CREATE INDEX idx_vendors_name_trgm ON purchase_vendors USING gin (company_name gin_trgm_ops);
CREATE INDEX idx_subcontractors_name_trgm ON subcontractors USING gin (company_name gin_trgm_ops);
Materialized View Refresh Strategy:



sql
-- Set up scheduled refresh (requires pg_cron or similar)
-- Refresh party search every 5 minutes
SELECT cron.schedule('refresh-party-search', '*/5 * * * *', 
  'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_party_search');
7.2 Query Optimization
Batch Party Resolution:



sql
-- Optimize for multiple party resolutions in document import scenarios
CREATE OR REPLACE FUNCTION resolve_parties_batch(
  p_organisation_id UUID,
  p_party_names TEXT[]
)
RETURNS TABLE (
  party_name TEXT,
  party_type party_type,
  party_id UUID,
  confidence_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    unnest(p_party_names) as party_name,
    ps.party_type,
    ps.party_id,
    ps.confidence_score
  FROM mv_party_search ps
  WHERE ps.organisation_id = p_organisation_id
    AND ps.party_name = ANY(p_party_names)
  ORDER BY ps.confidence_score DESC;
END;
$$ LANGUAGE plpgsql;
8. Migration Strategy
8.1 Data Migration
Historical Data Migration:



sql
-- Migrate existing delivery_challans with client_name to proper party structure
UPDATE delivery_challans dc
SET 
  party_type = 'client',
  client_id = c.id
FROM clients c
WHERE dc.client_name = c.client_name
  AND dc.organisation_id = c.organisation_id
  AND dc.client_id IS NULL;
 
-- Backfill party_type for existing documents
UPDATE quotation_header SET party_type = 'client' WHERE party_type IS NULL;
UPDATE invoice_header SET party_type = 'client' WHERE party_type IS NULL;
-- Similar for other document tables
8.2 Rollback Strategy
Rollback Migration:



sql
-- In case of issues, rollback can be performed
ALTER TABLE quotation_header DROP CONSTRAINT quotation_party_check;
ALTER TABLE quotation_header DROP COLUMN party_type;
ALTER TABLE quotation_header DROP COLUMN vendor_id;
ALTER TABLE quotation_header DROP COLUMN subcontractor_id;
 
-- Drop materialized view
DROP MATERIALIZED VIEW IF EXISTS mv_party_search;
 
-- Drop party type
DROP TYPE IF EXISTS party_type;
9. Success Criteria
9.1 Functional Requirements
Party Selection:

✅ Users can search for clients, vendors, and subcontractors in a single field
✅ Party type is automatically detected and highlighted in dropdown
✅ Fuzzy matching handles typos and partial names
✅ Confidence scores indicate match quality
Document Creation:

✅ Documents can be created for any party type
✅ Party details (GSTIN, state) are automatically populated
✅ Existing client-only documents continue to work
✅ Document validation prevents invalid party combinations
Ledger Integration:

✅ Vendor transactions appear in vendor ledger
✅ Subcontractor transactions appear in subcontractor ledger
✅ Document flows maintain financial accounting integrity
✅ Opening balances can be set for vendors/subcontractors
9.2 Non-Functional Requirements
Performance:

✅ Party search responds within 200ms for common names
✅ Document creation performance unchanged (<500ms)
✅ Materialized view refresh doesn't impact UI responsiveness
Security:

✅ RLS policies prevent cross-organization data access
✅ Role-based permissions control party type access
✅ Audit trail tracks all party changes
Usability:

✅ UI changes are minimal and intuitive
✅ Existing workflows remain unchanged
✅ Learning curve for users is minimal
10. Risk Assessment
10.1 Technical Risks
Schema Complexity:

Risk: Adding party_type and multiple FK columns increases schema complexity
Mitigation: Use check constraints to ensure data integrity, comprehensive testing
Performance Impact:

Risk: Materialized view refresh may impact performance
Mitigation: Use concurrent refresh, schedule during low-traffic periods
Data Migration:

Risk: Historical data migration may fail or produce inconsistencies
Mitigation: Comprehensive testing, rollback strategy, phased migration
10.2 Business Risks
User Adoption:

Risk: Users may be confused by unified party selection
Mitigation: Clear UI indicators, comprehensive documentation, training
Financial Accuracy:

Risk: Ledger integration errors could affect financial reporting
Mitigation: Comprehensive testing, audit trails, validation checks
11. Future Enhancements
11.1 Advanced Features
Party Relationship Mapping:

Link vendors to subcontractors for complex supply chains
Track party hierarchies and parent-child relationships
Enable consolidated reporting across party groups
Smart Party Suggestions:

AI-powered party recommendations based on document context
Historical party preference analysis
Automatic party type detection based on document patterns
Enhanced Ledger Analytics:

Cross-party aging analysis
Party-wise profitability tracking
Supply chain financial health metrics
11.2 Integration Opportunities
Payment Gateway Integration:

Vendor payment processing through unified party system
Subcontractor payment automation
Multi-party payment reconciliation
Procurement Automation:

Automatic PO generation for vendor documents
Subcontractor work order generation from invoices
Three-way matching automation
12. Timeline & Resources
12.1 Development Timeline
Week 1-2: Database foundation and RPC functions Week 3: API layer and service development Week 4: UI integration and component development Week 5: Testing, validation, and deployment

12.2 Resource Requirements
Development: 1 senior backend developer, 1 frontend developer Testing: 1 QA engineer Database: Database administrator for migration oversight Documentation: Technical writer for user guides

13. Conclusion
This PRD outlines a comprehensive approach to enable multi-party document issuance while maintaining the simplicity of the existing client-centric UI. The unified party model with RPC-based architecture provides:

Minimal UI Disruption: Users continue using familiar patterns
Backend Intelligence: Party resolution and validation happens server-side
Financial Integrity: Comprehensive ledger integration ensures accurate tracking
Scalability: Materialized views and RPC functions handle performance
Security: RLS policies maintain organization isolation
Future-Proof: Architecture supports advanced features and integrations
The implementation follows modern architecture patterns, ignores browser-based complexity, and leverages PostgreSQL's powerful RPC capabilities for robust business logic execution.