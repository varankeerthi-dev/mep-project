import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/button';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface BulkPriceDialogProps {
  open: boolean;
  onClose: () => void;
  priceText: string;
  onPriceTextChange: (text: string) => void;
  previewRows: any[];
  parseErrors: string[];
  applyErrors: string[];
  inProgress: boolean;
  onPreview: () => void;
  onApply: () => void;
}

export function BulkPriceDialog({
  open, onClose, priceText, onPriceTextChange,
  previewRows, parseErrors, applyErrors, inProgress,
  onPreview, onApply,
}: BulkPriceDialogProps) {
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Bulk Price Update"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={inProgress} className="text-xs">Cancel</Button>
          {previewRows.length === 0 && (
            <Button variant="default" onClick={onPreview} className="text-xs">Preview Changes</Button>
          )}
          {previewRows.length > 0 && (
            <Button variant="default" onClick={onApply} disabled={inProgress} className="text-xs">
              {inProgress ? 'Updating...' : `Apply ${previewRows.length} Update${previewRows.length > 1 ? 's' : ''}`}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-600">Paste TSV data (Item Code/Name, Sale Price, Purchase Price)</label>
          <textarea
            value={priceText}
            onChange={(e) => onPriceTextChange(e.target.value)}
            className="w-full h-28 rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder={`ITEM-001\t1250\t980\nITEM-002\t2500\t2000`}
            disabled={inProgress}
          />
        </div>

        {parseErrors.length > 0 && (
          <div className="space-y-1">
            {parseErrors.map((err, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{err}</span>
              </div>
            ))}
          </div>
        )}

        {previewRows.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-xs font-medium text-green-700">{previewRows.length} item(s) to update</span>
            </div>
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-semibold text-zinc-500">Item</th>
                    <th className="text-right px-3 py-1.5 font-semibold text-zinc-500">Current Sale</th>
                    <th className="text-right px-3 py-1.5 font-semibold text-zinc-500">New Sale</th>
                    <th className="text-right px-3 py-1.5 font-semibold text-zinc-500">Current Purchase</th>
                    <th className="text-right px-3 py-1.5 font-semibold text-zinc-500">New Purchase</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-t border-zinc-100">
                      <td className="px-3 py-1.5 text-zinc-700">{row.identifier}</td>
                      <td className="px-3 py-1.5 text-right text-zinc-500">{row.item.sale_price ?? '-'}</td>
                      <td className="px-3 py-1.5 text-right font-medium text-indigo-700">{row.nextSale ?? '-'}</td>
                      <td className="px-3 py-1.5 text-right text-zinc-500">{row.item.purchase_price ?? '-'}</td>
                      <td className="px-3 py-1.5 text-right font-medium text-indigo-700">{row.nextPurchase ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {applyErrors.length > 0 && (
          <div className="space-y-1">
            {applyErrors.map((err, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-red-700 bg-red-50 rounded-lg p-2">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{err}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
