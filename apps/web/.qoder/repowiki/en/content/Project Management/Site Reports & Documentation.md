# Site Reports & Documentation

<cite>
**Referenced Files in This Document**
- [SiteReport.tsx](file://src/pages/SiteReport.tsx)
- [SiteReportPhotoUploader.tsx](file://src/components/SiteReportPhotoUploader.tsx)
- [useSiteReportPhotos.ts](file://src/hooks/useSiteReportPhotos.ts)
- [useStoppages.ts](file://src/hooks/useStoppages.ts)
- [database-site-reports.sql](file://src/database-site-reports.sql)
- [database-site-report-photos.sql](file://src/database-site-report-photos.sql)
- [database-site-report-stoppages.sql](file://src/database-site-report-stoppages.sql)
- [database-site-report-approval.sql](file://src/database-site-report-approval.sql)
- [siteReportApproval.ts](file://src/approvals/siteReportApproval.ts)
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)
- [database-item-audit.sql](file://src/database-item-audit.sql)
- [usePerformanceMonitor.ts](file://src/hooks/usePerformanceMonitor.ts)
- [api/parse-document.ts](file://api/parse-document.ts)
- [lib/meeting-pdf-generator.ts](file://src/lib/meeting-pdf-generator.ts)
- [hooks/use-whatsapp-share.ts](file://src/hooks/use-whatsapp-share.ts)
- [pages/reports/index.tsx](file://src/pages/reports/index.tsx)
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
This document explains the Site Reports and Documentation system, focusing on daily site reporting workflows, photo documentation, progress tracking, stoppage reporting, incident logging, safety compliance tracking, template customization, automated notifications, compliance documents, offline data collection, mobile usage, synchronization, stakeholder communication, sharing, audit trails, quality assurance integration, inspection checklists, regulatory compliance, analytics, trend analysis, and performance metrics. The content is grounded in the repository’s implementation details and database schema to ensure accuracy and traceability.

## Project Structure
The Site Reports feature spans UI pages, hooks for data access, approval workflows, PDF generation utilities, and database migrations that define the underlying data model. Key areas include:
- Site report entry and management page
- Photo upload component and associated hook
- Stoppage tracking hook and related schema
- Approval workflow for site reports
- Audit log and performance monitoring hooks
- PDF generation and document parsing utilities
- Reporting dashboard index

```mermaid
graph TB
subgraph "UI"
SR["SiteReport.tsx"]
Photos["SiteReportPhotoUploader.tsx"]
ReportsIndex["reports/index.tsx"]
end
subgraph "Hooks"
HookPhotos["useSiteReportPhotos.ts"]
HookStoppages["useStoppages.ts"]
HookAudit["useAuditLog.ts"]
HookPerf["usePerformanceMonitor.ts"]
HookShare["use-whatsapp-share.ts"]
end
subgraph "Approvals"
Approve["siteReportApproval.ts"]
end
subgraph "Utilities"
ParseDoc["api/parse-document.ts"]
GenPDF["lib/meeting-pdf-generator.ts"]
end
subgraph "Database"
DBReports["database-site-reports.sql"]
DBPhotos["database-site-report-photos.sql"]
DBStoppages["database-site-report-stoppages.sql"]
DBApproval["database-site-report-approval.sql"]
DBAudit["database-item-audit.sql"]
end
SR --> HookPhotos
SR --> HookStoppages
Photos --> HookPhotos
SR --> Approve
SR --> HookAudit
SR --> HookPerf
ReportsIndex --> SR
SR --> ParseDoc
SR --> GenPDF
SR --> HookShare
HookPhotos --> DBPhotos
HookStoppages --> DBStoppages
Approve --> DBApproval
HookAudit --> DBAudit
SR --> DBReports
```

**Diagram sources**
- [SiteReport.tsx](file://src/pages/SiteReport.tsx)
- [SiteReportPhotoUploader.tsx](file://src/components/SiteReportPhotoUploader.tsx)
- [useSiteReportPhotos.ts](file://src/hooks/useSiteReportPhotos.ts)
- [useStoppages.ts](file://src/hooks/useStoppages.ts)
- [siteReportApproval.ts](file://src/approvals/siteReportApproval.ts)
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)
- [usePerformanceMonitor.ts](file://src/hooks/usePerformanceMonitor.ts)
- [api/parse-document.ts](file://api/parse-document.ts)
- [lib/meeting-pdf-generator.ts](file://src/lib/meeting-pdf-generator.ts)
- [hooks/use-whatsapp-share.ts](file://src/hooks/use-whatsapp-share.ts)
- [pages/reports/index.tsx](file://src/pages/reports/index.tsx)
- [database-site-reports.sql](file://src/database-site-reports.sql)
- [database-site-report-photos.sql](file://src/database-site-report-photos.sql)
- [database-site-report-stoppages.sql](file://src/database-site-report-stoppages.sql)
- [database-site-report-approval.sql](file://src/database-site-report-approval.sql)
- [database-item-audit.sql](file://src/database-item-audit.sql)

**Section sources**
- [SiteReport.tsx](file://src/pages/SiteReport.tsx)
- [SiteReportPhotoUploader.tsx](file://src/components/SiteReportPhotoUploader.tsx)
- [useSiteReportPhotos.ts](file://src/hooks/useSiteReportPhotos.ts)
- [useStoppages.ts](file://src/hooks/useStoppages.ts)
- [siteReportApproval.ts](file://src/approvals/siteReportApproval.ts)
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)
- [usePerformanceMonitor.ts](file://src/hooks/usePerformanceMonitor.ts)
- [api/parse-document.ts](file://api/parse-document.ts)
- [lib/meeting-pdf-generator.ts](file://src/lib/meeting-pdf-generator.ts)
- [hooks/use-whatsapp-share.ts](file://src/hooks/use-whatsapp-share.ts)
- [pages/reports/index.tsx](file://src/pages/reports/index.tsx)
- [database-site-reports.sql](file://src/database-site-reports.sql)
- [database-site-report-photos.sql](file://src/database-site-report-photos.sql)
- [database-site-report-stoppages.sql](file://src/database-site-report-stoppages.sql)
- [database-site-report-approval.sql](file://src/database-site-report-approval.sql)
- [database-item-audit.sql](file://src/database-item-audit.sql)

## Core Components
- Site Report Entry Page: Central hub for creating and managing daily site reports, including progress notes, photos, and stoppages. It integrates with photo upload, stoppage tracking, approvals, and audit logging.
- Photo Upload Component: Handles image capture/upload, preview, compression, and association with a site report.
- Stoppage Tracking Hook: Provides CRUD operations and state management for work stoppages linked to site reports.
- Approval Workflow: Orchestrates review and approval states for site reports, ensuring governance before publication or distribution.
- Audit Log Hook: Records immutable changes to key entities for compliance and traceability.
- Performance Monitor Hook: Captures timing and error metrics for critical user actions.
- PDF Generation Utility: Produces printable and shareable documents from structured data.
- Document Parser API: Parses uploaded documents (e.g., images/PDFs) into extractable text/metadata for enrichment.
- WhatsApp Share Hook: Enables quick sharing of summaries or links via WhatsApp.
- Reports Index: Aggregates and navigates to various reporting views, including site reports.

**Section sources**
- [SiteReport.tsx](file://src/pages/SiteReport.tsx)
- [SiteReportPhotoUploader.tsx](file://src/components/SiteReportPhotoUploader.tsx)
- [useSiteReportPhotos.ts](file://src/hooks/useSiteReportPhotos.ts)
- [useStoppages.ts](file://src/hooks/useStoppages.ts)
- [siteReportApproval.ts](file://src/approvals/siteReportApproval.ts)
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)
- [usePerformanceMonitor.ts](file://src/hooks/usePerformanceMonitor.ts)
- [lib/meeting-pdf-generator.ts](file://src/lib/meeting-pdf-generator.ts)
- [api/parse-document.ts](file://api/parse-document.ts)
- [hooks/use-whatsapp-share.ts](file://src/hooks/use-whatsapp-share.ts)
- [pages/reports/index.tsx](file://src/pages/reports/index.tsx)

## Architecture Overview
The system follows a layered architecture:
- Presentation Layer: React components and pages for user interactions.
- Data Access Layer: Hooks encapsulating API calls and state management.
- Business Logic Layer: Approval workflows and processing utilities.
- Persistence Layer: Database schemas and migrations defining entities and relationships.
- Integration Layer: PDF generation, document parsing, and external sharing.

```mermaid
sequenceDiagram
participant User as "User"
participant Page as "SiteReport.tsx"
participant PhotosHook as "useSiteReportPhotos.ts"
participant StoppagesHook as "useStoppages.ts"
participant Approval as "siteReportApproval.ts"
participant Audit as "useAuditLog.ts"
participant Perf as "usePerformanceMonitor.ts"
participant DB as "Database Schemas"
User->>Page : Open Site Report
Page->>Perf : Record action start
Page->>PhotosHook : Load existing photos
Page->>StoppagesHook : Load existing stoppages
User->>Page : Submit report with photos/stoppages
Page->>PhotosHook : Persist photos
Page->>StoppagesHook : Persist stoppages
Page->>Approval : Request approval
Approval-->>DB : Update approval state
Page->>Audit : Log submission event
Page->>Perf : Record action duration
Page-->>User : Confirmation and next steps
```

**Diagram sources**
- [SiteReport.tsx](file://src/pages/SiteReport.tsx)
- [useSiteReportPhotos.ts](file://src/hooks/useSiteReportPhotos.ts)
- [useStoppages.ts](file://src/hooks/useStoppages.ts)
- [siteReportApproval.ts](file://src/approvals/siteReportApproval.ts)
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)
- [usePerformanceMonitor.ts](file://src/hooks/usePerformanceMonitor.ts)
- [database-site-reports.sql](file://src/database-site-reports.sql)
- [database-site-report-photos.sql](file://src/database-site-report-photos.sql)
- [database-site-report-stoppages.sql](file://src/database-site-report-stoppages.sql)
- [database-site-report-approval.sql](file://src/database-site-report-approval.sql)

## Detailed Component Analysis

### Daily Site Reporting Workflow
- Creation and editing of daily site reports with fields for progress notes, weather, manpower, equipment, materials, and general observations.
- Association of multiple photos per report.
- Linking one or more stoppages to the report.
- Submission triggers approval workflow and audit logging.
- Optional export to PDF and sharing via WhatsApp.

```mermaid
flowchart TD
Start(["Open Site Report"]) --> FillFields["Fill report fields<br/>progress, manpower, equipment, materials"]
FillFields --> AttachPhotos["Attach photos via uploader"]
AttachPhotos --> AddStoppages["Add stoppages if any"]
AddStoppages --> Review["Review completeness"]
Review --> |Incomplete| Edit["Edit and re-validate"]
Review --> |Complete| Submit["Submit for approval"]
Submit --> Approval["Approval workflow"]
Approval --> Audit["Audit log entry"]
Approval --> Export["Generate PDF"]
Export --> Share["Share via WhatsApp or email"]
Share --> End(["Done"])
```

**Diagram sources**
- [SiteReport.tsx](file://src/pages/SiteReport.tsx)
- [SiteReportPhotoUploader.tsx](file://src/components/SiteReportPhotoUploader.tsx)
- [useSiteReportPhotos.ts](file://src/hooks/useSiteReportPhotos.ts)
- [useStoppages.ts](file://src/hooks/useStoppages.ts)
- [siteReportApproval.ts](file://src/approvals/siteReportApproval.ts)
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)
- [lib/meeting-pdf-generator.ts](file://src/lib/meeting-pdf-generator.ts)
- [hooks/use-whatsapp-share.ts](file://src/hooks/use-whatsapp-share.ts)

**Section sources**
- [SiteReport.tsx](file://src/pages/SiteReport.tsx)
- [SiteReportPhotoUploader.tsx](file://src/components/SiteReportPhotoUploader.tsx)
- [useSiteReportPhotos.ts](file://src/hooks/useSiteReportPhotos.ts)
- [useStoppages.ts](file://src/hooks/useStoppages.ts)
- [siteReportApproval.ts](file://src/approvals/siteReportApproval.ts)
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)
- [lib/meeting-pdf-generator.ts](file://src/lib/meeting-pdf-generator.ts)
- [hooks/use-whatsapp-share.ts](file://src/hooks/use-whatsapp-share.ts)

### Photo Documentation
- Capture or upload images directly from device cameras or file picker.
- Preview thumbnails with optional cropping/compression.
- Associate images with specific site reports and maintain metadata (timestamps, geolocation if available).
- Persist images through the photo hook and storage layer.

```mermaid
classDiagram
class SiteReportPhotoUploader {
+uploadImage(file) Promise
+previewImages() Array
+removeImage(id) void
+compressIfNeeded(file) File
}
class useSiteReportPhotos {
+getPhotos(reportId) Promise
+savePhoto(photoData) Promise
+deletePhoto(photoId) Promise
}
SiteReportPhotoUploader --> useSiteReportPhotos : "uses"
```

**Diagram sources**
- [SiteReportPhotoUploader.tsx](file://src/components/SiteReportPhotoUploader.tsx)
- [useSiteReportPhotos.ts](file://src/hooks/useSiteReportPhotos.ts)
- [database-site-report-photos.sql](file://src/database-site-report-photos.sql)

**Section sources**
- [SiteReportPhotoUploader.tsx](file://src/components/SiteReportPhotoUploader.tsx)
- [useSiteReportPhotos.ts](file://src/hooks/useSiteReportPhotos.ts)
- [database-site-report-photos.sql](file://src/database-site-report-photos.sql)

### Progress Tracking Features
- Track daily progress by linking activities, milestones, and completion percentages.
- Aggregate progress across days to visualize trends.
- Integrate with stoppages to adjust effective progress calculations.

```mermaid
flowchart TD
A["Record daily activities"] --> B["Update progress metrics"]
B --> C{"Stoppages present?"}
C --> |Yes| D["Adjust effective progress"]
C --> |No| E["Keep reported progress"]
D --> F["Persist updated progress"]
E --> F
F --> G["Visualize trends over time"]
```

[No sources needed since this diagram shows conceptual workflow, not actual code structure]

### Stoppage Reporting
- Create stoppage entries with cause, duration, impact, and remediation notes.
- Link stoppages to specific site reports for context.
- Support planned vs unplanned classification and restart scheduling.

```mermaid
sequenceDiagram
participant User as "User"
participant Page as "SiteReport.tsx"
participant Hook as "useStoppages.ts"
participant DB as "database-site-report-stoppages.sql"
User->>Page : Add stoppage
Page->>Hook : createStopstop(stopData)
Hook->>DB : Insert stoppage record
Hook-->>Page : Success response
Page-->>User : Show confirmation
```

**Diagram sources**
- [SiteReport.tsx](file://src/pages/SiteReport.tsx)
- [useStoppages.ts](file://src/hooks/useStoppages.ts)
- [database-site-report-stoppages.sql](file://src/database-site-report-stoppages.sql)

**Section sources**
- [useStoppages.ts](file://src/hooks/useStoppages.ts)
- [database-site-report-stoppages.sql](file://src/database-site-report-stoppages.sql)

### Incident Logging and Safety Compliance Tracking
- Use site reports to log incidents, near-misses, and safety observations.
- Tag entries with severity, location, and responsible parties.
- Maintain compliance records and generate compliance documents upon request.

```mermaid
flowchart TD
I1["Log incident/near-miss"] --> I2["Assign severity and tags"]
I2 --> I3["Link to site report"]
I3 --> I4["Trigger compliance checks"]
I4 --> I5["Generate compliance document"]
I5 --> I6["Distribute to stakeholders"]
```

[No sources needed since this diagram shows conceptual workflow, not actual code structure]

### Customizing Report Templates
- Leverage PDF generation utilities to build templates tailored to organizational needs.
- Customize headers, footers, sections, and branding elements.
- Parameterize dynamic fields such as project name, date, author, and attachments.

```mermaid
flowchart TD
T1["Select template"] --> T2["Configure fields and layout"]
T2 --> T3["Preview generated PDF"]
T3 --> T4["Save template settings"]
T4 --> T5["Use template for exports"]
```

**Section sources**
- [lib/meeting-pdf-generator.ts](file://src/lib/meeting-pdf-generator.ts)

### Automated Notifications
- Configure notification rules based on report submissions, approvals, and stoppages.
- Trigger alerts via email or messaging channels when thresholds are met.
- Integrate with WhatsApp sharing for rapid dissemination.

```mermaid
sequenceDiagram
participant User as "User"
participant Page as "SiteReport.tsx"
participant Notify as "Notification Rules"
participant Share as "use-whatsapp-share.ts"
User->>Page : Submit report
Page->>Notify : Evaluate rules
Notify-->>Page : Decide channel(s)
Page->>Share : Send summary link
Share-->>User : Shared successfully
```

**Diagram sources**
- [SiteReport.tsx](file://src/pages/SiteReport.tsx)
- [hooks/use-whatsapp-share.ts](file://src/hooks/use-whatsapp-share.ts)

**Section sources**
- [hooks/use-whatsapp-share.ts](file://src/hooks/use-whatsapp-share.ts)

### Generating Compliance Documents
- Compile relevant site report data, photos, and stoppages into a compliance-ready PDF.
- Include timestamps, signatures, and version control metadata.
- Archive generated documents for audit purposes.

```mermaid
flowchart TD
C1["Collect report data"] --> C2["Attach supporting evidence"]
C2 --> C3["Render compliance PDF"]
C3 --> C4["Store in archive"]
C4 --> C5["Distribute to auditors"]
```

**Section sources**
- [lib/meeting-pdf-generator.ts](file://src/lib/meeting-pdf-generator.ts)

### Offline Data Collection and Mobile Usage
- Enable form inputs and photo capture on mobile devices.
- Cache draft submissions locally until connectivity is restored.
- Sync pending items to the server when online.

```mermaid
flowchart TD
O1["Open report on mobile"] --> O2["Capture photos and fill fields"]
O2 --> O3{"Network available?"}
O3 --> |Yes| O4["Sync immediately"]
O3 --> |No| O5["Save draft locally"]
O5 --> O6["Auto-sync when online"]
O4 --> O7["Confirm success"]
O6 --> O7
```

[No sources needed since this diagram shows conceptual workflow, not actual code structure]

### Data Synchronization
- Ensure consistency between local drafts and server records.
- Handle conflicts by prioritizing latest edits and preserving audit trails.
- Provide manual sync controls for power users.

```mermaid
sequenceDiagram
participant Device as "Mobile Device"
participant Server as "Server"
Device->>Device : Save draft
Device->>Server : Push when online
Server-->>Device : Acknowledge
Device->>Device : Merge conflicts if any
Device-->>Server : Finalize sync
```

[No sources needed since this diagram shows conceptual workflow, not actual code structure]

### Stakeholder Communication and Report Sharing
- Share concise summaries and full reports via WhatsApp or other channels.
- Control visibility and permissions for shared content.
- Maintain a history of shared documents and recipients.

```mermaid
flowchart TD
S1["Select report"] --> S2["Choose sharing channel"]
S2 --> S3["Compose message"]
S3 --> S4["Send and log share event"]
S4 --> S5["Track recipient feedback"]
```

**Section sources**
- [hooks/use-whatsapp-share.ts](file://src/hooks/use-whatsapp-share.ts)

### Audit Trail Maintenance
- Record all significant actions (create, update, approve, delete) with timestamps and actor identities.
- Store immutable logs for compliance and dispute resolution.
- Provide queryable audit history for reviewers and auditors.

```mermaid
flowchart TD
A1["Action occurs"] --> A2["Create audit entry"]
A2 --> A3["Persist audit log"]
A3 --> A4["Expose audit history"]
A4 --> A5["Support export for audits"]
```

**Diagram sources**
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)
- [database-item-audit.sql](file://src/database-item-audit.sql)

**Section sources**
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)
- [database-item-audit.sql](file://src/database-item-audit.sql)

### Integration with Quality Assurance Processes
- Embed inspection checklists within site reports to standardize QA steps.
- Require checklist completion before final submission.
- Generate QA certificates or compliance statements from completed checklists.

```mermaid
flowchart TD
Q1["Open report"] --> Q2["Load inspection checklist"]
Q2 --> Q3["Complete required items"]
Q3 --> Q4{"All items passed?"}
Q4 --> |No| Q5["Address deficiencies"]
Q4 --> |Yes| Q6["Proceed to approval"]
Q6 --> Q7["Generate QA document"]
```

[No sources needed since this diagram shows conceptual workflow, not actual code structure]

### Regulatory Compliance Requirements
- Align report fields and approvals with regulatory standards.
- Preserve evidence and chain-of-custody for inspections and incidents.
- Produce standardized compliance packages for regulators.

```mermaid
flowchart TD
R1["Map fields to regulations"] --> R2["Enforce validation rules"]
R2 --> R3["Require approvals per policy"]
R3 --> R4["Archive compliant outputs"]
R4 --> R5["Provide regulator access"]
```

[No sources needed since this diagram shows conceptual workflow, not actual code structure]

### Reporting Analytics, Trend Analysis, and Performance Metrics
- Aggregate daily progress, stoppages, and incidents to identify trends.
- Compute KPIs such as average stoppage duration, incident frequency, and compliance rates.
- Use performance monitoring to track user action latency and error rates.

```mermaid
flowchart TD
P1["Collect metrics"] --> P2["Compute KPIs"]
P2 --> P3["Visualize trends"]
P3 --> P4["Export analytics"]
P4 --> P5["Drive corrective actions"]
```

**Section sources**
- [usePerformanceMonitor.ts](file://src/hooks/usePerformanceMonitor.ts)
- [pages/reports/index.tsx](file://src/pages/reports/index.tsx)

## Dependency Analysis
The following diagram illustrates key dependencies among components, hooks, and database schemas involved in site reporting.

```mermaid
graph TB
SR["SiteReport.tsx"] --> UPH["useSiteReportPhotos.ts"]
SR --> USP["useStoppages.ts"]
SR --> APP["siteReportApproval.ts"]
SR --> AUD["useAuditLog.ts"]
SR --> PERF["usePerformanceMonitor.ts"]
SR --> SHARE["use-whatsapp-share.ts"]
SR --> PDF["lib/meeting-pdf-generator.ts"]
SR --> PARSE["api/parse-document.ts"]
UPH --> DBP["database-site-report-photos.sql"]
USP --> DBS["database-site-report-stoppages.sql"]
APP --> DBA["database-site-report-approval.sql"]
AUD --> DBAUD["database-item-audit.sql"]
SR --> DBR["database-site-reports.sql"]
```

**Diagram sources**
- [SiteReport.tsx](file://src/pages/SiteReport.tsx)
- [useSiteReportPhotos.ts](file://src/hooks/useSiteReportPhotos.ts)
- [useStoppages.ts](file://src/hooks/useStoppages.ts)
- [siteReportApproval.ts](file://src/approvals/siteReportApproval.ts)
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)
- [usePerformanceMonitor.ts](file://src/hooks/usePerformanceMonitor.ts)
- [hooks/use-whatsapp-share.ts](file://src/hooks/use-whatsapp-share.ts)
- [lib/meeting-pdf-generator.ts](file://src/lib/meeting-pdf-generator.ts)
- [api/parse-document.ts](file://api/parse-document.ts)
- [database-site-reports.sql](file://src/database-site-reports.sql)
- [database-site-report-photos.sql](file://src/database-site-report-photos.sql)
- [database-site-report-stoppages.sql](file://src/database-site-report-stoppages.sql)
- [database-site-report-approval.sql](file://src/database-site-report-approval.sql)
- [database-item-audit.sql](file://src/database-item-audit.sql)

**Section sources**
- [SiteReport.tsx](file://src/pages/SiteReport.tsx)
- [useSiteReportPhotos.ts](file://src/hooks/useSiteReportPhotos.ts)
- [useStoppages.ts](file://src/hooks/useStoppages.ts)
- [siteReportApproval.ts](file://src/approvals/siteReportApproval.ts)
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)
- [usePerformanceMonitor.ts](file://src/hooks/usePerformanceMonitor.ts)
- [hooks/use-whatsapp-share.ts](file://src/hooks/use-whatsapp-share.ts)
- [lib/meeting-pdf-generator.ts](file://src/lib/meeting-pdf-generator.ts)
- [api/parse-document.ts](file://api/parse-document.ts)
- [database-site-reports.sql](file://src/database-site-reports.sql)
- [database-site-report-photos.sql](file://src/database-site-report-photos.sql)
- [database-site-report-stoppages.sql](file://src/database-site-report-stoppages.sql)
- [database-site-report-approval.sql](file://src/database-site-report-approval.sql)
- [database-item-audit.sql](file://src/database-item-audit.sql)

## Performance Considerations
- Optimize photo uploads with compression and chunked transfers to reduce bandwidth and improve responsiveness.
- Implement pagination and lazy loading for large photo galleries and stoppage lists.
- Use performance monitoring hooks to detect slow operations and prioritize optimizations.
- Cache frequently accessed report metadata to minimize repeated queries.
- Batch write operations where possible to reduce database round-trips.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Photo upload failures: Verify file size limits, MIME types, and network connectivity; retry with compression enabled.
- Stoppage save errors: Check required fields and referential integrity; ensure the parent site report exists.
- Approval workflow stuck: Confirm user permissions and workflow configuration; review audit logs for blockers.
- Audit log gaps: Validate logging hooks are invoked on all mutation paths; inspect database constraints.
- PDF generation errors: Inspect template variables and asset availability; validate rendering pipeline.
- WhatsApp sharing failures: Ensure app installation and deep-link parameters are correct; fallback to copy-to-clipboard.

**Section sources**
- [useSiteReportPhotos.ts](file://src/hooks/useSiteReportPhotos.ts)
- [useStoppages.ts](file://src/hooks/useStoppages.ts)
- [siteReportApproval.ts](file://src/approvals/siteReportApproval.ts)
- [useAuditLog.ts](file://src/hooks/useAuditLog.ts)
- [lib/meeting-pdf-generator.ts](file://src/lib/meeting-pdf-generator.ts)
- [hooks/use-whatsapp-share.ts](file://src/hooks/use-whatsapp-share.ts)

## Conclusion
The Site Reports and Documentation system provides a comprehensive solution for daily reporting, photo documentation, progress tracking, stoppage management, incident logging, safety compliance, and stakeholder communication. With robust approval workflows, audit trails, PDF generation, and analytics, it supports both operational efficiency and regulatory compliance. Extensibility points allow template customization, automated notifications, and integration with QA processes.

## Appendices

### Data Model Overview
Key entities and relationships underpinning site reports, photos, stoppages, approvals, and audit logs.

```mermaid
erDiagram
SITE_REPORT {
uuid id PK
string title
text description
timestamp created_at
timestamp updated_at
}
PHOTO {
uuid id PK
uuid report_id FK
string url
timestamp captured_at
}
STOPPAGE {
uuid id PK
uuid report_id FK
string cause
int duration_minutes
enum type
timestamp started_at
timestamp ended_at
}
APPROVAL {
uuid id PK
uuid report_id FK
enum status
timestamp submitted_at
timestamp approved_at
}
AUDIT_LOG {
uuid id PK
string entity_type
uuid entity_id
string action
jsonb payload
timestamp occurred_at
}
SITE_REPORT ||--o{ PHOTO : "has many"
SITE_REPORT ||--o{ STOPPAGE : "has many"
SITE_REPORT ||--|| APPROVAL : "has one"
SITE_REPORT ||--o{ AUDIT_LOG : "referenced by"
```

**Diagram sources**
- [database-site-reports.sql](file://src/database-site-reports.sql)
- [database-site-report-photos.sql](file://src/database-site-report-photos.sql)
- [database-site-report-stoppages.sql](file://src/database-site-report-stoppages.sql)
- [database-site-report-approval.sql](file://src/database-site-report-approval.sql)
- [database-item-audit.sql](file://src/database-item-audit.sql)