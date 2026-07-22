# Reports & Analytics API

<cite>
**Referenced Files in This Document**
- [src/pages/reports/Reports.tsx](file://src/pages/reports/Reports.tsx)
- [src/components/reports/index.tsx](file://src/components/reports/index.tsx)
- [src/hooks/usePerformanceMonitor.ts](file://src/hooks/usePerformanceMonitor.ts)
- [src/hooks/useVirtualizedTable.ts](file://src/hooks/useVirtualizedTable.ts)
- [src/lib/table-schema.ts](file://src/lib/table-schema.ts)
- [src/utils/export-utils.ts](file://src/utils/export-utils.ts)
- [src/api/approvals/process-action.ts](file://src/api/approvals/process-action.ts)
- [src/app/routing/registry.ts](file://src/app/routing/registry.ts)
- [src/config/queryClient.ts](file://src/config/queryClient.ts)
- [database/database-reports-schema.sql](file://database/database-reports-schema.sql)
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
This document provides comprehensive API documentation for reporting and analytics endpoints within the application. It covers pre-built report generation, custom query execution, dashboard data aggregation, export capabilities (PDF, Excel, CSV), scheduled report delivery, and real-time analytics streaming. It also details performance optimization techniques for large dataset queries, caching strategies, and result pagination, along with examples for common business reports and custom analytics implementations.

## Project Structure
The reporting and analytics features are implemented across UI pages, reusable components, hooks, utilities, and database schema definitions:
- Pages: Top-level report entry points and dashboards
- Components: Reusable report widgets and table integrations
- Hooks: Performance monitoring and virtualization for large datasets
- Utilities: Export helpers and table schema definitions
- Database: Report-related schema definitions and indexes

```mermaid
graph TB
subgraph "UI Layer"
ReportsPage["Reports Page<br/>src/pages/reports/Reports.tsx"]
ReportsComponents["Report Components<br/>src/components/reports/index.tsx"]
end
subgraph "Data & Logic"
QueryClient["Query Client Config<br/>src/config/queryClient.ts"]
TableSchema["Table Schema Utils<br/>src/lib/table-schema.ts"]
ExportUtils["Export Utilities<br/>src/utils/export-utils.ts"]
VirtualizedTable["Virtualized Table Hook<br/>src/hooks/useVirtualizedTable.ts"]
PerfMonitor["Performance Monitor Hook<br/>src/hooks/usePerformanceMonitor.ts"]
end
subgraph "Routing & API"
RoutingRegistry["App Routing Registry<br/>src/app/routing/registry.ts"]
ApprovalsAPI["Approvals Action API<br/>src/api/approvals/process-action.ts"]
end
subgraph "Database"
ReportsDB["Reports Schema<br/>database/database-reports-schema.sql"]
end
ReportsPage --> ReportsComponents
ReportsComponents --> TableSchema
ReportsComponents --> ExportUtils
ReportsComponents --> VirtualizedTable
ReportsComponents --> PerfMonitor
ReportsPage --> RoutingRegistry
ReportsPage --> QueryClient
QueryClient --> ReportsDB
ReportsPage --> ApprovalsAPI
```

**Diagram sources**
- [src/pages/reports/Reports.tsx](file://src/pages/reports/Reports.tsx)
- [src/components/reports/index.tsx](file://src/components/reports/index.tsx)
- [src/config/queryClient.ts](file://src/config/queryClient.ts)
- [src/lib/table-schema.ts](file://src/lib/table-schema.ts)
- [src/utils/export-utils.ts](file://src/utils/export-utils.ts)
- [src/hooks/useVirtualizedTable.ts](file://src/hooks/useVirtualizedTable.ts)
- [src/hooks/usePerformanceMonitor.ts](file://src/hooks/usePerformanceMonitor.ts)
- [src/app/routing/registry.ts](file://src/app/routing/registry.ts)
- [src/api/approvals/process-action.ts](file://src/api/approvals/process-action.ts)
- [database/database-reports-schema.sql](file://database/database-reports-schema.sql)

**Section sources**
- [src/pages/reports/Reports.tsx](file://src/pages/reports/Reports.tsx)
- [src/components/reports/index.tsx](file://src/components/reports/index.tsx)
- [src/config/queryClient.ts](file://src/config/queryClient.ts)
- [src/lib/table-schema.ts](file://src/lib/table-schema.ts)
- [src/utils/export-utils.ts](file://src/utils/export-utils.ts)
- [src/hooks/useVirtualizedTable.ts](file://src/hooks/useVirtualizedTable.ts)
- [src/hooks/usePerformanceMonitor.ts](file://src/hooks/usePerformanceMonitor.ts)
- [src/app/routing/registry.ts](file://src/app/routing/registry.ts)
- [src/api/approvals/process-action.ts](file://src/api/approvals/process-action.ts)
- [database/database-reports-schema.sql](file://database/database-reports-schema.sql)

## Core Components
- Pre-built Report Generation
  - Entry point page orchestrates report selection, filters, and rendering.
  - Uses shared components to render tabular and chart-based outputs.
- Custom Query Execution
  - Leverages a typed table schema utility to build parameterized queries safely.
  - Integrates with the global query client for caching and background fetching.
- Dashboard Data Aggregation
  - Aggregates metrics via server-side SQL and returns summarized payloads.
  - Supports time-windowed aggregations and dimension grouping.
- Export Capabilities
  - Exports to PDF, Excel, and CSV using dedicated utilities.
  - Handles large datasets by streaming or chunking where applicable.
- Scheduled Report Delivery
  - Triggers asynchronous jobs through an action API endpoint.
  - Returns job IDs for status polling and completion notifications.
- Real-time Analytics Streaming
  - Utilizes long-lived connections or periodic polling to stream updates.
  - Integrates with performance monitoring to throttle and debounce updates.

**Section sources**
- [src/pages/reports/Reports.tsx](file://src/pages/reports/Reports.tsx)
- [src/components/reports/index.tsx](file://src/components/reports/index.tsx)
- [src/lib/table-schema.ts](file://src/lib/table-schema.ts)
- [src/utils/export-utils.ts](file://src/utils/export-utils.ts)
- [src/api/approvals/process-action.ts](file://src/api/approvals/process-action.ts)
- [src/hooks/usePerformanceMonitor.ts](file://src/hooks/usePerformanceMonitor.ts)

## Architecture Overview
The reporting architecture separates concerns between UI orchestration, data access, and export/scheduling services. The query client centralizes caching and request lifecycle management. Database schemas define report tables and indexes to optimize analytical queries.

```mermaid
sequenceDiagram
participant User as "User"
participant Page as "Reports Page"
participant Components as "Report Components"
participant QueryClient as "Query Client"
participant DB as "Database"
participant Exporter as "Export Utilities"
participant Scheduler as "Action API"
User->>Page : Open Reports
Page->>Components : Render selected report
Components->>QueryClient : Fetch aggregated data
QueryClient->>DB : Execute optimized query
DB-->>QueryClient : Return results
QueryClient-->>Components : Cached payload
Components->>Exporter : Generate PDF/Excel/CSV
Exporter-->>Components : File blob
User->>Scheduler : Schedule report delivery
Scheduler-->>User : Job ID + status URL
Note over Components,DB : Real-time updates via polling/streaming
```

**Diagram sources**
- [src/pages/reports/Reports.tsx](file://src/pages/reports/Reports.tsx)
- [src/components/reports/index.tsx](file://src/components/reports/index.tsx)
- [src/config/queryClient.ts](file://src/config/queryClient.ts)
- [src/utils/export-utils.ts](file://src/utils/export-utils.ts)
- [src/api/approvals/process-action.ts](file://src/api/approvals/process-action.ts)
- [database/database-reports-schema.sql](file://database/database-reports-schema.sql)

## Detailed Component Analysis

### Reports Page Orchestration
- Responsibilities
  - Route registration and navigation to report views
  - Parameter validation and filter state management
  - Triggering exports and scheduling jobs
- Integration Points
  - App routing registry for consistent navigation
  - Query client for data fetching and caching
  - Export utilities for file generation
  - Action API for scheduling

```mermaid
flowchart TD
Start(["Open Reports"]) --> ValidateFilters["Validate Filters"]
ValidateFilters --> BuildQuery["Build Typed Query"]
BuildQuery --> FetchData["Fetch via Query Client"]
FetchData --> CacheCheck{"Cache Hit?"}
CacheCheck --> |Yes| UseCached["Use Cached Data"]
CacheCheck --> |No| ServerFetch["Server Query"]
ServerFetch --> UpdateCache["Update Cache"]
UseCached --> RenderReport["Render Report"]
UpdateCache --> RenderReport
RenderReport --> ExportOptions{"Export Requested?"}
ExportOptions --> |Yes| GenerateFile["Generate PDF/Excel/CSV"]
ExportOptions --> |No| ScheduleDelivery{"Schedule Delivery?"}
ScheduleDelivery --> |Yes| SubmitJob["Submit Job via Action API"]
ScheduleDelivery --> |No| End(["Done"])
GenerateFile --> End
SubmitJob --> End
```

**Diagram sources**
- [src/pages/reports/Reports.tsx](file://src/pages/reports/Reports.tsx)
- [src/app/routing/registry.ts](file://src/app/routing/registry.ts)
- [src/config/queryClient.ts](file://src/config/queryClient.ts)
- [src/utils/export-utils.ts](file://src/utils/export-utils.ts)
- [src/api/approvals/process-action.ts](file://src/api/approvals/process-action.ts)

**Section sources**
- [src/pages/reports/Reports.tsx](file://src/pages/reports/Reports.tsx)
- [src/app/routing/registry.ts](file://src/app/routing/registry.ts)
- [src/config/queryClient.ts](file://src/config/queryClient.ts)
- [src/utils/export-utils.ts](file://src/utils/export-utils.ts)
- [src/api/approvals/process-action.ts](file://src/api/approvals/process-action.ts)

### Report Components and Table Rendering
- Responsibilities
  - Render tabular data with sorting, filtering, and pagination
  - Integrate virtualization for large datasets
  - Provide drill-down actions and export triggers
- Key Integrations
  - Table schema utilities for column definitions and types
  - Virtualized table hook for efficient rendering
  - Performance monitor hook to track render times

```mermaid
classDiagram
class ReportTable {
+columns : ColumnDef[]
+data : any[]
+pagination : PaginationState
+sorting : SortingState
+filtering : FilteringState
+render() void
+export(format) void
}
class TableSchemaUtil {
+defineColumns(schema) ColumnDef[]
+validateRow(row) boolean
}
class VirtualizedTableHook {
+useVirtualizedTable(options) VirtualizedTableProps
}
class PerformanceMonitorHook {
+trackMetric(name, value) void
+getMetrics() MetricsMap
}
ReportTable --> TableSchemaUtil : "uses"
ReportTable --> VirtualizedTableHook : "uses"
ReportTable --> PerformanceMonitorHook : "uses"
```

**Diagram sources**
- [src/components/reports/index.tsx](file://src/components/reports/index.tsx)
- [src/lib/table-schema.ts](file://src/lib/table-schema.ts)
- [src/hooks/useVirtualizedTable.ts](file://src/hooks/useVirtualizedTable.ts)
- [src/hooks/usePerformanceMonitor.ts](file://src/hooks/usePerformanceMonitor.ts)

**Section sources**
- [src/components/reports/index.tsx](file://src/components/reports/index.tsx)
- [src/lib/table-schema.ts](file://src/lib/table-schema.ts)
- [src/hooks/useVirtualizedTable.ts](file://src/hooks/useVirtualizedTable.ts)
- [src/hooks/usePerformanceMonitor.ts](file://src/hooks/usePerformanceMonitor.ts)

### Export Utilities
- Supported Formats
  - PDF: Vector graphics and layout preservation
  - Excel: Spreadsheet formatting and formulas
  - CSV: Lightweight tabular data
- Large Dataset Handling
  - Chunked processing to avoid memory spikes
  - Streaming responses where supported
- Error Handling
  - Graceful fallbacks on unsupported features
  - Detailed error messages for debugging

```mermaid
flowchart TD
Start(["Export Request"]) --> SelectFormat["Select Format (PDF/Excel/CSV)"]
SelectFormat --> PrepareData["Prepare Data Payload"]
PrepareData --> CheckSize{"Large Dataset?"}
CheckSize --> |Yes| ChunkProcess["Chunk Processing"]
CheckSize --> |No| DirectProcess["Direct Processing"]
ChunkProcess --> GenerateFile["Generate File Blob"]
DirectProcess --> GenerateFile
GenerateFile --> Download["Trigger Download"]
Download --> End(["Done"])
```

**Diagram sources**
- [src/utils/export-utils.ts](file://src/utils/export-utils.ts)

**Section sources**
- [src/utils/export-utils.ts](file://src/utils/export-utils.ts)

### Scheduling and Delivery
- Workflow
  - User initiates schedule from report view
  - Action API creates a job record and returns a job ID
  - Status polling retrieves progress and completion artifacts
- Reliability
  - Idempotent job creation
  - Retry policies for transient failures
  - Audit logging for compliance

```mermaid
sequenceDiagram
participant User as "User"
participant Page as "Reports Page"
participant Scheduler as "Action API"
participant Queue as "Job Queue"
participant Worker as "Worker Process"
participant Storage as "Artifact Storage"
User->>Page : Click "Schedule Report"
Page->>Scheduler : POST /api/report/schedule
Scheduler->>Queue : Enqueue job
Scheduler-->>Page : {jobId, statusUrl}
Page->>Scheduler : GET /api/report/status/{jobId}
Scheduler->>Queue : Poll job status
Queue-->>Scheduler : InProgress/Completed
Scheduler-->>Page : Status update
alt Completed
Scheduler->>Storage : Upload artifact
Scheduler-->>Page : Artifact URL
else Failed
Scheduler-->>Page : Error details
end
```

**Diagram sources**
- [src/api/approvals/process-action.ts](file://src/api/approvals/process-action.ts)

**Section sources**
- [src/api/approvals/process-action.ts](file://src/api/approvals/process-action.ts)

### Real-time Analytics Streaming
- Mechanisms
  - Periodic polling with exponential backoff
  - Long-lived connections where available
- Throttling
  - Debounced updates to prevent UI thrashing
  - Performance monitoring to adapt refresh rates

```mermaid
flowchart TD
Start(["Start Stream"]) --> InitConnection["Init Connection/Poller"]
InitConnection --> FetchSnapshot["Fetch Initial Snapshot"]
FetchSnapshot --> RenderInitial["Render Initial Data"]
RenderInitial --> SetInterval["Set Interval"]
SetInterval --> FetchDelta["Fetch Delta"]
FetchDelta --> MergeData["Merge with Local State"]
MergeData --> UpdateUI["Update UI"]
UpdateUI --> MonitorPerf["Monitor Performance"]
MonitorPerf --> AdjustRate{"Adjust Rate?"}
AdjustRate --> |Yes| Backoff["Increase Interval"]
AdjustRate --> |No| Continue["Continue"]
Backoff --> SetInterval
Continue --> SetInterval
```

**Diagram sources**
- [src/hooks/usePerformanceMonitor.ts](file://src/hooks/usePerformanceMonitor.ts)

**Section sources**
- [src/hooks/usePerformanceMonitor.ts](file://src/hooks/usePerformanceMonitor.ts)

## Dependency Analysis
The reporting subsystem depends on routing, query client configuration, table schema utilities, export utilities, and database schema definitions. The following diagram illustrates key dependencies:

```mermaid
graph TB
ReportsPage["Reports Page"] --> RoutingRegistry["Routing Registry"]
ReportsPage --> QueryClient["Query Client"]
ReportsPage --> ExportUtils["Export Utilities"]
ReportsPage --> ActionAPI["Action API"]
ReportComponents["Report Components"] --> TableSchema["Table Schema"]
ReportComponents --> VirtualizedTable["Virtualized Table Hook"]
ReportComponents --> PerfMonitor["Performance Monitor Hook"]
QueryClient --> ReportsDB["Reports DB Schema"]
```

**Diagram sources**
- [src/pages/reports/Reports.tsx](file://src/pages/reports/Reports.tsx)
- [src/app/routing/registry.ts](file://src/app/routing/registry.ts)
- [src/config/queryClient.ts](file://src/config/queryClient.ts)
- [src/utils/export-utils.ts](file://src/utils/export-utils.ts)
- [src/api/approvals/process-action.ts](file://src/api/approvals/process-action.ts)
- [src/components/reports/index.tsx](file://src/components/reports/index.tsx)
- [src/lib/table-schema.ts](file://src/lib/table-schema.ts)
- [src/hooks/useVirtualizedTable.ts](file://src/hooks/useVirtualizedTable.ts)
- [src/hooks/usePerformanceMonitor.ts](file://src/hooks/usePerformanceMonitor.ts)
- [database/database-reports-schema.sql](file://database/database-reports-schema.sql)

**Section sources**
- [src/pages/reports/Reports.tsx](file://src/pages/reports/Reports.tsx)
- [src/app/routing/registry.ts](file://src/app/routing/registry.ts)
- [src/config/queryClient.ts](file://src/config/queryClient.ts)
- [src/utils/export-utils.ts](file://src/utils/export-utils.ts)
- [src/api/approvals/process-action.ts](file://src/api/approvals/process-action.ts)
- [src/components/reports/index.tsx](file://src/components/reports/index.tsx)
- [src/lib/table-schema.ts](file://src/lib/table-schema.ts)
- [src/hooks/useVirtualizedTable.ts](file://src/hooks/useVirtualizedTable.ts)
- [src/hooks/usePerformanceMonitor.ts](file://src/hooks/usePerformanceMonitor.ts)
- [database/database-reports-schema.sql](file://database/database-reports-schema.sql)

## Performance Considerations
- Query Optimization
  - Use indexed columns for filters and joins
  - Aggregate at the database layer to reduce payload size
  - Apply window functions for time-series metrics
- Caching Strategies
  - Configure query client cache keys based on report parameters
  - Implement stale-while-revalidate patterns for dashboards
  - Invalidate caches on data mutations
- Result Pagination
  - Server-side pagination with cursor or offset strategies
  - Combine with virtualization for smooth scrolling
- Memory Management
  - Stream large exports in chunks
  - Avoid holding entire datasets in client memory
- Monitoring
  - Track render times and network latency
  - Auto-adjust polling intervals based on performance metrics

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Common Issues
  - Slow report loads: Verify database indexes and query plans
  - Export failures: Check format support and memory limits
  - Stale data: Ensure cache invalidation on writes
  - High CPU usage: Reduce polling frequency and enable virtualization
- Debugging Steps
  - Inspect query client logs for failed requests
  - Review performance monitor metrics for bottlenecks
  - Validate table schema definitions against actual data
- Recovery Actions
  - Retry failed exports with smaller chunks
  - Reset cache for affected report keys
  - Rebuild indexes if fragmentation is detected

**Section sources**
- [src/hooks/usePerformanceMonitor.ts](file://src/hooks/usePerformanceMonitor.ts)
- [src/config/queryClient.ts](file://src/config/queryClient.ts)
- [src/lib/table-schema.ts](file://src/lib/table-schema.ts)

## Conclusion
The reporting and analytics subsystem provides robust capabilities for generating pre-built reports, executing custom queries, aggregating dashboard data, exporting to multiple formats, scheduling deliveries, and streaming real-time insights. By leveraging optimized queries, effective caching, pagination, and virtualization, the system maintains responsiveness even with large datasets. Continuous monitoring and structured troubleshooting ensure reliability and performance.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Example: Sales Summary Report
- Inputs
  - Date range, region, product category
- Processing
  - Aggregated sales totals and margins
  - Grouped by region and category
- Outputs
  - Tabular summary with drill-down
  - Export to PDF and Excel
- References
  - [src/pages/reports/Reports.tsx](file://src/pages/reports/Reports.tsx)
  - [src/components/reports/index.tsx](file://src/components/reports/index.tsx)
  - [src/utils/export-utils.ts](file://src/utils/export-utils.ts)

### Example: Inventory Turnover Analytics
- Inputs
  - Warehouse, SKU, time window
- Processing
  - Turnover ratio calculation
  - Trend analysis with moving averages
- Outputs
  - Charts and KPI cards
  - CSV export for further analysis
- References
  - [src/components/reports/index.tsx](file://src/components/reports/index.tsx)
  - [src/hooks/useVirtualizedTable.ts](file://src/hooks/useVirtualizedTable.ts)
  - [src/hooks/usePerformanceMonitor.ts](file://src/hooks/usePerformanceMonitor.ts)

### Example: Custom Query Builder
- Inputs
  - Selected tables, join conditions, filters
- Processing
  - Builds typed query using table schema utilities
  - Executes via query client with caching
- Outputs
  - Paginated results with export options
- References
  - [src/lib/table-schema.ts](file://src/lib/table-schema.ts)
- [src/config/queryClient.ts](file://src/config/queryClient.ts)