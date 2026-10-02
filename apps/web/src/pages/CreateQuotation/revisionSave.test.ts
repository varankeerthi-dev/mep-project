import { describe, expect, it, vi } from 'vitest';
import { applySaveCurrentRevisionResult } from './revisionSave';

describe('quotation revision save outcome', () => {
  it('treats checklist cancellation as neither a save failure nor negotiation enablement', () => {
    const onSaved = vi.fn();
    const onFailure = vi.fn();

    applySaveCurrentRevisionResult({ kind: 'cancelled' }, { onSaved, onFailure });

    expect(onSaved).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('enables negotiation only after a successful revision write', () => {
    const revision = { newRevisionNo: 4, newHistory: [{ revision_no: 3 }] };
    const onSaved = vi.fn();
    const onFailure = vi.fn();

    applySaveCurrentRevisionResult({ kind: 'saved', revision }, { onSaved, onFailure });

    expect(onSaved).toHaveBeenCalledWith(revision);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('reports a real write or gate failure without enabling negotiation', () => {
    const onSaved = vi.fn();
    const onFailure = vi.fn();

    applySaveCurrentRevisionResult({ kind: 'failed', error: 'permission denied' }, { onSaved, onFailure });

    expect(onSaved).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledWith('permission denied');
  });
});
