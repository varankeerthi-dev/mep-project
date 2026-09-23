import React, { useState, useMemo } from 'react';
import { Search, Download, Calendar, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';

interface TrialBalanceRow {
  account_code: string;
  account_name: string;
  root_type: string;
  total_debit: number;
  total_credit: number;
  balance: number;
}

export const TrialBalance: React.FC = () => {
  const { organisation } = useAuth();
  const [asOfDate, setAsOfDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedRootType, setSelectedRootType] = useState<string>('All');

  const { data: rows = [], isLoading, error, refetch } = useQuery<TrialBalanceRow[]>({
    queryKey: ['trial-balance', organisation?.id, asOfDate],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase.rpc('get_trial_balance', {
        porganisationid: organisation.id,
        pasofdate: asOfDate
      });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        account_code: r.account_code,
        account_name: r.account_name,
        root_type: r.root_type,
        total_debit: Number(r.total_debit || 0),
        total_credit: Number(r.total_credit || 0),
        balance: Number(r.balance || 0),
      }));
    },
    enabled: !!organisation?.id
  });

  // Filter rows
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const matchesSearch = searchTerm.trim() === '' ||
        r.account_code?.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        r.account_name?.toLowerCase().includes(searchTerm.toLowerCase().trim());
      
      const matchesType = selectedRootType === 'All' || r.root_type === selectedRootType;

      return matchesSearch && matchesType;
    });
  }, [rows, searchTerm, selectedRootType]);

  // Overall Totals (from all rows for mathematical proof)
  const grandTotalDebit = useMemo(() => {
    return rows.reduce((sum, r) => sum + r.total_debit, 0);
  }, [rows]);

  const grandTotalCredit = useMemo(() => {
    return rows.reduce((sum, r) => sum + r.total_credit, 0);
  }, [rows]);

  const totalDifference = useMemo(() => {
    return Math.abs(Math.round((grandTotalDebit - grandTotalCredit) * 100) / 100);
  }, [grandTotalDebit, grandTotalCredit]);

  const isBalanced = useMemo(() => {
    return totalDifference < 0.01;
  }, [totalDifference]);

  // Group filtered rows by root_type
  const groupedRows = useMemo(() => {
    const groups: { [key: string]: TrialBalanceRow[] } = {};
    const rootOrder = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];

    // Initialize ordered groups
    rootOrder.forEach(t => { groups[t] = []; });

    filteredRows.forEach(row => {
      const type = row.root_type || 'Other';
      if (!groups[type]) groups[type] = [];
      groups[type].push(row);
    });

    return groups;
  }, [filteredRows]);

  const handleExportCSV = () => {
    if (!rows.length) return;
    const headers = ['Account Code', 'Account Name', 'Root Type', 'Debit (INR)', 'Credit (INR)', 'Closing Balance (INR)'];
    const csvRows = [
      headers.join(','),
      ...rows.map(r => [
        `"${r.account_code}"`,
        `"${r.account_name.replace(/"/g, '""')}"`,
        `"${r.root_type}"`,
        r.total_debit.toFixed(2),
        r.total_credit.toFixed(2),
        r.balance.toFixed(2)
      ].join(',')),
      `"","Grand Total","",${grandTotalDebit.toFixed(2)},${grandTotalCredit.toFixed(2)},${(grandTotalDebit - grandTotalCredit).toFixed(2)}`
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Trial_Balance_${asOfDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-[14px] border-b border-[0.5px]">
        <div>
          <h1 className="text-[16px] font-medium text-primary">Trial Balance</h1>
          <p className="text-[12px] text-gray-500">General ledger trial balance as of selected date</p>
        </div>

        <div className="flex items-center gap-3">
          {/* As Of Date Picker */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-[8px] px-2.5 py-1">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-[12px] text-gray-500 font-medium">As of:</span>
            <input 
              type="date" 
              value={asOfDate}
              onChange={e => setAsOfDate(e.target.value)}
              className="text-[13px] border-none p-0 focus:outline-none focus:ring-0 text-gray-800 font-medium"
            />
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-[14px] h-[14px] absolute left-[8px] top-1/2 -translate-y-1/2 text-tertiary" />
            <input 
              type="text" 
              placeholder="Search accounts..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="h-[32px] w-[200px] pl-[28px] pr-[10px] py-[5px] rounded-[8px] border text-[13px] border-gray-200 focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          <button 
            onClick={() => refetch()}
            className="h-[32px] px-[10px] bg-white border text-gray-700 rounded-[8px] text-[13px] font-medium flex items-center gap-[6px] hover:bg-gray-50"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button 
            onClick={handleExportCSV}
            disabled={rows.length === 0}
            className="h-[32px] px-[14px] py-[6px] bg-white border text-gray-700 rounded-[8px] text-[13px] font-medium flex items-center gap-[6px] hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary Verification Cards */}
      <div className="px-6 py-3 border-b border-[0.5px] bg-secondary/20 grid grid-cols-4 gap-4">
        <div className="bg-white p-3 rounded-lg border">
          <div className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">Total Debits</div>
          <div className="text-[16px] font-semibold text-gray-900 mt-0.5 text-left font-mono">
            ₹{grandTotalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-white p-3 rounded-lg border">
          <div className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">Total Credits</div>
          <div className="text-[16px] font-semibold text-gray-900 mt-0.5 text-left font-mono">
            ₹{grandTotalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-white p-3 rounded-lg border">
          <div className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">Difference</div>
          <div className={`text-[16px] font-semibold mt-0.5 text-left font-mono ${totalDifference > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            ₹{totalDifference.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-white p-3 rounded-lg border flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">Balance Status</div>
            <div className="text-[13px] font-semibold mt-1">
              {isBalanced ? (
                <span className="text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Balanced (Dr = Cr)
                </span>
              ) : (
                <span className="text-red-600 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> Imbalance Detected
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Root Type Filter Pills */}
      <div className="flex items-center gap-1.5 px-6 py-2 border-b border-[0.5px] bg-secondary/10">
        {['All', 'Asset', 'Liability', 'Equity', 'Income', 'Expense'].map(type => (
          <button
            key={type}
            onClick={() => setSelectedRootType(type)}
            className={`px-3 py-1 rounded-full text-[12px] font-medium transition-colors ${
              selectedRootType === type
                ? 'bg-black text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Table Header */}
      <div className="flex items-center px-6 py-[8px] border-b border-[0.5px] bg-secondary/30 text-[11px] font-medium text-gray-500 uppercase tracking-[0.04em]">
        <div className="w-[120px]">Account Code</div>
        <div className="flex-1">Account Name</div>
        <div className="w-[120px]">Root Type</div>
        <div className="w-[160px] text-left">Debit (₹)</div>
        <div className="w-[160px] text-left">Credit (₹)</div>
        <div className="w-[160px] text-left">Closing Balance (₹)</div>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-auto pb-10">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 text-[13px]">Calculating trial balance...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 text-[13px]">
            Error loading trial balance: {(error as any).message}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-[13px]">
            No account balances found for the selected date. Post a journal entry to populate the Trial Balance.
          </div>
        ) : (
          Object.entries(groupedRows).map(([groupName, groupItems]) => {
            if (groupItems.length === 0) return null;

            const groupDebit = groupItems.reduce((sum, item) => sum + item.total_debit, 0);
            const groupCredit = groupItems.reduce((sum, item) => sum + item.total_credit, 0);
            const groupBalance = groupItems.reduce((sum, item) => sum + item.balance, 0);

            return (
              <div key={groupName} className="border-b border-gray-100">
                {/* Group Header */}
                <div className="bg-gray-50/80 px-6 py-2 text-[12px] font-semibold text-gray-700 flex items-center justify-between">
                  <span>{groupName}s</span>
                  <span className="text-[11px] text-gray-400 font-normal">{groupItems.length} accounts</span>
                </div>

                {/* Group Rows */}
                {groupItems.map(row => (
                  <div 
                    key={row.account_code}
                    className="flex items-center px-6 py-2.5 border-b border-[0.5px] hover:bg-gray-50/50 text-[13px] transition-colors"
                  >
                    <div className="w-[120px] font-mono text-[12px] text-gray-500">{row.account_code}</div>
                    <div className="flex-1 font-medium text-gray-900">{row.account_name}</div>
                    <div className="w-[120px] text-gray-500 text-[12px]">{row.root_type}</div>
                    
                    {/* Amounts strictly left-aligned per monorepo rules */}
                    <div className="w-[160px] text-left tabular-nums font-mono text-gray-800">
                      {row.total_debit > 0
                        ? `₹${row.total_debit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '—'}
                    </div>
                    <div className="w-[160px] text-left tabular-nums font-mono text-gray-800">
                      {row.total_credit > 0
                        ? `₹${row.total_credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '—'}
                    </div>
                    <div className={`w-[160px] text-left tabular-nums font-mono font-medium ${row.balance < 0 ? 'text-amber-700' : 'text-gray-900'}`}>
                      ₹{row.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}

                {/* Group Subtotal */}
                <div className="flex items-center px-6 py-2 bg-gray-50/40 border-b text-[12px] font-semibold text-gray-600">
                  <div className="w-[120px]" />
                  <div className="flex-1">Subtotal {groupName}s:</div>
                  <div className="w-[120px]" />
                  <div className="w-[160px] text-left font-mono">
                    ₹{groupDebit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="w-[160px] text-left font-mono">
                    ₹{groupCredit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="w-[160px] text-left font-mono">
                    ₹{groupBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Grand Total Row */}
        {rows.length > 0 && (
          <div className="flex items-center px-6 py-3 bg-gray-100/80 border-t-2 border-b-2 border-gray-300 font-bold text-[13px] text-gray-900 sticky bottom-0">
            <div className="w-[120px]" />
            <div className="flex-1 uppercase tracking-wider text-[12px]">Grand Total:</div>
            <div className="w-[120px]" />
            <div className="w-[160px] text-left font-mono text-gray-900">
              ₹{grandTotalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="w-[160px] text-left font-mono text-gray-900">
              ₹{grandTotalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="w-[160px] text-left font-mono text-gray-900">
              ₹{(grandTotalDebit - grandTotalCredit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrialBalance;
