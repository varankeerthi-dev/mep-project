import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  checklistPolicyFingerprint,
  isChecklistComplete,
  requiredChecklistItemIds,
  toggleAllChecklistItems,
  toggleChecklistItem,
  type ChecklistPolicy,
} from './domain';

interface ChecklistConfirmationDialogProps {
  policy: ChecklistPolicy | null;
  policyChanged: boolean;
  onContinue: (checkedItemIds: string[]) => void;
  onCancel: () => void;
}

export function ChecklistConfirmationDialog({
  policy,
  policyChanged,
  onContinue,
  onCancel,
}: ChecklistConfirmationDialogProps) {
  const [checkedItemIds, setCheckedItemIds] = useState<string[]>([]);
  const fingerprint = useMemo(() => policy ? checklistPolicyFingerprint(policy) : '', [policy]);

  useEffect(() => {
    setCheckedItemIds([]);
  }, [fingerprint]);

  const itemIds = policy ? requiredChecklistItemIds(policy) : [];
  const allChecked = Boolean(policy && isChecklistComplete(policy, checkedItemIds));

  return (
    <Dialog open={Boolean(policy)} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent overlayClassName="z-[10010]" className="z-[10020] max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Review before continuing</DialogTitle>
          <DialogDescription>
            Check every required item before this document can be saved or submitted.
          </DialogDescription>
        </DialogHeader>

        {policyChanged && (
          <p role="status" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            The checklist changed while this window was open. Review the current wording and confirm again.
          </p>
        )}

        <label className="flex cursor-pointer items-center gap-2 border-b border-zinc-200 pb-3 text-sm font-medium text-zinc-800">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={() => setCheckedItemIds((current) => toggleAllChecklistItems(policy!, current))}
          />
          Mark all
        </label>

        <div className="space-y-4">
          {policy?.groups.map((group) => (
            <section key={group.id} aria-labelledby={`checklist-group-${group.id}`}>
              <h3 id={`checklist-group-${group.id}`} className="mb-2 text-sm font-semibold text-zinc-900">
                {group.name}
              </h3>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <label key={item.id} className="flex cursor-pointer items-start gap-2 text-sm text-zinc-700">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checkedItemIds.includes(item.id)}
                      onChange={() => setCheckedItemIds((current) => toggleChecklistItem(policy!, current, item.id))}
                    />
                    <span>{item.label}<span className="ml-1 text-red-600" aria-label="required">*</span></span>
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => onContinue(checkedItemIds)} disabled={!policy || !itemIds.length || !allChecked}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
