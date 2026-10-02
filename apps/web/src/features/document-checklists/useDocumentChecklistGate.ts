import { useCallback, useRef, useState } from 'react';
import { loadChecklistPolicy } from './api';
import { runDocumentChecklistGate } from './gate';
import type {
  ChecklistDocumentType,
  ChecklistPolicy,
  ChecklistResponse,
  ChecklistGateResult,
} from './domain';

interface PendingConfirmation {
  policy: ChecklistPolicy;
  resolve: (response: ChecklistResponse) => void;
}

export function useDocumentChecklistGate() {
  const [policy, setPolicy] = useState<ChecklistPolicy | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [policyChanged, setPolicyChanged] = useState(false);
  const busyRef = useRef(false);
  const pendingRef = useRef<PendingConfirmation | null>(null);

  const confirm = useCallback((nextPolicy: ChecklistPolicy) => new Promise<ChecklistResponse>((resolve) => {
    pendingRef.current = { policy: nextPolicy, resolve };
    setPolicy(nextPolicy);
  }), []);

  const run = useCallback(async <T,>(input: {
    organisationId: string;
    documentType: ChecklistDocumentType;
    action: () => Promise<T> | T;
  }): Promise<ChecklistGateResult<T> | { kind: 'busy' } | { kind: 'failed'; error: string }> => {
    if (busyRef.current) return { kind: 'busy' };
    busyRef.current = true;
    setIsBusy(true);
    setPolicyChanged(false);

    try {
      return await runDocumentChecklistGate({
        ...input,
        loadPolicy: loadChecklistPolicy,
        confirm,
        onPolicyChanged: () => setPolicyChanged(true),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown checklist error.';
      return { kind: 'failed', error: message };
    } finally {
      busyRef.current = false;
      setIsBusy(false);
      setPolicy(null);
      pendingRef.current = null;
      setPolicyChanged(false);
    }
  }, [confirm]);

  const respond = useCallback((response: ChecklistResponse) => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    setPolicy(null);
    pending.resolve(response);
  }, []);

  return {
    policy,
    isBusy,
    policyChanged,
    isBusyNow: () => busyRef.current,
    run,
    continueWith: (checkedItemIds: string[]) => respond({ kind: 'confirmed', checkedItemIds }),
    cancel: () => respond({ kind: 'cancelled' }),
  };
}
