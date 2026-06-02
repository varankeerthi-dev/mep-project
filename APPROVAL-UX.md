# Approval UX Standard (Adopted)

## Single `/approvals` page structure
- **Awaiting My Action** — primary section; all items where current user is the next approver in the chain, regardless of type
- **Pending (Others)** — read-only, secondary
- **Approved by Me** — history of user’s approvals
- **Released / Completed** — final state

## Type filtering
- Collapsed by default; chips show count badges
- Persists last selection per user

## Approval chain indicator
Each row shows: `PM [✓] → GM [●] → MD [ ]`
