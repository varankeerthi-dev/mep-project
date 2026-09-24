import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Search, 
  Download, 
  Plus, 
  MoreHorizontal, 
  ChevronDown, 
  ArrowUpRight, 
  ArrowDownLeft, 
  FileText, 
  RefreshCw,
  TrendingUp,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import { supabase } from '../../supabase';
import { useAuth } from '../../App';
import { withSessionCheck } from '../../queryClient';
import { formatCurrency, formatDateTable } from '../../utils/formatters';

interface DashboardLedgerSplitProps {
  onNavigate?: (path: string) => void;
}

interface ReceivableItem {
  id: string;
  code: string;
  partyName: string;
  date: string;
  dueDate: string | null;
  amount: number;
  paidAmount: number;
  balanceAmount: number;
  status: 'paid' | 'pending' | 'overdue' | 'partial' | 'cancelled';
  rawStatus: string;
}

interface PayableItem {
  id: string;
  code: string;
  partyName: string;
  date: string;
  dueDate: string | null;
  amount: number;
  paidAmount: number;
  balanceAmount: number;
  status: 'paid' | 'pending' | 'overdue' | 'partial';
  rawStatus: string;
}

// Enterprise Inter-based styling palette
const typography = {
  fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  tabularNums: { fontVariantNumeric: 'tabular-nums' } as React.CSSProperties,
};

const colors = {
  background: '#F9FAFB',
  cards: '#FFFFFF',
  primaryText: '#0F172A',     // Slate-900: High-contrast primary
  bodyText: '#1E293B',        // Slate-800: Medium-high contrast body
  secondaryText: '#64748B',   // Slate-500: Subdued secondary
  mutedText: '#94A3B8',       // Slate-400: Tertiary / helper text
  border: '#ECECEC',
  divider: '#F3F4F6',
  headerBg: '#FFFFFF',
  success: '#15803D',         // Green-700: High accessibility green
  successBg: '#ECFDF3',
  warning: '#C2410C',         // Orange-700
  warningBg: '#FFF7ED',
  danger: '#B91C1C',          // Red-700
  dangerBg: '#FEF2F2',
  info: '#1D4ED8',            // Blue-700
  infoBg: '#EFF6FF',
};

export function DashboardLedgerSplit({ onNavigate }: DashboardLedgerSplitProps) {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'split' | 'receivables' | 'payables'>('split');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Realtime mutation listener: Automatically re-fetches ledger whenever an invoice or purchase bill is created, updated, or paid anywhere in the app
  useEffect(() => {
    if (!organisation?.id) return;

    const channel = supabase
      .channel(`ledger_realtime_sync_${organisation.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoices', filter: `organisation_id=eq.${organisation.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['invoices'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchase_bills', filter: `organisation_id=eq.${organisation.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['purchase-bills', organisation.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organisation?.id, queryClient]);

  // Receivables filters
  const [recSearch, setRecSearch] = useState('');
  const [recStatusFilter, setRecStatusFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');
  const [recTimeframe, setRecTimeframe] = useState<'all' | 'monthly' | 'quarterly'>('all');

  // Payables filters
  const [paySearch, setPaySearch] = useState('');
  const [payStatusFilter, setPayStatusFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');
  const [payTimeframe, setPayTimeframe] = useState<'all' | 'monthly' | 'quarterly'>('all');

  // Query Receivables (Invoices) - Interlocked with global ['invoices', 'list'] queryKey from invoices/hooks.ts
  const {
    data: receivablesData = [],
    isLoading: recLoading,
    refetch: refetchReceivables,
    isRefetching: recRefetching
  } = useQuery({
    queryKey: ['invoices', 'list', 'ledger', organisation?.id],
    queryFn: withSessionCheck(async (): Promise<ReceivableItem[]> => {
      if (!organisation?.id) return [];

      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_no,
          invoice_date,
          due_date,
          total,
          paid_amount,
          status,
          client:client_id (
            id,
            client_name,
            name
          )
        `)
        .eq('organisation_id', organisation.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching receivables:', error);
        return [];
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return (data || []).map((inv: any) => {
        const total = Number(inv.total || 0);
        const paid = Number(inv.paid_amount || 0);
        const balance = Math.max(0, total - paid);
        const rawStatus = (inv.status || 'draft').toLowerCase();

        let status: ReceivableItem['status'] = 'pending';
        if (rawStatus === 'paid' || balance <= 0) {
          status = 'paid';
        } else if (rawStatus === 'cancelled') {
          status = 'cancelled';
        } else if (paid > 0 && balance > 0) {
          status = 'partial';
        } else if (inv.due_date && new Date(inv.due_date) < today && balance > 0) {
          status = 'overdue';
        } else {
          status = 'pending';
        }

        const partyName = inv.client?.client_name || inv.client?.name || 'Unknown Client';

        return {
          id: inv.id,
          code: inv.invoice_no || `INV-${inv.id.slice(0, 8)}`,
          partyName,
          date: inv.invoice_date || inv.due_date || '',
          dueDate: inv.due_date,
          amount: total,
          paidAmount: paid,
          balanceAmount: balance,
          status,
          rawStatus: inv.status || 'Draft'
        };
      });
    }),
    enabled: !!organisation?.id,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Query Payables (Purchase Bills) - Interlocked with global ['purchase-bills', orgId] queryKey
  const {
    data: payablesData = [],
    isLoading: payLoading,
    refetch: refetchPayables,
    isRefetching: payRefetching
  } = useQuery({
    queryKey: ['purchase-bills', organisation?.id, 'ledger'],
    queryFn: withSessionCheck(async (): Promise<PayableItem[]> => {
      if (!organisation?.id) return [];

      const { data, error } = await supabase
        .from('purchase_bills')
        .select(`
          id,
          bill_number,
          bill_date,
          due_date,
          total_amount,
          paid_amount,
          balance_amount,
          payment_status,
          approval_status,
          vendor:purchase_vendors (
            id,
            company_name
          )
        `)
        .eq('organisation_id', organisation.id)
        .order('bill_date', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching payables:', error);
        return [];
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return (data || []).map((pb: any) => {
        const total = Number(pb.total_amount || 0);
        const paid = Number(pb.paid_amount || 0);
        const balance = pb.balance_amount !== null && pb.balance_amount !== undefined
          ? Number(pb.balance_amount)
          : Math.max(0, total - paid);
        const pStatus = (pb.payment_status || 'Unpaid').toLowerCase();

        let status: PayableItem['status'] = 'pending';
        if (pStatus === 'paid' || balance <= 0) {
          status = 'paid';
        } else if (pStatus.includes('part') || (paid > 0 && balance > 0)) {
          status = 'partial';
        } else if (pb.due_date && new Date(pb.due_date) < today && balance > 0) {
          status = 'overdue';
        } else {
          status = 'pending';
        }

        const partyName = pb.vendor?.company_name || 'Unknown Supplier';

        return {
          id: pb.id,
          code: pb.bill_number || `BILL-${pb.id.slice(0, 8)}`,
          partyName,
          date: pb.bill_date || pb.due_date || '',
          dueDate: pb.due_date,
          amount: total,
          paidAmount: paid,
          balanceAmount: balance,
          status,
          rawStatus: pb.payment_status || 'Unpaid'
        };
      });
    }),
    enabled: !!organisation?.id,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Filtered Receivables
  const filteredReceivables = useMemo(() => {
    return receivablesData.filter(item => {
      // Search
      const matchesSearch = 
        item.code.toLowerCase().includes(recSearch.toLowerCase()) ||
        item.partyName.toLowerCase().includes(recSearch.toLowerCase());
      if (!matchesSearch) return false;

      // Status
      if (recStatusFilter === 'pending' && !['pending', 'partial'].includes(item.status)) return false;
      if (recStatusFilter === 'paid' && item.status !== 'paid') return false;
      if (recStatusFilter === 'overdue' && item.status !== 'overdue') return false;

      // Timeframe
      if (recTimeframe !== 'all' && item.date) {
        const itemDate = new Date(item.date);
        const now = new Date();
        if (recTimeframe === 'monthly') {
          const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 30) return false;
        } else if (recTimeframe === 'quarterly') {
          const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 90) return false;
        }
      }

      return true;
    });
  }, [receivablesData, recSearch, recStatusFilter, recTimeframe]);

  // Filtered Payables
  const filteredPayables = useMemo(() => {
    return payablesData.filter(item => {
      // Search
      const matchesSearch = 
        item.code.toLowerCase().includes(paySearch.toLowerCase()) ||
        item.partyName.toLowerCase().includes(paySearch.toLowerCase());
      if (!matchesSearch) return false;

      // Status
      if (payStatusFilter === 'pending' && !['pending', 'partial'].includes(item.status)) return false;
      if (payStatusFilter === 'paid' && item.status !== 'paid') return false;
      if (payStatusFilter === 'overdue' && item.status !== 'overdue') return false;

      // Timeframe
      if (payTimeframe !== 'all' && item.date) {
        const itemDate = new Date(item.date);
        const now = new Date();
        if (payTimeframe === 'monthly') {
          const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 30) return false;
        } else if (payTimeframe === 'quarterly') {
          const diffDays = (now.getTime() - itemDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 90) return false;
        }
      }

      return true;
    });
  }, [payablesData, paySearch, payStatusFilter, payTimeframe]);

  // Aggregate Metrics
  const summaryMetrics = useMemo(() => {
    const totalReceivables = receivablesData.reduce((acc, curr) => acc + curr.balanceAmount, 0);
    const totalPayables = payablesData.reduce((acc, curr) => acc + curr.balanceAmount, 0);
    const netPosition = totalReceivables - totalPayables;
    const overdueRecCount = receivablesData.filter(r => r.status === 'overdue').length;
    const overduePayCount = payablesData.filter(p => p.status === 'overdue').length;

    return {
      totalReceivables,
      totalPayables,
      netPosition,
      overdueRecCount,
      overduePayCount
    };
  }, [receivablesData, payablesData]);

  // Copy code helper
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Export to CSV helper
  const handleExportCSV = (type: 'receivables' | 'payables') => {
    const isRec = type === 'receivables';
    const items = isRec ? filteredReceivables : filteredPayables;
    if (items.length === 0) return;

    const headers = ['Record Code', 'Party Name', 'Date', 'Due Date', 'Total Amount', 'Paid Amount', 'Balance Due', 'Status'];
    const rows = items.map(item => [
      `"${item.code}"`,
      `"${item.partyName.replace(/"/g, '""')}"`,
      item.date || '-',
      item.dueDate || '-',
      item.amount,
      item.paidAmount,
      item.balanceAmount,
      item.status
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${type}_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderStatusBadge = (status: 'paid' | 'pending' | 'overdue' | 'partial' | 'cancelled') => {
    switch (status) {
      case 'paid':
        return (
          <span style={{
            ...typography,
            height: '24px',
            borderRadius: '999px',
            paddingLeft: '10px',
            paddingRight: '10px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 600,
            backgroundColor: colors.successBg,
            color: colors.success
          }}>
            • Paid
          </span>
        );
      case 'overdue':
        return (
          <span style={{
            ...typography,
            height: '24px',
            borderRadius: '999px',
            paddingLeft: '10px',
            paddingRight: '10px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 600,
            backgroundColor: colors.dangerBg,
            color: colors.danger
          }}>
            • Overdue
          </span>
        );
      case 'partial':
        return (
          <span style={{
            ...typography,
            height: '24px',
            borderRadius: '999px',
            paddingLeft: '10px',
            paddingRight: '10px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 600,
            backgroundColor: colors.infoBg,
            color: colors.info
          }}>
            • Partial
          </span>
        );
      case 'cancelled':
        return (
          <span style={{
            ...typography,
            height: '24px',
            borderRadius: '999px',
            paddingLeft: '10px',
            paddingRight: '10px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 500,
            backgroundColor: '#F3F4F6',
            color: colors.secondaryText
          }}>
            • Cancelled
          </span>
        );
      case 'pending':
      default:
        return (
          <span style={{
            ...typography,
            height: '24px',
            borderRadius: '999px',
            paddingLeft: '10px',
            paddingRight: '10px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 600,
            backgroundColor: colors.warningBg,
            color: colors.warning
          }}>
            • Pending
          </span>
        );
    }
  };

  return (
    <div style={{ 
      ...typography,
      display: 'flex', 
      flexDirection: 'column', 
      gap: '20px', 
      width: '100%', 
      animation: 'staggerFadeIn 0.35s ease 0ms both' 
    }}>
      
      {/* --- Executive Working Capital Strip --- */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '16px'
      }}>
        {/* Receivables Card */}
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #ECECEC',
          borderRadius: '14px',
          padding: '18px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: colors.secondaryText }}>
              Total Outstanding Receivables
            </span>
            {/* Amount left-aligned per rule - Pure Inter font with tabular-nums */}
            <span style={{ 
              fontSize: '24px', 
              fontWeight: 700, 
              color: colors.success, 
              ...typography.tabularNums, 
              textAlign: 'left' 
            }}>
              {formatCurrency(summaryMetrics.totalReceivables)}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: colors.secondaryText }}>
              <span style={{ fontWeight: 500 }}>{receivablesData.length} active invoices</span>
              {summaryMetrics.overdueRecCount > 0 && (
                <span style={{ color: colors.danger, fontWeight: 600 }}>
                  ({summaryMetrics.overdueRecCount} overdue)
                </span>
              )}
            </div>
          </div>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            backgroundColor: '#ECFDF5',
            color: colors.success,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ArrowDownLeft size={22} />
          </div>
        </div>

        {/* Payables Card */}
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #ECECEC',
          borderRadius: '14px',
          padding: '18px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: colors.secondaryText }}>
              Total Outstanding Payables
            </span>
            {/* Amount left-aligned per rule - Pure Inter font with tabular-nums */}
            <span style={{ 
              fontSize: '24px', 
              fontWeight: 700, 
              color: colors.danger, 
              ...typography.tabularNums, 
              textAlign: 'left' 
            }}>
              {formatCurrency(summaryMetrics.totalPayables)}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: colors.secondaryText }}>
              <span style={{ fontWeight: 500 }}>{payablesData.length} active bills</span>
              {summaryMetrics.overduePayCount > 0 && (
                <span style={{ color: colors.danger, fontWeight: 600 }}>
                  ({summaryMetrics.overduePayCount} overdue)
                </span>
              )}
            </div>
          </div>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            backgroundColor: '#FEF2F2',
            color: colors.danger,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ArrowUpRight size={22} />
          </div>
        </div>

        {/* Net Cashflow Position Card */}
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #ECECEC',
          borderRadius: '14px',
          padding: '18px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: colors.secondaryText }}>
              Net Working Position
            </span>
            {/* Amount left-aligned per rule - Pure Inter font with tabular-nums */}
            <span style={{
              fontSize: '24px', 
              fontWeight: 700, 
              color: summaryMetrics.netPosition >= 0 ? colors.primaryText : colors.danger, 
              ...typography.tabularNums,
              textAlign: 'left'
            }}>
              {summaryMetrics.netPosition >= 0 ? '+' : ''}{formatCurrency(summaryMetrics.netPosition)}
            </span>
            <span style={{ fontSize: '12px', color: colors.secondaryText, fontWeight: 400 }}>
              {summaryMetrics.netPosition >= 0 ? 'Positive working capital' : 'Payable exposure deficit'}
            </span>
          </div>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            backgroundColor: '#F3F4F6',
            color: '#374151',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <TrendingUp size={22} />
          </div>
        </div>
      </div>

      {/* --- View Mode Switcher --- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{
          display: 'inline-flex',
          borderRadius: '8px',
          border: `1px solid ${colors.border}`,
          padding: '3px',
          backgroundColor: '#F3F4F6'
        }}>
          {(['split', 'receivables', 'payables'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                ...typography,
                height: '30px',
                paddingLeft: '14px',
                paddingRight: '14px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: viewMode === mode ? 600 : 500,
                backgroundColor: viewMode === mode ? '#FFFFFF' : 'transparent',
                color: viewMode === mode ? colors.primaryText : colors.secondaryText,
                border: 'none',
                cursor: 'pointer',
                boxShadow: viewMode === mode ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 150ms ease'
              }}
            >
              {mode === 'split' ? 'Split Screen' : mode === 'receivables' ? 'Receivables Only' : 'Payables Only'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => {
              refetchReceivables();
              refetchPayables();
            }}
            disabled={recRefetching || payRefetching}
            style={{
              ...typography,
              height: '34px',
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              backgroundColor: '#FFFFFF',
              paddingLeft: '12px',
              paddingRight: '12px',
              fontSize: '12px',
              fontWeight: 500,
              color: colors.primaryText,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            className="hover:bg-zinc-50"
          >
            <RefreshCw size={13} className={recRefetching || payRefetching ? 'animate-spin' : ''} />
            Refresh All
          </button>
        </div>
      </div>

      {/* --- Split Screen Tables Grid --- */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: viewMode === 'split' ? 'repeat(auto-fit, minmax(620px, 1fr))' : '1fr',
        gap: '24px',
        alignItems: 'start'
      }}>

        {/* ================= RECEIVABLES TABLE ================= */}
        {(viewMode === 'split' || viewMode === 'receivables') && (
          <div style={{
            backgroundColor: colors.cards,
            border: `1px solid ${colors.border}`,
            borderRadius: '14px',
            padding: '20px',
            boxShadow: 'none',
            overflow: 'hidden'
          }}>
            {/* Table Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottom: `1px solid ${colors.divider}`,
              paddingBottom: '18px',
              marginBottom: '18px'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: colors.primaryText, margin: 0 }}>
                    Operational Receivables Ledger
                  </h3>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    backgroundColor: '#ECFDF5',
                    color: colors.success
                  }}>
                    Invoices
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: colors.secondaryText, margin: 0, fontWeight: 400 }}>
                  Client billing schedules, outstanding balances & collection dues.
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <select 
                    value={recStatusFilter}
                    onChange={(e) => setRecStatusFilter(e.target.value as any)}
                    style={{
                      ...typography,
                      height: '34px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      backgroundColor: '#FFFFFF',
                      paddingLeft: '12px',
                      paddingRight: '28px',
                      fontSize: '13px',
                      color: colors.primaryText,
                      outline: 'none',
                      cursor: 'pointer',
                      appearance: 'none',
                      fontWeight: 500
                    }}
                  >
                    <option value="all">Status: All</option>
                    <option value="pending">Pending/Unpaid</option>
                    <option value="overdue">Overdue</option>
                    <option value="paid">Paid</option>
                  </select>
                  <ChevronDown size={14} style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: colors.secondaryText,
                    pointerEvents: 'none'
                  }} />
                </div>
              </div>
            </div>

            {/* Table Toolbar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '18px'
            }}>
              <div style={{ position: 'relative', width: '220px' }}>
                <Search size={16} style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: colors.secondaryText
                }} />
                <input 
                  type="text" 
                  placeholder="Search invoice or client..." 
                  value={recSearch}
                  onChange={(e) => setRecSearch(e.target.value)}
                  style={{
                    ...typography,
                    height: '38px',
                    width: '100%',
                    borderRadius: '10px',
                    border: '1px solid #E5E7EB',
                    paddingLeft: '36px',
                    paddingRight: '14px',
                    fontSize: '13px',
                    backgroundColor: '#FFFFFF',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ 
                  display: 'flex', 
                  borderRadius: '8px', 
                  border: `1px solid ${colors.border}`,
                  padding: '2px',
                  backgroundColor: '#F3F4F6'
                }}>
                  {(['all', 'monthly', 'quarterly'] as const).map(tf => (
                    <button
                      key={tf}
                      onClick={() => setRecTimeframe(tf)}
                      style={{
                        ...typography,
                        height: '28px',
                        paddingLeft: '10px',
                        paddingRight: '10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: recTimeframe === tf ? 600 : 500,
                        backgroundColor: recTimeframe === tf ? '#FFFFFF' : 'transparent',
                        color: recTimeframe === tf ? colors.primaryText : colors.secondaryText,
                        border: 'none',
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                        boxShadow: recTimeframe === tf ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                      }}
                    >
                      {tf}
                    </button>
                  ))}
                </div>

                <button 
                  onClick={() => handleExportCSV('receivables')}
                  style={{
                    ...typography,
                    height: '38px',
                    borderRadius: '10px',
                    border: '1px solid #E5E7EB',
                    backgroundColor: '#FFFFFF',
                    paddingLeft: '12px',
                    paddingRight: '12px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: colors.primaryText,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxSizing: 'border-box'
                  }} 
                  className="hover:bg-zinc-50 transition-colors"
                >
                  <Download size={14} /> Export
                </button>

                {onNavigate && (
                  <button 
                    onClick={() => onNavigate('/invoices')}
                    style={{
                      ...typography,
                      height: '38px',
                      borderRadius: '10px',
                      backgroundColor: '#0F172A',
                      color: '#FFFFFF',
                      border: 'none',
                      paddingLeft: '14px',
                      paddingRight: '14px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxSizing: 'border-box'
                    }} 
                    className="hover:bg-zinc-800 transition-colors"
                  >
                    <Plus size={14} /> Invoices
                  </button>
                )}
              </div>
            </div>

            {/* Table Container */}
            <div style={{ 
              overflowX: 'auto', 
              border: `1px solid ${colors.border}`, 
              borderRadius: '10px' 
            }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse', 
                backgroundColor: '#FFFFFF' 
              }}>
                <thead>
                  <tr style={{ height: '46px', borderBottom: `1.5px solid ${colors.divider}` }}>
                    <th style={{ paddingLeft: '16px', paddingRight: '16px', fontSize: '12px', fontWeight: 600, color: colors.secondaryText, textAlign: 'left', backgroundColor: '#FFFFFF', letterSpacing: '0.02em' }}>INVOICE REF</th>
                    <th style={{ paddingLeft: '16px', paddingRight: '16px', fontSize: '12px', fontWeight: 600, color: colors.secondaryText, textAlign: 'left', backgroundColor: '#FFFFFF', letterSpacing: '0.02em' }}>CLIENT</th>
                    <th style={{ paddingLeft: '16px', paddingRight: '16px', fontSize: '12px', fontWeight: 600, color: colors.secondaryText, textAlign: 'left', backgroundColor: '#FFFFFF', letterSpacing: '0.02em' }}>DATE</th>
                    {/* MONETARY COLUMN ALWAYS LEFT ALIGNED per rule 2 */}
                    <th style={{ paddingLeft: '16px', paddingRight: '16px', fontSize: '12px', fontWeight: 600, color: colors.secondaryText, textAlign: 'left', backgroundColor: '#FFFFFF', letterSpacing: '0.02em' }}>BALANCE / TOTAL</th>
                    <th style={{ paddingLeft: '16px', paddingRight: '16px', fontSize: '12px', fontWeight: 600, color: colors.secondaryText, textAlign: 'center', backgroundColor: '#FFFFFF', letterSpacing: '0.02em' }}>STATUS</th>
                    <th style={{ paddingLeft: '16px', paddingRight: '16px', fontSize: '12px', fontWeight: 600, color: colors.secondaryText, textAlign: 'right', backgroundColor: '#FFFFFF' }}></th>
                  </tr>
                </thead>
                
                <tbody>
                  {recLoading ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: colors.secondaryText, fontSize: '13px', fontWeight: 500 }}>
                        Loading receivables ledger...
                      </td>
                    </tr>
                  ) : filteredReceivables.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '40px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <FileText size={32} style={{ color: '#D1D5DB' }} />
                          <span style={{ fontSize: '14px', fontWeight: 600, color: colors.primaryText }}>No invoices found</span>
                          <span style={{ fontSize: '12px', color: colors.secondaryText }}>Try adjusting your search or status filter</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredReceivables.map((row) => (
                      <tr 
                        key={row.id} 
                        style={{ height: '54px', borderBottom: `1px solid ${colors.divider}` }}
                        className="hover:bg-zinc-50/70 transition-colors"
                      >
                        {/* Invoice Ref: Inter, Semi-Bold, Deep slate, tabular nums */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600, color: colors.primaryText, textAlign: 'left', ...typography.tabularNums }}>
                          <span 
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleCopy(row.id, row.code)}
                            title="Click to copy invoice number"
                            className="hover:underline flex items-center gap-1.5"
                          >
                            {row.code}
                            {copiedId === row.id ? <Check size={12} className="text-emerald-600" /> : null}
                          </span>
                        </td>
                        {/* Client: Inter, Medium, Dark slate */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 500, color: colors.bodyText, textAlign: 'left', maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.partyName}>
                          {row.partyName}
                        </td>
                        {/* Date: Inter, Regular, Cool gray */}
                        <td style={{ padding: '14px 16px', fontSize: '12px', fontWeight: 400, color: colors.secondaryText, textAlign: 'left', ...typography.tabularNums }}>
                          {formatDateTable(row.date)}
                        </td>
                        {/* Balance / Total: Left-aligned per rule - Inter, Bold for balance, regular muted for total */}
                        <td style={{ padding: '14px 16px', textAlign: 'left', ...typography.tabularNums }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: colors.primaryText }}>
                            {formatCurrency(row.balanceAmount)}
                          </div>
                          {row.balanceAmount !== row.amount && (
                            <div style={{ fontSize: '11px', color: colors.mutedText, fontWeight: 400 }}>
                              of {formatCurrency(row.amount)}
                            </div>
                          )}
                        </td>
                        {/* Status badge */}
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          {renderStatusBadge(row.status)}
                        </td>
                        {/* Action buttons */}
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <button 
                            onClick={() => onNavigate?.(`/invoices`)}
                            style={{ 
                              border: 'none', 
                              backgroundColor: 'transparent', 
                              cursor: 'pointer', 
                              color: colors.secondaryText,
                              padding: '5px',
                              borderRadius: '6px'
                            }} 
                            className="hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                            title="View Invoice in Module"
                          >
                            <ExternalLink size={15} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= PAYABLES TABLE ================= */}
        {(viewMode === 'split' || viewMode === 'payables') && (
          <div style={{
            backgroundColor: colors.cards,
            border: `1px solid ${colors.border}`,
            borderRadius: '14px',
            padding: '20px',
            boxShadow: 'none',
            overflow: 'hidden'
          }}>
            {/* Table Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottom: `1px solid ${colors.divider}`,
              paddingBottom: '18px',
              marginBottom: '18px'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: colors.primaryText, margin: 0 }}>
                    Operational Payables Ledger
                  </h3>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    backgroundColor: '#FEF2F2',
                    color: colors.danger
                  }}>
                    Purchase Bills
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: colors.secondaryText, margin: 0, fontWeight: 400 }}>
                  Supplier procurement bills, vendor payment schedules & disbursements.
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <select 
                    value={payStatusFilter}
                    onChange={(e) => setPayStatusFilter(e.target.value as any)}
                    style={{
                      ...typography,
                      height: '34px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      backgroundColor: '#FFFFFF',
                      paddingLeft: '12px',
                      paddingRight: '28px',
                      fontSize: '13px',
                      color: colors.primaryText,
                      outline: 'none',
                      cursor: 'pointer',
                      appearance: 'none',
                      fontWeight: 500
                    }}
                  >
                    <option value="all">Status: All</option>
                    <option value="pending">Pending/Unpaid</option>
                    <option value="overdue">Overdue</option>
                    <option value="paid">Paid</option>
                  </select>
                  <ChevronDown size={14} style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: colors.secondaryText,
                    pointerEvents: 'none'
                  }} />
                </div>
              </div>
            </div>

            {/* Table Toolbar */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '18px'
            }}>
              <div style={{ position: 'relative', width: '220px' }}>
                <Search size={16} style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: colors.secondaryText
                }} />
                <input 
                  type="text" 
                  placeholder="Search bill or vendor..." 
                  value={paySearch}
                  onChange={(e) => setPaySearch(e.target.value)}
                  style={{
                    ...typography,
                    height: '38px',
                    width: '100%',
                    borderRadius: '10px',
                    border: '1px solid #E5E7EB',
                    paddingLeft: '36px',
                    paddingRight: '14px',
                    fontSize: '13px',
                    backgroundColor: '#FFFFFF',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ 
                  display: 'flex', 
                  borderRadius: '8px', 
                  border: `1px solid ${colors.border}`,
                  padding: '2px',
                  backgroundColor: '#F3F4F6'
                }}>
                  {(['all', 'monthly', 'quarterly'] as const).map(tf => (
                    <button
                      key={tf}
                      onClick={() => setPayTimeframe(tf)}
                      style={{
                        ...typography,
                        height: '28px',
                        paddingLeft: '10px',
                        paddingRight: '10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: payTimeframe === tf ? 600 : 500,
                        backgroundColor: payTimeframe === tf ? '#FFFFFF' : 'transparent',
                        color: payTimeframe === tf ? colors.primaryText : colors.secondaryText,
                        border: 'none',
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                        boxShadow: payTimeframe === tf ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                      }}
                    >
                      {tf}
                    </button>
                  ))}
                </div>

                <button 
                  onClick={() => handleExportCSV('payables')}
                  style={{
                    ...typography,
                    height: '38px',
                    borderRadius: '10px',
                    border: '1px solid #E5E7EB',
                    backgroundColor: '#FFFFFF',
                    paddingLeft: '12px',
                    paddingRight: '12px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: colors.primaryText,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxSizing: 'border-box'
                  }} 
                  className="hover:bg-zinc-50 transition-colors"
                >
                  <Download size={14} /> Export
                </button>

                {onNavigate && (
                  <button 
                    onClick={() => onNavigate('/purchase')}
                    style={{
                      ...typography,
                      height: '38px',
                      borderRadius: '10px',
                      backgroundColor: '#0F172A',
                      color: '#FFFFFF',
                      border: 'none',
                      paddingLeft: '14px',
                      paddingRight: '14px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxSizing: 'border-box'
                    }} 
                    className="hover:bg-zinc-800 transition-colors"
                  >
                    <Plus size={14} /> Purchase
                  </button>
                )}
              </div>
            </div>

            {/* Table Container */}
            <div style={{ 
              overflowX: 'auto', 
              border: `1px solid ${colors.border}`, 
              borderRadius: '10px' 
            }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse', 
                backgroundColor: '#FFFFFF' 
              }}>
                <thead>
                  <tr style={{ height: '46px', borderBottom: `1.5px solid ${colors.divider}` }}>
                    <th style={{ paddingLeft: '16px', paddingRight: '16px', fontSize: '12px', fontWeight: 600, color: colors.secondaryText, textAlign: 'left', backgroundColor: '#FFFFFF', letterSpacing: '0.02em' }}>BILL REF</th>
                    <th style={{ paddingLeft: '16px', paddingRight: '16px', fontSize: '12px', fontWeight: 600, color: colors.secondaryText, textAlign: 'left', backgroundColor: '#FFFFFF', letterSpacing: '0.02em' }}>VENDOR/SUPPLIER</th>
                    <th style={{ paddingLeft: '16px', paddingRight: '16px', fontSize: '12px', fontWeight: 600, color: colors.secondaryText, textAlign: 'left', backgroundColor: '#FFFFFF', letterSpacing: '0.02em' }}>DATE</th>
                    {/* MONETARY COLUMN ALWAYS LEFT ALIGNED per rule 2 */}
                    <th style={{ paddingLeft: '16px', paddingRight: '16px', fontSize: '12px', fontWeight: 600, color: colors.secondaryText, textAlign: 'left', backgroundColor: '#FFFFFF', letterSpacing: '0.02em' }}>BALANCE / TOTAL</th>
                    <th style={{ paddingLeft: '16px', paddingRight: '16px', fontSize: '12px', fontWeight: 600, color: colors.secondaryText, textAlign: 'center', backgroundColor: '#FFFFFF', letterSpacing: '0.02em' }}>STATUS</th>
                    <th style={{ paddingLeft: '16px', paddingRight: '16px', fontSize: '12px', fontWeight: 600, color: colors.secondaryText, textAlign: 'right', backgroundColor: '#FFFFFF' }}></th>
                  </tr>
                </thead>
                
                <tbody>
                  {payLoading ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: colors.secondaryText, fontSize: '13px', fontWeight: 500 }}>
                        Loading payables ledger...
                      </td>
                    </tr>
                  ) : filteredPayables.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '40px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <FileText size={32} style={{ color: '#D1D5DB' }} />
                          <span style={{ fontSize: '14px', fontWeight: 600, color: colors.primaryText }}>No purchase bills found</span>
                          <span style={{ fontSize: '12px', color: colors.secondaryText }}>Try adjusting your search or status filter</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredPayables.map((row) => (
                      <tr 
                        key={row.id} 
                        style={{ height: '54px', borderBottom: `1px solid ${colors.divider}` }}
                        className="hover:bg-zinc-50/70 transition-colors"
                      >
                        {/* Bill Ref: Inter, Semi-Bold, Deep slate, tabular nums */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600, color: colors.primaryText, textAlign: 'left', ...typography.tabularNums }}>
                          <span 
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleCopy(row.id, row.code)}
                            title="Click to copy bill number"
                            className="hover:underline flex items-center gap-1.5"
                          >
                            {row.code}
                            {copiedId === row.id ? <Check size={12} className="text-emerald-600" /> : null}
                          </span>
                        </td>
                        {/* Vendor: Inter, Medium, Dark slate */}
                        <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 500, color: colors.bodyText, textAlign: 'left', maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.partyName}>
                          {row.partyName}
                        </td>
                        {/* Date: Inter, Regular, Cool gray */}
                        <td style={{ padding: '14px 16px', fontSize: '12px', fontWeight: 400, color: colors.secondaryText, textAlign: 'left', ...typography.tabularNums }}>
                          {formatDateTable(row.date)}
                        </td>
                        {/* Balance / Total: Left-aligned per rule - Inter, Bold for balance, regular muted for total */}
                        <td style={{ padding: '14px 16px', textAlign: 'left', ...typography.tabularNums }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: colors.primaryText }}>
                            {formatCurrency(row.balanceAmount)}
                          </div>
                          {row.balanceAmount !== row.amount && (
                            <div style={{ fontSize: '11px', color: colors.mutedText, fontWeight: 400 }}>
                              of {formatCurrency(row.amount)}
                            </div>
                          )}
                        </td>
                        {/* Status badge */}
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          {renderStatusBadge(row.status)}
                        </td>
                        {/* Action buttons */}
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <button 
                            onClick={() => onNavigate?.(`/purchase`)}
                            style={{ 
                              border: 'none', 
                              backgroundColor: 'transparent', 
                              cursor: 'pointer', 
                              color: colors.secondaryText,
                              padding: '5px',
                              borderRadius: '6px'
                            }} 
                            className="hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                            title="View Purchase Bill in Module"
                          >
                            <ExternalLink size={15} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
