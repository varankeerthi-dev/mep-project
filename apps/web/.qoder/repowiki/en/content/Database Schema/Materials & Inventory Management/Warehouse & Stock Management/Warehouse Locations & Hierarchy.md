# Warehouse Locations & Hierarchy

<cite>
**Referenced Files in This Document**
- [database-warehouse-purpose.sql](file://src/database-warehouse-purpose.sql)
- [useWarehouses.ts](file://src/hooks/useWarehouses.ts)
- [materials.ts](file://src/features/materials/api.ts)
- [StockTransfer.tsx](file://src/pages/StockTransfer.tsx)
- [QuickStockCheck.tsx](file://src/pages/QuickStockCheck.tsx)
- [database-inventory.sql](file://src/database-inventory.sql)
- [database-materials.sql](file://src/database-materials.sql)
- [database-setup.sql](file://src/database-setup.sql)
- [database-indexes.sql](file://database-indexes.sql)
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
This document describes the data model and implementation for warehouse location management, including:
- Warehouse entity structure with hierarchical locations (parent-child relationships)
- Geographic information fields
- Capacity management at warehouse, zone, and bin levels
- Storage zones and bin-level organization
- Purpose classification (raw materials, finished goods, work-in-progress)
- Access control mechanisms
- Database schema, foreign keys, and indexing strategies
- Multi-tenant scenarios and organization-specific configurations

The goal is to provide a clear, code-sourced reference for developers and domain users working with warehouses and inventory operations.

## Project Structure
Warehouse-related functionality spans database migrations/schema files, API hooks, and UI pages that consume warehouse data. The key areas are:
- Data definitions and constraints in SQL migration files
- Frontend hooks and APIs for warehouse queries and mutations
- Pages that perform stock transfers and quick checks using warehouse hierarchies

```mermaid
graph TB
subgraph "Data Layer"
A["database-setup.sql"]
B["database-inventory.sql"]
C["database-materials.sql"]
D["database-warehouse-purpose.sql"]
E["database-indexes.sql"]
end
subgraph "Frontend Hooks & APIs"
F["useWarehouses.ts"]
G["features/materials/api.ts"]
end
subgraph "UI Pages"
H["pages/StockTransfer.tsx"]
I["pages/QuickStockCheck.tsx"]
end
A --> B
A --> C
D --> B
E --> B
E --> C
F --> H
F --> I
G --> H
G --> I
```

**Diagram sources**
- [database-setup.sql](file://src/database-setup.sql)
- [database-inventory.sql](file://src/database-inventory.sql)
- [database-materials.sql](file://src/database-materials.sql)
- [database-warehouse-purpose.sql](file://src/database-warehouse-purpose.sql)
- [database-indexes.sql](file://database-indexes.sql)
- [useWarehouses.ts](file://src/hooks/useWarehouses.ts)
- [materials.ts](file://src/features/materials/api.ts)
- [StockTransfer.tsx](file://src/pages/StockTransfer.tsx)
- [QuickStockCheck.tsx](file://src/pages/QuickStockCheck.tsx)

**Section sources**
- [database-setup.sql](file://src/database-setup.sql)
- [database-inventory.sql](file://src/database-inventory.sql)
- [database-materials.sql](file://src/database-materials.sql)
- [database-warehouse-purpose.sql](file://src/database-warehouse-purpose.sql)
- [database-indexes.sql](file://database-indexes.sql)
- [useWarehouses.ts](file://src/hooks/useWarehouses.ts)
- [materials.ts](file://src/features/materials/api.ts)
- [StockTransfer.tsx](file://src/pages/StockTransfer.tsx)
- [QuickStockCheck.tsx](file://src/pages/QuickStockCheck.tsx)

## Core Components
- Warehouse entity and hierarchy
  - Supports parent-child relationships to model building → floor → aisle → rack → bin structures
  - Includes geographic fields such as address, city, state, country, postal code, latitude, longitude
- Purpose classification
  - Enumerated purpose values include raw materials, finished goods, work-in-progress
  - Enforced via dedicated purpose table or column constraints
- Capacity management
  - Warehouse-level capacity limits
  - Zone-level capacity and utilization tracking
  - Bin-level capacity and occupancy
- Storage zones and bins
  - Zones partition warehouses by function or product type
  - Bins represent the smallest storage unit within zones
- Access control
  - Row-level security policies scoped by organization
  - Role-based access to create, read, update, delete warehouses and related entities
- Multi-tenancy
  - Organization-scoped records ensure isolation across tenants
  - Organization-specific configuration flags per warehouse

**Section sources**
- [database-warehouse-purpose.sql](file://src/database-warehouse-purpose.sql)
- [database-inventory.sql](file://src/database-inventory.sql)
- [database-materials.sql](file://src/database-materials.sql)
- [database-setup.sql](file://src/database-setup.sql)
- [useWarehouses.ts](file://src/hooks/useWarehouses.ts)
- [StockTransfer.tsx](file://src/pages/StockTransfer.tsx)
- [QuickStockCheck.tsx](file://src/pages/QuickStockCheck.tsx)

## Architecture Overview
The warehouse data model integrates with inventory and materials modules. UI pages use hooks and APIs to query hierarchical warehouses and execute stock movements.

```mermaid
sequenceDiagram
participant UI as "StockTransfer Page"
participant Hook as "useWarehouses.ts"
participant API as "features/materials/api.ts"
participant DB as "Database Tables"
UI->>Hook : "Load warehouse hierarchy"
Hook->>API : "Fetch warehouses with parent-child"
API->>DB : "Query warehouses, zones, bins"
DB-->>API : "Hierarchical results"
API-->>Hook : "Normalized tree"
Hook-->>UI : "Tree for selection"
UI->>Hook : "Perform stock transfer"
Hook->>API : "Submit transfer payload"
API->>DB : "Insert/update stock entries"
DB-->>API : "Success/failure"
API-->>Hook : "Result"
Hook-->>UI : "Update UI state"
```

**Diagram sources**
- [useWarehouses.ts](file://src/hooks/useWarehouses.ts)
- [materials.ts](file://src/features/materials/api.ts)
- [StockTransfer.tsx](file://src/pages/StockTransfer.tsx)
- [database-inventory.sql](file://src/database-inventory.sql)
- [database-materials.sql](file://src/database-materials.sql)

## Detailed Component Analysis

### Warehouse Entity and Hierarchy
- Parent-child relationships enable deep nesting (e.g., site → building → floor → aisle → rack → bin)
- Each node can carry metadata like name, code, description, active flag, and sort order
- Geographic attributes support mapping and logistics planning

```mermaid
classDiagram
class Warehouse {
+id
+name
+code
+description
+address
+city
+state
+country
+postal_code
+latitude
+longitude
+purpose
+is_active
+organization_id
+parent_id
}
class Zone {
+id
+name
+code
+description
+capacity
+warehouse_id
+organization_id
}
class Bin {
+id
+name
+code
+description
+capacity
+zone_id
+organization_id
}
Warehouse "1" o-- "many" Zone : "contains"
Zone "1" o-- "many" Bin : "contains"
Warehouse --> Warehouse : "parent_id"
```

**Diagram sources**
- [database-inventory.sql](file://src/database-inventory.sql)
- [database-materials.sql](file://src/database-materials.sql)

**Section sources**
- [database-inventory.sql](file://src/database-inventory.sql)
- [database-materials.sql](file://src/database-materials.sql)

### Purpose Classification
- Purpose values categorize warehouses into functional types
- Enforced through a dedicated purpose definition or constrained column
- Used to filter and route inventory flows appropriately

```mermaid
flowchart TD
Start(["Create/Update Warehouse"]) --> CheckPurpose["Validate Purpose Value"]
CheckPurpose --> Valid{"Valid Purpose?"}
Valid --> |No| Error["Reject with validation error"]
Valid --> |Yes| Persist["Persist Warehouse Record"]
Persist --> End(["Done"])
```

**Diagram sources**
- [database-warehouse-purpose.sql](file://src/database-warehouse-purpose.sql)

**Section sources**
- [database-warehouse-purpose.sql](file://src/database-warehouse-purpose.sql)

### Capacity Management
- Warehouse-level capacity sets an upper bound on total stored items
- Zone-level capacity partitions capacity by area/function
- Bin-level capacity enforces granular limits and prevents overstocking
- Utilization metrics can be computed from current stock vs. capacities

```mermaid
flowchart TD
Entry(["Stock Inbound"]) --> ResolveBin["Resolve Target Bin"]
ResolveBin --> CheckBinCap["Check Bin Capacity"]
CheckBinCap --> BinOK{"Bin Has Capacity?"}
BinOK --> |No| EscalateZone["Escalate to Zone/Bin Selection"]
EscalateZone --> ResolveBin
BinOK --> CheckZoneCap["Check Zone Capacity"]
CheckZoneCap --> ZoneOK{"Zone Has Capacity?"}
ZoneOK --> |No| EscalateWH["Escalate to Warehouse Selection"]
EscalateWH --> ResolveBin
ZoneOK --> CheckWHCap["Check Warehouse Capacity"]
CheckWHCap --> WHOK{"Warehouse Has Capacity?"}
WHOK --> |No| Reject["Reject Stock Inbound"]
WHOK --> Commit["Commit Stock Entry"]
Commit --> Exit(["Done"])
```

**Diagram sources**
- [database-inventory.sql](file://src/database-inventory.sql)
- [database-materials.sql](file://src/database-materials.sql)

**Section sources**
- [database-inventory.sql](file://src/database-inventory.sql)
- [database-materials.sql](file://src/database-materials.sql)

### Access Control and Multi-Tenancy
- Organization scoping ensures each tenant’s warehouses are isolated
- Row-level security policies restrict access based on user’s organization context
- Role-based permissions govern CRUD operations on warehouses, zones, and bins

```mermaid
sequenceDiagram
participant Client as "Client App"
participant RLS as "Row-Level Security"
participant Org as "Organization Context"
participant DB as "Warehouse Tables"
Client->>RLS : "Request warehouses"
RLS->>Org : "Resolve current organization"
Org-->>RLS : "organization_id"
RLS->>DB : "Filter by organization_id"
DB-->>RLS : "Scoped results"
RLS-->>Client : "Authorized data"
```

**Diagram sources**
- [database-setup.sql](file://src/database-setup.sql)
- [database-inventory.sql](file://src/database-inventory.sql)
- [database-materials.sql](file://src/database-materials.sql)

**Section sources**
- [database-setup.sql](file://src/database-setup.sql)
- [database-inventory.sql](file://src/database-inventory.sql)
- [database-materials.sql](file://src/database-materials.sql)

### UI Integration and Workflows
- useWarehouses hook provides hierarchical warehouse trees for selection
- Stock transfer page orchestrates source-to-destination movement using selected bins/zones
- Quick stock check leverages warehouse hierarchy to aggregate stock levels

```mermaid
sequenceDiagram
participant UI as "QuickStockCheck Page"
participant Hook as "useWarehouses.ts"
participant API as "features/materials/api.ts"
participant DB as "Inventory Tables"
UI->>Hook : "Select warehouse hierarchy"
Hook->>API : "Fetch stock by warehouse/zone/bin"
API->>DB : "Aggregate stock levels"
DB-->>API : "Aggregated counts"
API-->>Hook : "Results"
Hook-->>UI : "Display stock overview"
```

**Diagram sources**
- [useWarehouses.ts](file://src/hooks/useWarehouses.ts)
- [materials.ts](file://src/features/materials/api.ts)
- [QuickStockCheck.tsx](file://src/pages/QuickStockCheck.tsx)
- [database-inventory.sql](file://src/database-inventory.sql)

**Section sources**
- [useWarehouses.ts](file://src/hooks/useWarehouses.ts)
- [materials.ts](file://src/features/materials/api.ts)
- [QuickStockCheck.tsx](file://src/pages/QuickStockCheck.tsx)
- [database-inventory.sql](file://src/database-inventory.sql)

## Dependency Analysis
- Database dependencies
  - Inventory tables depend on materials definitions and warehouse hierarchy
  - Purpose classification constrains valid warehouse types
- Frontend dependencies
  - Hooks depend on API endpoints for warehouse and stock data
  - Pages depend on hooks for rendering and actions

```mermaid
graph TB
subgraph "Schema"
W["warehouses"]
Z["zones"]
B["bins"]
S["stock_entries"]
M["materials"]
end
subgraph "Frontend"
UH["useWarehouses.ts"]
MA["features/materials/api.ts"]
ST["StockTransfer.tsx"]
QSC["QuickStockCheck.tsx"]
end
W --> Z
Z --> B
S --> W
S --> Z
S --> B
S --> M
UH --> ST
UH --> QSC
MA --> ST
MA --> QSC
```

**Diagram sources**
- [database-inventory.sql](file://src/database-inventory.sql)
- [database-materials.sql](file://src/database-materials.sql)
- [useWarehouses.ts](file://src/hooks/useWarehouses.ts)
- [materials.ts](file://src/features/materials/api.ts)
- [StockTransfer.tsx](file://src/pages/StockTransfer.tsx)
- [QuickStockCheck.tsx](file://src/pages/QuickStockCheck.tsx)

**Section sources**
- [database-inventory.sql](file://src/database-inventory.sql)
- [database-materials.sql](file://src/database-materials.sql)
- [useWarehouses.ts](file://src/hooks/useWarehouses.ts)
- [materials.ts](file://src/features/materials/api.ts)
- [StockTransfer.tsx](file://src/pages/StockTransfer.tsx)
- [QuickStockCheck.tsx](file://src/pages/QuickStockCheck.tsx)

## Performance Considerations
- Indexing strategy
  - Primary keys on all core tables
  - Foreign key indexes on warehouse_id, zone_id, bin_id, material_id
  - Composite indexes for frequent queries (e.g., organization_id + warehouse_id)
  - Spatial indexes if geospatial queries are used
- Query optimization
  - Use hierarchical CTEs for efficient tree traversal
  - Aggregate stock levels with precomputed summaries where appropriate
- Concurrency
  - Apply optimistic locking or row versioning for stock updates
  - Use transactions for multi-step stock movements to maintain consistency

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Common issues
  - Missing organization_id leads to cross-tenant data leakage; verify RLS policies
  - Invalid purpose values cause constraint violations; validate against purpose definitions
  - Capacity exceeded errors indicate incorrect bin/zone selection logic
- Debugging steps
  - Inspect warehouse hierarchy resolution in the hook layer
  - Validate API payloads before submission
  - Review database logs for constraint failures and RLS denials

**Section sources**
- [database-setup.sql](file://src/database-setup.sql)
- [database-warehouse-purpose.sql](file://src/database-warehouse-purpose.sql)
- [database-inventory.sql](file://src/database-inventory.sql)
- [useWarehouses.ts](file://src/hooks/useWarehouses.ts)
- [materials.ts](file://src/features/materials/api.ts)

## Conclusion
The warehouse location management system models a robust hierarchy with purpose classification, capacity controls, and strong multi-tenant isolation. The integration between database schemas, frontend hooks, and UI pages enables efficient stock operations while maintaining data integrity and performance. Proper indexing and RLS policies ensure scalability and security across organizations.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Database Schema Summary
- Core tables
  - Warehouses: id, name, code, description, address, city, state, country, postal_code, latitude, longitude, purpose, is_active, organization_id, parent_id
  - Zones: id, name, code, description, capacity, warehouse_id, organization_id
  - Bins: id, name, code, description, capacity, zone_id, organization_id
  - Stock entries: id, material_id, warehouse_id, zone_id, bin_id, quantity, organization_id, timestamps
- Foreign key relationships
  - Zones.warehouse_id → Warehouses.id
  - Bins.zone_id → Zones.id
  - Stock entries.warehouse_id → Warehouses.id
  - Stock entries.zone_id → Zones.id
  - Stock entries.bin_id → Bins.id
  - Stock entries.material_id → Materials.id
- Indexing strategies
  - PK indexes on all tables
  - FK indexes on warehouse_id, zone_id, bin_id, material_id
  - Composite indexes on organization_id + warehouse_id, organization_id + zone_id, organization_id + bin_id
  - Additional indexes for frequent filters (e.g., purpose, is_active)

**Section sources**
- [database-inventory.sql](file://src/database-inventory.sql)
- [database-materials.sql](file://src/database-materials.sql)
- [database-indexes.sql](file://database-indexes.sql)