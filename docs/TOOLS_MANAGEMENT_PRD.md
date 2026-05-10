# Tools Management System - Product Requirements Document

## 1. Overview

### 1.1 Purpose
The Tools Management System is a comprehensive module for tracking tools and equipment issued to clients, managing their movement between locations, and maintaining complete audit trails. This system will be integrated into the existing project management platform as a new "Tools" tab within the Projects section.

### 1.2 Scope
- Tool issuance and tracking from warehouse to clients
- Tool returns from clients to warehouse
- Direct tool transfers between clients (bypassing warehouse)
- Complete history tracking with searchable filters
- Tool catalog management with technical specifications
- PDF generation for tool transactions
- Dashboard for real-time tool status monitoring

## 2. System Architecture

### 2.1 Integration Points
- **Projects Module**: Tools tab will be added to existing Projects.tsx
- **Client Management**: Integration with existing client database
- **Template System**: Reuse Classic Quotation Template for PDF generation
- **Authentication**: Use existing organisation-based access control
- **Database**: New tables in existing Supabase setup

### 2.2 User Roles
- **Warehouse Manager**: Issue tools, receive returns, manage inventory
- **Project Manager**: Request tools, view status, manage site transfers
- **Admin**: Full access, tool creation, system configuration

## 3. Functional Requirements

### 3.1 Tools Tab Structure
The Tools tab will be added to the main Projects navigation alongside "Projects" and "Material" tabs.

#### 3.1.1 Sub-tabs Structure
```
Tools/
├── Dashboard
├── Issue Tools          (Warehouse → Site)
├── Receive Tools        (Site → Warehouse)
├── Transfer Tools       (Client → Client)
├── Site Transfer        (Site → Site)
├── Tool History
└── Tool Catalog
```

### 3.2 Tool Issuance Workflow

#### 3.2.1 Issue Tools Form
**Location**: Tools → Issue Tools

**Fields Required**:
- **Reference ID**: Auto-generated (ORG001-12345 format)
  - First 3 letters: Organisation code
  - 5 digits: Sequential number
- **Date**: Current date (editable)
- **Client**: Dropdown from existing client database
- **Tool Source Place**: Dropdown with default values
  - **Default Options**: "Warehouse", "Main Office", "Central Store", "Regional Hub"
  - **User can select**: Current location where tools are stored
  - **Display**: Above tools table as "TOOL SOURCE: [Selected Place]"
- **Taken By**: Employee name (text input)
- **Remarks**: Text area for notes
- **Tools Section**: Dynamic table with columns:
  - Tool Name (dropdown from catalog)
  - Make (user-specific, hide/unhide option in template settings)
  - Quantity (number input)
  - Actions (add/remove rows)

**Actions**:
- Add Tool button (adds new row)
- Submit button (with loading spinner)
- Success notification with download PDF option

#### 3.2.2 Business Rules
- Reference ID must be unique per organisation
- Cannot issue more tools than available in stock
- Validation for required fields
- Auto-update stock levels on submission
- Tool source place is saved for audit trail

### 3.3 Tool Receipt Workflow

#### 3.3.1 Receive Tools Form
**Location**: Tools → Receive Tools

**Fields Required**:
- Reference ID (searchable autocomplete)
- Client Name (auto-populated)
- Tools List (auto-populated from issuance)
- Received Quantity (editable per tool)
- Return Date (current date)
- Received By (employee name)
- Remarks (condition notes)

**Actions**:
- Search by Reference ID
- Partial or complete returns
- Update stock levels automatically
- Generate receipt PDF

### 3.4 Direct Client Transfer

#### 3.4.1 Transfer Tools Form
**Location**: Tools → Transfer Tools

**Fields Required**:
- Reference ID: New auto-generated ID
- From Client: Dropdown
- To Client: Dropdown
- Transfer Date: Current date
- Tools Section: Same as issuance form
- Reason for Transfer: Text area
- Approved By: Employee name

**Business Rules**:
- Cannot transfer to same client
- Validate tool availability at source client
- Create audit trail for both clients
- No warehouse stock impact

### 3.5 Site-to-Site Transfer

#### 3.5.1 Site Transfer Form
**Location**: Tools → Site Transfer

**Fields Required**:
- Reference ID: Auto-generated (ORG001-12345 format)
- Transfer Date: Current date
- From Project: Dropdown (project sites)
- From Site Address: Auto-populated from project
- To Project: Dropdown (project sites)
- To Site Address: Auto-populated from project
- Transferred By: Employee name
- Received By: Employee name (at destination)
- Reason for Transfer: Text area
- Vehicle Number: Optional tracking
- Tools Section: Same as issuance form

**Business Rules**:
- Cannot transfer to same project/site
- Validate tool availability at source project
- Create audit trail for both projects
- No warehouse stock impact
- Update project tool inventory directly

#### 3.5.2 Site Transfer Workflow
1. **Initiation**: Select source and destination projects
2. **Tool Selection**: Choose tools available at source project
3. **Authorization**: Manager approval for high-value tools
4. **Transit**: Mark status as "In Transit"
5. **Receipt**: Destination confirms receipt
6. **Inventory Update**: Both projects' tool counts updated

#### 3.6 Tool History & Search

#### 3.6.1 History Table
**Location**: Tools → Tool History

**Columns**:
- Reference ID
- Date
- Client/Project Name
- Transaction Type (Issue/Receive/Transfer/Site Transfer)
- Tool Details
- Status (At Client/Partial Received/Returned/In Transit)
- Actions (View/Edit/Download PDF)

#### 3.6.2 Search & Filters
- **Date Range**: Start and end date pickers
- **Client/Project**: Multi-select dropdown
- **Transaction Type**: Issue/Receive/Transfer/Site Transfer
- **Status**: Active/Returned/Partial/In Transit
- **Reference ID**: Text search
- **Tool Name**: Text search

### 3.7 Tools Dashboard

#### 3.7.1 Dashboard Metrics
**Location**: Tools → Dashboard

**Key Metrics**:
- Total Tools in Catalog
- Tools Currently at Clients/Sites
- Tools Available in Warehouse
- Tools in Transit (including site transfers)
- Overdue Returns (if any)

#### 3.7.2 Recent Activity
- Last 10 transactions
- Pending returns
- Recent transfers (client + site transfers)
- Pending site transfers

#### 3.7.3 Quick Actions
- Issue Tools button (Warehouse → Site)
- Receive Tools button (Site → Warehouse)
- Transfer Tools button (Client → Client)
- Site Transfer button (Site → Site)

### 3.8 Tool Catalog Management

#### 3.8.1 Tool Creation Form
**Location**: Tools → Tool Catalog → Add New Tool

**Fields Required**:
- **Basic Information**:
  - Tool Name (required, unique)
  - Make/Brand (text) - This will be the "Tool Source" in DC
  - Model Number (text)
  - Category (dropdown)
  
- **Financial Information**:
  - Purchase Price (number)
  - GST Rate (percentage)
  - Depreciation Rate (optional)

- **Technical Specifications**:
  - Technical Details (rich text editor)
  - Specifications table (dynamic rows)
  - Upload Images/Diagrams

- **Custom Labels** (4 custom fields):
  - Label 1 Name + Value
  - Label 2 Name + Value  
  - Label 3 Name + Value
  - Label 4 Name + Value

- **Stock Information**:
  - Initial Stock Quantity
  - Minimum Stock Level
  - Reorder Point
  - Default Source Location (dropdown: Warehouse, Main Office, Central Store, Regional Hub)

#### 3.8.2 Tool List View
- Searchable table with all tools
- Edit/Delete options
- Stock status indicators
- Bulk import/export functionality

## 4. Data Model

### 4.1 Database Schema

#### 4.1.1 Tools Catalog Table
```sql
CREATE TABLE tools_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID REFERENCES organisations(id),
    tool_name VARCHAR(255) NOT NULL,
    make VARCHAR(100),
    model VARCHAR(100),
    category VARCHAR(100),
    purchase_price DECIMAL(10,2),
    gst_rate DECIMAL(5,2),
    depreciation_rate DECIMAL(5,2),
    technical_specs TEXT,
    custom_label_1_name VARCHAR(100),
    custom_label_1_value VARCHAR(255),
    custom_label_2_name VARCHAR(100),
    custom_label_2_value VARCHAR(255),
    custom_label_3_name VARCHAR(100),
    custom_label_3_value VARCHAR(255),
    custom_label_4_name VARCHAR(100),
    custom_label_4_value VARCHAR(255),
    initial_stock INTEGER DEFAULT 0,
    current_stock INTEGER DEFAULT 0,
    min_stock_level INTEGER DEFAULT 0,
    reorder_point INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 4.1.2 Tool Transactions Table
```sql
CREATE TABLE tool_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID REFERENCES organisations(id),
    reference_id VARCHAR(20) NOT NULL UNIQUE,
    transaction_type VARCHAR(20) NOT NULL, -- 'ISSUE', 'RECEIVE', 'TRANSFER'
    transaction_date DATE NOT NULL,
    client_id UUID REFERENCES clients(id),
    from_client_id UUID REFERENCES clients(id), -- for transfers
    to_client_id UUID REFERENCES clients(id),   -- for transfers
    taken_by VARCHAR(255),
    received_by VARCHAR(255),
    remarks TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVE', -- 'ACTIVE', 'RETURNED', 'PARTIAL'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 4.1.3 Tool Transaction Items Table
```sql
CREATE TABLE tool_transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES tool_transactions(id),
    tool_id UUID REFERENCES tools_catalog(id),
    quantity INTEGER NOT NULL,
    returned_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 4.1.4 Tool Stock Movements Table
```sql
CREATE TABLE tool_stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID REFERENCES organisations(id),
    tool_id UUID REFERENCES tools_catalog(id),
    transaction_id UUID REFERENCES tool_transactions(id),
    movement_type VARCHAR(20) NOT NULL, -- 'OUT', 'IN', 'TRANSFER', 'SITE_TRANSFER'
    quantity INTEGER NOT NULL,
    location_type VARCHAR(20) NOT NULL, -- 'WAREHOUSE', 'CLIENT', 'PROJECT'
    location_id UUID, -- client_id or project_id or NULL for warehouse
    balance_after INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 4.1.5 Site Tool Transfers Table
```sql
CREATE TABLE site_tool_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID REFERENCES organisations(id),
    reference_id VARCHAR(20) UNIQUE NOT NULL,
    transfer_date DATE NOT NULL,
    from_project_id UUID REFERENCES projects(id),
    to_project_id UUID REFERENCES projects(id),
    transferred_by VARCHAR(255),
    received_by VARCHAR(255),
    reason_for_transfer TEXT,
    vehicle_number VARCHAR(50),
    status VARCHAR(20) DEFAULT 'IN_TRANSIT',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### 4.2 Reference ID Generation
```sql
CREATE SEQUENCE tools_ref_seq START 1;
-- Format: ORG001-12345 (ORG + 3-digit org code + 5-digit sequence)
```

## 5. Technical Implementation

### 5.1 Frontend Components

#### 5.1.1 File Structure
```
src/
├── pages/
│   ├── ToolsDashboard.tsx
│   ├── IssueTools.tsx
│   ├── ReceiveTools.tsx
│   ├── TransferTools.tsx
│   ├── ToolHistory.tsx
│   └── ToolCatalog.tsx
├── components/
│   └── tools/
│       ├── ToolIssueForm.tsx
│       ├── ToolReceiptForm.tsx
│       ├── ToolTransferForm.tsx
│       ├── ToolHistoryTable.tsx
│       ├── ToolCatalogForm.tsx
│       └── ToolTransactionPDF.tsx
└── tools/
    ├── api.ts
    └── types.ts
```

#### 5.1.2 Key Components

**ToolIssueForm.tsx**:
- Dynamic tool selection with stock validation
- Real-time stock availability checking
- Form validation and submission
- PDF generation on success

**ToolHistoryTable.tsx**:
- Advanced filtering and search
- Pagination for large datasets
- Export to CSV functionality
- Row actions (View/Edit/Download)

**ToolTransactionPDF.tsx**:
- Based on ClassicQuotationTemplate.tsx
- Custom layout for tool transactions
- Support for multiple tools per transaction
- Organisation branding and details

### 5.2 Backend API

#### 5.2.1 API Endpoints
```typescript
// Tool Catalog
POST   /api/tools/catalog              // Create new tool
GET    /api/tools/catalog              // List all tools
PUT    /api/tools/catalog/:id          // Update tool
DELETE /api/tools/catalog/:id          // Delete tool

// Tool Transactions
POST   /api/tools/issue                // Issue tools to client
POST   /api/tools/receive              // Receive tools from client
POST   /api/tools/transfer             // Transfer between clients
GET    /api/tools/transactions         // List transactions
GET    /api/tools/transactions/:id     // Get transaction details

// Stock Management
GET    /api/tools/stock                // Get stock levels
POST   /api/tools/stock/update         // Update stock manually

// Reference ID Generation
GET    /api/tools/reference-id         // Get next reference ID
```

#### 5.2.2 Stock Management Logic
```typescript
interface StockUpdate {
  toolId: string;
  quantity: number;
  movementType: 'OUT' | 'IN' | 'TRANSFER';
  locationType: 'WAREHOUSE' | 'CLIENT';
  locationId?: string;
  transactionId: string;
}

async function updateStock(update: StockUpdate) {
  // 1. Get current stock balance
  // 2. Validate movement (can't go negative)
  // 3. Update tools_catalog.current_stock
  // 4. Create stock_movement record
  // 5. Update transaction status if needed
}
```

### 5.3 PDF Generation

#### 5.3.1 Template Strategy
Using **Classic Quotation Template** modified for Tools Delivery Challan:

**Template File**: `src/pages/ClassicToolsDeliveryChallanTemplate.tsx`

**Key Features**:
- **Classic quotation layout** (consistent with existing templates)
- **Fixed document title**: "DELIVERY CHALLAN" for all tools transactions
- **Organization header** with logo and details
- **Dynamic content based on transaction type** (Issue/Receive/Transfer)
- **Template Settings integration** for customizable columns
- **HSN Code support** for tools with proper GST compliance

#### 5.3.2 Template Settings Integration

**Document Type Added**: "Tools Delivery Challan" in Template Settings

**Customizable Columns**:
- **Tool Name** (instead of Item Name)
- **Tool Code** (instead of Item Code)  
- **HSN Code** (enabled by default for tools)
- **Make** (tool manufacturer)
- **Quantity** (mandatory)
- **Rate** (tool value)
- **Tax %** (GST rates)
- **Amount** (line total)

**Template Settings Options**:
- Show/hide specific columns
- Configure organization details
- Bank details display
- Terms and conditions
- Signature requirements
- Page size and orientation

#### 5.3.3 PDF Layout Structure

**Header Section**:
```
┌─────────────────────────────────────────────────────────────┐
│ ORGANIZATION LOGO & DETAILS                             │
│                    DELIVERY CHALLAN                      │
├─────────────────────────────────────────────────────────────┤
│ DC NO. │ DATE    │ TRANSACTION TYPE │ TAKEN BY │ PREP. BY │
│ ORG001-12345 │ 10/05/2026 │ ISSUE           │ John     │ Admin    │
└─────────────────────────────────────────────────────────────┘
```

**Client & Transaction Details**:
- **For Issue/Receive**: Client Name, Address, GSTIN, Project
- **For Transfer**: From Client, To Client, Transfer Reason
- Additional Details: State, E-Way Bill, Received By

**Tools Table** (with HSN Code support):
```
┌─────────────────────────────────────────────────────────────┐
│ CODE │ TOOL NAME    │ DESCRIPTION │ HSN   │ QTY │ RATE   │ AMOUNT │
│ TL001 │ Drill Machine│ Bosch GSB 550│ 8467  │ 2   │ 4500   │ 9000   │
│ TL002 │ Power Saw    │ Makita 5703 │ 8465  │ 1   │ 3200   │ 3200   │
└─────────────────────────────────────────────────────────────┘
```

**Totals Section**:
- Subtotal
- Tax Amount (GST based on HSN)
- Round Off
- Grand Total

**Terms & Conditions**:
- Customizable terms based on transaction type
- GST compliance notes
- Return policy terms

**Signature Section**:
- Issued By signature and date
- Received By signature and date
- Company seal space

#### 5.3.4 PDF Generation Functions

**Core Functions**:
```typescript
// Generate PDF Blob using Classic Template
export const generateClassicToolsDeliveryChallanTemplate = (data, organisation, templateSettings): Blob

// Integration with existing PDF workflow
generateToolsTransactionPDF(transactionData, organisation): Blob

// Open PDF in new tab
openToolsTransactionPDF(transactionData, organisation): void

// Download PDF with custom filename
downloadToolsTransactionPDF(transactionData, organisation, filename): void
```

**Integration Points**:
- Called from Issue Tools form on successful submission
- Called from Receive Tools form on successful submission
- Called from Transfer Tools form on successful submission
- Available from Tools History table "Download PDF" action
- Template Settings integration for customization

#### 5.3.5 Dynamic Content Handling

**Transaction Type Variations**:
- **ISSUE**: Shows "Taken By", "DC NO." as reference
- **RECEIVE**: Shows "Received By", "Returned Qty" in table
- **TRANSFER**: Shows "From/To Client", transfer reason in client details

**Conditional Sections**:
- Transfer details only for TRANSFER type
- Different client details layout based on transaction type
- Dynamic metadata fields in header
- Custom terms and conditions per transaction type

#### 5.3.6 Template Settings Integration

**Customization via Template Settings**:
- **Column Visibility**: Show/hide Tool Code, HSN, Make, etc.
- **Layout Options**: Page size, orientation, margins
- **Content Options**: Bank details, terms, signatures
- **Branding**: Logo, colors, fonts

**Template Configuration**:
```typescript
// Template Settings for Tools Delivery Challan
{
  template_name: "Tools Delivery Challan",
  document_type: "Tools Delivery Challan",
  column_settings: {
    optional: {
      tool_code: true,
      hsn_code: true,  // Enabled for GST compliance
      make: true,
      description: true,
      rate: true,
      tax_percent: true,
      line_total: true
    }
  },
  show_bank_details: false,
  show_terms: true,
  show_signature: true
}
```

#### 5.3.7 HSN Code Support for Tools

**GST Compliance**:
- **HSN Code column** enabled by default for tools
- **Tax calculation** based on HSN rates
- **GST breakdown** in totals section
- **E-Way Bill support** for high-value tools

**HSN Code Integration**:
- Tools catalog includes HSN codes
- Auto-populate HSN in delivery challan
- GST rates calculated automatically
- Support for different tax rates (5%, 12%, 18%, 28%)

## 6. User Experience Design

### 6.1 Professional Modal Design System
Based on `PROFESSIONAL_MODAL_DESIGN.md` - High-Density Enterprise Design

#### 6.1.1 Visual Philosophy
- **High-Density**: Minimize wasted whitespace to show more information without clutter
- **Precision**: Use fixed spacing (8px grid) and crisp, non-rounded edges (4px max) for professional "command center" feel
- **Hierarchy**: Strong distinction between primary text, secondary metadata, and muted labels

#### 6.1.2 Color Tokens
| Token | Value | Usage |
| :--- | :--- | :--- |
| **Surface (Card)** | `#FFFFFF` | Main modal body background |
| **Surface (Page)** | `#F8F9FA` | Inputs, footers, and background contrasts |
| **Border** | `#E5E7EB` | Hairline dividers and input strokes |
| **Accent** | `#DC2626` | Destructive actions or critical status |
| **Text Primary** | `#111827` | Headlines and active input text |
| **Text Secondary** | `#6B7280` | Body text and sub-headers |
| **Text Muted** | `#9CA3AF` | Captions and inactive placeholders |

#### 6.1.3 Typography (Inter Stack)
| Element | Size | Weight | Transformation |
| :--- | :--- | :--- | :--- |
| **Modal Title** | `1.125rem` (18px) | 700 | Sentence case |
| **Form Labels** | `0.75rem` (12px) | 600 | ALL CAPS / 0.04em track |
| **Input Text** | `0.875rem` (14px) | 400 | - |
| **Buttons** | `0.875rem` (14px) | 600 | - |
| **Monospace** | `0.8125rem` (13px) | 500 | (JetBrains Mono for IDs) |

#### 6.1.4 Spacing & Layout
- **Overlay**: `rgba(0,0,0,0.5)` with `backdrop-filter: blur(2px)`
- **Container Width**: `640px` (Standard Form), `800px` (Data Rich), `1100px` (Dashboard)
- **Main Padding**: `1.25rem` (20px) uniform
- **Form Grid Gap**: `1rem` (16px) between rows; `0.375rem` (6px) between label and input
- **Border Radius**: `0.375rem` (6px) for subtle modern curve, or `0px` for "Enterprise Command" look

#### 6.1.5 Component Anatomy

**Header**:
- **Height**: `56px`
- **Elements**: Title (Left), Close Button (Right - 32x32px ghost button)
- **Separator**: `1px solid #E5E7EB`

**Form Inputs**:
- **Height**: `38px` (High-density)
- **State (Focus)**: `Border: 1px solid #DC2626`, `Background: #FFFFFF`
- **Background (Default)**: `#F8F9FA` (Contrast against card surface)

**Footer**:
- **Background**: `#F8F9FA`
- **Height**: `64px`
- **Layout**: `flex-end` alignment with `0.75rem` (12px) gap between actions

### 6.2 Design Principles
- **Professional Enterprise**: High-density, command center aesthetic
- **Consistency**: Apply design system across all tools workflows
- **Efficiency**: Minimize clicks with optimized layouts
- **Clarity**: Clear hierarchy and status indicators
- **Responsive**: Works on tablets and desktop (primary focus)

### 6.2 Key Interactions

#### 6.2.1 Tool Selection
- Autocomplete with search
- Show available stock in dropdown
- Batch add multiple tools
- Quick-add for frequently used tools

#### 6.2.2 Status Indicators
- Color-coded status badges
- Progress indicators for partial returns
- Alert for low stock items
- Notification for overdue returns

#### 6.2.3 Search & Filtering
- Real-time search as you type
- Multi-select filters
- Saved filter presets
- Export filtered results

## 7. Security & Access Control

### 7.1 Permissions Matrix
| Role | Issue | Receive | Transfer | Catalog | History |
|------|-------|---------|----------|---------|---------|
| Warehouse Manager | ✓ | ✓ | ✓ | ✓ | ✓ |
| Project Manager | ✓ | ✓ | ✓ | ✗ | ✓ |
| Admin | ✓ | ✓ | ✓ | ✓ | ✓ |
| Viewer | ✗ | ✗ | ✗ | ✗ | ✓ |

### 7.2 Data Security
- Organisation-based data isolation
- Audit trail for all transactions
- Role-based API access
- Input validation and sanitization

## 8. Performance Considerations

### 8.1 Database Optimization
- Indexes on frequently queried columns
- Partitioning for large transaction tables
- Archived transactions for historical data

### 8.2 Frontend Performance
- Lazy loading for large tool catalogs
- Virtual scrolling for history tables
- Caching for frequently accessed data
- Optimized PDF generation

## 9. Testing Strategy

### 9.1 Unit Tests
- Stock calculation logic
- Reference ID generation
- Form validation
- API endpoints

### 9.2 Integration Tests
- End-to-end transaction workflows
- PDF generation accuracy
- Stock level consistency
- Multi-user scenarios

### 9.3 User Acceptance Tests
- Warehouse operations workflow
- Client transfer scenarios
- Reporting accuracy
- Performance under load

## 10. Implementation Phases

### Phase 1: Core Functionality (Week 1-2)
- Database schema creation
- Basic tool catalog CRUD
- Issue/Receive tools functionality
- Simple dashboard

### Phase 2: Advanced Features (Week 3-4)
- Client transfer functionality
- Advanced search and filtering
- PDF generation
- Stock management automation

### Phase 3: Polish & Optimization (Week 5-6)
- UI/UX improvements
- Performance optimization
- Testing and bug fixes
- Documentation and training

## 11. Success Metrics

### 11.1 Operational Metrics
- Reduction in tool loss/misplacement
- Faster tool issuance/receipt processing
- Improved stock visibility
- Reduced manual paperwork

### 11.2 User Satisfaction
- Ease of use ratings
- Training time required
- Support ticket reduction
- User adoption rate

## 12. Tools Procurement Integration

### 12.1 Purchase Order Integration
The Tools Management System integrates with the existing Purchase Order module for tool procurement:

#### 12.1.1 Procurement Workflow
1. **Tool Identification**: Tools are marked as item_type 'TOOL' in materials table
2. **PO Creation**: Use existing Purchase Orders module to procure tools
3. **Auto-Receipt**: When PO status changes to 'Completed', tools are automatically added to tools_catalog
4. **Stock Update**: Current stock in tools_catalog is updated automatically

#### 12.1.2 PO Creation for Tools
- Navigate to **Purchase → Purchase Orders**
- Filter materials by **Type: Tools**
- Select tools from existing catalog or add new tools
- Standard PO workflow (3-step process)
- PO auto-generates with existing numbering system

#### 12.1.3 Tools-Specific PO Features
- **Make/Model**: Required fields for tools procurement
- **Technical Specs**: Rich text descriptions for specifications
- **GST Rates**: Tool-specific tax rates
- **Warranty**: Additional warranty information field
- **Serial Numbers**: Optional serial number tracking

#### 12.1.4 Receipt & Stock Integration
```sql
-- Automatic stock update on PO completion
CREATE TRIGGER update_tools_stock_on_po_complete
  AFTER UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_tools_on_po_completion();
```

### 12.2 Tools Procurement Dashboard

#### 12.2.1 Procurement Metrics
- **Pending Tool POs**: Count and value of pending orders
- **Tools in Transit**: POs marked as "Sent" but not "Completed"
- **Lead Time**: Average delivery time for tools
- **Vendor Performance**: Tool delivery reliability by vendor

#### 12.2.2 Quick Actions
- **Procure New Tool**: Redirects to PO creation with tool filter
- **Reorder Tool**: Pre-filled PO based on existing tool
- **Track PO**: Monitor pending tool orders
- **Receive Tools**: Quick receipt from completed POs

### 12.3 Vendor Management for Tools

#### 12.3.1 Tool-Specific Vendors
- **Specialized Tool Suppliers**: Vendors categorized by tool types
- **Preferred Vendors**: Mark preferred suppliers for specific tools
- **Pricing History**: Track price trends for tools
- **Quality Ratings**: Rate vendors based on tool quality

#### 12.3.2 Vendor Integration
- Use existing `purchase_vendors` table
- Add `vendor_type` field: 'GENERAL', 'TOOLS', 'MATERIALS'
- Filter vendors by type when creating tool POs

## 13. Future Enhancements

### 13.1 Planned Features
- Mobile app for field operations
- QR code scanning for tools
- Predictive maintenance scheduling
- Multi-warehouse support
- Tool maintenance tracking
- Cost allocation per project
- Advanced reporting and analytics

### 13.2 Scalability Considerations
- Multi-location tool tracking
- Tool lifecycle management
- Integration with asset management
- Advanced analytics and reporting
