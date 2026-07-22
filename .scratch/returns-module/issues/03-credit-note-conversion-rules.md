# Ticket: Credit Note Conversion Rules
Status: closed
Type: grilling

## Question

What are the rules for converting a Return to a Credit Note?

### Context

A return can map to multiple Invoices and multiple DCs:
- Invoices have rates, taxes (CGST/SGST/IGST), and financial values.
- DCs may be non-billable or not yet invoiced, meaning they might not have tax rates or unit prices associated with them in the same way.

### Open Choices

- If a return is mapped to a DC, how is the credit note generated? Does it prompt the user for pricing, use the project material rate, or is it excluded from the Credit Note?
- Should the Credit Note be itemized automatically based on the selected invoice item rates and tax configurations?
- Should we allow a lump sum (lot) Credit Note conversion or only itemized?

## Resolution

We have established the following rules for converting returns to credit notes:

1. **Invoice Mappings Only**: Only return quantities mapped to **Invoices** are eligible for Credit Note conversion. Mappings to **Delivery Challans (DCs)** represent inventory returns rather than financial reversals, so they are **not** eligible for Credit Notes.
2. **Splitting/Filtering Mappings**: If a return contains a mix of items mapped to both Invoices and DCs, only the invoice-mapped items/quantities will be pulled when initiating a Credit Note conversion. DC-mapped line items will be ignored.
3. **Itemized Conversion**: The Credit Note will be generated with full itemization automatically:
   - For each returned item mapped to an invoice, the Credit Note line item will use the exact `rate`, `discount_amount`, and tax rates (`cgst_percent`, `sgst_percent`, `igst_percent`) from the original invoice item.
   - The Credit Note will reference the target `invoice_id` in its header.
4. **Lot/Lump Sum Option**: Since the Credit Note module allows both itemized and lot modes, the user can select their preferred mode during conversion (defaulting to itemized).
