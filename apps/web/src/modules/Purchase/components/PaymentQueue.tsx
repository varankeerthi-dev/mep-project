import React, { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  AlertCircle, 
  Calendar, 
  Clock, 
  CreditCard, 
  AlertTriangle,
  FileText,
  BadgeAlert,
  Wallet,
  Timer
} from 'lucide-react';
import { Button as ShadcnButton } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/Badge';
import { AppTable } from '../../../components/ui/AppTable';
import { Input } from '../../../components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/Tabs';
import { cn } from '../../../lib/utils';

import { useAuth } from '../../../contexts/AuthContext';
import { usePurchaseBills, usePaymentRequests } from '../hooks/usePurchaseQueries';

export const PaymentQueue: React.FC = () => {
  const { organisation } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const t = parseInt(searchParams.get('tab') || '0', 10);
    return (t >= 0 && t <= 3) ? t : 0;
  });
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '');

  const handleTabChange = useCallback((value: string) => {
    const tabMap: Record<string, number> = { 'all': 0, 'overdue': 1, '7days': 2, '30days': 3 };
    const newTab = tabMap[value] ?? 0;
    setActiveTab(newTab);
    setSearchParams(prev => {
      prev.set('tab', String(newTab));
      return prev;
    }, { replace: true });
  }, [setSearchParams]);

  const { data: billsRes = { data: [], count: 0 } } = usePurchaseBills(organisation?.id, {
    overdue: activeTab === 1,
  });
  const { data: requests = [] } = usePaymentRequests(organisation?.id);

  const bills = billsRes.data ?? [];

  // Filter bills based on tab and search
  const filteredBills = useMemo(() => {
    let tabFiltered = bills.filter((bill: any) => {
    if (activeTab === 0) return true; // All
    if (activeTab === 1) { // Overdue
      const dueDate = new Date(bill.due_date);
      return dueDate < new Date() && bill.payment_status !== 'Paid';
    }
    if (activeTab === 2) { // Next 7 Days
      const dueDate = new Date(bill.due_date);
      const sevenDays = new Date();
      sevenDays.setDate(sevenDays.getDate() + 7);
      return dueDate <= sevenDays && dueDate >= new Date() && bill.payment_status !== 'Paid';
    }
    if (activeTab === 3) { // Next 30 Days
      const dueDate = new Date(bill.due_date);
      const thirtyDays = new Date();
      thirtyDays.setDate(thirtyDays.getDate() + 30);
      return dueDate <= thirtyDays && dueDate >= new Date() && bill.payment_status !== 'Paid';
    }
      return true;
    });
    if (!searchTerm) return tabFiltered;
    const q = searchTerm.toLowerCase();
    return tabFiltered.filter((b: any) =>
      String(b.bill_number || '').toLowerCase().includes(q) ||
      String(b.vendor?.company_name || '').toLowerCase().includes(q)
    );
  }, [bills, activeTab, searchTerm]);

  const calculateDaysOverdue = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diff = Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const columns = [
    {
      id: 'bill_number',
      header: 'Bill #',
      cell: ({ row }: any) => (
        <span className="font-semibold text-zinc-800">
          {row.original.bill_number}
        </span>
      ),
    },
    {
      id: 'bill_date',
      header: 'Bill Date',
      cell: ({ row }: any) => new Date(row.original.bill_date).toLocaleDateString('en-IN'),
    },
    {
      id: 'due_date',
      header: 'Due Date',
      cell: ({ row }: any) => {
        const daysOverdue = calculateDaysOverdue(row.original.due_date);
        return (
          <div className="flex flex-col py-1">
            <span className="text-zinc-800">{new Date(row.original.due_date).toLocaleDateString('en-IN')}</span>
            {daysOverdue > 0 && (
              <span className="text-[10px] font-bold text-rose-600 uppercase flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {daysOverdue} days overdue
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: 'vendor',
      header: 'Vendor',
      cell: ({ row }: any) => row.original.vendor?.company_name || '-',
    },
    {
      id: 'total_amount',
      header: 'Total',
      cell: ({ row }: any) => (
        <div className="text-right">₹{Number(row.original.total_amount).toLocaleString()}</div>
      ),
    },
    {
      id: 'balance_amount',
      header: 'Balance',
      cell: ({ row }: any) => (
        <div className="font-bold text-right text-rose-600 italic">
          ₹{Number(row.original.balance_amount).toLocaleString()}
        </div>
      ),
    },
    {
      id: 'payment_status',
      header: 'Status',
      cell: ({ row }: any) => {
        const val = row.original.payment_status;
        const colors: any = {
          'Paid': 'bg-emerald-50 text-emerald-700 border-emerald-200',
          'Partially Paid': 'bg-amber-50 text-amber-700 border-amber-200',
          'Unpaid': 'bg-rose-50 text-rose-700 border-rose-200',
        };
        return (
          <Badge className={cn("text-[10px] font-medium px-2 py-0 h-5 border shadow-none", colors[val])}>
            {val}
          </Badge>
        );
      },
    },
    {
      id: 'priority',
      header: 'Priority',
      cell: ({ row }: any) => {
        const days = calculateDaysOverdue(row.original.due_date);
        if (days > 0) return <Badge className="bg-rose-600 text-white border-0 text-[10px] h-5 shadow-sm shadow-rose-200">URGENT</Badge>;
        
        const due = new Date(row.original.due_date);
        const today = new Date();
        const left = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (left <= 7) return <Badge className="bg-amber-500 text-white border-0 text-[10px] h-5 shadow-sm shadow-amber-200">CRITICAL</Badge>;
        return <Badge variant="outline" className="text-zinc-500 border-zinc-200 text-[10px] h-5">NORMAL</Badge>;
      },
    },
    {
      id: 'actions',
      header: 'Action',
      cell: () => (
        <ShadcnButton 
          size="sm" 
          className="h-8 bg-emerald-600 hover:bg-emerald-700 font-bold gap-1.5"
        >
          <CreditCard className="h-3.5 w-3.5" />
          Pay
        </ShadcnButton>
      ),
    },
  ];


  // Calculate summary
  const totalPayable = filteredBills.reduce((sum: number, b: any) => sum + (b.balance_amount || 0), 0);
  const overdueAmount = filteredBills.filter((b: any) => calculateDaysOverdue(b.due_date) > 0).reduce((sum: number, b: any) => sum + (b.balance_amount || 0), 0);
  const criticalCount = filteredBills.filter((b: any) => calculateDaysOverdue(b.due_date) > 0 || (new Date(b.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24) <= 7).length;

  const summaryCards = [
    { label: 'Total Payable', value: `₹${totalPayable.toLocaleString()}`, icon: Wallet, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Overdue Amount', value: `₹${overdueAmount.toLocaleString()}`, icon: BadgeAlert, color: 'text-rose-700', bg: 'bg-rose-100' },
    { label: 'Critical Bills', value: `${criticalCount} Bills`, icon: Timer, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Pending Requests', value: requests.filter((r: any) => r.status === 'Pending').length, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Compact Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-medium text-zinc-900">Bills Due</h1>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
            {criticalCount} Due
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-6 py-4">
        {summaryCards.map((card, i) => (
          <div key={i} className="bg-white border border-zinc-200 rounded-xl overflow-hidden group">
            <div className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{card.label}</p>
                <h4 className={cn("text-xl font-bold tracking-tight", card.color)}>{card.value}</h4>
              </div>
              <div className={cn("p-2.5 rounded-xl transition-colors", card.bg)}>
                <card.icon className={cn("h-5 w-5", card.color)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden border-t border-zinc-100">
        <Tabs defaultValue="all" className="flex-1 flex flex-col" onValueChange={handleTabChange}>
          <div className="flex items-center justify-between px-6 border-b border-zinc-100 bg-zinc-50/50" style={{ paddingTop: 15, paddingBottom: 15 }}>
            <TabsList className="flex items-center gap-1 bg-transparent p-0">
              <TabsTrigger value="all" className="w-[150px] h-[26px] px-4 text-sm font-medium transition-colors data-[state=active]:bg-blue-600/10 data-[state=active]:text-blue-600 text-zinc-600 hover:bg-zinc-100">
                All Pending ({filteredBills.length})
              </TabsTrigger>
              <TabsTrigger value="overdue" className="w-[150px] h-[26px] px-4 text-sm font-medium transition-colors data-[state=active]:bg-blue-600/10 data-[state=active]:text-blue-600 text-zinc-600 hover:bg-zinc-100">
                Overdue ({filteredBills.filter((b: any) => calculateDaysOverdue(b.due_date) > 0).length})
              </TabsTrigger>
              <TabsTrigger value="7days" className="w-[150px] h-[26px] px-4 text-sm font-medium transition-colors data-[state=active]:bg-blue-600/10 data-[state=active]:text-blue-600 text-zinc-600 hover:bg-zinc-100">
                Next 7 Days
              </TabsTrigger>
              <TabsTrigger value="30days" className="w-[150px] h-[26px] px-4 text-sm font-medium transition-colors data-[state=active]:bg-blue-600/10 data-[state=active]:text-blue-600 text-zinc-600 hover:bg-zinc-100">
                Next 30 Days
              </TabsTrigger>
            </TabsList>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input
                placeholder="Filter queue..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 pl-8 h-[30px] w-64 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto p-1">
            {overdueAmount > 0 && activeTab === 1 && (
              <div className="mx-5 my-4 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 animate-pulse">
                <div className="p-2 bg-rose-200/50 rounded-full">
                  <AlertCircle className="h-5 w-5 text-rose-700" />
                </div>
                <div>
                  <h5 className="text-sm font-bold text-rose-900 leading-none">Critical Payment Alert</h5>
                  <p className="text-xs text-rose-700 font-medium mt-1">₹{overdueAmount.toLocaleString()} in vendor debts has exceeded due dates.</p>
                </div>
              </div>
            )}
            
            <AppTable
              data={filteredBills}
              columns={columns}
              loading={false}
            />
          </div>
        </Tabs>
      </div>
    </div>

  );
};

export default PaymentQueue;