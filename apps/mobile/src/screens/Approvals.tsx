import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ApprovalItem {
  id: string;
  title: string;
  description?: string;
  amount?: number;
  approval_type: string;
  status: string;
  priority?: string;
  requester_name?: string;
  project_name?: string;
  created_at: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  NORMAL: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
  HIGH: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
  URGENT: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
};

const TYPE_LABELS: Record<string, string> = {
  PURCHASE_ORDER: 'Purchase Order',
  WORK_ORDER: 'Work Order',
  QUOTATION: 'Quotation',
  INVOICE: 'Invoice',
  PAYMENT_REQUEST: 'Payment Request',
  EXPENSE_CLAIM: 'Expense Claim',
};

export const Approvals: React.FC<{ isDemo?: boolean }> = ({ isDemo = false }) => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalItem | null>(null);

  // Mock database state for Demo Mode
  const [demoApprovals, setDemoApprovals] = useState<ApprovalItem[]>([
    {
      id: 'demo-a1',
      title: 'Cement Procurement - MLE',
      description: 'Procurement of 500 bags of OPC cement',
      amount: 150000,
      approval_type: 'PURCHASE_ORDER',
      status: 'PENDING',
      priority: 'HIGH',
      requester_name: 'John Doe',
      project_name: 'Metro Line Expansion',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    },
    {
      id: 'demo-a2',
      title: 'Electrical Subcontractor Invoice',
      description: 'Invoice for phase 1 wiring works',
      amount: 420000,
      approval_type: 'WORK_ORDER',
      status: 'PENDING',
      priority: 'URGENT',
      requester_name: 'Sarah Connor',
      project_name: 'Commercial Complex B',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    },
    {
      id: 'demo-a3',
      title: 'Site Inspection Travel Claims',
      description: 'Travel expenses for Site inspection',
      amount: 8500,
      approval_type: 'EXPENSE_CLAIM',
      status: 'PENDING',
      priority: 'NORMAL',
      requester_name: 'Bob Johnson',
      project_name: 'Metro Line Expansion',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
    },
    {
      id: 'demo-a4',
      title: 'Aggregate Purchase - Complex B',
      description: 'Purchase of coarse aggregate',
      amount: 98000,
      approval_type: 'PURCHASE_ORDER',
      status: 'APPROVED',
      priority: 'NORMAL',
      requester_name: 'Jane Smith',
      project_name: 'Commercial Complex B',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), // 3 days ago
    },
    {
      id: 'demo-a5',
      title: 'Cabling Work Order',
      description: 'Work order for cabling',
      amount: 75000,
      approval_type: 'WORK_ORDER',
      status: 'REJECTED',
      priority: 'HIGH',
      requester_name: 'Bob Johnson',
      project_name: 'Metro Line Expansion',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(), // 4 days ago
    }
  ]);

  useEffect(() => {
    if (isDemo) {
      loadDemoApprovals();
    } else {
      initSessionAndFetch();
    }
  }, [activeTab, isDemo]);

  const loadDemoApprovals = () => {
    setLoading(true);
    // Filter local mock array by tab
    const items = demoApprovals.filter(item => {
      if (activeTab === 'pending') {
        return item.status === 'PENDING';
      } else {
        return item.status === 'APPROVED' || item.status === 'REJECTED';
      }
    });
    setApprovals(items);
    setLoading(false);
  };

  const initSessionAndFetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('User not authenticated');
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const { data: memberData } = await supabase
        .from('org_members')
        .select('organisation_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      const userOrgId = memberData?.organisation_id;
      if (!userOrgId) {
        setError('No organization associated with this account');
        setLoading(false);
        return;
      }
      setOrgId(userOrgId);

      await fetchApprovals(userOrgId);
    } catch (err: any) {
      console.error('Error in initSessionAndFetch:', err);
      setError(err?.message || 'Failed to initialize session');
      setLoading(false);
    }
  };

  const fetchApprovals = async (userOrgId: string) => {
    try {
      let query = supabase
        .from('approvals')
        .select('*')
        .eq('organisation_id', userOrgId)
        .order('created_at', { ascending: false });

      if (activeTab === 'pending') {
        query = query.eq('status', 'PENDING');
      } else {
        query = query.in('status', ['APPROVED', 'REJECTED']);
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;

      setApprovals(data || []);
    } catch (err: any) {
      console.error('Error fetching approvals:', err);
      setError(err?.message || 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, action: 'APPROVED' | 'REJECTED') => {
    setProcessingId(id);
    setError(null);

    if (isDemo) {
      // Simulate network request delay
      setTimeout(() => {
        // Update mock database state locally
        setDemoApprovals(prev =>
          prev.map(item => (item.id === id ? { ...item, status: action } : item))
        );
        // Remove from list locally for smooth micro-animations
        setApprovals((prev) => prev.filter((item) => item.id !== id));
        setProcessingId(null);
      }, 500);
      return;
    }

    if (!orgId || !userId) return;
    try {
      // 1. Insert into approval_actions
      const { error: actionErr } = await supabase.from('approval_actions').insert({
        approval_id: id,
        action: action,
        approver_id: userId,
        comments: `Actioned via Mobile App`,
        organisation_id: orgId,
      });

      if (actionErr) throw actionErr;

      // 2. Update approvals status
      const { error: updateErr } = await supabase
        .from('approvals')
        .update({
          status: action,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateErr) throw updateErr;

      // Remove from list locally for smooth micro-animations
      setApprovals((prev) => prev.filter((item) => item.id !== id));
      if (selectedApproval?.id === id) {
        setSelectedApproval(null);
      }
    } catch (err: any) {
      console.error(`Error processing action ${action}:`, err);
      setError(err?.message || `Failed to ${action.toLowerCase()} request`);
    } finally {
      setProcessingId(null);
    }
  };

  const formatAmount = (amount?: number) => {
    if (amount === undefined || amount === null) return '—';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '—';
      const day = String(d.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      return `${day}-${month}-${year}`; // dd-mmm-yyyy
    } catch {
      return '—';
    }
  };

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto flex flex-col pb-24">
      {/* Header */}
      <header className="px-4 pt-10 pb-4 border-b border-border bg-card">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Approvals</h1>
        <p className="text-[10px] font-medium text-muted-foreground uppercase">
          Review and approve pending requests
        </p>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary mt-4">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'pending'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground'
            }`}
          >
            History
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="px-4 pt-4 flex-1 overflow-y-auto space-y-4">
        {error && (
          <div className="p-3 text-xs rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-center">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : approvals.length === 0 ? (
          <div className="glass-card rounded-2xl p-10 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center mx-auto text-muted-foreground text-xl">
              ✓
            </div>
            <p className="text-sm font-semibold text-foreground">All caught up</p>
            <p className="text-xs text-muted-foreground">
              {activeTab === 'pending'
                ? 'No approvals awaiting your action.'
                : 'No approval history found.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {approvals.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  className="glass-card rounded-2xl p-4 border border-border/50 relative overflow-hidden flex flex-col gap-3"
                >
                  {/* Top line with Requester and Type */}
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full uppercase">
                        {TYPE_LABELS[item.approval_type] || item.approval_type}
                      </span>
                      {item.priority && (
                        <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ml-1.5 uppercase ${PRIORITY_COLORS[item.priority] || ''}`}>
                          {item.priority}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {formatDate(item.created_at)}
                    </span>
                  </div>

                  {/* Title and Amount */}
                  <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-foreground line-clamp-1">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Requested by: <span className="font-semibold">{item.requester_name || 'N/A'}</span>
                      </p>
                      {item.project_name && (
                        <p className="text-[11px] text-muted-foreground">
                          Project: <span className="font-semibold">{item.project_name}</span>
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-base font-extrabold text-foreground font-currency tabular-nums">
                        {formatAmount(item.amount)}
                      </p>
                    </div>
                  </div>

                  {/* One-Tap actions (only if pending) */}
                  {activeTab === 'pending' && (
                    <div className="flex gap-2 pt-2 border-t border-border/50">
                      <button
                        onClick={() => handleAction(item.id, 'REJECTED')}
                        disabled={processingId !== null}
                        className="flex-1 h-9 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive font-semibold text-xs active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </button>
                      <button
                        onClick={() => handleAction(item.id, 'APPROVED')}
                        disabled={processingId !== null}
                        className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground font-semibold text-xs active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {processingId === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Approve
                      </button>
                    </div>
                  )}

                  {/* History Status display */}
                  {activeTab === 'history' && (
                    <div className="flex justify-between items-center pt-2 border-t border-border/50 text-xs">
                      <span className="text-muted-foreground">Final Status:</span>
                      <span
                        className={`font-semibold px-2 py-0.5 rounded-md ${
                          item.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
};
