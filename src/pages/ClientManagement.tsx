import { useState, useEffect, useMemo } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
  Button,
  Input,
  Label,
  Badge,
  Tabs, TabsList, TabsTrigger, TabsContent,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Separator,
  Skeleton,
} from '@/components/ui';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

function getCurrentQueryParams() {
  const hashQuery = window.location.hash.split('?')[1];
  const searchQuery = window.location.search.slice(1);
  return new URLSearchParams(hashQuery || searchQuery || '');
}

type CreateClientEditProps = {
  onSuccess: () => void
  onCancel: () => void
}

type ClientDiscountPortfolioProps = {
  formData: any
  setFormData: (updater: any) => void
  isAdmin: boolean
}

type CreateClientProps = {
  onSuccess: () => void
  onCancel: () => void
  editMode?: boolean
  clientData?: any
}

export function CreateClientEdit({ onSuccess, onCancel }: CreateClientEditProps) {
  const params = getCurrentQueryParams();
  const clientId = params.get('id');

  const clientQuery = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').eq('id', clientId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId
  });

  if (clientQuery.isLoading) {
    return (
      <div className="p-6 md:p-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (clientQuery.isError) {
    return (
      <div className="p-6 md:p-8">
        <Card>
          <CardContent style={{ padding: '24px' }}>
            <p className="text-sm text-red-600">Error loading client. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <CreateClient editMode={true} clientData={clientQuery.data} onSuccess={onSuccess} onCancel={onCancel} />;
}

function ClientDiscountPortfolio({ formData, setFormData, isAdmin }: ClientDiscountPortfolioProps) {
  const [customDiscounts, setCustomDiscounts] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: string; text: string }>({ type: '', text: '' });

  const pricelistsQuery = useQuery({
    queryKey: ['discountPricelists'],
    queryFn: async () => {
      const { data, error } = await supabase.from('standard_discount_pricelists').select('*').eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000
  });

  const structuresQuery = useQuery({
    queryKey: ['discountStructures'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discount_structures')
        .select('*')
        .eq('is_active', true)
        .neq('structure_name', 'Standard');
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000
  });

  const variantsQuery = useQuery({
    queryKey: ['companyVariants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_variants')
        .select('*')
        .eq('is_active', true)
        .order('variant_name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000
  });

  const pricelists = pricelistsQuery.data || [];
  const structures = structuresQuery.data || [];
  const variants = variantsQuery.data || [];

  useEffect(() => {
    if (formData.custom_discounts && typeof formData.custom_discounts === 'object') {
      setCustomDiscounts(formData.custom_discounts);
    } else {
      setCustomDiscounts({});
    }
  }, [formData.custom_discounts]);

  const selectedStructureId = useMemo(() => {
    if (formData.discount_type === 'Standard' || !formData.discount_type) return null;
    const struct = structures.find((s: any) => s.structure_name === formData.discount_type);
    return struct?.id || null;
  }, [formData.discount_type, structures]);

  const previewQuery = useQuery({
    queryKey: ['discountVariantSettings', selectedStructureId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discount_variant_settings')
        .select('*, variant:company_variants(variant_name)')
        .eq('structure_id', selectedStructureId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedStructureId
  });

  const previewSettings = previewQuery.data || [];
  const loading = previewQuery.isFetching;

  const handleCustomDiscountChange = (variantId: string | number, value: string) => {
    setCustomDiscounts((prev: any) => ({
      ...prev,
      [variantId]: parseFloat(value) || 0
    }));
  };

  const handleSaveCustomDiscounts = async () => {
    if (!formData.id) {
      setSaveMessage({ type: 'error', text: 'Please save the client first before saving discounts.' });
      return;
    }
    setSaving(true);
    setSaveMessage({ type: '', text: '' });
    try {
      const { error } = await supabase
        .from('clients')
        .update({ custom_discounts: customDiscounts })
        .eq('id', formData.id);
      if (error) throw error;
      setFormData((prev: any) => ({ ...prev, custom_discounts: customDiscounts }));
      setSaveMessage({ type: 'success', text: 'Discounts saved successfully!' });
    } catch (err: any) {
      setSaveMessage({ type: 'error', text: 'Error saving discounts: ' + (err?.message || err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Discount Portfolio</CardTitle>
          <CardDescription>Choose the pricing strategy for this client.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4" style={{ maxWidth: '480px' }}>
            <div className="space-y-2">
              <Label>Discount Type *</Label>
              <select
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.discount_type || 'Special'}
                onChange={e => setFormData({ ...formData, discount_type: e.target.value, standard_pricelist_id: e.target.value === 'Standard' ? formData.standard_pricelist_id : null })}
                disabled={!isAdmin}
              >
                <option value="Standard">Standard (Price List Based)</option>
                <option value="Premium">Premium (Variant Based)</option>
                <option value="Bulk">Bulk (Variant Based)</option>
                <option value="Special">Special (Variant Based)</option>
              </select>
            </div>
            {formData.discount_type === 'Standard' && (
              <div className="space-y-2">
                <Label>Select Standard Price List *</Label>
                <select
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.standard_pricelist_id || ''}
                  onChange={e => setFormData({ ...formData, standard_pricelist_id: e.target.value })}
                  required
                  disabled={!isAdmin}
                >
                  <option value="">-- Select Price List --</option>
                  {pricelists.map((pl: any) => (
                    <option key={pl.id} value={pl.id}>{pl.pricelist_name} ({pl.discount_percent}%)</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle style={{ fontSize: '15px' }}>Custom Discounts (Per Variant)</CardTitle>
              <CardDescription>Override discount percentages for individual variants.</CardDescription>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveCustomDiscounts}
              disabled={saving || !formData.id}
            >
              {saving ? 'Saving...' : 'Save Discounts'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {saveMessage.text && (
            <div className={cn(
              'mb-4 rounded-lg px-4 py-3 text-sm font-medium',
              saveMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-red-50 text-red-600 border border-red-200'
            )}>
              {saveMessage.text}
            </div>
          )}
          <div className="max-h-[220px] overflow-auto rounded-lg border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ width: '60%' }}>Variant</TableHead>
                  <TableHead style={{ width: '40%' }}>Discount %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variants.length === 0 ? (
                  <TableRow><td colSpan={2} className="px-4 py-3 text-center text-slate-500">No variants found</td></TableRow>
                ) : (
                  variants.map((v: any) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.variant_name}</TableCell>
                      <TableCell>
                        <input
                          type="number"
                          className="h-8 w-20 rounded-md border border-slate-300 bg-white px-2 text-right text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          value={customDiscounts[v.id] || 0}
                          onChange={(e) => handleCustomDiscountChange(v.id, e.target.value)}
                          min="0"
                          max="100"
                          step="0.01"
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle style={{ fontSize: '15px' }}>Portfolio Preview</CardTitle>
          <CardDescription>How discounts will apply for this client.</CardDescription>
        </CardHeader>
        <CardContent>
          {formData.discount_type === 'Standard' ? (
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-5 py-4">
              <p className="text-sm text-slate-700">
                <strong>Standard Discount:</strong> {pricelists.find((pl: any) => pl.id === formData.standard_pricelist_id)?.discount_percent || 0}% flat on all items.
              </p>
            </div>
          ) : (
            <div className="overflow-auto rounded-lg border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead style={{ width: '40%' }}>Variant</TableHead>
                    <TableHead style={{ width: '20%' }}>Default %</TableHead>
                    <TableHead style={{ width: '20%' }}>Min %</TableHead>
                    <TableHead style={{ width: '20%' }}>Max %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><td colSpan={4} className="px-4 py-3 text-center text-slate-500">Loading...</td></TableRow>
                  ) : previewSettings.length === 0 ? (
                    <TableRow><td colSpan={4} className="px-4 py-3 text-center text-slate-500">No settings found.</td></TableRow>
                  ) : (
                    previewSettings.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.variant?.variant_name}</TableCell>
                        <TableCell>{s.default_discount_percent}%</TableCell>
                        <TableCell>{s.min_discount_percent}%</TableCell>
                        <TableCell>{s.max_discount_percent}%</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function CreateClient({ onSuccess, onCancel, editMode, clientData }: CreateClientProps) {
  const { organisation, organisations } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = organisations?.find((o: any) => o.organisation.id === organisation?.id)?.role?.toLowerCase() === 'admin';

  const [activeTab, setActiveTab] = useState('general');
  const [formData, setFormData] = useState<any>({
    client_name: '', address1: '', address2: '', state: '', city: '', pincode: '',
    gstin: '', contact: '', email: '', vendor_no: '', remarks: '', category: 'Active',
    contact_person: '', contact_designation: '', contact_person_email: '',
    contact_person_2: '', contact_designation_2: '', contact_person_2_contact: '', contact_person_2_email: '',
    purchase_person: '', purchase_designation: '', purchase_contact: '', purchase_email: '',
    about_client: '', discount_type: 'Special', standard_pricelist_id: null
  });
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (clientData) {
      setFormData(clientData);
      setTimeout(() => setIsDirty(false), 100);
    }
  }, [clientData]);

  useEffect(() => {
    if (formData.client_name) {
      setIsDirty(true);
    }
  }, [formData]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !saving) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, saving]);

  const [gstError, setGstError] = useState('');
  const [showShippingForm, setShowShippingForm] = useState(false);
  const [newShipping, setNewShipping] = useState({
    address_name: '', address_line1: '', address_line2: '', city: '', state: '',
    pincode: '', gstin: '', contact: '', is_default: false
  });

  const indianStates = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
    'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry'
  ];

  const gstStateCodes: Record<string, string> = {
    '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
    '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
    '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
    '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
    '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
    '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
    '25': 'Maharashtra', '26': 'Karnataka', '27': 'Goa', '28': 'Lakshadweep',
    '29': 'Kerala', '30': 'Tamil Nadu', '31': 'Puducherry', '32': 'Andaman and Nicobar Islands',
    '33': 'Telangana', '34': 'Andhra Pradesh', '35': 'Ladakh'
  };

  const shippingQuery = useQuery({
    queryKey: ['clientShipping', clientData?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_shipping_addresses')
        .select('*')
        .eq('client_id', clientData?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: editMode && !!clientData?.id
  });

  const shippingAddresses = shippingQuery.data || [];

  const handleGstChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    if (value.length <= 15) {
      setFormData({ ...formData, gstin: value });
      if (value.length >= 2) {
        const stateCode = value.substring(0, 2);
        const detectedState = gstStateCodes[stateCode];
        if (detectedState) setFormData((prev: any) => ({ ...prev, gstin: value, state: detectedState }));
      }
      if (value.length > 0 && value.length < 15) setGstError('GSTIN must be exactly 15 characters');
      else setGstError('');
    }
  };

  const copyBillingToShipping = () => {
    setNewShipping({
      ...newShipping,
      address_line1: formData.address1 || '',
      address_line2: formData.address2 || '',
      city: formData.city || '',
      state: formData.state || '',
      pincode: formData.pincode || ''
    });
    setShowShippingForm(true);
  };

  const addShippingAddress = async () => {
    if (!editMode || !clientData?.id) {
      alert('Please save client first before adding shipping addresses');
      return;
    }
    const { error } = await supabase.from('client_shipping_addresses').insert({
      client_id: clientData.id,
      ...newShipping
    });
    if (error) {
      alert('Error: ' + error.message);
    } else {
      setNewShipping({ address_name: '', address_line1: '', address_line2: '', city: '', state: '', pincode: '', gstin: '', contact: '', is_default: false });
      setShowShippingForm(false);
      queryClient.invalidateQueries({ queryKey: ['clientShipping', clientData.id] });
    }
  };

  const deleteShippingAddress = async (id: string) => {
    if (!confirm('Delete this shipping address?')) return;
    await supabase.from('client_shipping_addresses').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['clientShipping', clientData.id] });
  };

  const deleteClient = async () => {
    if (!editMode || !clientData?.id) return;
    if (!confirm(`Are you sure you want to delete client "${formData.client_name}"? This action cannot be undone.`)) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('clients').delete().eq('id', clientData.id);
      if (error) throw error;
      alert('Client deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setIsDirty(false);
      onCancel();
    } catch (err: any) {
      alert('Error deleting client: ' + (err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e?: FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (formData.gstin && formData.gstin.length !== 15) {
      alert('GSTIN must be exactly 15 characters');
      return;
    }
    setSaving(true);
    try {
      if (editMode && clientData?.id) {
        const { error } = await supabase.from('clients').update(formData).eq('id', clientData.id);
        if (error) throw error;
        alert('Client updated successfully!');
      } else {
        const clientId = 'CLT-' + Date.now().toString().slice(-6);
        const { error } = await supabase.from('clients').insert({ ...formData, client_id: clientId });
        if (error) throw error;
        alert('Client saved successfully!');
      }
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setIsDirty(false);
      onSuccess();
    } catch (error) {
      alert('Error: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const inputCn = 'h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const selectCn = inputCn;

  return (
    <div className="min-h-screen bg-slate-50 p-5 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">

        <div>
          <h1 className="text-2xl font-bold text-slate-900">{editMode ? 'Edit Client' : 'Create Client'}</h1>
          <p className="mt-1 text-sm text-slate-500">{editMode ? 'Update client information' : 'Add a new client to your organization'}</p>
        </div>

        <Tabs defaultValue="general" value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6 pt-6">

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label>Client Name *</Label>
                      <Input value={formData.client_name} onChange={e => setFormData({ ...formData, client_name: (e.target as HTMLInputElement).value })} required placeholder="Client name" />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <select className={selectCn} value={formData.category || 'Active'} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Prospect">Prospect</option>
                      </select>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      <span className="text-sm font-semibold text-slate-700">Contact Persons</span>
                    </div>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Input value={formData.contact_person || ''} onChange={e => setFormData({ ...formData, contact_person: (e.target as HTMLInputElement).value })} placeholder="Contact 1" />
                        <Input value={formData.contact_designation || ''} onChange={e => setFormData({ ...formData, contact_designation: (e.target as HTMLInputElement).value })} placeholder="Designation" />
                        <Input value={formData.contact || ''} onChange={e => setFormData({ ...formData, contact: (e.target as HTMLInputElement).value })} placeholder="Phone" />
                        <Input type="email" value={formData.contact_person_email || ''} onChange={e => setFormData({ ...formData, contact_person_email: (e.target as HTMLInputElement).value })} placeholder="Email" />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Input value={formData.contact_person_2 || ''} onChange={e => setFormData({ ...formData, contact_person_2: (e.target as HTMLInputElement).value })} placeholder="Contact 2" />
                        <Input value={formData.contact_designation_2 || ''} onChange={e => setFormData({ ...formData, contact_designation_2: (e.target as HTMLInputElement).value })} placeholder="Designation" />
                        <Input value={formData.contact_person_2_contact || ''} onChange={e => setFormData({ ...formData, contact_person_2_contact: (e.target as HTMLInputElement).value })} placeholder="Phone" />
                        <Input type="email" value={formData.contact_person_2_email || ''} onChange={e => setFormData({ ...formData, contact_person_2_email: (e.target as HTMLInputElement).value })} placeholder="Email" />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Input value={formData.purchase_person || ''} onChange={e => setFormData({ ...formData, purchase_person: (e.target as HTMLInputElement).value })} placeholder="Purchase Person" />
                        <Input value={formData.purchase_designation || ''} onChange={e => setFormData({ ...formData, purchase_designation: (e.target as HTMLInputElement).value })} placeholder="Designation" />
                        <Input value={formData.purchase_contact || ''} onChange={e => setFormData({ ...formData, purchase_contact: (e.target as HTMLInputElement).value })} placeholder="Phone" />
                        <Input type="email" value={formData.purchase_email || ''} onChange={e => setFormData({ ...formData, purchase_email: (e.target as HTMLInputElement).value })} placeholder="Email" />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label>GST IN</Label>
                      <Input value={formData.gstin || ''} onChange={handleGstChange} placeholder="15 characters" maxLength={15} />
                      {gstError && <p className="text-xs text-red-500 mt-1">{gstError}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Vendor No</Label>
                      <Input value={formData.vendor_no || ''} onChange={e => setFormData({ ...formData, vendor_no: (e.target as HTMLInputElement).value })} />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="border-emerald-200 bg-emerald-50/40">
                      <CardHeader style={{ padding: '16px 20px 12px' }}>
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          <CardTitle style={{ fontSize: '14px', color: '#047857' }}>Billing Address</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent style={{ padding: '0 20px 20px' }}>
                        <div className="space-y-3">
                          <Input value={formData.address1 || ''} onChange={e => setFormData({ ...formData, address1: (e.target as HTMLInputElement).value })} placeholder="Address Line 1" />
                          <Input value={formData.address2 || ''} onChange={e => setFormData({ ...formData, address2: (e.target as HTMLInputElement).value })} placeholder="Address Line 2" />
                          <div className="grid grid-cols-3 gap-2">
                            <select className={cn(selectCn, 'text-xs')} value={formData.state || ''} onChange={e => setFormData({ ...formData, state: e.target.value })}>
                              <option value="">State</option>
                              {indianStates.map(state => (<option key={state} value={state}>{state}</option>))}
                            </select>
                            <Input value={formData.city || ''} onChange={e => setFormData({ ...formData, city: (e.target as HTMLInputElement).value })} placeholder="City" style={{ fontSize: '13px' }} />
                            <Input value={formData.pincode || ''} onChange={e => setFormData({ ...formData, pincode: (e.target as HTMLInputElement).value })} placeholder="Pincode" style={{ fontSize: '13px' }} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                          <span className="text-sm font-semibold text-slate-700">Shipping Addresses</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={copyBillingToShipping}>
                          Copy Billing
                        </Button>
                      </div>

                      {shippingAddresses.map((addr: any) => (
                        <Card key={addr.id} hover>
                          <CardContent style={{ padding: '12px 16px' }}>
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="text-sm font-semibold text-slate-800">
                                  {addr.address_name || 'Address'}
                                  {addr.is_default && <span className="ml-2"><Badge variant="default" size="sm">Default</Badge></span>}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">{addr.address_line1} {addr.address_line2}</div>
                                <div className="text-xs text-slate-500">{addr.city}, {addr.state} - {addr.pincode}</div>
                              </div>
                              <Button variant="ghost" size="sm" onClick={() => deleteShippingAddress(addr.id)} style={{ color: '#94a3b8' }}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}

                      {showShippingForm && (
                        <Card className="border-indigo-200 bg-indigo-50/40">
                          <CardHeader style={{ padding: '12px 16px 8px' }}>
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                              <CardTitle style={{ fontSize: '13px', color: '#4338ca' }}>Add Shipping Address</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent style={{ padding: '0 16px 16px' }}>
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <Input value={newShipping.address_name} onChange={e => setNewShipping({ ...newShipping, address_name: (e.target as HTMLInputElement).value })} placeholder="Address Name" />
                                <Input value={newShipping.contact} onChange={e => setNewShipping({ ...newShipping, contact: (e.target as HTMLInputElement).value })} placeholder="Contact" />
                              </div>
                              <Input value={newShipping.address_line1} onChange={e => setNewShipping({ ...newShipping, address_line1: (e.target as HTMLInputElement).value })} placeholder="Address Line 1" />
                              <Input value={newShipping.address_line2} onChange={e => setNewShipping({ ...newShipping, address_line2: (e.target as HTMLInputElement).value })} placeholder="Address Line 2" />
                              <div className="grid grid-cols-3 gap-2">
                                <select className={cn(selectCn, 'text-xs')} value={newShipping.state} onChange={e => setNewShipping({ ...newShipping, state: e.target.value })}>
                                  <option value="">State</option>
                                  {indianStates.map(state => (<option key={state} value={state}>{state}</option>))}
                                </select>
                                <Input value={newShipping.city} onChange={e => setNewShipping({ ...newShipping, city: (e.target as HTMLInputElement).value })} placeholder="City" style={{ fontSize: '13px' }} />
                                <Input value={newShipping.pincode} onChange={e => setNewShipping({ ...newShipping, pincode: (e.target as HTMLInputElement).value })} placeholder="Pincode" style={{ fontSize: '13px' }} />
                              </div>
                              <div className="flex gap-2 pt-1">
                                <Button variant="primary" size="sm" onClick={addShippingAddress}>Save</Button>
                                <Button variant="secondary" size="sm" onClick={() => setShowShippingForm(false)}>Cancel</Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {!showShippingForm && shippingAddresses.length === 0 && (
                        <button
                          type="button"
                          className="w-full rounded-lg border-2 border-dashed border-slate-300 py-4 text-sm text-slate-500 transition hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50"
                          onClick={() => setShowShippingForm(true)}
                        >
                          <span className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                            Add Shipping Address
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label>Remarks</Label>
                      <Textarea rows={3} value={formData.remarks || ''} onChange={e => setFormData({ ...formData, remarks: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>About Client</Label>
                      <Textarea rows={3} value={formData.about_client || ''} onChange={e => setFormData({ ...formData, about_client: e.target.value })} placeholder="Additional information..." />
                    </div>
                  </div>

                  <Separator />

                  <div className="flex flex-wrap gap-3">
                    <Button variant="primary" type="submit" disabled={saving}>
                      {editMode ? 'Update Client' : 'Submit'}
                    </Button>
                    {editMode && (
                      <Button variant="danger" type="button" onClick={deleteClient} disabled={saving}>
                        Delete
                      </Button>
                    )}
                    <Button variant="secondary" type="button" onClick={onCancel} disabled={saving}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pricing">
            <div className="space-y-5">
              <ClientDiscountPortfolio formData={formData} setFormData={setFormData} isAdmin={isAdmin} />
              <Separator />
              <div className="flex gap-3">
                <Button variant="primary" onClick={() => handleSubmit()}>
                  {editMode ? 'Update Pricing' : 'Submit'}
                </Button>
                <Button variant="secondary" onClick={onCancel}>
                  Cancel
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default CreateClient;
