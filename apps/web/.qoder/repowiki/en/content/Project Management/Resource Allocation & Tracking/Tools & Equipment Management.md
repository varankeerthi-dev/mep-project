# Tools & Equipment Management

<cite>
**Referenced Files in This Document**
- [ToolsCatalog.tsx](file://src/pages/ToolsCatalog.tsx)
- [ToolsDashboard.tsx](file://src/pages/ToolsDashboard.tsx)
- [ToolsHistory.tsx](file://src/pages/ToolsHistory.tsx)
- [ToolsManagement.tsx](file://src/pages/ToolsManagement.tsx)
- [ToolsSettings.tsx](file://src/pages/ToolsSettings.tsx)
- [ClassicToolsDeliveryChallanTemplate.tsx](file://src/pages/ClassicToolsDeliveryChallanTemplate.tsx)
- [useMaterials.ts](file://src/hooks/useMaterials.ts)
- [useWarehouses.ts](file://src/hooks/useWarehouses.ts)
- [database-add-equipment-no-fault.sql](file://src/database-add-equipment-no-fault.sql)
- [supabase-tables.sql](file://supabase-tables.sql)
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
10. [Appendices](#appendices)

## Introduction
This document describes the tools and equipment management system implemented in the web application. It covers tool catalog creation, maintenance scheduling, utilization tracking, reservation workflows, checkout/checkin processes, condition monitoring, project allocations, automated alerts for overdue returns, depreciation calculations, mobile access for field teams, barcode scanning capabilities, and real-time availability across multiple locations. The goal is to provide both a high-level overview and detailed implementation guidance for developers and operators.

## Project Structure
The tools and equipment module is primarily implemented as React pages under src/pages, with supporting hooks and database migrations. Key files include:
- Pages for catalog, dashboard, history, management, and settings
- A delivery challan template for tools
- Hooks for materials and warehouses integration
- Database schema and migration scripts

```mermaid
graph TB
subgraph "Pages"
A["ToolsCatalog.tsx"]
B["ToolsDashboard.tsx"]
C["ToolsHistory.tsx"]
D["ToolsManagement.tsx"]
E["ToolsSettings.tsx"]
F["ClassicToolsDeliveryChallanTemplate.tsx"]
end
subgraph "Hooks"
G["useMaterials.ts"]
H["useWarehouses.ts"]
end
subgraph "Database"
I["supabase-tables.sql"]
J["database-add-equipment-no-fault.sql"]
end
A --> G
B --> G
C --> G
D --> G
D --> H
E --> I
F --> G
I --> J
```

**Diagram sources**
- [ToolsCatalog.tsx](file://src/pages/ToolsCatalog.tsx)
- [ToolsDashboard.tsx](file://src/pages/ToolsDashboard.tsx)
- [ToolsHistory.tsx](file://src/pages/ToolsHistory.tsx)
- [ToolsManagement.tsx](file://src/pages/ToolsManagement.tsx)
- [ToolsSettings.tsx](file://src/pages/ToolsSettings.tsx)
- [ClassicToolsDeliveryChallanTemplate.tsx](file://src/pages/ClassicToolsDeliveryChallanTemplate.tsx)
- [useMaterials.ts](file://src/hooks/useMaterials.ts)
- [useWarehouses.ts](file://src/hooks/useWarehouses.ts)
- [supabase-tables.sql](file://supabase-tables.sql)
- [database-add-equipment-no-fault.sql](file://src/database-add-equipment-no-fault.sql)

**Section sources**
- [ToolsCatalog.tsx](file://src/pages/ToolsCatalog.tsx)
- [ToolsDashboard.tsx](file://src/pages/ToolsDashboard.tsx)
- [ToolsHistory.tsx](file://src/pages/ToolsHistory.tsx)
- [ToolsManagement.tsx](file://src/pages/ToolsManagement.tsx)
- [ToolsSettings.tsx](file://src/pages/ToolsSettings.tsx)
- [ClassicToolsDeliveryChallanTemplate.tsx](file://src/pages/ClassicToolsDeliveryChallanTemplate.tsx)
- [useMaterials.ts](file://src/hooks/useMaterials.ts)
- [useWarehouses.ts](file://src/hooks/useWarehouses.ts)
- [supabase-tables.sql](file://supabase-tables.sql)
- [database-add-equipment-no-fault.sql](file://src/database-add-equipment-no-fault.sql)

## Core Components
- Tool Catalog: Create and maintain tool records, categories, serial numbers, barcodes, purchase details, and initial condition.
- Dashboard: Real-time availability, utilization metrics, upcoming maintenance, and overdue alerts.
- History: Audit trail of checkouts, checkins, repairs, maintenance, and status changes.
- Management: Reservation workflow, checkout/checkin operations, location transfers, and condition updates.
- Settings: Categories, maintenance intervals, depreciation rules, alert thresholds, and barcode configuration.
- Delivery Challan Template: Printable record for physical handover at site.

Key integrations:
- Materials and warehouses via hooks for unified inventory context.
- Database schema for equipment tables and audit fields.

**Section sources**
- [ToolsCatalog.tsx](file://src/pages/ToolsCatalog.tsx)
- [ToolsDashboard.tsx](file://src/pages/ToolsDashboard.tsx)
- [ToolsHistory.tsx](file://src/pages/ToolsHistory.tsx)
- [ToolsManagement.tsx](file://src/pages/ToolsManagement.tsx)
- [ToolsSettings.tsx](file://src/pages/ToolsSettings.tsx)
- [ClassicToolsDeliveryChallanTemplate.tsx](file://src/pages/ClassicToolsDeliveryChallanTemplate.tsx)
- [useMaterials.ts](file://src/hooks/useMaterials.ts)
- [useWarehouses.ts](file://src/hooks/useWarehouses.ts)
- [supabase-tables.sql](file://supabase-tables.sql)

## Architecture Overview
The system follows a page-driven architecture with shared hooks for data access and a relational backend. Pages orchestrate user flows; hooks encapsulate API calls and caching; migrations define persistent structures.

```mermaid
sequenceDiagram
participant User as "Field User"
participant UI as "ToolsManagement.tsx"
participant Hook as "useMaterials.ts"
participant DB as "Supabase Tables"
participant Alert as "Alert Engine"
User->>UI : "Reserve tool"
UI->>Hook : "Check availability by location"
Hook->>DB : "Query stock and reservations"
DB-->>Hook : "Availability result"
Hook-->>UI : "Available or not"
UI->>User : "Confirm reservation"
UI->>Hook : "Create reservation"
Hook->>DB : "Insert reservation record"
DB-->>Hook : "Success"
Hook-->>UI : "Reservation created"
UI->>Alert : "Schedule reminders"
Alert-->>User : "Email/SMS reminder before due date"
```

**Diagram sources**
- [ToolsManagement.tsx](file://src/pages/ToolsManagement.tsx)
- [useMaterials.ts](file://src/hooks/useMaterials.ts)
- [supabase-tables.sql](file://supabase-tables.sql)

## Detailed Component Analysis

### Tool Catalog Creation and Maintenance
- Purpose: Define equipment master data including categories, identifiers (serial number, barcode), acquisition cost, warranty, and initial condition.
- Features:
  - Category hierarchy and attributes
  - Barcode generation and assignment
  - Purchase and vendor linkage
  - Depreciation parameters (method, useful life, salvage value)
  - Maintenance templates (interval type, frequency, responsible party)
- Data model highlights:
  - Equipment table with category, barcode, purchase info, depreciation fields
  - Maintenance schedule linked to equipment
  - Condition codes and statuses

```mermaid
flowchart TD
Start(["Create Tool"]) --> FillDetails["Fill basic details<br/>category, serial, barcode"]
FillDetails --> SetDepreciation["Set depreciation parameters"]
SetDepreciation --> AddMaintenance["Define maintenance interval"]
AddMaintenance --> Save["Save to catalog"]
Save --> End(["Tool available for allocation"])
```

**Diagram sources**
- [ToolsCatalog.tsx](file://src/pages/ToolsCatalog.tsx)
- [ToolsSettings.tsx](file://src/pages/ToolsSettings.tsx)
- [supabase-tables.sql](file://supabase-tables.sql)

**Section sources**
- [ToolsCatalog.tsx](file://src/pages/ToolsCatalog.tsx)
- [ToolsSettings.tsx](file://src/pages/ToolsSettings.tsx)
- [supabase-tables.sql](file://supabase-tables.sql)

### Utilization Tracking and History
- Purpose: Track usage events, durations, and outcomes to compute utilization rates and support audits.
- Features:
  - Checkout/checkin timestamps
  - Assigned project and user
  - Usage notes and photos
  - Aggregated utilization dashboards
- History view:
  - Chronological log of all lifecycle events
  - Filters by tool, project, user, date range

```mermaid
classDiagram
class Equipment {
+id
+name
+category
+barcode
+purchase_cost
+depreciation_method
+useful_life_months
+salvage_value
}
class UtilizationEvent {
+id
+equipment_id
+checkout_time
+checkin_time
+project_id
+user_id
+notes
}
Equipment "1" --> "many" UtilizationEvent : "has"
```

**Diagram sources**
- [ToolsHistory.tsx](file://src/pages/ToolsHistory.tsx)
- [supabase-tables.sql](file://supabase-tables.sql)

**Section sources**
- [ToolsHistory.tsx](file://src/pages/ToolsHistory.tsx)
- [supabase-tables.sql](file://supabase-tables.sql)

### Reservation Workflow and Checkout/Checkin
- Reservation:
  - Check real-time availability considering existing reservations and active checkouts
  - Reserve for a time window with reminders
- Checkout:
  - Validate reservation and conditions
  - Record checkout metadata (location, project, user)
  - Generate delivery challan if needed
- Checkin:
  - Inspect condition, update status
  - Close reservation and utilization event
  - Trigger maintenance checks if required

```mermaid
sequenceDiagram
participant Manager as "Manager"
participant Field as "Field Team"
participant UI as "ToolsManagement.tsx"
participant Hook as "useMaterials.ts"
participant DB as "Supabase Tables"
Manager->>UI : "Create reservation"
UI->>Hook : "Verify availability"
Hook->>DB : "Read reservations and stock"
DB-->>Hook : "Availability"
Hook-->>UI : "OK"
UI->>DB : "Persist reservation"
Field->>UI : "Checkout"
UI->>Hook : "Validate reservation"
Hook->>DB : "Update checkout record"
DB-->>Hook : "Success"
Hook-->>UI : "Checkout confirmed"
Field->>UI : "Checkin"
UI->>Hook : "Record checkin and condition"
Hook->>DB : "Close event and update status"
DB-->>Hook : "Done"
```

**Diagram sources**
- [ToolsManagement.tsx](file://src/pages/ToolsManagement.tsx)
- [useMaterials.ts](file://src/hooks/useMaterials.ts)
- [supabase-tables.sql](file://supabase-tables.sql)

**Section sources**
- [ToolsManagement.tsx](file://src/pages/ToolsManagement.tsx)
- [useMaterials.ts](file://src/hooks/useMaterials.ts)
- [supabase-tables.sql](file://supabase-tables.sql)

### Condition Monitoring and Maintenance Scheduling
- Condition monitoring:
  - Predefined condition states (e.g., good, fair, poor, out-of-service)
  - Optional fault tagging and repair linkage
- Maintenance scheduling:
  - Interval-based schedules (time or usage hours)
  - Automated tasks and reminders
  - Repair history integrated with condition updates

```mermaid
stateDiagram-v2
[*] --> Available
Available --> Reserved : "reservation created"
Reserved --> CheckedOut : "checkout"
CheckedOut --> UnderRepair : "condition=poor/out-of-service"
UnderRepair --> Available : "repair complete"
CheckedOut --> Available : "checkin"
Available --> OutOfService : "maintenance overdue"
OutOfService --> Available : "maintenance completed"
```

**Diagram sources**
- [ToolsManagement.tsx](file://src/pages/ToolsManagement.tsx)
- [database-add-equipment-no-fault.sql](file://src/database-add-equipment-no-fault.sql)
- [supabase-tables.sql](file://supabase-tables.sql)

**Section sources**
- [ToolsManagement.tsx](file://src/pages/ToolsManagement.tsx)
- [database-add-equipment-no-fault.sql](file://src/database-add-equipment-no-fault.sql)
- [supabase-tables.sql](file://supabase-tables.sql)

### Project Allocations and Delivery Challan
- Link tools to projects for accountability and cost tracking.
- Generate a delivery challan for physical handover, capturing tool list, quantities, and signatures.

```mermaid
flowchart TD
A["Select Project"] --> B["Allocate Tools"]
B --> C{"Need Challan?"}
C --> |Yes| D["Generate Delivery Challan"]
C --> |No| E["Direct Allocation"]
D --> F["Print/Share PDF"]
E --> G["Update Inventory"]
F --> G
```

**Diagram sources**
- [ToolsManagement.tsx](file://src/pages/ToolsManagement.tsx)
- [ClassicToolsDeliveryChallanTemplate.tsx](file://src/pages/ClassicToolsDeliveryChallanTemplate.tsx)

**Section sources**
- [ToolsManagement.tsx](file://src/pages/ToolsManagement.tsx)
- [ClassicToolsDeliveryChallanTemplate.tsx](file://src/pages/ClassicToolsDeliveryChallanTemplate.tsx)

### Automated Alerts for Overdue Returns
- Triggers:
  - Approaching due date reminders
  - Overdue return notifications
  - Maintenance due warnings
- Channels:
  - In-app notifications
  - Email/SMS (configurable)

```mermaid
flowchart TD
Start(["Scheduler Tick"]) --> Scan["Scan active checkouts"]
Scan --> NearDue{"Near due date?"}
NearDue --> |Yes| SendReminder["Send reminder"]
NearDue --> |No| CheckOverdue{"Overdue?"}
CheckOverdue --> |Yes| Escalate["Escalate alert"]
CheckOverdue --> |No| End(["No action"])
SendReminder --> End
Escalate --> End
```

[No diagram sources since this is conceptual logic]

**Section sources**
- [ToolsDashboard.tsx](file://src/pages/ToolsDashboard.tsx)
- [ToolsManagement.tsx](file://src/pages/ToolsManagement.tsx)

### Depreciation Calculations
- Methods:
  - Straight-line over useful life
  - Units-of-production based on usage hours
- Inputs:
  - Acquisition cost, salvage value, useful life, usage logs
- Outputs:
  - Book value per period
  - Accumulated depreciation reports

```mermaid
flowchart TD
A["Acquisition Cost"] --> B["Salvage Value"]
B --> C["Useful Life (months/hours)"]
C --> D["Usage Hours (period)"]
D --> E["Compute Depreciation"]
E --> F["Book Value Update"]
```

**Diagram sources**
- [ToolsSettings.tsx](file://src/pages/ToolsSettings.tsx)
- [supabase-tables.sql](file://supabase-tables.sql)

**Section sources**
- [ToolsSettings.tsx](file://src/pages/ToolsSettings.tsx)
- [supabase-tables.sql](file://supabase-tables.sql)

### Mobile Access, Barcode Scanning, and Multi-location Availability
- Mobile access:
  - Responsive UI for field teams
  - Offline-friendly forms where applicable
- Barcode scanning:
  - Camera-based scanning to auto-populate tool details
  - Bulk scan for quick checkouts/checkins
- Multi-location availability:
  - Warehouse and site-level stock views
  - Transfer requests and approvals

```mermaid
sequenceDiagram
participant Mobile as "Mobile Device"
participant UI as "ToolsManagement.tsx"
participant Hook as "useMaterials.ts"
participant WH as "useWarehouses.ts"
participant DB as "Supabase Tables"
Mobile->>UI : "Scan barcode"
UI->>Hook : "Lookup tool by barcode"
Hook->>DB : "Fetch tool details"
DB-->>Hook : "Tool record"
Hook-->>UI : "Display details"
UI->>WH : "Get availability by location"
WH->>DB : "Query stock per location"
DB-->>WH : "Location availability"
WH-->>UI : "Show nearest available"
```

**Diagram sources**
- [ToolsManagement.tsx](file://src/pages/ToolsManagement.tsx)
- [useMaterials.ts](file://src/hooks/useMaterials.ts)
- [useWarehouses.ts](file://src/hooks/useWarehouses.ts)
- [supabase-tables.sql](file://supabase-tables.sql)

**Section sources**
- [ToolsManagement.tsx](file://src/pages/ToolsManagement.tsx)
- [useMaterials.ts](file://src/hooks/useMaterials.ts)
- [useWarehouses.ts](file://src/hooks/useWarehouses.ts)
- [supabase-tables.sql](file://supabase-tables.sql)

## Dependency Analysis
- Page components depend on hooks for data operations.
- Hooks depend on Supabase tables defined in migrations.
- Settings influence behavior across pages (categories, intervals, depreciation).
- Delivery challan template depends on materials data.

```mermaid
graph LR
ToolsCatalog["ToolsCatalog.tsx"] --> useMaterials["useMaterials.ts"]
ToolsDashboard["ToolsDashboard.tsx"] --> useMaterials
ToolsHistory["ToolsHistory.tsx"] --> useMaterials
ToolsManagement["ToolsManagement.tsx"] --> useMaterials
ToolsManagement --> useWarehouses["useWarehouses.ts"]
ToolsSettings["ToolsSettings.tsx"] --> supabaseTables["supabase-tables.sql"]
ClassicDC["ClassicToolsDeliveryChallanTemplate.tsx"] --> useMaterials
supabaseTables --> addEquipFault["database-add-equipment-no-fault.sql"]
```

**Diagram sources**
- [ToolsCatalog.tsx](file://src/pages/ToolsCatalog.tsx)
- [ToolsDashboard.tsx](file://src/pages/ToolsDashboard.tsx)
- [ToolsHistory.tsx](file://src/pages/ToolsHistory.tsx)
- [ToolsManagement.tsx](file://src/pages/ToolsManagement.tsx)
- [ToolsSettings.tsx](file://src/pages/ToolsSettings.tsx)
- [ClassicToolsDeliveryChallanTemplate.tsx](file://src/pages/ClassicToolsDeliveryChallanTemplate.tsx)
- [useMaterials.ts](file://src/hooks/useMaterials.ts)
- [useWarehouses.ts](file://src/hooks/useWarehouses.ts)
- [supabase-tables.sql](file://supabase-tables.sql)
- [database-add-equipment-no-fault.sql](file://src/database-add-equipment-no-fault.sql)

**Section sources**
- [ToolsCatalog.tsx](file://src/pages/ToolsCatalog.tsx)
- [ToolsDashboard.tsx](file://src/pages/ToolsDashboard.tsx)
- [ToolsHistory.tsx](file://src/pages/ToolsHistory.tsx)
- [ToolsManagement.tsx](file://src/pages/ToolsManagement.tsx)
- [ToolsSettings.tsx](file://src/pages/ToolsSettings.tsx)
- [ClassicToolsDeliveryChallanTemplate.tsx](file://src/pages/ClassicToolsDeliveryChallanTemplate.tsx)
- [useMaterials.ts](file://src/hooks/useMaterials.ts)
- [useWarehouses.ts](file://src/hooks/useWarehouses.ts)
- [supabase-tables.sql](file://supabase-tables.sql)
- [database-add-equipment-no-fault.sql](file://src/database-add-equipment-no-fault.sql)

## Performance Considerations
- Use pagination and filtering in lists to reduce payload sizes.
- Cache frequent reads (tool details, categories) and invalidate on writes.
- Batch operations for bulk checkouts/checkins.
- Index frequently queried columns (barcode, project_id, location_id).
- Defer heavy computations (depreciation) to background jobs.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Barcode not found:
  - Verify barcode uniqueness and correct encoding
  - Ensure tool exists in catalog
- Reservation conflicts:
  - Check overlapping reservations and active checkouts
  - Adjust time windows or release conflicting reservations
- Overdue alerts not firing:
  - Confirm scheduler runs and thresholds are configured
  - Validate notification channels and user contacts
- Condition stuck in repair:
  - Review repair completion steps and status transitions
  - Reassign maintenance tasks if necessary

**Section sources**
- [ToolsManagement.tsx](file://src/pages/ToolsManagement.tsx)
- [ToolsDashboard.tsx](file://src/pages/ToolsDashboard.tsx)
- [ToolsHistory.tsx](file://src/pages/ToolsHistory.tsx)

## Conclusion
The tools and equipment management system provides end-to-end control over tool lifecycles from cataloging through utilization, maintenance, and disposition. With robust reservation and checkout/checkin workflows, condition monitoring, project integration, and multi-location visibility, it supports efficient field operations and accurate accounting. Extensibility points include additional depreciation methods, advanced analytics, and deeper ERP integrations.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Examples and Setup Guides
- Setting up equipment categories:
  - Define categories and attributes in settings
  - Assign default maintenance intervals and depreciation parameters
- Defining maintenance intervals:
  - Choose time-based or usage-based triggers
  - Configure responsible parties and escalation rules
- Tracking repair histories:
  - Log faults, actions, parts used, and outcomes
  - Link repairs to condition updates and maintenance schedules
- Barcode scanning setup:
  - Enable camera permissions
  - Map scanned values to tool identifiers
- Real-time availability across locations:
  - Configure warehouse/site mappings
  - Enable live stock sync and transfer approvals

**Section sources**
- [ToolsSettings.tsx](file://src/pages/ToolsSettings.tsx)
- [ToolsManagement.tsx](file://src/pages/ToolsManagement.tsx)
- [supabase-tables.sql](file://supabase-tables.sql)