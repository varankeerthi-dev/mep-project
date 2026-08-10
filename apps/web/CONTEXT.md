# Domain Glossary

## Project Scope
* **Contractor Scope**: The specific deliverables, labor, and tasks assigned to subcontractors on a project.
* **Client Scope**: The works, materials, utilities, or permissions that the client is responsible for providing.
* **Not Our Scope (Excluded)**: Works that are explicitly excluded from the project agreement and will not be executed by the team.
* **Scope Awaiting Approval**: Variations, changes, or additional scope items currently pending client or management sign-off before execution.
* **Instructions to Site Engineer**: Critical operational guidelines and notes always visible to onsite engineers at a quick glance.

## Project Lifecycle
* **Draft Project**: A project in the planning stage that has not yet begun execution.
* **Active Project**: A project currently in the execution phase.
* **Completed Project**: A project where execution has finished (marked as 'Execution Completed', 'Closed', or 'Financially Closed'), requiring a completion percentage of 100%.

## Warranty & Maintenance
* **Warranty Claim**: A formal transaction/request escalated to an equipment vendor or manufacturer to resolve a defect on supplied equipment during its warranty window.
* **Vendor Dispute Reason**: The documented justification/explanation provided by a supplier when they reject or dispute a warranty claim.

## Material Returns
* **Material Return**: The transaction recording unused or leftover materials sent back from a project site to a warehouse.
* **Good Return**: A returned item in reusable condition that automatically increments the warehouse's physical inventory stock.
* **Scrap Return**: A returned item that is damaged or unusable. It reduces the project's net supplied quantity on site, but does not increment standard warehouse inventory.

## Manufacturing — Machine & Tooling
* **Tooling**: Any tool, die, mould, jig, or fixture mounted on a machine to produce a product. The generic term used across all machine types (injection moulding, blow moulding, press, extruder). A mould is a type of Tooling. UI label is always "Tooling" — never "Mould" — to remain future-safe across machine types.
* **Machine (Work Center)**: A physical production asset in the plant. Identified by a code (e.g. IM-01) and machine type. A Machine is a static asset; Tooling is mounted on and removed from it.
* **Machine Type**: Classification of a Work Center that drives which capacity fields and panels appear in the UI. Values: injection_moulding | blow_moulding | press | extruder | assembly | general.
* **Cavity**: A single impression within a Tooling that produces one unit per shot/cycle. Always user-defined — never assumed or fixed by the system.
* **Running Cavities**: The number of cavities actively used for a specific Job Card. May be less than total cavity count if one or more are blocked. Recorded on Job Card, not on Tooling.
* **Shot**: One complete open-close-inject-eject cycle of an injection moulding machine. Primary production count unit for IM. Equivalent: Cycle (blow moulding), Stroke (press).
* **Machine Incharge**: Named person responsible for a machine's condition and output. Reference text field on Machine Master. Not used in scheduling logic.
* **Part Weight**: The weight of one finished unit (in grams) produced by a BOM. Stored as `part_weight_grams` on `bom_headers`. User-entered once on the BOM. Used to verify that (Part Weight × Running Cavities) ≤ Machine's Max Shot Weight during Job Card creation. If not filled, compatibility check is silently skipped.
* **Shot Counter**: The cumulative shot count for a Tooling. Always computed live as `SUM(actual_shots)` across all non-deleted Production Entries linked to that tooling. Never stored as a running total on the Tooling row. Edits and deletes self-correct automatically. The `total_shots_lifetime` column on `manufacturing_tooling` is removed — it is not the source of truth.
* **Tooling Reserved**: A computed badge state — not a stored status — indicating that at least one active, non-completed Job Card references this Tooling. Derived by querying job_cards. Shown on the Tooling list as a pending badge. Prevents a second planner from double-booking the same Tooling at planning time.
* **Tooling Mounted**: A stored status on `manufacturing_tooling.status`. Set to `mounted` when the first Production Entry is saved against a Job Card that references this Tooling (physical reality: shots have begun). Reverts to `available` when the Job Card reaches `completed` or `cancelled`.
* **Downtime Priority Rule**: When an open Downtime record exists for a Machine, the Machine Board always shows 🔴 BREAKDOWN — regardless of any active Job Card. The Job Card status remains `in_progress` and is not auto-frozen. The operator saves partial Production Entries for shots completed before the breakdown, then resumes on repair. The Job Card is the operator's document; only the operator completes or cancels it.
* **Plan This Machine (adaptive flow)**: The 3-step drawer launched from a Machine Board card. Branches on machine state: if the machine has a current Tooling mounted (`current_tooling_id` is set), Step 1 pre-fills that Tooling and the user confirms product + qty. If no Tooling is mounted, Step 1 asks for product, Step 2 shows available Toolings filtered by that product. Step 3 is always shift + planned qty + running cavities confirmation.
* **Machine Board Default**: The Machine Board (`/manufacturing/machines`) is the default landing tab for all users who open the manufacturing module, regardless of role. Dashboard remains as a second tab.
* **Shots Since Last Maintenance (computed)**: Not a stored column. Derived as `SUM(actual_shots from production_entries WHERE created_at > last maintenance_date for this tooling)`. The columns `total_shots_lifetime` and `shots_since_last_maintenance` are removed from `manufacturing_tooling` — they are not stored.
