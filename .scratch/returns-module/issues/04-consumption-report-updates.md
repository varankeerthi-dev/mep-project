# Ticket: Consumption Report Updates
Status: closed
Type: grilling

## Question

How should the Project Consumption Report be updated to include the "Return" column and adjust final quantities?

### Context

The `material_consumption_summary` table (or RPC `update_material_consumption_summary`) tracks planned, received, and used quantities.
- Mapped return quantities need to be subtracted from "supplied/received" quantities to calculate the net quantity used/supplied on site.

### Open Choices

- Do we add a `returned_qty` column directly to the `material_consumption_summary` table, and modify the DB triggers/RPC to calculate it?
- Or do we calculate it dynamically on the client side when loading the dashboard?

## Resolution

We will implement the updates directly in the database layer and extend the frontend table to display the return quantities:

1. **Table Schema Update**: Add a `returned_qty DECIMAL(10,2) DEFAULT 0` column to the `material_consumption_summary` table.
2. **RPC Calculation (`update_material_consumption_summary`)**:
   - The RPC or trigger recalculating consumption will be updated to fetch return quantities:
     ```sql
     -- Example calculation inside the RPC
     returned_qty = COALESCE((
       SELECT SUM(ri.quantity)
       FROM return_items ri
       JOIN returns r ON r.id = ri.return_id
       WHERE r.project_id = p_project_id
         AND ri.item_id = summary.item_id
         AND (ri.variant_id = summary.variant_id OR (ri.variant_id IS NULL AND summary.variant_id IS NULL))
         AND r.status = 'completed'
     ), 0)
     ```
3. **Quantity Formulas**:
   - `net_supplied_qty = received_qty - returned_qty` (Net supplied quantity)
   - `remaining_qty = received_qty - used_qty - returned_qty` (Actual remaining quantity on site)
4. **Frontend UI Update**:
   - Update the Project Material Dashboard / Consumption table to include a **Returns** column directly next to the **Received/Supplied** and **Used** columns.
   - Adjust the calculations displayed in the table rows to match: `Actual Qty on Site = Supplied - Used - Returned`.
