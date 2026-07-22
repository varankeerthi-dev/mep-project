# Ticket: PDF/Excel Export Utilities
Status: closed
Type: task

## Question

What are the layout, formatting, and file export utilities for the Returns module?

### Context

We need download buttons for PDF and Excel.
- Excel exports can be done client-side using `xlsx` (e.g. `xlsx` or `sheetjs` library).
- PDF exports can be done using a custom PDF generator similar to invoices.

### Open Choices

- Should we use a template similar to the delivery challan or invoice layout?
- Are there existing Excel export libraries/utilities in the codebase we should reuse?

## Resolution

We will build the export utilities by utilizing the existing premium layout helpers and libraries:

1. **Excel Export (`xlsx`)**:
   - We will use SheetJS (`xlsx`) which is already installed and used in the codebase (e.g., `BulkImportModal.tsx`, `ProjectMaterialDashboard.tsx`).
   - The excel generator will structure return metadata (Return Number, Project Name, Return Date) as header rows, followed by the table of returned items: `[S.no, Item, Variant, Quantity, Unit, Rate, Total, Mapped Sources / Remarks]`.
   - Code snippet to be implemented:
     ```typescript
     const XLSX = await import('xlsx');
     const wb = XLSX.utils.book_new();
     const ws = XLSX.utils.json_to_sheet(exportData);
     XLSX.utils.book_append_sheet(wb, ws, 'Material Returns');
     XLSX.writeFile(wb, `${returnNumber}_material_returns.xlsx`);
     ```

2. **PDF Export (`jspdf` + `jspdf-autotable`)**:
   - We will implement a new PDF export utility `apps/web/src/pdf/proGridReturnPdf.ts` that matches the existing document design style using `jspdf`, `jspdf-autotable`, and layouts from `apps/web/src/pdf/proGridLayout`.
   - It will feature a professional double frame, organization details header, client details, material returns list table, and a summary block.
