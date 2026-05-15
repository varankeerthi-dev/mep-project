import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Plus,
  Search,
  FileEdit,
  FileText,
  X,
  Trash2,
  Pencil,
  Eye,
  Loader2,
  Warehouse,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button as ShadcnButton } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/Badge';
import { AppTable } from '../../../components/ui/AppTable';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { cn } from '../../../lib/utils';
import { supabase } from '../../../supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useDebitNotes, usePurchaseBills, useVendors, useCreateDebitNote } from '../hooks/usePurchaseQueries';
import { adjustCNStock } from '../../../credit-notes/stock-adjustment';

const DN_TYPES = ['Purchase Return', 'Rate Difference', 'Discount', 'Rejection', 'Other'];

interface DNItem {
  description: string;
  hsn_code: string;
  quantity: number;
  rate: number;
  gst_percent: number;
  taxable_value: number;
  gst_amount: number;
  total_amount: number;
  material_id?: string;
  warehouse_id?: string;
  variant?: string;
  variant_id?: string;
  make?: string;
}

function createEmptyItem(): DNItem {
  return {
    description: '',
    hsn_code: '',
    quantity: 1,
    rate: 0,
    gst_percent: 18,
    taxable_value: 0,
    gst_amount: 0,
    total_amount: 0,
  };
}

function calcItemTotals(item: DNItem): DNItem {
  const lineTotal = item.quantity * item.rate;
  const taxableValue = Math.max(0, lineTotal);
  const gstAmount = Math.round(taxableValue * item.gst_percent / 100 * 100) / 100;
  const totalAmount = Math.round((taxableValue + gstAmount) * 100) / 100;
  return {
    ...item,
    taxable_value: Math.round(taxableValue * 100) / 100,
    gst_amount: gstAmount,
    total_amount: totalAmount,
  };
}

export const DebitNotes: React.FC = () => {
  const { organisation } = useAuth();
  const [openDialog, setOpenDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [billId, setBillId] = useState('');
  const [dnType, setDnType] = useState('Purchase Return');
  const [dnDate, setDnDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [items, setItems] = useState<DNItem[]>([createEmptyItem()]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dnNumber, setDnNumber] = useState('');
  const [warehousePanelOpen, setWarehousePanelOpen] = useState(false);
  const [defaultWarehouseId, setDefaultWarehouseId] = useState('');

  const { data: dns = [], isLoading, refetch } = useDebitNotes(organisation?.id);
  const { data: bills = [] } = usePurchaseBills(organisation?.id);
  const { data: vendors = [] } = useVendors(organisation?.id);
  const createDN = useCreateDebitNote();

  const warehousesQuery = useQuery({
    queryKey: ['warehouses', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .eq('organisation_id', organisation.id)
        .eq('is_active', true)
        .order('warehouse_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  const stockQuery = useQuery({
    queryKey: ['item-stock', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('item_stock')
        .select('item_id, warehouse_id, company_variant_id, current_stock')
        .eq('organisation_id', organisation.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
    staleTime: 2 * 60 * 1000,
  });

  const [materialOptions, setMaterialOptions] = useState<Array<{
    id: string; name: string; display_name: string; hsn_code: string | null;
    unit: string | null; sale_price: number | null; make: string | null;
    variants: Array<{ variant_id: string; variant_name: string; make: string | null; sale_price: number | null }>;
  }>>([]);

  const [variantDropdowns, setVariantDropdowns] = useState<Record<number, boolean>>({});
  const variantInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const variantDropdownRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!organisation?.id) return;
    Promise.all([
      supabase.from('materials').select('id, name, display_name, hsn_code, unit, sale_price, make').eq('organisation_id', organisation.id).order('name'),
      supabase.from('item_variant_pricing').select('material_id, variant_id, sale_price, make').eq('company_id', organisation.id),
      supabase.from('company_variants').select('id, variant_name').eq('organisation_id', organisation.id).eq('is_active', true),
    ]).then(([materialsRes, pricingRes, variantsRes]) => {
      if (!materialsRes.data) return;
      const variantNames = new Map<string, string>();
      variantsRes.data?.forEach(v => variantNames.set(String(v.id), String(v.variant_name)));
      const pricingByMaterial = new Map<string, Array<{ variant_id: string; variant_name: string; make: string | null; sale_price: number | null }>>();
      pricingRes.data?.forEach(p => {
        const matId = String(p.material_id);
        const vid = String(p.variant_id);
        const vname = variantNames.get(vid) ?? vid;
        const list = pricingByMaterial.get(matId) ?? [];
        list.push({ variant_id: vid, variant_name: vname, make: p.make ?? null, sale_price: p.sale_price ?? null });
        pricingByMaterial.set(matId, list);
      });
      setMaterialOptions(materialsRes.data.map(m => ({
        id: String(m.id), name: String(m.name ?? ''), display_name: String(m.display_name ?? m.name ?? ''),
        hsn_code: m.hsn_code ?? null, unit: m.unit ?? null, sale_price: m.sale_price ?? null, make: m.make ?? null,
        variants: pricingByMaterial.get(String(m.id)) ?? [],
      })));
    });
  }, [organisation?.id]);

  const selectedBill = useMemo(() => {
    return bills.find((b: any) => b.id === billId) ?? null;
  }, [bills, billId]);

  const selectedVendor = useMemo(() => {
    if (!selectedBill) return null;
    return vendors.find((v: any) => v.id === selectedBill.vendor_id) ?? null;
  }, [vendors, selectedBill]);

  useEffect(() => {
    if (!openDialog || !organisation?.id) return;
    supabase
      .from('debit_notes')
      .select('dn_number')
      .eq('organisation_id', organisation.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0 && data[0].dn_number) {
          const match = data[0].dn_number.match(/(\d+)$/);
          if (match) {
            const next = parseInt(match[1]) + 1;
            setDnNumber(`DN-${String(next).padStart(4, '0')}`);
          } else {
            setDnNumber('DN-0001');
          }
        } else {
          setDnNumber('DN-0001');
        }
      });
  }, [openDialog, organisation?.id]);

  const totals = useMemo(() => {
    let taxable = 0;
    let gst = 0;
    let total = 0;
    for (const item of items) {
      taxable += item.taxable_value;
      gst += item.gst_amount;
      total += item.total_amount;
    }
    return {
      taxable: Math.round(taxable * 100) / 100,
      gst: Math.round(gst * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }, [items]);

  const handleAdd = () => {
    setOpenDialog(true);
    setBillId('');
    setDnType('Purchase Return');
    setDnDate(new Date().toISOString().split('T')[0]);
    setReason('');
    setItems([createEmptyItem()]);
    setSaveError(null);
  };

  const updateItem = (index: number, field: keyof DNItem, value: string | number) => {
    setItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next.map(item => calcItemTotals(item));
    });
  };

  const addItem = () => setItems(prev => [...prev, createEmptyItem()]);
  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      Object.keys(variantDropdownRefs.current).forEach(index => {
        const dropdown = variantDropdownRefs.current[Number(index)];
        const input = variantInputRefs.current[Number(index)];
        if (dropdown && !dropdown.contains(e.target as Node) && input && !input.contains(e.target as Node)) {
          setVariantDropdowns(prev => ({ ...prev, [Number(index)]: false }));
        }
      });
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSave = async () => {
    if (!billId || !reason || items.length === 0) return;
    if (!organisation?.id || !selectedBill) return;

    setSaveError(null);
    setSaving(true);

    try {
      const dnData = {
        organisation_id: organisation.id,
        vendor_id: selectedBill.vendor_id,
        bill_id: billId,
        dn_number: dnNumber,
        dn_date: dnDate,
        dn_type: dnType,
        reason,
        taxable_amount: totals.taxable,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: totals.gst,
        total_amount: totals.total,
        approval_status: 'Pending',
      };

      const dnItems = items.map(item => ({
        description: item.description,
        hsn_code: item.hsn_code || null,
        quantity: item.quantity,
        rate: item.rate,
        gst_percent: item.gst_percent,
        taxable_value: item.taxable_value,
        gst_amount: item.gst_amount,
        total_amount: item.total_amount,
      }));

      await createDN.mutateAsync({ dnData, items: dnItems });

      const stockItems = items
        .filter(item => item.material_id && item.warehouse_id)
        .map(item => ({
          material_id: item.material_id!,
          warehouse_id: item.warehouse_id!,
          quantity: item.quantity,
        }));

      if (stockItems.length > 0 && organisation?.id) {
        try {
          await adjustCNStock('', organisation.id, stockItems, 'deduct');
        } catch (stockErr) {
          console.error('DN stock deduction failed:', stockErr);
        }
      }

      setOpenDialog(false);
      refetch();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to create debit note');
    } finally {
      setSaving(false);
    }
  };

  const filteredDNs = useMemo(() => {
    if (!searchTerm) return dns;
    const q = searchTerm.toLowerCase();
    return (dns as any[]).filter(
      (dn: any) =>
        dn.dn_number?.toLowerCase().includes(q) ||
        dn.vendor?.company_name?.toLowerCase().includes(q) ||
        dn.bill?.bill_number?.toLowerCase().includes(q)
    );
  }, [dns, searchTerm]);

  const columns = [
    {
      id: 'dn_number',
      header: 'DN #',
      cell: ({ row }: any) => (
        <span className="font-semibold text-rose-600">{row.original.dn_number}</span>
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
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 h-5">
          {row.original.dn_type}
        </span>
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
          Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          Pending: 'bg-slate-50 text-slate-700 border-slate-200',
          Rejected: 'bg-red-50 text-red-700 border-red-200',
        };
        return (
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium h-5 border shadow-none', colors[val] || colors.Pending)}>
            {val}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-1">
          <ShadcnButton variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500 hover:bg-slate-50">
            <Eye className="h-4 w-4" />
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
          <AppTable data={filteredDNs} columns={columns} loading={isLoading} />
        </div>
      </Card>

      <Dialog open={openDialog} onOpenChange={(open) => !open && setOpenDialog(false)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b bg-rose-50/30">
            <DialogTitle className="text-xl font-bold text-rose-900">Create Debit Note</DialogTitle>
          </DialogHeader>

          <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
            {saveError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">{saveError}</div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-500 tracking-wider">DN Number</Label>
                <Input value={dnNumber} readOnly className="border-slate-200 h-10 bg-slate-50" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-500 tracking-wider">DN Date</Label>
                <Input type="date" value={dnDate} onChange={(e) => setDnDate(e.target.value)} className="border-slate-200 h-10" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-500 tracking-wider">DN Type</Label>
                <Select value={dnType} onValueChange={setDnType}>
                  <SelectTrigger className="border-slate-200 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DN_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2 space-y-1.5">
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

              <div className="md:col-span-3 space-y-1.5">
                <Label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Reason *</Label>
                <textarea
                  className="flex min-h-[60px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/20"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain the reason for this debit note..."
                />
              </div>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '12px', background: '#f8fafc' }}>
              <div
                onClick={() => setWarehousePanelOpen(!warehousePanelOpen)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', cursor: 'pointer', userSelect: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Warehouse size={14} style={{ color: '#64748b' }} />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#1e293b' }}>Stock & Warehouse</span>
                </div>
                {warehousePanelOpen ? <ChevronDown size={14} style={{ color: '#94a3b8' }} /> : <ChevronRight size={14} style={{ color: '#94a3b8' }} />}
              </div>
              {warehousePanelOpen && (
                <div style={{ padding: '10px 12px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flex: 1, maxWidth: '250px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '3px' }}>Default Warehouse</label>
                    <select
                      value={defaultWarehouseId}
                      onChange={(e) => setDefaultWarehouseId(e.target.value)}
                      style={{ width: '100%', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '11px', background: '#fff' }}
                    >
                      <option value="">Select warehouse</option>
                      {warehousesQuery.data?.map((wh: any) => (
                        <option key={wh.id} value={wh.id}>{wh.warehouse_name || wh.name || 'Warehouse'}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-bold uppercase text-slate-500 tracking-wider">Line Items</Label>
                <ShadcnButton variant="secondary" size="sm" onClick={addItem} className="h-7 text-xs">
                  <Plus className="h-3 w-3 mr-1" /> Add Item
                </ShadcnButton>
              </div>

              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="px-3 py-2 text-left font-semibold text-slate-600 w-8">#</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">MATERIAL</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600 w-14">HSN</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600 w-16">MAKE</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600 w-20">VARIANT</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600 w-20">WAREHOUSE</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-600 w-14">STOCK</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-600 w-16">Qty</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-600 w-20">Rate</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-600 w-16">GST%</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-600 w-20">Taxable</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-600 w-16">GST</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-600 w-20">Total</th>
                      <th className="px-3 py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} className="border-b last:border-b-0">
                        <td className="px-3 py-1.5 text-center text-slate-400">{index + 1}</td>
                        <td className="px-3 py-1.5">
                          <select
                            value={item.material_id || ''}
                            onChange={(e) => {
                              const mat = materialOptions.find(m => m.id === e.target.value);
                              if (mat) {
                                const firstVariant = mat.variants.length > 0 ? mat.variants[0] : null;
                                updateItem(index, 'material_id', mat.id);
                                updateItem(index, 'description', mat.display_name || mat.name);
                                updateItem(index, 'hsn_code', mat.hsn_code || '');
                                updateItem(index, 'make', firstVariant?.make ?? mat.make ?? '');
                                updateItem(index, 'variant', firstVariant?.variant_name ?? '');
                                updateItem(index, 'variant_id', firstVariant?.variant_id ?? '');
                                updateItem(index, 'rate', firstVariant?.sale_price ?? mat.sale_price ?? 0);
                                if (defaultWarehouseId && !item.warehouse_id) {
                                  updateItem(index, 'warehouse_id', defaultWarehouseId);
                                }
                              }
                            }}
                            style={{ width: '100%', padding: '3px 6px', border: '1px solid transparent', borderRadius: '2px', fontSize: '10px', background: 'transparent' }}
                          >
                            <option value="">Select material</option>
                            {materialOptions.map(m => (
                              <option key={m.id} value={m.id}>{m.display_name || m.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            value={item.hsn_code}
                            onChange={(e) => updateItem(index, 'hsn_code', e.target.value)}
                            placeholder="HSN"
                            className="h-7 text-xs border-transparent focus:border-slate-200"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="text"
                            value={item.make || ''}
                            readOnly
                            placeholder="-"
                            style={{ width: '100%', padding: '3px 6px', border: '1px solid transparent', borderRadius: '2px', fontSize: '10px', background: 'transparent', opacity: item.material_id ? 1 : 0.5 }}
                          />
                        </td>
                        <td className="px-3 py-1.5" style={{ position: 'relative' }}>
                          <input
                            ref={(el) => { variantInputRefs.current[index] = el; }}
                            type="text"
                            value={item.variant || ''}
                            readOnly={!item.material_id}
                            onClick={() => {
                              const mat = materialOptions.find(m => m.id === item.material_id);
                              if (mat && mat.variants.length > 0) setVariantDropdowns(prev => ({ ...prev, [index]: true }));
                            }}
                            placeholder="-"
                            style={{ width: '100%', padding: '3px 6px', border: '1px solid transparent', borderRadius: '2px', fontSize: '10px', background: 'transparent', cursor: item.material_id ? 'pointer' : 'default', opacity: item.material_id ? 1 : 0.5 }}
                          />
                          {variantDropdowns[index] && item.material_id && (() => {
                            const mat = materialOptions.find(m => m.id === item.material_id);
                            if (!mat || mat.variants.length === 0) return null;
                            return (
                              <div ref={(el) => { variantDropdownRefs.current[index] = el; }} style={{ position: 'fixed', background: 'white', border: '1px solid #e2e8f0', borderRadius: '4px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 9999, maxHeight: '200px', overflowY: 'auto', minWidth: '120px' }}>
                                {mat.variants.map((v) => (
                                  <div key={v.variant_id} onClick={() => {
                                    updateItem(index, 'variant', v.variant_name);
                                    updateItem(index, 'variant_id', v.variant_id);
                                    if (v.make) updateItem(index, 'make', v.make);
                                    updateItem(index, 'rate', v.sale_price ?? 0);
                                    setVariantDropdowns(prev => ({ ...prev, [index]: false }));
                                  }} style={{ padding: '6px 10px', cursor: 'pointer', fontSize: '10px', borderBottom: '1px solid #f1f5f9' }} onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
                                    <div style={{ fontWeight: 500 }}>{v.variant_name}</div>
                                    {v.sale_price != null && <div style={{ fontSize: '9px', color: '#94a3b8' }}>₹{v.sale_price}</div>}
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-1.5">
                          {item.material_id ? (
                            <select
                              value={item.warehouse_id || ''}
                              onChange={(e) => updateItem(index, 'warehouse_id', e.target.value)}
                              style={{ width: '100%', padding: '3px 6px', border: '1px solid transparent', borderRadius: '2px', fontSize: '10px', background: 'transparent' }}
                            >
                              <option value="">Select</option>
                              {warehousesQuery.data?.map((wh: any) => (
                                <option key={wh.id} value={wh.id}>{wh.warehouse_name || wh.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-[10px] text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          {(() => {
                            if (!item.material_id || !item.warehouse_id) return <span className="text-[10px] text-slate-400">-</span>;
                            const sr = stockQuery.data?.find((s: any) =>
                              s.item_id === item.material_id &&
                              s.warehouse_id === item.warehouse_id &&
                              (item.variant_id ? s.company_variant_id === item.variant_id : s.company_variant_id === null)
                            );
                            const stock = sr?.current_stock || 0;
                            return <span className={`text-[10px] font-semibold ${stock > 0 ? 'text-slate-800' : 'text-red-600'}`}>{stock}</span>;
                          })()}
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                            className="h-7 text-xs border-transparent focus:border-slate-200 text-right"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            type="number"
                            value={item.rate}
                            onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                            className="h-7 text-xs border-transparent focus:border-slate-200 text-right"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            type="number"
                            value={item.gst_percent}
                            onChange={(e) => updateItem(index, 'gst_percent', parseFloat(e.target.value) || 0)}
                            className="h-7 text-xs border-transparent focus:border-slate-200 text-right"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono">{item.taxable_value.toFixed(2)}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{item.gst_amount.toFixed(2)}</td>
                        <td className="px-3 py-1.5 text-right font-mono font-semibold">{item.total_amount.toFixed(2)}</td>
                        <td className="px-3 py-1.5 text-center">
                          <button
                            onClick={() => removeItem(index)}
                            disabled={items.length <= 1}
                            className="text-slate-400 hover:text-red-500 disabled:opacity-30"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end mt-3">
                <div className="w-64 space-y-1">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Taxable Amount</span>
                    <span className="font-mono">₹{totals.taxable.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>GST (IGST)</span>
                    <span className="font-mono">₹{totals.gst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t pt-1">
                    <span>Total</span>
                    <span className="font-mono text-rose-600">₹{totals.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-slate-50/50 flex flex-row items-center justify-between">
            <ShadcnButton variant="secondary" onClick={() => setOpenDialog(false)} className="px-8 border-slate-200 font-semibold">
              Cancel
            </ShadcnButton>
            <ShadcnButton
              onClick={handleSave}
              className="px-10 bg-rose-600 hover:bg-rose-700 font-bold shadow-lg shadow-rose-100"
              disabled={!billId || !reason || items.length === 0 || saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <FileEdit className="h-4 w-4 mr-2" />
                  Generate DN
                </>
              )}
            </ShadcnButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DebitNotes;
