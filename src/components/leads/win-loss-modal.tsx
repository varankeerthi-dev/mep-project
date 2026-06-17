// =============================================================================
// Win / Loss modal
// Gating modal shown when a quote is moved to lost / cancelled (or, optionally,
// approved). Captures the reason and notes; required to actually log the close.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useWinLossReasons } from '@/hooks/use-leads';
import type { WinLossCategory } from '@/types/leads';
import { cn } from '@/lib/utils';

interface WinLossModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What triggered the modal. Drives which reason category is loaded. */
  category: WinLossCategory;
  /** Optional. Rendered as the title context. */
  referenceLabel?: string;
  /** Returns null if user cancels. Resolves with reason data on submit. */
  onConfirm: (data: { reasonId: string | null; notes: string }) => void;
  /** Cancel / dismiss. */
  onCancel?: () => void;
}

const TITLES: Record<WinLossCategory, string> = {
  win: 'Why did we win?',
  loss: 'Why did we lose?',
  disqualify: 'Why is this disqualified?',
};

const SUBTITLES: Record<WinLossCategory, string> = {
  win: 'Captured for the playbook — these are the patterns we want to repeat.',
  loss: 'Captured for the playbook — these are the patterns we want to avoid.',
  disqualify: 'Captured so we stop spending cycles on the wrong fit.',
};

export function WinLossModal({
  open,
  onOpenChange,
  category,
  referenceLabel,
  onConfirm,
  onCancel,
}: WinLossModalProps) {
  const { data: reasons = [] } = useWinLossReasons(category);
  const [selectedReasonId, setSelectedReasonId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setSelectedReasonId(null);
      setNotes('');
    }
  }, [open, category]);

  const canSubmit = useMemo(() => {
    if (category === 'win' || category === 'loss') return selectedReasonId !== null;
    return true; // disqualify: free-text reason on the lead itself; modal is optional
  }, [category, selectedReasonId]);

  const handleSubmit = () => {
    if (!canSubmit) return;
    onConfirm({ reasonId: selectedReasonId, notes: notes.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{TITLES[category]}</DialogTitle>
          <DialogDescription>
            {SUBTITLES[category]}
            {referenceLabel ? (
              <span className="mt-1 block text-xs font-medium text-zinc-700">{referenceLabel}</span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {(category === 'win' || category === 'loss') && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-zinc-700">Reason</Label>
              <div className="grid max-h-56 grid-cols-1 gap-1.5 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-2">
                {reasons.length === 0 && (
                  <p className="px-2 py-3 text-center text-xs text-zinc-500">No reasons configured yet.</p>
                )}
                {reasons.map((r) => {
                  const selected = selectedReasonId === r.id;
                  return (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => setSelectedReasonId(r.id)}
                      className={cn(
                        'flex items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors',
                        selected
                          ? 'border-blue-600/30 bg-blue-600/10 text-blue-900'
                          : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100'
                      )}
                    >
                      <span className="font-medium">{r.label}</span>
                      {selected && <span className="text-xs text-blue-700">Selected</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-zinc-700" htmlFor="wl-notes">
              Notes <span className="font-normal text-zinc-500">(optional but recommended)</span>
            </Label>
            <Textarea
              id="wl-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                category === 'win'
                  ? 'What tipped it? Any specifics on price, terms, or relationship?'
                  : category === 'loss'
                    ? 'Who did they choose? What was the deciding factor?'
                    : 'What made this a poor fit?'
              }
              className="min-h-[80px] resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onCancel?.();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={handleSubmit} disabled={!canSubmit}>
            Save & continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
