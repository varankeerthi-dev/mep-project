// ============================================
// EXPENSE SUMMARY COMPONENT
// Shows totals, category breakdown, and status counts
// ============================================
import { useMemo } from 'react';
import { DollarSign, Receipt, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { EXPENSE_STATUS_CONFIG, EXPENSE_CATEGORY_LABELS } from '../types/expense';

interface ExpenseEntry {
  id: string;
  amount: number;
  status: string;
  expense_category: string;
  created_at: string;
}

interface ExpenseSummaryProps {
  expenses: ExpenseEntry[];
}

export default function ExpenseSummary({ expenses }: ExpenseSummaryProps) {
  const stats = useMemo(() => {
    const total = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const paid = expenses
      .filter((e) => e.status === 'PAID' || e.status === 'VERIFIED')
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const pending = expenses
      .filter((e) => e.status === 'PENDING_APPROVAL')
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const rejected = expenses
      .filter((e) => e.status === 'REJECTED')
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const statusCounts: Record<string, number> = {};
    expenses.forEach((e) => {
      statusCounts[e.status] = (statusCounts[e.status] || 0) + 1;
    });

    const categoryTotals: Record<string, number> = {};
    expenses.forEach((e) => {
      const cat = e.expense_category || 'other';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (e.amount || 0);
    });

    return { total, paid, pending, rejected, statusCounts, categoryTotals };
  }, [expenses]);

  const cards = [
    {
      label: 'Total Expenses',
      value: `₹${stats.total.toLocaleString('en-IN')}`,
      icon: DollarSign,
      color: 'text-zinc-700',
      bg: 'bg-zinc-50',
      border: 'border-zinc-200',
    },
    {
      label: 'Paid',
      value: `₹${stats.paid.toLocaleString('en-IN')}`,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
    },
    {
      label: 'Pending',
      value: `₹${stats.pending.toLocaleString('en-IN')}`,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
    },
    {
      label: 'Rejected',
      value: `₹${stats.rejected.toLocaleString('en-IN')}`,
      icon: XCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
    },
  ];

  return (
    <div className="space-y-3">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`flex items-center gap-3 rounded-lg border ${card.border} ${card.bg} px-3 py-2.5`}
          >
            <card.icon size={16} className={card.color} />
            <div className="min-w-0">
              <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">{card.label}</div>
              <div className={`text-sm font-bold tabular-nums ${card.color}`}>{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Category Breakdown */}
      {Object.keys(stats.categoryTotals).length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-3">
          <h4 className="text-xs font-semibold text-zinc-600 mb-2">By Category</h4>
          <div className="space-y-1.5">
            {Object.entries(stats.categoryTotals)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, amount]) => (
                <div key={cat} className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500 capitalize">
                    {EXPENSE_CATEGORY_LABELS[cat as keyof typeof EXPENSE_CATEGORY_LABELS] || cat}
                  </span>
                  <span className="text-xs font-medium text-zinc-700 tabular-nums">
                    ₹{amount.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
