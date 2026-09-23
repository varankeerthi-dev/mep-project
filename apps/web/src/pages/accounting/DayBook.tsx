import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, Filter, Download, Plus, MoreHorizontal, CheckCircle2, AlertCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useDayBook, useCreateJournalEntry, useChartOfAccounts } from './useAccounting';

type VoucherType = 'Sales' | 'Purchase' | 'Receipt' | 'Payment' | 'Journal' | 'Contra' | 'Credit Note' | 'Debit Note';

interface JournalLineForm {
  account_id: string;
  debit: number;
  credit: number;
  party_type: '' | 'customer' | 'vendor';
  party_id: string;
  narration: string;
}

export const DayBook: React.FC = () => {
  const { organisation } = useAuth();
  const { data: entries = [], isLoading } = useDayBook();
  const createEntry = useCreateJournalEntry();
  const { data: accounts = [] } = useChartOfAccounts();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'All' | 'Receipt' | 'Payment' | 'Journal'>('All');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    voucher_date: string;
    voucher_type: string;
    narration: string;
    lines: JournalLineForm[];
  }>({
    voucher_date: new Date().toISOString().split('T')[0],
    voucher_type: 'Journal',
    narration: '',
    lines: [
      { account_id: '', debit: 0, credit: 0, party_type: '', party_id: '', narration: '' },
      { account_id: '', debit: 0, credit: 0, party_type: '', party_id: '', narration: '' }
    ]
  });

  // Fetch clients for party selection
  const { data: clients = [] } = useQuery({
    queryKey: ['daybook-clients', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_name')
        .eq('organisation_id', organisation.id)
        .order('client_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id
  });

  // Fetch vendors for party selection
  const { data: vendors = [] } = useQuery({
    queryKey: ['daybook-vendors', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('purchase_vendors')
        .select('id, name')
        .eq('organisation_id', organisation.id)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id
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

  // Real-time double-entry calculations
  const totalDebit = useMemo(() => {
    return formData.lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  }, [formData.lines]);

  const totalCredit = useMemo(() => {
    return formData.lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  }, [formData.lines]);

  const diff = useMemo(() => {
    return Math.abs(Math.round((totalDebit - totalCredit) * 100) / 100);
  }, [totalDebit, totalCredit]);

  const isBalanced = useMemo(() => {
    return diff < 0.01 && totalDebit > 0;
  }, [diff, totalDebit]);

  const handleCreate = async () => {
    setErrorMessage(null);
    const validLines = formData.lines
      .filter(l => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0))
      .map(l => ({
        account_id: l.account_id,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        party_type: l.party_type ? l.party_type : null,
        party_id: l.party_id ? l.party_id : null,
        narration: l.narration || formData.narration || ''
      }));

    if (validLines.length < 2) {
      setErrorMessage('A minimum of 2 line items are required.');
      return;
    }

    if (!isBalanced) {
      setErrorMessage(`Voucher is not balanced. Difference: ₹${diff.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
      return;
    }

    try {
      await createEntry.mutateAsync({
        voucher_date: formData.voucher_date,
        voucher_type: formData.voucher_type,
        narration: formData.narration,
        lines: validLines
      });
      setIsModalOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to post journal entry.');
    }
  };

  const getTypeStyles = (type: string) => {
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

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter((e: any) => {
      const matchesSearch = searchTerm.trim() === '' ||
        e.voucherNo?.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        e.partyName?.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        e.narration?.toLowerCase().includes(searchTerm.toLowerCase().trim());
      
      const matchesFilter = selectedFilter === 'All' || e.type?.toLowerCase() === selectedFilter.toLowerCase();

      return matchesSearch && matchesFilter;
    });
  }, [entries, searchTerm, selectedFilter]);

  const dayTotalDebit = useMemo(() => {
    return filteredEntries.reduce((sum: number, e: any) => sum + (e.debit || 0), 0);
  }, [filteredEntries]);

  const dayTotalCredit = useMemo(() => {
    return filteredEntries.reduce((sum: number, e: any) => sum + (e.credit || 0), 0);
  }, [filteredEntries]);

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
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="h-[32px] w-[180px] pl-[28px] pr-[10px] py-[5px] rounded-[8px] border text-[13px] border-gray-200 focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
          <button 
            onClick={() => {
              setFormData({
                voucher_date: new Date().toISOString().split('T')[0],
                voucher_type: 'Journal',
                narration: '',
                lines: [
                  { account_id: '', debit: 0, credit: 0, party_type: '', party_id: '', narration: '' },
                  { account_id: '', debit: 0, credit: 0, party_type: '', party_id: '', narration: '' }
                ]
              });
              setErrorMessage(null);
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
          {(['All', 'Receipt', 'Payment', 'Journal'] as const).map(type => (
            <span
              key={type}
              onClick={() => setSelectedFilter(type)}
              className={`h-[28px] px-[12px] py-[4px] rounded-[20px] border text-[12px] font-medium flex items-center cursor-pointer transition-colors ${
                selectedFilter === type
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {type === 'All' ? 'All Types' : `${type}s`}
            </span>
          ))}
        </div>
      </div>

      {/* Table Header - 32px */}
      <div className="flex items-center px-6 py-[7px] border-b border-[0.5px] bg-secondary/30 text-[11px] font-medium text-gray-500 uppercase tracking-[0.04em]">
        <div className="w-[64px] px-[12px]">Time</div>
        <div className="w-[140px] px-[12px]">Voucher No.</div>
        <div className="w-[96px] px-[12px] text-center">Type</div>
        <div className="flex-1 px-[12px]">Party / Account</div>
        <div className="w-[120px] px-[12px] text-left">Debit (₹)</div>
        <div className="w-[120px] px-[12px] text-left">Credit (₹)</div>
        <div className="w-[64px] px-[12px] text-center">Status</div>
      </div>

      {/* Data Rows */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-6 text-center text-gray-500 text-[13px]">Loading vouchers...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-[13px]">
            {searchTerm || selectedFilter !== 'All' ? 'No vouchers match your filter.' : 'No vouchers found. Click "New Entry" to create a voucher.'}
          </div>
        ) : (
          filteredEntries.map((entry: any) => (
            <div key={entry.id} className="flex items-center px-6 py-[10px] border-b border-[0.5px] hover:bg-gray-50 transition-colors h-[56px] group cursor-pointer">
              <div className="w-[64px] px-[12px] text-[12px] text-gray-500">{entry.time}</div>
              <div className="w-[140px] px-[12px] text-[12px] font-mono text-gray-500">{entry.voucherNo}</div>
              <div className="w-[96px] px-[12px] flex justify-center">
                <span className={`px-[10px] py-[2px] rounded-[20px] text-[11px] font-medium ${getTypeStyles(entry.type)}`}>
                  {entry.type}
                </span>
              </div>
              <div className="flex-1 px-[12px] flex flex-col justify-center">
                <span className="text-[13px] font-medium text-gray-900">{entry.partyName}</span>
                <span className="text-[12px] text-gray-500 mt-[2px] truncate">{entry.narration}</span>
              </div>
              <div className="w-[120px] px-[12px] text-[13px] text-red-600 text-left tabular-nums font-medium">
                {entry.debit ? `₹${entry.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
              </div>
              <div className="w-[120px] px-[12px] text-[13px] text-emerald-600 text-left tabular-nums font-medium">
                {entry.credit ? `₹${entry.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
              </div>
              <div className="w-[64px] px-[12px] flex items-center justify-center">
                <span className="text-[11px] text-gray-500">{entry.status}</span>
              </div>
            </div>
          ))
        )}

        {/* Day Total Row */}
        {filteredEntries.length > 0 && (
          <div className="flex items-center px-6 py-[8px] border-b border-[0.5px] bg-gray-50 font-medium">
            <div className="w-[64px] px-[12px]" />
            <div className="w-[140px] px-[12px]" />
            <div className="w-[96px] px-[12px]" />
            <div className="flex-1 px-[12px] text-right text-[12px] text-gray-500">Day Total:</div>
            <div className="w-[120px] px-[12px] text-[13px] text-red-600 text-left tabular-nums font-semibold">
              ₹{dayTotalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="w-[120px] px-[12px] text-[13px] text-emerald-600 text-left tabular-nums font-semibold">
              ₹{dayTotalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="w-[64px] px-[12px]" />
          </div>
        )}
      </div>

      {/* New Voucher Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Journal Entry"
        size="lg"
      >
        <div className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

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
              placeholder="e.g. Month-end adjustment, customer invoice settlement"
              className="w-full border rounded p-2 text-sm"
              value={formData.narration}
              onChange={e => setFormData(f => ({ ...f, narration: e.target.value }))}
            />
          </div>

          <div className="pt-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Entry Lines (Double-Entry)</label>
            <div className="space-y-2">
              {formData.lines.map((line, index) => (
                <div key={index} className="p-2 border rounded-lg bg-gray-50/50 space-y-2">
                  <div className="flex gap-2 items-center">
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
                      placeholder="Debit (₹)"
                      className="w-28 border rounded p-2 text-sm"
                      value={line.debit || ''}
                      onChange={e => {
                        const newLines = [...formData.lines];
                        newLines[index].debit = parseFloat(e.target.value) || 0;
                        setFormData({ ...formData, lines: newLines });
                      }}
                    />

                    <input
                      type="number"
                      placeholder="Credit (₹)"
                      className="w-28 border rounded p-2 text-sm"
                      value={line.credit || ''}
                      onChange={e => {
                        const newLines = [...formData.lines];
                        newLines[index].credit = parseFloat(e.target.value) || 0;
                        setFormData({ ...formData, lines: newLines });
                      }}
                    />

                    {formData.lines.length > 2 && (
                      <button 
                        onClick={() => {
                          const newLines = formData.lines.filter((_, i) => i !== index);
                          setFormData({ ...formData, lines: newLines });
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded"
                        title="Remove line"
                      >
                        &times;
                      </button>
                    )}
                  </div>

                  {/* Party Tagging Row */}
                  <div className="flex gap-2 items-center text-xs">
                    <span className="text-gray-500 font-medium">Party Subledger:</span>
                    <select
                      className="border rounded px-2 py-1 bg-white text-xs"
                      value={line.party_type}
                      onChange={e => {
                        const newLines = [...formData.lines];
                        newLines[index].party_type = e.target.value as any;
                        newLines[index].party_id = '';
                        setFormData({ ...formData, lines: newLines });
                      }}
                    >
                      <option value="">None</option>
                      <option value="customer">Customer</option>
                      <option value="vendor">Vendor</option>
                    </select>

                    {line.party_type === 'customer' && (
                      <select
                        className="flex-1 border rounded px-2 py-1 bg-white text-xs"
                        value={line.party_id}
                        onChange={e => {
                          const newLines = [...formData.lines];
                          newLines[index].party_id = e.target.value;
                          setFormData({ ...formData, lines: newLines });
                        }}
                      >
                        <option value="">Select Customer...</option>
                        {clients.map((c: any) => (
                          <option key={c.id} value={c.id}>{c.client_name}</option>
                        ))}
                      </select>
                    )}

                    {line.party_type === 'vendor' && (
                      <select
                        className="flex-1 border rounded px-2 py-1 bg-white text-xs"
                        value={line.party_id}
                        onChange={e => {
                          const newLines = [...formData.lines];
                          newLines[index].party_id = e.target.value;
                          setFormData({ ...formData, lines: newLines });
                        }}
                      >
                        <option value="">Select Vendor...</option>
                        {vendors.map((v: any) => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-2 flex items-center justify-between">
              <button 
                onClick={() => setFormData(f => ({ ...f, lines: [...f.lines, { account_id: '', debit: 0, credit: 0, party_type: '', party_id: '', narration: '' }] }))}
                className="text-xs text-blue-600 font-medium hover:underline"
              >
                + Add Line
              </button>
            </div>
          </div>

          {/* Live Double-Entry Balance Verification Banner */}
          <div className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
            isBalanced 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : totalDebit === 0 
                ? 'bg-gray-50 border-gray-200 text-gray-600'
                : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <div className="flex gap-4 font-mono font-medium">
              <span>Total Dr: ₹{totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              <span>Total Cr: ₹{totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div>
              {isBalanced ? (
                <span className="font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 inline" /> Balanced
                </span>
              ) : totalDebit === 0 ? (
                <span>Enter debit & credit amounts</span>
              ) : (
                <span className="font-semibold text-red-600">
                  Imbalance: ₹{diff.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t">
            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded text-sm font-medium">Cancel</button>
            <button 
              onClick={handleCreate}
              disabled={createEntry.isPending || !isBalanced}
              className="px-4 py-2 bg-black text-white rounded text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {createEntry.isPending ? 'Posting...' : 'Post Entry'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DayBook;
