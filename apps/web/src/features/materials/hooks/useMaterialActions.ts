// @ts-nocheck
import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { deleteOrArchiveMaterial, toggleMaterialActive } from '../repository';

export function useMaterialActions(orgId: string | null, updateMaterialsCache: (updater: any) => void) {
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);

  const deleteMaterial = useCallback(async (material: any) => {
    setDeleteInProgress(true);
    try {
      const result = await deleteOrArchiveMaterial(material.id);

      if (result.deleted) {
        updateMaterialsCache((prev) => prev.filter((m) => m.id !== material.id));
      } else if (result.archived) {
        updateMaterialsCache((prev) =>
          prev.map((item) =>
            item.id === material.id ? { ...item, is_active: false, updated_at: new Date().toISOString() } : item
          )
        );
        alert(`Item is linked with:\n- ${result.linkedTables.join('\n- ')}\n\nIt has been archived (disabled) instead of hard delete.`);
      }

      queryClient.invalidateQueries({ queryKey: ['itemStock'] });
    } catch (err: any) {
      console.error('Delete item error:', err);
      alert('Unable to delete item: ' + err.message);
    } finally {
      setDeleteInProgress(false);
    }
  }, [orgId, updateMaterialsCache, queryClient]);

  const toggleActive = useCallback(async (material: any) => {
    const nowIso = new Date().toISOString();
    try {
      await toggleMaterialActive(material);
      updateMaterialsCache((prev) =>
        prev.map((item) =>
          item.id === material.id ? { ...item, is_active: !material.is_active, updated_at: nowIso } : item
        )
      );
    } catch (err) {
      console.error('Toggle active error:', err);
    }
  }, [updateMaterialsCache]);

  return {
    deleteTarget,
    setDeleteTarget,
    deleteInProgress,
    deleteMaterial,
    toggleActive,
  };
}
