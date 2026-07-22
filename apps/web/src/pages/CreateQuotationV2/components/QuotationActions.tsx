import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, FileText, RotateCcw } from 'lucide-react';
import { SaveStatusIndicator } from './SaveStatusIndicator';

interface QuotationActionsProps {
  editId: string | null;
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  saving: boolean;
  handleSave: (saveAndNew: boolean) => Promise<void>;
  saveCurrentRevision: () => Promise<{ newRevisionNo: number; newHistory: any[] } | null>;
  setConfirmDialog: (dlg: any) => void;
  setRevisionDialogOpen: (open: boolean) => void;
  setIsParserOpen: (open: boolean) => void;
  activeImportSessionId: string | null;
  handleUndoImport: () => void;
  toast: any;
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'conflict' | 'error';
}

export function QuotationActions({
  editId,
  formData,
  setFormData,
  saving,
  handleSave,
  saveCurrentRevision,
  setConfirmDialog,
  setRevisionDialogOpen,
  setIsParserOpen,
  activeImportSessionId,
  handleUndoImport,
  toast,
  saveStatus,
}: QuotationActionsProps) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between sticky top-0 z-50 pt-4 pb-3 border-b border-zinc-200" style={{ top: 0, margin: '0 -24px 24px -24px', padding: '16px 24px', zIndex: 100, backgroundColor: '#ffffff' }}>
      <div className="flex items-center gap-3">
        <h1 className="text-base font-bold text-zinc-900 tracking-tight">
          {editId ? 'Edit Quotation' : 'Create New Quotation'}
        </h1>
        {editId && formData.revision_no > 1 && (
          <span className="px-2 py-1 text-xs font-bold bg-amber-100 text-amber-700 rounded">
            Rev. {formData.revision_no}
          </span>
        )}
        <SaveStatusIndicator status={saveStatus} />
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 pr-4 border-r border-zinc-200">
          <label className="relative inline-flex items-center cursor-pointer group">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={formData.negotiation_mode || false}
              onChange={async (e) => {
                if (e.target.checked && editId && !formData.negotiation_mode) {
                  setConfirmDialog({
                    open: true,
                    title: 'Enable Negotiation Mode',
                    description: `This will save the current quotation as Revision ${formData.revision_no} before making changes. Continue?`,
                    confirmLabel: 'Enable',
                    onConfirm: async () => {
                      setConfirmDialog(null);
                      const result = await saveCurrentRevision();
                      if (!result) {
                        toast.error('Failed to save revision. Please try again.');
                        return;
                      }
                      setFormData((prev: any) => ({ 
                        ...prev, 
                        revision_no: result.newRevisionNo,
                        revision_history: result.newHistory,
                        negotiation_mode: true,
                        status: 'Under Negotiation'
                      }));
                    }
                  });
                  return;
                } else {
                  setFormData((prev: any) => ({ 
                    ...prev, 
                    negotiation_mode: e.target.checked, 
                    status: e.target.checked ? 'Under Negotiation' : prev.status 
                  }));
                }
              }}
            />
            <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
            <span className="ms-3 text-sm font-medium text-zinc-700 group-hover:text-sky-700 transition-colors">Negotiation Mode</span>
            <div className="relative inline-flex items-center ml-1.5 group/popover">
              <Info size={14} className="text-zinc-400 cursor-help" />
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 hidden group-hover/popover:block z-[100]">
                <div className="bg-zinc-900 text-white text-[11px] leading-relaxed rounded-lg px-3 py-2 w-56 shadow-lg">
                  When enabled, editing discount or rate fields creates a new revision. Original values are preserved in the revision history for comparison.
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-zinc-900"></div>
                </div>
              </div>
            </div>
          </label>
          {(formData.revision_history?.length > 0) && (
            <button
              type="button"
              className="text-xs font-medium text-blue-600 hover:text-blue-800 underline ml-2"
              onClick={() => setRevisionDialogOpen(true)}
            >
              View History ({formData.revision_history?.length})
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsParserOpen(true)}
            className="h-9 px-3 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
          >
            <FileText className="w-4 h-4 mr-1.5" />
            Import PDF/Image
          </button>
          <select
            value={formData.status || 'Draft'}
            onChange={(e) => setFormData((prev: any) => ({ ...prev, status: e.target.value }))}
            className="h-9 px-2 text-xs font-semibold border border-zinc-300 bg-white text-zinc-700 focus:border-blue-500 focus:outline-none min-w-[100px]"
            title="Quotation status"
          >
            <option value="Draft">Draft</option>
            <option value="Sent">Sent to Client</option>
          </select>
          <button
            type="button"
            className="h-9 px-10 min-w-[100px] rounded flex items-center justify-center text-xs font-bold text-zinc-600 hover:text-zinc-900 transition-all"
            onClick={() => navigate('/quotation')}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`h-9 px-10 min-w-[100px] rounded flex items-center justify-center text-xs font-bold text-zinc-600 hover:text-zinc-900 transition-all ${
              saving ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            onClick={() => handleSave(true)}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save as Draft'}
          </button>
          <button
            type="button"
            style={{
              height: '36px', padding: '0 40px', minWidth: '100px',
              background: '#185FA5', border: '1px solid #185FA5',
              color: '#fff', borderRadius: '6px',
              fontSize: '12px', fontWeight: 500,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
              transition: 'all 0.15s'
            }}
            onClick={() => handleSave(false)}
            disabled={saving}
            onMouseEnter={e => { if (!saving) { e.currentTarget.style.background = '#0C447C'; e.currentTarget.style.borderColor = '#0C447C'; }}}
            onMouseLeave={e => { e.currentTarget.style.background = '#185FA5'; e.currentTarget.style.borderColor = '#185FA5'; }}
          >
            {saving
              ? 'Saving...'
              : editId
                ? formData.status === 'Sent' ? 'Update & Submit' : 'Update Quotation'
                : formData.status === 'Sent' ? 'Submit to Client' : 'Confirm & Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
