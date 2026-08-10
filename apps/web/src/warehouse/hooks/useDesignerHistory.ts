// src/warehouse/hooks/useDesignerHistory.ts
// Undo/redo history stack for the Warehouse Designer draft (PRD §5.20).
// The draft is immutable (reducers return new objects), so snapshots are
// cheap references. A draftRef mirrors state so `set`/`undo`/`redo` never
// depend on updater functions (which React may invoke twice in StrictMode).

import { useCallback, useRef, useState } from 'react';
import type { WarehouseDraft } from '../types';

const MAX_HISTORY = 100;

export function useDesignerHistory(initial: WarehouseDraft) {
  const [draft, setState] = useState<WarehouseDraft>(initial);
  const draftRef = useRef<WarehouseDraft>(initial);
  const pastRef = useRef<WarehouseDraft[]>([]);
  const futureRef = useRef<WarehouseDraft[]>([]);

  const commit = useCallback((next: WarehouseDraft) => {
    draftRef.current = next;
    setState(next);
  }, []);

  const set = useCallback((updater: WarehouseDraft | ((d: WarehouseDraft) => WarehouseDraft)) => {
    const prev = draftRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    if (next === prev) return;
    pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), prev];
    futureRef.current = [];
    commit(next);
  }, [commit]);

  const undo = useCallback(() => {
    const previous = pastRef.current.pop();
    if (!previous) return;
    futureRef.current = [...futureRef.current, draftRef.current];
    commit(previous);
  }, [commit]);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current = [...pastRef.current, draftRef.current];
    commit(next);
  }, [commit]);

  const reset = useCallback((next: WarehouseDraft) => {
    pastRef.current = [];
    futureRef.current = [];
    commit(next);
  }, [commit]);

  return {
    draft,
    setDraft: set,
    undo,
    redo,
    reset,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    historySize: pastRef.current.length,
  };
}
