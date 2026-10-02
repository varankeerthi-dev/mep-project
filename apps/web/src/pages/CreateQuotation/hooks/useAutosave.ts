import { useEffect } from 'react';

interface UseAutosaveProps {
  isDirty: boolean;
  saving: boolean;
  items: any[];
  formData: any;
  handleSave: (saveAndNew?: boolean, isAutosave?: boolean) => Promise<void>;
  paused?: boolean;
  debounceMs?: number;
}

export function useAutosave({
  isDirty,
  saving,
  items,
  formData,
  handleSave,
  paused = false,
  debounceMs = 15000
}: UseAutosaveProps) {
  useEffect(() => {
    if (!isDirty || saving || paused) return;
    if (!formData.client_id) return;

    const timer = setTimeout(() => {
      handleSave(false, true);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [items, formData, isDirty, saving, paused, handleSave, debounceMs]);
}
