# Proforma Invoices API

<cite>
**Referenced Files in This Document**
- [proforma-invoices.ts](file://src/proforma-invoices/api.ts)
- [useProformaInvoices.ts](file://src/proforma-invoices/hooks.ts)
- [proforma-types.ts](file://src/proforma-invoices/types.ts)
- [database-proforma-invoices.sql](file://src/database-proforma-invoices.sql)
- [proforma-page.tsx](file://src/pages/ProformaInvoicePage.tsx)
- [proforma-list.tsx](file://src/pages/ProformaInvoiceList.tsx)
- [conversion-api.ts](file://src/conversions/api.ts)
- [invoice-api.ts](file://src/invoices/api.ts)
- [advance-payment-modal.tsx](file://src/components/AdvancePaymentModal.tsx)
- [template-renderer.tsx](file://src/pdf/template-renderer.tsx)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction
This document provides detailed API documentation for proforma invoice management, including creation, modification, conversion to formal invoices, and advance payment handling. It also covers item management, pricing calculations, template rendering, and the end-to-end workflow from proforma to invoice with financial adjustments. Examples are provided for advance payment scenarios and contract-based billing processes.

## Project Structure
The proforma invoice feature is implemented across dedicated modules:
- API layer for CRUD and conversion operations
- Hooks for client-side data fetching and mutations
- Types for request/response schemas
- Database schema definitions
- UI pages for listing and editing proforma invoices
- Conversion utilities linking proforma to invoices
- Template rendering for PDF generation

```mermaid
graph TB
subgraph "Frontend"
PIF["Proforma Invoice Page"]
PIL["Proforma Invoice List"]
AP["Advance Payment Modal"]
TR["Template Renderer"]
end
subgraph "API Layer"
PA["Proforma API"]
CA["Conversion API"]
IA["Invoice API"]
end
subgraph "Data"
DB["Database Schema"]
end
PIF --> PA
PIL --> PA
AP --> PA
PIF --> CA
CA --> IA
PIF --> TR
PA --> DB
CA --> DB
IA --> DB
```

**Diagram sources**
- [proforma-page.tsx](file://src/pages/ProformaInvoicePage.tsx)
- [proforma-list.tsx](file://src/pages/ProformaInvoiceList.tsx)
- [advance-payment-modal.tsx](file://src/components/AdvancePaymentModal.tsx)
- [template-renderer.tsx](file://src/pdf/template-renderer.tsx)
- [proforma-invoices.ts](file://src/proforma-invoices/api.ts)
- [conversion-api.ts](file://src/conversions/api.ts)
- [invoice-api.ts](file://src/invoices/api.ts)
- [database-proforma-invoices.sql](file://src/database-proforma-invoices.sql)

**Section sources**
- [proforma-invoices.ts](file://src/proforma-invoices/api.ts)
- [useProformaInvoices.ts](file://src/proforma-invoices/hooks.ts)
- [proforma-types.ts](file://src/proforma-invoices/types.ts)
- [database-proforma-invoices.sql](file://src/database-proforma-invoices.sql)
- [proforma-page.tsx](file://src/pages/ProformaInvoicePage.tsx)
- [proforma-list.tsx](file://src/pages/ProformaInvoiceList.tsx)
- [conversion-api.ts](file://src/conversions/api.ts)
- [invoice-api.ts](file://src/invoices/api.ts)
- [advance-payment-modal.tsx](file://src/components/AdvancePaymentModal.tsx)
- [template-renderer.tsx](file://src/pdf/template-renderer.tsx)

## Core Components
- Proforma API module: exposes endpoints for creating, updating, deleting, and converting proforma invoices; supports item-level operations and totals calculation.
- Hooks: provide typed queries and mutations for efficient state synchronization and optimistic updates.
- Types: define request/response shapes, validation rules, and enums for statuses and tax configurations.
- Database schema: defines tables for proforma headers, line items, payments, and audit fields.
- UI pages: list view for browsing and filtering; edit/create page for building documents.
- Conversion API: orchestrates transformation from proforma to invoice, applying taxes, discounts, and currency conversions.
- Invoice API: creates final invoices and posts accounting entries.
- Advance payment modal: captures partial payments against a proforma and tracks remaining balance.
- Template renderer: generates printable PDFs using configured templates.

**Section sources**
- [proforma-invoices.ts](file://src/proforma-invoices/api.ts)
- [useProformaInvoices.ts](file://src/proforma-invoices/hooks.ts)
- [proforma-types.ts](file://src/proforma-invoices/types.ts)
- [database-proforma-invoices.sql](file://src/database-proforma-invoices.sql)
- [proforma-page.tsx](file://src/pages/ProformaInvoicePage.tsx)
- [proforma-list.tsx](file://src/pages/ProformaInvoiceList.tsx)
- [conversion-api.ts](file://src/conversions/api.ts)
- [invoice-api.ts](file://src/invoices/api.ts)
- [advance-payment-modal.tsx](file://src/components/AdvancePaymentModal.tsx)
- [template-renderer.tsx](file://src/pdf/template-renderer.tsx)

## Architecture Overview
The system follows a layered architecture:
- Presentation layer (pages and modals) interacts with hooks for data access.
- API layer encapsulates business logic and persistence calls.
- Data layer persists entities and maintains referential integrity.
- Conversion pipeline transforms proforma into invoice with financial adjustments.
- Rendering pipeline produces PDF outputs based on templates.

```mermaid
sequenceDiagram
participant UI as "UI Pages"
participant Hook as "Hooks"
participant API as "Proforma API"
participant Conv as "Conversion API"
participant Inv as "Invoice API"
participant DB as "Database"
UI->>Hook : Create/Update Proforma
Hook->>API : POST/PUT /proforma
API->>DB : Persist header + items
API-->>Hook : Proforma object
Hook-->>UI : Optimistic update
UI->>Conv : Convert to Invoice {proformaId}
Conv->>API : Read Proforma
Conv->>Inv : Create Invoice (mapped fields)
Inv->>DB : Post invoice + accounting entries
Conv-->>UI : Invoice created
```

**Diagram sources**
- [proforma-page.tsx](file://src/pages/ProformaInvoicePage.tsx)
- [useProformaInvoices.ts](file://src/proforma-invoices/hooks.ts)
- [proforma-invoices.ts](file://src/proforma-invoices/api.ts)
- [conversion-api.ts](file://src/conversions/api.ts)
- [invoice-api.ts](file://src/invoices/api.ts)
- [database-proforma-invoices.sql](file://src/database-proforma-invoices.sql)

## Detailed Component Analysis

### Proforma Creation and Modification
- Endpoints:
  - Create proforma: POST /proforma
  - Update proforma: PUT /proforma/:id
  - Delete proforma: DELETE /proforma/:id
  - Get proforma: GET /proforma/:id
  - List proformas: GET /proforma?filters
- Request body includes:
  - Header metadata (client, project, dates, currency, terms)
  - Line items (item id, description, qty, unit price, discount, tax rate)
  - Totals computed server-side (subtotal, discount total, tax total, grand total)
- Validation:
  - Required fields enforced at API layer
  - Numeric precision handled consistently
- Response:
  - Full proforma object with computed totals and status

```mermaid
flowchart TD
Start(["Create/Update Proforma"]) --> Validate["Validate input fields"]
Validate --> Valid{"Valid?"}
Valid --> |No| ReturnError["Return validation errors"]
Valid --> |Yes| ComputeTotals["Compute subtotal/discount/tax/grand total"]
ComputeTotals --> Persist["Persist header and line items"]
Persist --> ReturnResult["Return proforma object"]
```

**Diagram sources**
- [proforma-invoices.ts](file://src/proforma-invoices/api.ts)
- [proforma-types.ts](file://src/proforma-invoices/types.ts)

**Section sources**
- [proforma-invoices.ts](file://src/proforma-invoices/api.ts)
- [proforma-types.ts](file://src/proforma-invoices/types.ts)

### Item Management
- Operations:
  - Add item: include in line items array or via dedicated endpoint if supported
  - Remove item: delete by line item id
  - Update item: modify quantity, price, discount, tax
- Pricing:
  - Unit price multiplied by quantity yields line total
  - Discount applied per line or globally
  - Tax calculated on taxable amount after discount
- Inventory linkage:
  - Optional stock reservation when converting to invoice (if enabled)

```mermaid
classDiagram
class ProformaHeader {
+string id
+string clientId
+date issueDate
+date dueDate
+string currency
+number subtotal
+number discountTotal
+number taxTotal
+number grandTotal
+enum status
}
class ProformaLineItem {
+string id
+string proformaId
+string itemId
+string description
+number quantity
+number unitPrice
+number discountPercent
+number taxRate
+number lineTotal
}
ProformaHeader "1" --> "many" ProformaLineItem : "contains"
```

**Diagram sources**
- [proforma-types.ts](file://src/proforma-invoices/types.ts)
- [database-proforma-invoices.sql](file://src/database-proforma-invoices.sql)

**Section sources**
- [proforma-types.ts](file://src/proforma-invoices/types.ts)
- [database-proforma-invoices.sql](file://src/database-proforma-invoices.sql)

### Conversion Workflow: Proforma to Invoice
- Trigger:
  - User initiates conversion from proforma detail page
- Steps:
  - Read proforma header and items
  - Map fields to invoice schema
  - Apply current tax rules and currency conversion if needed
  - Create invoice record and related accounting entries
  - Update proforma status to converted
- Financial adjustments:
  - Discounts and taxes reflected in invoice totals
  - Advance payments offset invoice balance
  - Audit trail maintained for traceability

```mermaid
sequenceDiagram
participant UI as "Proforma Detail"
participant Conv as "Conversion API"
participant PI as "Proforma API"
participant INV as "Invoice API"
participant DB as "Database"
UI->>Conv : Convert(proformaId)
Conv->>PI : GET /proforma/ : id
PI-->>Conv : Proforma data
Conv->>INV : Create invoice (mapped payload)
INV->>DB : Insert invoice + entries
Conv->>PI : PATCH /proforma/ : id {status : "converted"}
Conv-->>UI : Success with invoiceId
```

**Diagram sources**
- [conversion-api.ts](file://src/conversions/api.ts)
- [proforma-invoices.ts](file://src/proforma-invoices/api.ts)
- [invoice-api.ts](file://src/invoices/api.ts)
- [database-proforma-invoices.sql](file://src/database-proforma-invoices.sql)

**Section sources**
- [conversion-api.ts](file://src/conversions/api.ts)
- [invoice-api.ts](file://src/invoices/api.ts)
- [proforma-invoices.ts](file://src/proforma-invoices/api.ts)

### Advance Payment Handling
- Purpose:
  - Record partial payments against a proforma before conversion
- Operations:
  - Create advance payment: POST /proforma/:id/payments
  - List payments: GET /proforma/:id/payments
  - Update payment: PUT /proforma/payments/:paymentId
  - Delete payment: DELETE /proforma/payments/:paymentId
- Balance calculation:
  - Remaining balance = Grand total - Sum of advance payments
- Conversion impact:
  - Converted invoice reflects paid amount and outstanding balance

```mermaid
flowchart TD
Start(["Record Advance Payment"]) --> ValidateAmt["Validate payment amount"]
ValidateAmt --> CheckCap{"Amount <= Outstanding?"}
CheckCap --> |No| Error["Reject overpayment"]
CheckCap --> |Yes| PersistPay["Persist payment record"]
PersistPay --> UpdateBalance["Update proforma outstanding balance"]
UpdateBalance --> ReturnOK["Return updated balance"]
```

**Diagram sources**
- [advance-payment-modal.tsx](file://src/components/AdvancePaymentModal.tsx)
- [proforma-invoices.ts](file://src/proforma-invoices/api.ts)

**Section sources**
- [advance-payment-modal.tsx](file://src/components/AdvancePaymentModal.tsx)
- [proforma-invoices.ts](file://src/proforma-invoices/api.ts)

### Template Rendering
- Functionality:
  - Generate PDF from proforma or invoice using configured HTML/CSS templates
- Inputs:
  - Document data (header, items, totals, client info)
  - Template selection and customization options
- Outputs:
  - Printable PDF stream or URL

```mermaid
sequenceDiagram
participant UI as "Print Button"
participant TR as "Template Renderer"
participant API as "Proforma/Invoice API"
UI->>TR : Render(documentType, documentId)
TR->>API : Fetch document data
API-->>TR : JSON payload
TR-->>UI : PDF blob/URL
```

**Diagram sources**
- [template-renderer.tsx](file://src/pdf/template-renderer.tsx)
- [proforma-invoices.ts](file://src/proforma-invoices/api.ts)
- [invoice-api.ts](file://src/invoices/api.ts)

**Section sources**
- [template-renderer.tsx](file://src/pdf/template-renderer.tsx)
- [proforma-invoices.ts](file://src/proforma-invoices/api.ts)
- [invoice-api.ts](file://src/invoices/api.ts)

### Examples

#### Example: Create Proforma with Items
- Endpoint: POST /proforma
- Payload includes:
  - Client identifier, issue date, due date, currency
  - Array of line items with quantities, prices, discounts, tax rates
- Server computes totals and returns full proforma object

**Section sources**
- [proforma-invoices.ts](file://src/proforma-invoices/api.ts)
- [proforma-types.ts](file://src/proforma-invoices/types.ts)

#### Example: Convert Proforma to Invoice
- Endpoint: POST /convert/proforma/:id/to-invoice
- Behavior:
  - Maps proforma fields to invoice schema
  - Creates invoice and accounting entries
  - Updates proforma status to converted
- Response includes new invoice identifier

**Section sources**
- [conversion-api.ts](file://src/conversions/api.ts)
- [invoice-api.ts](file://src/invoices/api.ts)

#### Example: Record Advance Payment
- Endpoint: POST /proforma/:id/payments
- Payload includes:
  - Payment amount, date, reference number
- Server validates against outstanding balance and updates records

**Section sources**
- [advance-payment-modal.tsx](file://src/components/AdvancePaymentModal.tsx)
- [proforma-invoices.ts](file://src/proforma-invoices/api.ts)

#### Example: Contract-Based Billing Process
- Steps:
  - Create proforma aligned with contract milestones
  - Record advance payments per milestone
  - Convert proforma to invoice upon milestone completion
  - Render invoice PDF for client delivery
- Notes:
  - Ensure milestone dates and amounts match contract terms
  - Maintain audit trail for compliance

**Section sources**
- [proforma-page.tsx](file://src/pages/ProformaInvoicePage.tsx)
- [conversion-api.ts](file://src/conversions/api.ts)
- [template-renderer.tsx](file://src/pdf/template-renderer.tsx)

## Dependency Analysis
- Frontend components depend on hooks for data operations.
- Hooks call API endpoints defined in the proforma module.
- Conversion API depends on both proforma and invoice APIs.
- Template renderer depends on document data fetched via APIs.
- Database schema underpins all entities and relationships.

```mermaid
graph TB
H["Hooks"] --> A["Proforma API"]
H --> C["Conversion API"]
C --> I["Invoice API"]
A --> D["Database Schema"]
C --> D
I --> D
R["Template Renderer"] --> A
R --> I
```

**Diagram sources**
- [useProformaInvoices.ts](file://src/proforma-invoices/hooks.ts)
- [proforma-invoices.ts](file://src/proforma-invoices/api.ts)
- [conversion-api.ts](file://src/conversions/api.ts)
- [invoice-api.ts](file://src/invoices/api.ts)
- [template-renderer.tsx](file://src/pdf/template-renderer.tsx)
- [database-proforma-invoices.sql](file://src/database-proforma-invoices.sql)

**Section sources**
- [useProformaInvoices.ts](file://src/proforma-invoices/hooks.ts)
- [proforma-invoices.ts](file://src/proforma-invoices/api.ts)
- [conversion-api.ts](file://src/conversions/api.ts)
- [invoice-api.ts](file://src/invoices/api.ts)
- [template-renderer.tsx](file://src/pdf/template-renderer.tsx)
- [database-proforma-invoices.sql](file://src/database-proforma-invoices.sql)

## Performance Considerations
- Use pagination and filters for listing proformas to reduce payload size.
- Prefer server-side computation of totals to avoid client rounding discrepancies.
- Cache frequently accessed templates to speed up PDF generation.
- Batch updates where possible to minimize network round-trips.
- Optimize database indexes on foreign keys and commonly filtered columns.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Common issues:
  - Validation errors: ensure required fields and numeric formats are correct.
  - Overpayment rejection: verify outstanding balance before recording payments.
  - Conversion failures: check that proforma status allows conversion and mapping fields exist.
  - Template rendering errors: confirm template availability and valid placeholders.
- Debugging tips:
  - Inspect API responses for error messages and stack traces.
  - Verify database constraints and referential integrity.
  - Review audit logs for conversion and payment actions.

**Section sources**
- [proforma-invoices.ts](file://src/proforma-invoices/api.ts)
- [conversion-api.ts](file://src/conversions/api.ts)
- [advance-payment-modal.tsx](file://src/components/AdvancePaymentModal.tsx)
- [template-renderer.tsx](file://src/pdf/template-renderer.tsx)

## Conclusion
The proforma invoice API provides robust capabilities for creating, modifying, and converting proforma documents to invoices, along with advance payment tracking and template-based PDF rendering. The layered architecture ensures clear separation of concerns, while the conversion pipeline guarantees accurate financial adjustments and auditability. Following the examples and guidelines will help implement reliable contract-based billing workflows.