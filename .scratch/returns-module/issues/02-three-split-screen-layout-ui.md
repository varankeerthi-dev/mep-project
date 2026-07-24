# Ticket: Two-Panel Split Screen UI Layout
Status: needs-triage
Type: prototype

## Question

How should the two-panel split screen layout be structured and look visually for material returns?

### Context

Based on alignment with the user, we will use a **two-panel split layout** instead of a three-split layout:
- **Left Panel (Main Return List)**: Displays the return metadata (project, date, return number, remarks) and the return items table containing:
  - S.no, Item Name, Variant, Return Qty, Unit, Rate, Total, Remarks (autofilled with mapped DC/Invoice numbers).
  - Includes download PDF, download Excel, edit, view, and save buttons.
  - Allows selecting items manually or loading from the project's material list / BOQ.
- **Right Panel (Source Mapping Drawer/Panel)**: Opens when an item in the left panel is selected. Displays the item details and its mapped supply sources:
  - Lists quantities already supplied under various DCs/Invoices for the project.
  - Buttons: "Add Invoice as Source" and "Add DC as Source".
  - Allows selecting multiple sources if the return quantity is larger than what was supplied in a single document.
  - Mapped document numbers are passed back to the Left Panel to populate the item's Remarks column.

### Open Choices

- Should the Right Panel be a slide-over drawer (Sheet component from shadcn/ui) or a side-by-side split view on desktop screens?
- How does the user trigger loading of the project's material list / BOQ (e.g., a "Load BOQ/Materials" action button)?
