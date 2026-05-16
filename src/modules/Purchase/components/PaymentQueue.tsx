import React, { useState } from 'react';
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
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/Tabs';
import { cn } from '../../../lib/utils';

import { useAuth } from '../../../contexts/AuthContext';
import { usePurchaseBills, usePaymentRequests } from '../hooks/usePurchaseQueries';

export const PaymentQueue: React.FC = () => {
  const { organisation } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: bills = [] } = usePurchaseBills(organisation?.id, { overdue: activeTab === 0 });
  const { data: requests = [] } = usePaymentRequests(organisation?.id);

  // Filter bills based on tab
  const filteredBills = bills.filter((bill: any) => {
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
    <div className="h-full flex flex-col space-y-6 p-4 md:p-6 bg-zinc-50/50">
      {/* Header & Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card, i) => (
          <Card key={i} className="border-none shadow-sm overflow-hidden bg-white group hover:ring-2 hover:ring-rose-500/10 transition-all">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{card.label}</p>
                <h4 className={cn("text-xl font-bold tracking-tight", card.color)}>{card.value}</h4>
              </div>
              <div className={cn("p-2.5 rounded-xl transition-colors", card.bg)}>
                <card.icon className={cn("h-5 w-5", card.color)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="flex-1 border-none shadow-sm overflow-hidden bg-white flex flex-col">
        <Tabs defaultValue="all" className="flex-1 flex flex-col" onValueChange={(v) => {
          const tabMap: any = { 'all': 0, 'overdue': 1, '7days': 2, '30days': 3 };
          setActiveTab(tabMap[v]);
        }}>
          <div className="px-6 border-b border-zinc-100 bg-white z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
              <TabsList className="bg-zinc-50/50 p-1 rounded-xl h-10 border border-zinc-100">
                <TabsTrigger value="all" className="px-4 text-[11px] font-bold uppercase tracking-wider rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  All Pending ({filteredBills.length})
                </TabsTrigger>
                <TabsTrigger value="overdue" className="px-4 text-[11px] font-bold uppercase tracking-wider rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-rose-600">
                  Overdue ({filteredBills.filter((b: any) => calculateDaysOverdue(b.due_date) > 0).length})
                </TabsTrigger>
                <TabsTrigger value="7days" className="px-4 text-[11px] font-bold uppercase tracking-wider rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-amber-600">
                  Next 7 Days
                </TabsTrigger>
                <TabsTrigger value="30days" className="px-4 text-[11px] font-bold uppercase tracking-wider rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  Next 30 Days
                </TabsTrigger>
              </TabsList>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input
                  placeholder="Filter queue..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64 h-9 text-xs border-zinc-200"
                />
              </div>
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
      </Card>
    </div>

  );
};

export default PaymentQueue;