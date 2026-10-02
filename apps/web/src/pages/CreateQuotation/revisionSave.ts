export interface SavedQuotationRevision {
  newRevisionNo: number;
  newHistory: any[];
}

export type SaveCurrentRevisionResult =
  | { kind: 'saved'; revision: SavedQuotationRevision }
  | { kind: 'cancelled' }
  | { kind: 'failed'; error: string };

export function applySaveCurrentRevisionResult(
  result: SaveCurrentRevisionResult,
  handlers: {
    onSaved: (revision: SavedQuotationRevision) => void;
    onFailure: (error: string) => void;
  },
): void {
  if (result.kind === 'saved') {
    handlers.onSaved(result.revision);
  } else if (result.kind === 'failed') {
    handlers.onFailure(result.error);
  }
}
