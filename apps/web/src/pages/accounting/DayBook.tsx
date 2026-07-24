import React, { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, Filter, Download, Plus, MoreHorizontal } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Card } from '@/components/ui/Card';

// Types based on the PRD
type VoucherType = 'Sales' | 'Purchase' | 'Receipt' | 'Payment' | 'Journal' | 'Contra' | 'Credit Note' | 'Debit Note';

interface JournalEntry {
  id: string;
  time: string;
  voucherNo: string;
  type: VoucherType;
  partyName: string;
  narration: string;
  debit: number | null;
  credit: number | null;
  status: 'Posted' | 'Draft';
}

import { useDayBook, useCreateJournalEntry, useChartOfAccounts } from './useAccounting';

export const DayBook: React.FC = () => {
  const { data: entries = [], isLoading } = useDayBook();
  const createEntry = useCreateJournalEntry();
  const { data: accounts = [] } = useChartOfAccounts();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    voucher_date: new Date().toISOString().split('T')[0],
    voucher_type: 'Journal',
    narration: '',
    lines: [
      { account_id: '', debit: 0, credit: 0, narration: '' },
      { account_id: '', debit: 0, credit: 0, narration: '' }
    ]
  });

  const flattenAccounts = (nodes: any[]): any[] => {
    let result: any[] = [];
    nodes.forEach(node => {
      if (node.type === 'Ledger') {
        result.push(node);
      }
      if (node.children) {
        result = result.concat(flattenAccounts(node.children));
      }
    });
    return result;
  };
  const ledgerOptions = flattenAccounts(accounts);

  const handleCreate = async () => {
    // Filter out empty lines
    const validLines = formData.lines.filter(l => l.account_id && (l.debit > 0 || l.credit > 0));
    await createEntry.mutateAsync({
      ...formData,
      lines: validLines
    });
    setIsModalOpen(false);
  };

  const getTypeStyles = (type: VoucherType) => {
    switch (type) {
      case 'Sales': return 'bg-[#E1F5EE] text-[#085041]';
      case 'Purchase': return 'bg-[#FAEEDA] text-[#633806]';
      case 'Receipt': return 'bg-[#E6F1FB] text-[#0C447C]';
      case 'Payment': return 'bg-[#FCEBEB] text-[#791F1F]';
      case 'Contra': return 'bg-[#EEEDFE] text-[#3C3489]';
      case 'Journal': return 'bg-[#F1EFE8] text-[#444441]';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Top Bar - 52px */}
      <div className="flex items-center justify-between px-6 py-[14px] border-b border-[0.5px]">
        <h1 className="text-[16px] font-medium text-primary">Day Book</h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-[14px] h-[14px] absolute left-[8px] top-1/2 -translate-y-1/2 text-tertiary" />
            <input 
              type="text" 
              placeholder="Search vouchers..." 
              className="h-[32px] w-[180px] pl-[28px] pr-[10px] py-[5px] rounded-[8px] border text-[13px] border-gray-200"
            />
          </div>
            <button className="h-[32px] px-[14px] py-[6px] bg-white border text-gray-700 rounded-[8px] text-[13px] font-medium flex items-center gap-[6px]">
              <Download className="w-4 h-4" /> Export
            </button>
            <button 
              onClick={() => {
                setFormData({
                  voucher_date: new Date().toISOString().split('T')[0],
                  voucher_type: 'Journal',
                  narration: '',
                  lines: [
                    { account_id: '', debit: 0, credit: 0, narration: '' },
                    { account_id: '', debit: 0, credit: 0, narration: '' }
                  ]
                });
                setIsModalOpen(true);
              }}
              className="h-[32px] px-[14px] py-[6px] bg-black text-white rounded-[8px] text-[13px] font-medium flex items-center gap-[6px]"
            >
              <Plus className="w-4 h-4" /> New Entry
            </button>
        </div>
      </div>

      {/* Filter Bar - 44px */}
      <div className="flex items-center px-6 py-[10px] border-b border-[0.5px] bg-secondary/30">
        <div className="flex gap-2">
          <span className="h-[28px] px-[12px] py-[4px] rounded-[20px] bg-white border border-gray-300 text-[12px] font-medium flex items-center cursor-pointer">
            All Types
          </span>
          <span className="h-[28px] px-[12px] py-[4px] rounded-[20px] bg-white border border-gray-200 text-[12px] text-gray-500 flex items-center cursor-pointer hover:border-gray-300">
            Receipts
          </span>
          <span className="h-[28px] px-[12px] py-[4px] rounded-[20px] bg-white border border-gray-200 text-[12px] text-gray-500 flex items-center cursor-pointer hover:border-gray-300">
            Payments
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button className="h-[28px] px-[8px] border rounded-[8px] flex items-center justify-center hover:bg-gray-50">
            <ChevronLeft className="w-[14px] h-[14px]" />
          </button>
          <span className="text-[13px] font-medium min-w-[120px] text-center">17 Jun 2026</span>
          <button className="h-[28px] px-[8px] border rounded-[8px] flex items-center justify-center hover:bg-gray-50">
            <ChevronRight className="w-[14px] h-[14px]" />
          </button>
        </div>
      </div>

      {/* Table Header - 32px */}
      <div className="flex items-center px-6 py-[7px] border-b border-[0.5px] bg-secondary/30 text-[11px] font-medium text-gray-500 uppercase tracking-[0.04em]">
        <div className="w-[64px] px-[12px]">Time</div>
        <div className="w-[130px] px-[12px]">Voucher No.</div>
        <div className="w-[96px] px-[12px] text-center">Type</div>
        <div className="flex-1 px-[12px]">Party / Account</div>
        <div className="w-[100px] px-[12px] text-right">Debit (₹)</div>
        <div className="w-[100px] px-[12px] text-right">Credit (₹)</div>
        <div className="w-[64px] px-[12px] text-center">Status</div>
      </div>

      {/* Data Rows */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-6 text-center text-gray-500 text-[13px]">Loading vouchers...</div>
        ) : entries.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-[13px]">No vouchers found for this day.</div>
        ) : (
          entries.map((entry: any) => (
            <div key={entry.id} className="flex items-center px-6 py-[10px] border-b border-[0.5px] hover:bg-gray-50 transition-colors h-[56px] group cursor-pointer">
              <div className="w-[64px] px-[12px] text-[12px] text-gray-500">{entry.time}</div>
              <div className="w-[130px] px-[12px] text-[12px] font-mono text-gray-500">{entry.voucherNo}</div>
              <div className="w-[96px] px-[12px] flex justify-center">
                <span className={`px-[10px] py-[2px] rounded-[20px] text-[11px] font-medium ${getTypeStyles(entry.type)}`}>
                  {entry.type}
                </span>
              </div>
              <div className="flex-1 px-[12px] flex flex-col justify-center">
                <span className="text-[13px] font-medium text-gray-900">{entry.partyName}</span>
                <span className="text-[12px] text-gray-500 mt-[2px] truncate">{entry.narration}</span>
              </div>
              <div className="w-[100px] px-[12px] text-[13px] text-red-600 text-right tabular-nums">
                {entry.debit ? entry.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
              </div>
              <div className="w-[100px] px-[12px] text-[13px] text-emerald-600 text-right tabular-nums">
                {entry.credit ? entry.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
              </div>
              <div className="w-[64px] px-[12px] flex items-center justify-center">
                <MoreHorizontal className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          ))
        )}

        {/* Day Total Row - 32px */}
        <div className="flex items-center px-6 py-[6px] border-b border-[0.5px] bg-gray-50 font-medium">
          <div className="w-[64px] px-[12px]" />
          <div className="w-[130px] px-[12px]" />
          <div className="w-[96px] px-[12px]" />
          <div className="flex-1 px-[12px] text-right text-[12px] text-gray-500">Day Total:</div>
          <div className="w-[100px] px-[12px] text-[13px] text-red-600 text-right tabular-nums">
            50,000.00
          </div>
          <div className="w-[100px] px-[12px] text-[13px] text-emerald-600 text-right tabular-nums">
            25,000.00
          </div>
          <div className="w-[64px] px-[12px]" />
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Journal Entry"
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Voucher Date</label>
              <input 
                type="date" 
                className="w-full border rounded p-2 text-sm"
                value={formData.voucher_date}
                onChange={e => setFormData(f => ({ ...f, voucher_date: e.target.value }))}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Voucher Type</label>
              <select 
                className="w-full border rounded p-2 text-sm bg-white"
                value={formData.voucher_type}
                onChange={e => setFormData(f => ({ ...f, voucher_type: e.target.value }))}
              >
                <option value="Journal">Journal</option>
                <option value="Receipt">Receipt</option>
                <option value="Payment">Payment</option>
                <option value="Contra">Contra</option>
                <option value="Sales">Sales</option>
                <option value="Purchase">Purchase</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Narration (Global)</label>
            <input 
              type="text" 
              className="w-full border rounded p-2 text-sm"
              value={formData.narration}
              onChange={e => setFormData(f => ({ ...f, narration: e.target.value }))}
            />
          </div>

          <div className="pt-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Entry Lines</label>
            {formData.lines.map((line, index) => (
              <div key={index} className="flex gap-2 mb-2 items-center">
                <select
                  className="flex-1 border rounded p-2 text-sm bg-white"
                  value={line.account_id}
                  onChange={e => {
                    const newLines = [...formData.lines];
                    newLines[index].account_id = e.target.value;
                    setFormData({ ...formData, lines: newLines });
                  }}
                >
                  <option value="">Select Account...</option>
                  {ledgerOptions.map(l => (
                    <option key={l.id} value={l.id}>{l.code} - {l.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Debit"
                  className="w-24 border rounded p-2 text-sm"
                  value={line.debit || ''}
                  onChange={e => {
                    const newLines = [...formData.lines];
                    newLines[index].debit = parseFloat(e.target.value) || 0;
                    setFormData({ ...formData, lines: newLines });
                  }}
                />
                <input
                  type="number"
                  placeholder="Credit"
                  className="w-24 border rounded p-2 text-sm"
                  value={line.credit || ''}
                  onChange={e => {
                    const newLines = [...formData.lines];
                    newLines[index].credit = parseFloat(e.target.value) || 0;
                    setFormData({ ...formData, lines: newLines });
                  }}
                />
                <button 
                  onClick={() => {
                    const newLines = formData.lines.filter((_, i) => i !== index);
                    setFormData({ ...formData, lines: newLines });
                  }}
                  className="p-2 text-red-500 hover:bg-red-50 rounded"
                >
                  &times;
                </button>
              </div>
            ))}
            <button 
              onClick={() => setFormData(f => ({ ...f, lines: [...f.lines, { account_id: '', debit: 0, credit: 0, narration: '' }] }))}
              className="text-sm text-blue-600 font-medium"
            >
              + Add Line
            </button>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded text-sm font-medium">Cancel</button>
            <button 
              onClick={handleCreate}
              disabled={createEntry.isPending}
              className="px-4 py-2 bg-black text-white rounded text-sm font-medium disabled:opacity-50"
            >
              {createEntry.isPending ? 'Saving...' : 'Post Entry'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DayBook;
