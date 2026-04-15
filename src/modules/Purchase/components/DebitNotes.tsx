import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  FileEdit, 
  FileText, 
  PlusCircle,
  X
} from 'lucide-react';
import { Button as ShadcnButton } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/Badge';
import { AppTable } from '../../../components/ui/AppTable';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../../../components/ui/select';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { cn } from '../../../lib/utils';

import { useAuth } from '../../../contexts/AuthContext';
import { useDebitNotes, usePurchaseBills, useVendors, useCreateDebitNote } from '../hooks/usePurchaseQueries';

const DN_TYPES = ['Purchase Return', 'Rate Difference', 'Discount', 'Rejection'];
const GST_RATES = [0, 5, 12, 18, 28];

export const DebitNotes: React.FC = () => {
  const { organisation } = useAuth();
  const [openDialog, setOpenDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [billId, setBillId] = useState('');
  const [dnType, setDnType] = useState('Purchase Return');
  const [dnDate, setDnDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [totals, setTotals] = useState({ subtotal: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });

  const { data: dns = [], isLoading } = useDebitNotes(organisation?.id);
  const { data: bills = [] } = usePurchaseBills(organisation?.id);
  const { data: vendors = [] } = useVendors(organisation?.id);
  const createDN = useCreateDebitNote();

  const handleAdd = () => {
    setOpenDialog(true);
    setBillId('');
    setItems([]);
  };

  const columns = [
    {
      id: 'dn_number',
      header: 'DN #',
      cell: ({ row }: any) => (
        <span className="font-semibold text-rose-600">
          {row.original.dn_number}
        </span>
      ),
    },
    {
      id: 'dn_date',
      header: 'Date',
      cell: ({ row }: any) => new Date(row.original.dn_date).toLocaleDateString('en-IN'),
    },
    {
      id: 'bill',
      header: 'Original Bill',
      cell: ({ row }: any) => row.original.bill?.bill_number || '-',
    },
    {
      id: 'vendor',
      header: 'Vendor',
      cell: ({ row }: any) => row.original.vendor?.company_name || '-',
    },
    {
      id: 'dn_type',
      header: 'Type',
      cell: ({ row }: any) => (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-medium px-2 py-0 h-5">
          {row.original.dn_type}
        </Badge>
      ),
    },
    {
      id: 'total_amount',
      header: 'Amount',
      cell: ({ row }: any) => (
        <div className="font-medium text-right text-rose-600">
          -₹{Number(row.original.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      id: 'approval_status',
      header: 'Status',
      cell: ({ row }: any) => {
        const val = row.original.approval_status;
        const colors: any = {
          'Approved': 'bg-emerald-50 text-emerald-700 border-emerald-200',
          'Pending': 'bg-slate-50 text-slate-700 border-slate-200',
        };
        return (
          <Badge className={cn("text-[10px] font-medium px-2 py-0 h-5 border shadow-none", colors[val] || colors['Pending'])}>
            {val}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: () => (
        <div className="flex items-center gap-1">
          <ShadcnButton 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-rose-600 hover:bg-rose-50"
          >
            <FileText className="h-4 w-4" />
          </ShadcnButton>
        </div>
      ),
    },
  ];


  return (
    <div className="h-full flex flex-col space-y-4 p-4 md:p-6 bg-slate-50/50">
      <Card className="border-none shadow-sm overflow-hidden text-sm">
        <CardHeader className="py-4 px-6 bg-white border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-50 rounded-lg">
                <FileEdit className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-800">Debit Notes</CardTitle>
                <p className="text-xs text-slate-500 font-medium">Manage purchase returns and adjustments</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search DN..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64 h-9 text-xs border-slate-200 focus:ring-rose-200"
                />
              </div>
              <ShadcnButton 
                onClick={handleAdd} 
                className="h-9 gap-2 shadow-sm font-semibold bg-rose-600 hover:bg-rose-700"
              >
                <Plus className="h-4 w-4" />
                Create DN
              </ShadcnButton>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="flex-1 border-none shadow-sm overflow-hidden bg-white">
        <div className="h-[calc(100vh-220px)] overflow-auto p-1">
          <AppTable
            data={dns}
            columns={columns}
            loading={isLoading}
          />
        </div>
      </Card>

      <Dialog open={openDialog} onOpenChange={(open) => !open && setOpenDialog(false)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b bg-rose-50/30">
            <DialogTitle className="text-xl font-bold text-rose-900">Create Debit Note</DialogTitle>
          </DialogHeader>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2 space-y-1.5 text-sm font-medium">
                <Label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Original Bill *</Label>
                <Select value={billId} onValueChange={setBillId}>
                  <SelectTrigger className="border-slate-200 h-10">
                    <SelectValue placeholder="Select Original Bill" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {bills.map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>
                        <div className="flex flex-col py-0.5">
                          <span className="font-bold text-slate-900">{b.bill_number}</span>
                          <span className="text-[10px] text-slate-500">{b.vendor?.company_name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-500 tracking-wider">DN Type</Label>
                <Select value={dnType} onValueChange={setDnType}>
                  <SelectTrigger className="border-slate-200 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DN_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-500 tracking-wider">DN Date</Label>
                <Input type="date" value={dnDate} onChange={(e) => setDnDate(e.target.value)} className="border-slate-200 h-10" />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Reason *</Label>
                <textarea 
                  className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain the reason for this debit note..."
                />
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-slate-50/50 flex flex-row items-center justify-between">
            <ShadcnButton variant="outline" onClick={() => setOpenDialog(false)} className="px-8 border-slate-200 font-semibold">
              Cancel
            </ShadcnButton>
            <ShadcnButton 
              className="px-10 bg-rose-600 hover:bg-rose-700 font-bold shadow-lg shadow-rose-100"
              disabled={!billId || !reason}
            >
              <FileEdit className="h-4 w-4 mr-2" />
              Generate DN
            </ShadcnButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
};

export default DebitNotes;