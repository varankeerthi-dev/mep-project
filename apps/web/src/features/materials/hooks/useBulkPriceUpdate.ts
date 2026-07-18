// @ts-nocheck
import { useState, useCallback } from 'react';
import { supabase } from '../../../supabase';
import { buildItemChangeLog, appendLocalAuditEntry } from '../shared/audit';

export function useBulkPriceUpdate(materials: any[]) {
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false);
  const [bulkPriceText, setBulkPriceText] = useState('');
  const [bulkPreviewRows, setBulkPreviewRows] = useState<any[]>([]);
  const [bulkParseErrors, setBulkParseErrors] = useState<string[]>([]);
  const [bulkApplyErrors, setBulkApplyErrors] = useState<string[]>([]);
  const [bulkInProgress, setBulkInProgress] = useState(false);

  const openBulkPriceModal = useCallback(() => {
    setShowBulkPriceModal(true);
    setBulkPriceText('');
    setBulkPreviewRows([]);
    setBulkParseErrors([]);
    setBulkApplyErrors([]);
  }, []);

  const closeBulkPriceModal = useCallback(() => {
    if (bulkInProgress) return;
    setShowBulkPriceModal(false);
  }, [bulkInProgress]);

  const parseBulkPriceRows = useCallback(() => {
    const text = bulkPriceText.trim();
    if (!text) {
      setBulkPreviewRows([]);
      setBulkParseErrors(['Paste data first.']);
      return;
    }

    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) {
      setBulkPreviewRows([]);
      setBulkParseErrors(['No rows found in pasted data.']);
      return;
    }

    const materialByCode: Record<string, any> = {};
    const materialByName: Record<string, any> = {};
    materials.forEach((item) => {
      if (item.item_code) materialByCode[item.item_code.toLowerCase().trim()] = item;
      if (item.display_name) materialByName[item.display_name.toLowerCase().trim()] = item;
      if (item.name) materialByName[item.name.toLowerCase().trim()] = item;
    });

    const errors: string[] = [];
    const rows: any[] = [];
    let startIdx = 0;
    const firstCols = lines[0].split('\t').map((c) => c.trim().toLowerCase());
    const hasHeader = firstCols.some((c) => c.includes('item') || c.includes('code') || c.includes('sale') || c.includes('purchase'));
    if (hasHeader) startIdx = 1;

    for (let idx = startIdx; idx < lines.length; idx += 1) {
      const raw = lines[idx];
      const cols = raw.split('\t').map((c) => c.trim());
      const rowNo = idx + 1;

      if (cols.length < 2) {
        errors.push(`Row ${rowNo}: requires at least 2 columns (Item Code/SKU or Name + Sale Price).`);
        continue;
      }

      const identifier = cols[0];
      const saleRaw = cols[1];
      const purchaseRaw = cols[2] ?? '';

      if (!identifier) { errors.push(`Row ${rowNo}: missing item identifier.`); continue; }

      const salePrice = saleRaw === '' ? null : parseFloat(saleRaw);
      const purchasePrice = purchaseRaw === '' ? null : parseFloat(purchaseRaw);

      if (saleRaw !== '' && Number.isNaN(salePrice)) { errors.push(`Row ${rowNo}: invalid sale price "${saleRaw}".`); continue; }
      if (purchaseRaw !== '' && Number.isNaN(purchasePrice)) { errors.push(`Row ${rowNo}: invalid purchase price "${purchaseRaw}".`); continue; }
      if (salePrice === null && purchasePrice === null) { errors.push(`Row ${rowNo}: at least one price (sale/purchase) is required.`); continue; }

      const key = identifier.toLowerCase().trim();
      const found = materialByCode[key] || materialByName[key];
      if (!found) { errors.push(`Row ${rowNo}: item "${identifier}" not found.`); continue; }

      const nextSale = salePrice === null ? found.sale_price : salePrice;
      const nextPurchase = purchasePrice === null ? found.purchase_price : purchasePrice;
      const hasChange = String(nextSale ?? '') !== String(found.sale_price ?? '') || String(nextPurchase ?? '') !== String(found.purchase_price ?? '');
      if (!hasChange) continue;

      rows.push({ rowNo, identifier, item: found, nextSale, nextPurchase });
    }

    setBulkPreviewRows(rows);
    setBulkParseErrors(errors);
  }, [bulkPriceText, materials]);

  const applyBulkPriceUpdates = useCallback(async (refreshMaterials: () => Promise<void>, loadItemTransactions: (id: string) => Promise<void>, selectedMaterialId: string | null) => {
    if (bulkInProgress) return;
    if (bulkPreviewRows.length === 0) {
      setBulkApplyErrors(['No valid rows to update. Click "Preview Changes" first.']);
      return;
    }

    setBulkInProgress(true);
    setBulkApplyErrors([]);
    const failures: string[] = [];
    let successCount = 0;
    let canWriteDbAudit = true;

    for (const row of bulkPreviewRows) {
      const nowIso = new Date().toISOString();
      const updateData = { sale_price: row.nextSale, purchase_price: row.nextPurchase, updated_at: nowIso };

      try {
        const { error } = await supabase.from('materials').update(updateData).eq('id', row.item.id);
        if (error) throw error;

        const auditChanges = buildItemChangeLog(row.item, { ...row.item, ...updateData });
        const auditEntry = {
          id: `local-bulk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          item_id: row.item.id, action: 'BULK_PRICE_UPDATE',
          notes: `Bulk price update from Items page (Row ${row.rowNo})`,
          changes: auditChanges, created_at: nowIso,
        };
        appendLocalAuditEntry(auditEntry);

        if (canWriteDbAudit) {
          const { error: dbAuditError } = await supabase.from('item_audit_logs').insert({
            item_id: row.item.id, action: 'BULK_PRICE_UPDATE', notes: auditEntry.notes,
            changes: JSON.stringify(auditChanges), created_at: nowIso,
          });
          if (dbAuditError) { console.log('item_audit_logs bulk write warning:', dbAuditError.message); canWriteDbAudit = false; }
        }
        successCount += 1;
      } catch (error: any) {
        failures.push(`Row ${row.rowNo} (${row.identifier}): ${error.message}`);
      }
    }

    await refreshMaterials();
    if (selectedMaterialId) await loadItemTransactions(selectedMaterialId);

    setBulkApplyErrors(failures);
    if (failures.length === 0) setShowBulkPriceModal(false);
    setBulkInProgress(false);

    return { successCount, failureCount: failures.length };
  }, [bulkInProgress, bulkPreviewRows]);

  return {
    showBulkPriceModal, setShowBulkPriceModal,
    bulkPriceText, setBulkPriceText,
    bulkPreviewRows, bulkParseErrors, bulkApplyErrors, bulkInProgress,
    openBulkPriceModal, closeBulkPriceModal,
    parseBulkPriceRows, applyBulkPriceUpdates,
  };
}
