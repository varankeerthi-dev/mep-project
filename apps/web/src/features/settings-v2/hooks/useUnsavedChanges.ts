import { useState, useCallback, useMemo, useEffect, useRef } from 'react';

export interface UseUnsavedChangesOptions<T> {
  initialData: T;
  onSave: (data: T) => Promise<void>;
  storageKey?: string;
}

export function useUnsavedChanges<T extends Record<string, any>>({
  initialData,
  onSave,
  storageKey,
}: UseUnsavedChangesOptions<T>) {
  const [savedSnapshot, setSavedSnapshot] = useState<T>(initialData);
  const [liveData, setLiveData] = useState<T>(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [draftAvailable, setDraftAvailable] = useState(false);

  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const initialDataStr = useMemo(() => JSON.stringify(initialData), [initialData]);
  const prevInitialDataRef = useRef(initialDataStr);

  // Sync snapshot only when initialData actually changes
  useEffect(() => {
    if (prevInitialDataRef.current !== initialDataStr) {
      prevInitialDataRef.current = initialDataStr;
      setSavedSnapshot(initialData);
      setLiveData(initialData);
    }
  }, [initialDataStr, initialData]);

  // Check for local storage draft on mount
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && JSON.stringify(parsed) !== initialDataStr) {
          setDraftAvailable(true);
        }
      }
    } catch (e) {
      console.warn('Failed to parse draft from storageKey:', storageKey, e);
    }
  }, [storageKey, initialDataStr]);

  const hasChanges = useMemo(() => {
    return JSON.stringify(liveData) !== JSON.stringify(savedSnapshot);
  }, [liveData, savedSnapshot]);

  // Debounced auto-save to localStorage when liveData changes
  useEffect(() => {
    if (!storageKey || !hasChanges) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(liveData));
      } catch (e) {
        console.warn('Failed to save draft to storageKey:', storageKey, e);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [liveData, hasChanges, storageKey]);

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setLiveData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updateMultiple = useCallback((partial: Partial<T>) => {
    setLiveData((prev) => ({ ...prev, ...partial }));
  }, []);

  const discard = useCallback(() => {
    setLiveData(savedSnapshot);
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch {}
    }
    setDraftAvailable(false);
  }, [savedSnapshot, storageKey]);

  const restoreDraft = useCallback(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        setLiveData(JSON.parse(raw));
      }
    } catch {}
    setDraftAvailable(false);
  }, [storageKey]);

  const dismissDraft = useCallback(() => {
    if (!storageKey) return;
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    setDraftAvailable(false);
  }, [storageKey]);

  const save = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSaveRef.current(liveData);
      setSavedSnapshot(structuredClone(liveData));
      if (storageKey) {
        try {
          localStorage.removeItem(storageKey);
        } catch {}
      }
      setDraftAvailable(false);
    } finally {
      setIsSaving(false);
    }
  }, [liveData, storageKey]);

  const reset = useCallback((newData: T) => {
    setSavedSnapshot(newData);
    setLiveData(newData);
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch {}
    }
    setDraftAvailable(false);
  }, [storageKey]);

  return {
    liveData,
    savedSnapshot,
    hasChanges,
    isSaving,
    draftAvailable,
    updateField,
    updateMultiple,
    discard,
    save,
    reset,
    restoreDraft,
    dismissDraft,
  };
}
