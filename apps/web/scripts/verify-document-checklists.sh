#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
pnpm exec vitest run \
  src/features/document-checklists/api.test.ts \
  src/features/document-checklists/domain.test.ts \
  src/features/document-checklists/gate.test.ts \
  src/invoices/editor/invoiceV2ChecklistAction.test.ts \
  src/pages/QuotationList.test.tsx \
  src/pages/sales/SalesOrderList.test.tsx \
  src/pages/sales/components/SalesOrderImportModal.test.tsx \
  src/features/document-checklists/migration-cas.test.ts \
  src/features/settings-v2/tabs/checklistAssignmentHelpers.test.ts \
  src/pages/CreateQuotation/revisionSave.test.ts
