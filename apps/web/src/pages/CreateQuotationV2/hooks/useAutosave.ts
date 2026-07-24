import { useEffect } from 'react';

interface UseAutosaveProps {
  isDirty: boolean;
  saving: boolean;
  items: any[];
  formData: any;
  handleSave: (saveAndNew?: boolean, isAutosave?: boolean) => Promise<void>;
  debounceMs?: number;
}

export function useAutosave({
  isDirty,
  saving,
  items,
  formData,
  handleSave,
  debounceMs = 15000
}: UseAutosaveProps) {
  useEffect(() => {
    if (!isDirty || saving) return;
    if (!formData.client_id) return;

    const timer = setTimeout(() => {
      handleSave(false, true);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [items, formData, isDirty, saving, handleSave, debounceMs]);
}
