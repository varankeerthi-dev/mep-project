import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import {
  Trash2 as TrashIcon,
  Plus as PlusIcon,
  Save as SaveIcon,
  ChevronLeft as ChevronLeftIcon,
  Loader2,
  Search
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { toast } from '../../lib/logger';

interface LineItem {
  id?: string;
  item_id: string;
  variant_id?: string | null;
  make?: string;
  description: string;
  qty: number;
  uom: string;
  rate: number;
  discount_percent: number;
  tax_percent: number;
  line_total: number;
}

export default function SalesOrderCreate({ editMode = false }: { editMode?: boolean }) {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const orgId = organisation?.id;
  const [searchParams] = useSearchParams();
  const quotationId = searchParams.get('quotationId');

  const [saving, setSaving] = useState(false);
  const [soNo, setSoNo] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [clientPoId, setClientPoId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [state, setState] = useState('');
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);

  // Fetch Clients
  const { data: clients = [] } = useQuery({
    queryKey: ['clients', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from('clients')
        .select('id, client_name, billing_address, shipping_address, gstin, state')
        .eq('organisation_id', orgId);
      return data || [];
    },
    enabled: !!orgId
  });

  // Fetch Projects
  const { data: projects = [] } = useQuery({
    queryKey: ['projects', orgId, clientId],
    queryFn: async () => {
      if (!orgId || !clientId) return [];
      const { data } = await supabase
        .from('projects')
        .select('id, name')
        .eq('organisation_id', orgId)
        .eq('client_id', clientId);
      return data || [];
    },
    enabled: !!orgId && !!clientId
  });

  // Fetch Materials/Products (only Finished Goods)
  const { data: materials = [] } = useQuery({
    queryKey: ['materials', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from('materials')
        .select('id, name, code, uom, default_sales_rate')
        .eq('organisation_id', orgId)
        .eq('category', 'finished_good');
      return data || [];
    },
    enabled: !!orgId
  });

  // Fetch Variants
  const { data: variants = [] } = useQuery({
    queryKey: ['variants', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from('company_variants')
        .select('*')
        .eq('organisation_id', orgId)
        .eq('is_active', true)
        .order('variant_name');
      return data || [];
    },
    enabled: !!orgId
  });

  // Fetch Item Variant Pricing
  const { data: variantPricingList = [] } = useQuery({
    queryKey: ['variant-pricing', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from('item_variant_pricing')
        .select('item_id, company_variant_id, sale_price, make')
        .eq('organisation_id', orgId);
      return data || [];
    },
    enabled: !!orgId
  });

  // Parse variantPricing mapping
  const pricingMap = useMemo(() => {
    const pricing: Record<string, Record<string, Record<string, number>>> = {};
    variantPricingList.forEach((row: any) => {
      const itemId = row.item_id;
      const variantId = row.company_variant_id || 'no_variant';
      const make = row.make || '';
      if (!pricing[itemId]) pricing[itemId] = {};
      if (!pricing[itemId][variantId]) pricing[itemId][variantId] = {};
      pricing[itemId][variantId][make] = parseFloat(row.sale_price) || 0;
    });
    return pricing;
  }, [variantPricingList]);

  // Parse available makes per item
  const itemMakesMap = useMemo(() => {
    const makesMap: Record<string, string[]> = {};
    variantPricingList.forEach((row: any) => {
      const itemId = row.item_id;
      const make = row.make;
      if (make) {
        if (!makesMap[itemId]) makesMap[itemId] = [];
        if (!makesMap[itemId].includes(make)) {
          makesMap[itemId].push(make);
        }
      }
    });
    return makesMap;
  }, [variantPricingList]);

  // Resolve rates helper
  const getRateForMaterialVariant = (itemId: string, variantId: string | null, make: string) => {
    if (!itemId) return 0;
    const vId = variantId || 'no_variant';
    const mName = make || '';
    
    const itemPricing = pricingMap[itemId] || {};
    const variantPricing = itemPricing[vId] || {};
    if (variantPricing[mName] !== undefined) {
      return variantPricing[mName];
    }
    
    if (mName) {
      for (const v in itemPricing) {
        if (itemPricing[v][mName] !== undefined) {
          return itemPricing[v][mName];
        }
      }
    }
    
    const mat = materials.find((m: any) => m.id === itemId);
    return mat?.default_sales_rate || 0;
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.client-dropdown-container')) {
        setIsClientDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Auto-fill client addresses and details
  useEffect(() => {
    if (!clientId) return;
    const client = clients.find((c: any) => c.id === clientId);
    if (client) {
      setBillingAddress(client.billing_address || '');
      setShippingAddress(client.shipping_address || '');
      setGstin(client.gstin || '');
      setState(client.state || '');
    }
  }, [clientId, clients]);

  // Load from Quotation if quotationId is in query params
  useEffect(() => {
    if (!quotationId || !orgId) return;

    const loadQuotation = async () => {
      const { data: quote, error: quoteError } = await supabase
        .from('quotation_header')
        .select('*')
        .eq('id', quotationId)
        .single();

      if (quoteError || !quote) {
        toast.error('Failed to load quotation');
        return;
      }

      setClientId(quote.client_id || '');
      setProjectId(quote.project_id || '');
      setBillingAddress(quote.billing_address || '');
      setShippingAddress(quote.shipping_address || '');
      setGstin(quote.gstin || '');
      setState(quote.state || '');
      setRemarks(quote.remarks || '');

      const { data: quoteItems, error: itemsError } = await supabase
        .from('quotation_items')
        .select('*')
        .eq('quotation_id', quotationId);

      if (itemsError || !quoteItems) {
        toast.error('Failed to load quotation items');
        return;
      }

      const mappedItems: LineItem[] = quoteItems.map((qi: any) => ({
        item_id: qi.item_id || '',
        variant_id: qi.variant_id || null,
        make: qi.make || '',
        description: qi.description || '',
        qty: parseFloat(qi.qty) || 0,
        uom: qi.uom || 'nos',
        rate: parseFloat(qi.rate) || 0,
        discount_percent: parseFloat(qi.discount_percent) || 0,
        tax_percent: parseFloat(qi.tax_percent) || 0,
        line_total: parseFloat(qi.line_total) || 0
      }));
      setItems(mappedItems);
    };

    loadQuotation();
  }, [quotationId, orgId]);

  // Generate SO Number
  useEffect(() => {
    if (!orgId || editMode) return;
    const getSoNumber = async () => {
      const { data, error } = await supabase.rpc('generate_sales_order_no', {
        p_org_id: orgId
      });
      if (!error && data) setSoNo(data);
    };
    getSoNumber();
  }, [orgId, editMode]);

  // Helper calculations
  const totals = useMemo(() => {
    let subtotal = 0;
    let taxAmount = 0;
    let grandTotal = 0;

    items.forEach((item) => {
      const lineSubtotal = item.qty * item.rate * (1 - item.discount_percent / 100);
      const lineTax = lineSubtotal * (item.tax_percent / 100);
      const lineTotal = lineSubtotal + lineTax;

      item.line_total = parseFloat(lineTotal.toFixed(2));
      subtotal += lineSubtotal;
      taxAmount += lineTax;
      grandTotal += lineTotal;
    });

    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      taxAmount: parseFloat(taxAmount.toFixed(2)),
      grandTotal: parseFloat(grandTotal.toFixed(2))
    };
  }, [items]);

  const addLineItem = () => {
    setItems([
      ...items,
      {
        item_id: '',
        variant_id: null,
        make: '',
        description: '',
        qty: 1,
        uom: 'nos',
        rate: 0,
        discount_percent: 0,
        tax_percent: 18,
        line_total: 0
      }
    ]);
  };

  const removeLineItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, patch: Partial<LineItem>) => {
    setItems(
      items.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, ...patch };

        if (patch.item_id) {
          const mat = materials.find((m: any) => m.id === patch.item_id);
          if (mat) {
            next.uom = mat.uom || 'nos';
            next.variant_id = null;
            next.make = '';
            next.rate = mat.default_sales_rate || 0;
          }
        }

        return next;
      })
    );
  };

  const handleSave = async () => {
    if (!orgId) return;
    if (!clientId) {
      toast.error('Please select a client');
      return;
    }
    if (items.length === 0) {
      toast.error('Please add at least one line item');
      return;
    }
    if (items.some((item) => !item.item_id || item.qty <= 0 || item.rate <= 0)) {
      toast.error('All line items must have a valid product, quantity, and rate');
      return;
    }

    try {
      setSaving(true);

      const soHeader = {
        sales_order_no: soNo,
        client_id: clientId,
        project_id: projectId || null,
        quotation_id: quotationId || null,
        client_po_id: clientPoId || null,
        order_date: orderDate,
        delivery_date: deliveryDate || null,
        billing_address: billingAddress,
        shipping_address: shippingAddress,
        gstin,
        state,
        remarks,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        grand_total: totals.grandTotal,
        status: 'draft',
        organisation_id: orgId
      };

      const { data: savedSo, error: soError } = await supabase
        .from('sales_orders')
        .insert(soHeader)
        .select()
        .single();

      if (soError || !savedSo) throw soError;

      const soItems = items.map((item) => ({
        sales_order_id: savedSo.id,
        item_id: item.item_id,
        variant_id: item.variant_id || null,
        make: item.make || null,
        description: item.description,
        qty: item.qty,
        uom: item.uom,
        rate: item.rate,
        discount_percent: item.discount_percent,
        tax_percent: item.tax_percent,
        line_total: item.line_total
      }));

      const { error: itemsError } = await supabase
        .from('sales_order_items')
        .insert(soItems);

      if (itemsError) throw itemsError;

      toast.success('Sales Order created successfully');
      navigate('/sales-orders');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save Sales Order');
    } finally {
      setSaving(false);
    }
  };

  const selectedClient = clients.find((c: any) => c.id === clientId);

  // Field row rendering helper matching DESIGN.md Document Section Pattern
  const renderHeaderField = (label: string, field: React.ReactNode, isLast = false) => (
    <div className="flex items-center gap-2" style={{ marginBottom: isLast ? 0 : '8px' }}>
      <span style={{ minWidth: '90px', maxWidth: '90px', fontWeight: 600, fontSize: '11px', color: '#374151', textAlign: 'right' }}>
        {label}
      </span>
      <div className="flex-1">{field}</div>
    </div>
  );

  const filteredClients = clients.filter((c: any) =>
    !clientSearch || c.client_name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-zinc-50 p-6 space-y-6">
      {/* Fixed top action bar */}
      <div className="flex items-center justify-between border-b pb-4 bg-white -mx-6 -mt-6 p-6 shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/sales-orders')} className="h-8 w-8">
            <ChevronLeftIcon className="h-5 w-5 text-zinc-500" />
          </Button>
          <div>
            <h1 className="text-base font-bold text-zinc-950">
              {editMode ? 'Edit Sales Order' : 'Create Sales Order'}
            </h1>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              Follows core quoteui document entry conventions
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate('/sales-orders')}
            className="h-8 px-4 text-xs font-medium border-zinc-300 text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="h-8 px-4 text-xs font-semibold text-white bg-[#185FA5] hover:bg-[#0C447C] border border-[#185FA5] rounded-md transition-all shadow-sm"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <SaveIcon className="h-3.5 w-3.5 mr-1" />
                Save Sales Order
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 3-Column Header Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Client Card */}
        <div className="bg-white p-5 shadow-sm space-y-4">
          <h2 style={{ fontWeight: 600, fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
            Client Info
          </h2>

          <div className="space-y-2">
            {/* Searchable Client Dropdown */}
            {renderHeaderField(
              'Client:',
              <div className="relative client-dropdown-container">
                <div className="relative">
                  <Input
                    value={clientSearch || (clientId ? clients.find((c: any) => c.id === clientId)?.client_name : '')}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setIsClientDropdownOpen(true);
                    }}
                    onFocus={() => setIsClientDropdownOpen(true)}
                    placeholder="Search Client..."
                    className="h-8 text-xs pr-8"
                  />
                  <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                </div>

                {isClientDropdownOpen && (
                  <div
                    className="absolute top-full left-0 right-0 z-50 bg-white border border-zinc-200 shadow-lg max-h-48 overflow-y-auto mt-1"
                    style={{ zIndex: 100 }}
                  >
                    {filteredClients.map((c: any) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setClientId(c.id);
                          setIsClientDropdownOpen(false);
                          setClientSearch('');
                        }}
                        className="px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer border-b last:border-0"
                      >
                        {c.client_name}
                      </div>
                    ))}
                    {filteredClients.length === 0 && (
                      <div className="px-3 py-2 text-xs text-zinc-400 italic text-center">
                        No clients found
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {renderHeaderField(
              'Project:',
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={!clientId}
                className="w-full h-8 px-2 rounded-md border border-zinc-200 text-xs bg-white disabled:bg-zinc-50 disabled:text-zinc-400"
              >
                <option value="">Select Project (Optional)</option>
                {projects.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}

            {renderHeaderField(
              'Client PO:',
              <Input
                value={clientPoId}
                onChange={(e) => setClientPoId(e.target.value)}
                placeholder="PO Reference"
                className="h-8 text-xs"
              />
            )}
          </div>
        </div>

        {/* Card 2: Document Card */}
        <div className="bg-white p-5 shadow-sm space-y-4">
          <h2 style={{ fontWeight: 600, fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
            Document Info
          </h2>

          <div className="space-y-2">
            {renderHeaderField(
              'SO Number:',
              <Input
                value={soNo}
                onChange={(e) => setSoNo(e.target.value)}
                placeholder="SO-XXXX-XXXX"
                className="h-8 text-xs font-semibold"
              />
            )}

            {renderHeaderField(
              'Order Date:',
              <Input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="h-8 text-xs"
              />
            )}

            {renderHeaderField(
              'Delivery Date:',
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="h-8 text-xs"
              />
            )}
          </div>
        </div>

        {/* Card 3: Address & Supply Details Card */}
        <div className="bg-white p-5 shadow-sm space-y-4">
          <h2 style={{ fontWeight: 600, fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
            Tax & Address Info
          </h2>

          <div className="space-y-2">
            {renderHeaderField(
              'GSTIN:',
              <Input
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                placeholder="GSTIN"
                className="h-8 text-xs"
              />
            )}

            {renderHeaderField(
              'Supply State:',
              <Input
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="Place of Supply"
                className="h-8 text-xs"
              />
            )}

            {renderHeaderField(
              'Billing Addr:',
              <Textarea
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                className="text-xs min-h-[40px] py-1 px-2"
                rows={1}
              />
            )}

            {renderHeaderField(
              'Shipping Addr:',
              <Textarea
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                className="text-xs min-h-[40px] py-1 px-2"
                rows={1}
              />
            )}
          </div>
        </div>
      </div>

      {/* Line Items Table Shell */}
      <div className="bg-white shadow-sm mb-6 mt-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Line Items (Finished Goods)
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={addLineItem}
            className="text-xs font-semibold border-zinc-200 hover:bg-zinc-50 text-[#185FA5]"
          >
            <PlusIcon className="h-3.5 w-3.5 mr-1" />
            Add Row
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#1e3a8a] text-white text-[11px] font-bold uppercase text-left">
                <th className="py-2.5 px-4 w-[200px]">Product</th>
                <th className="py-2.5 px-3 w-[150px]">Variant</th>
                <th className="py-2.5 px-3 w-[120px]">Make</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3 text-right w-[90px]">Qty</th>
                <th className="py-2.5 px-3 w-[70px]">UOM</th>
                <th className="py-2.5 px-3 text-right w-[110px]">Rate (₹)</th>
                <th className="py-2.5 px-3 text-right w-[80px]">GST %</th>
                <th className="py-2.5 px-3 text-right w-[130px]">Line Total</th>
                <th className="py-2.5 px-3 w-[50px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {items.map((item, index) => (
                <tr key={index} className="hover:bg-zinc-50/40">
                  {/* Material/Product Select */}
                  <td className="py-2 px-4">
                    <select
                      value={item.item_id}
                      onChange={(e) => updateLineItem(index, { item_id: e.target.value })}
                      className="w-full h-8 px-2 rounded-md border border-zinc-200 text-xs bg-white"
                    >
                      <option value="">Select Finished Product</option>
                      {materials.map((m: any) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.code})
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Variant Select */}
                  <td className="py-2 px-3">
                    <select
                      value={item.variant_id || ''}
                      onChange={(e) => {
                        const nextVariant = e.target.value || null;
                        const rate = getRateForMaterialVariant(item.item_id, nextVariant, item.make || '');
                        updateLineItem(index, { variant_id: nextVariant, rate });
                      }}
                      disabled={!item.item_id}
                      className="w-full h-8 px-2 rounded-md border border-zinc-200 text-xs bg-white disabled:bg-zinc-50 disabled:text-zinc-400"
                    >
                      <option value="">No Variant</option>
                      {variants
                        .filter((v: any) => {
                          const itemPricing = pricingMap[item.item_id] || {};
                          return itemPricing[v.id];
                        })
                        .map((v: any) => (
                          <option key={v.id} value={v.id}>
                            {v.variant_name}
                          </option>
                        ))}
                    </select>
                  </td>

                  {/* Make Select */}
                  <td className="py-2 px-3">
                    <select
                      value={item.make || ''}
                      onChange={(e) => {
                        const nextMake = e.target.value;
                        const rate = getRateForMaterialVariant(item.item_id, item.variant_id || null, nextMake);
                        updateLineItem(index, { make: nextMake, rate });
                      }}
                      disabled={!item.item_id}
                      className="w-full h-8 px-2 rounded-md border border-zinc-200 text-xs bg-white disabled:bg-zinc-50 disabled:text-zinc-400"
                    >
                      <option value="">No Make</option>
                      {(itemMakesMap[item.item_id] || []).map((m: string) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="py-2 px-3">
                    <Input
                      value={item.description}
                      onChange={(e) => updateLineItem(index, { description: e.target.value })}
                      placeholder="Specifications"
                      className="h-8 text-xs"
                    />
                  </td>

                  <td className="py-2 px-3">
                    <Input
                      type="number"
                      value={item.qty || ''}
                      onChange={(e) => updateLineItem(index, { qty: parseFloat(e.target.value) || 0 })}
                      className="h-8 text-xs text-right"
                    />
                  </td>

                  <td className="py-2 px-3">
                    <Input
                      value={item.uom}
                      disabled
                      className="h-8 text-xs bg-zinc-50 text-zinc-500 border-zinc-200"
                    />
                  </td>

                  <td className="py-2 px-3">
                    <Input
                      type="number"
                      value={item.rate || ''}
                      onChange={(e) => updateLineItem(index, { rate: parseFloat(e.target.value) || 0 })}
                      className="h-8 text-xs text-right"
                    />
                  </td>

                  <td className="py-2 px-3">
                    <Input
                      type="number"
                      value={item.tax_percent || ''}
                      onChange={(e) => updateLineItem(index, { tax_percent: parseFloat(e.target.value) || 0 })}
                      className="h-8 text-xs text-right"
                    />
                  </td>

                  <td className="py-2 px-3 text-right font-bold text-zinc-900 text-xs">
                    ₹{item.line_total.toLocaleString()}
                  </td>

                  <td className="py-2 px-3 text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLineItem(index)}
                      className="h-8 w-8 text-zinc-400 hover:text-red-600"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-xs text-zinc-400 italic">
                    No line items added yet. Click "Add Row" to start.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Area: Remarks & Totals */}
      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-6">
        {/* Remarks Card */}
        <div className="bg-white p-5 shadow-sm space-y-3">
          <span style={{ fontWeight: 600, fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Notes & Remarks
          </span>
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Write internal remarks, contract terms, or special instructions..."
            className="text-xs min-h-[100px]"
          />
        </div>

        {/* Financial Summary Card */}
        <div className="bg-white p-5 shadow-sm space-y-4">
          <span style={{ fontWeight: 600, fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Financial Summary
          </span>

          <div className="space-y-2.5 text-xs text-zinc-600">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-semibold text-zinc-950">₹{totals.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Taxes (GST):</span>
              <span className="font-semibold text-zinc-950">₹{totals.taxAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between pt-2.5 border-t text-sm font-bold text-zinc-950">
              <span>Grand Total:</span>
              <span className="text-[#185FA5] text-base font-bold">₹{totals.grandTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
