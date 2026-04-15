import { useState, useEffect, useMemo } from 'react';
import type { ChangeEvent, FormEvent, CSSProperties, ComponentProps } from 'react';
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

const selectCn = 'h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px] text-slate-800 outline-none transition-colors focus:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50';

const SectionHeading = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="flex items-center gap-2.5 pb-1">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">{icon}</span>
    <h3 className="text-sm font-semibold text-slate-800 tracking-wide">{children}</h3>
  </div>
);

const FieldGroup = ({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-[11px] font-semibold text-[#374151]">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </Label>
    {children}
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
);

const dcInputStyle: CSSProperties = { padding: '4px 8px', fontSize: '12px', background: '#ffffff' };
const dcTextAreaStyle: CSSProperties = { padding: '6px 8px', fontSize: '12px', background: '#ffffff', minHeight: '60px' };

const CompactInput = (props: ComponentProps<typeof Input>) => (
  <Input {...props} style={{ ...dcInputStyle, ...(props.style || {}) }} />
);

const CompactTextarea = (props: ComponentProps<typeof Textarea>) => (
  <Textarea {...props} style={{ ...dcTextAreaStyle, ...(props.style || {}) }} />
);

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
      <div className="min-h-screen bg-slate-50/80 p-6 md:p-10 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-slate-600 mb-4">Loading...</p>
        </div>
      </div>
    );
  }

  if (clientQuery.isError) {
    return (
      <div className="min-h-screen bg-slate-50/80 p-6 md:p-10">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-sm text-red-600">Error loading client. Please try again.</p>
              <Button variant="secondary" size="sm" onClick={onCancel} style={{ marginTop: '16px' }}>Go Back</Button>
            </CardContent>
          </Card>
        </div>
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle style={{ fontSize: '16px' }}>Discount Portfolio</CardTitle>
          <CardDescription>Choose the pricing strategy for this client.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FieldGroup label="Discount Type" required>
              <select
                className={selectCn}
                value={formData.discount_type || 'Special'}
                onChange={e => setFormData({ ...formData, discount_type: e.target.value, standard_pricelist_id: e.target.value === 'Standard' ? formData.standard_pricelist_id : null })}
                disabled={!isAdmin}
              >
                <option value="Standard">Standard (Price List Based)</option>
                <option value="Premium">Premium (Variant Based)</option>
                <option value="Bulk">Bulk (Variant Based)</option>
                <option value="Special">Special (Variant Based)</option>
              </select>
            </FieldGroup>
            {formData.discount_type === 'Standard' && (
              <FieldGroup label="Standard Price List" required>
                <select
                  className={selectCn}
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
              </FieldGroup>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle style={{ fontSize: '16px' }}>Custom Discounts</CardTitle>
              <CardDescription>Override discount percentages per variant.</CardDescription>
            </div>
            <Button variant="primary" size="sm" onClick={handleSaveCustomDiscounts} disabled={saving || !formData.id}>
              {saving ? 'Saving...' : 'Save Discounts'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {saveMessage.text && (
            <div className={cn(
              'mb-5 rounded-lg px-4 py-3 text-sm font-medium',
              saveMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'
            )}>
              {saveMessage.text}
            </div>
          )}
          <div className="max-h-56 overflow-auto rounded-lg border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ width: '60%' }}>Variant</TableHead>
                  <TableHead style={{ width: '40%' }}>Discount %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variants.length === 0 ? (
                  <TableRow><td colSpan={2} className="px-4 py-4 text-center text-sm text-slate-400">No variants found</td></TableRow>
                ) : (
                  variants.map((v: any) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium text-slate-700">{v.variant_name}</TableCell>
                      <TableCell>
                        <CompactInput
                          type="number"
                          className="h-9 w-24 rounded-lg border border-slate-200 bg-white px-3 text-right text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
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
          <CardTitle style={{ fontSize: '16px' }}>Portfolio Preview</CardTitle>
          <CardDescription>How discounts will apply for this client.</CardDescription>
        </CardHeader>
        <CardContent>
          {formData.discount_type === 'Standard' ? (
            <div className="rounded-lg bg-slate-50 border border-slate-100 px-5 py-4">
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-800">Standard Discount:</span>{' '}
                {pricelists.find((pl: any) => pl.id === formData.standard_pricelist_id)?.discount_percent || 0}% flat on all items.
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
                    <TableRow><td colSpan={4} className="px-4 py-4 text-center text-sm text-slate-400">Loading...</td></TableRow>
                  ) : previewSettings.length === 0 ? (
                    <TableRow><td colSpan={4} className="px-4 py-4 text-center text-sm text-slate-400">No settings found.</td></TableRow>
                  ) : (
                    previewSettings.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium text-slate-700">{s.variant?.variant_name}</TableCell>
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
    
    // Validate required fields
    if (!formData.client_name || formData.client_name.trim() === '') {
      alert('Client Name is required');
      return;
    }
    
    if (formData.gstin && formData.gstin.length !== 15) {
      alert('GSTIN must be exactly 15 characters');
      return;
    }
    
    setSaving(true);
    try {
      if (editMode && clientData?.id) {
        console.log('Updating client:', formData);
        const { error } = await supabase.from('clients').update(formData).eq('id', clientData.id);
        if (error) throw error;
        alert('Client updated successfully!');
      } else {
        console.log('Creating client:', formData);
        const clientId = 'CLT-' + Date.now().toString().slice(-6);
        const { error } = await supabase.from('clients').insert({ ...formData, client_id: clientId });
        if (error) throw error;
        alert('Client saved successfully!');
      }
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setIsDirty(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error saving client:', error);
      alert('Error: ' + (error?.message || error));
    } finally {
      setSaving(false);
    }
  };

  const val = (field: string) => formData[field] || '';
  const set = (field: string) => (e: any) => setFormData({ ...formData, [field]: (e.target as HTMLInputElement).value });

  return (
    <div className="min-h-screen bg-slate-50/80 px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-[960px]">

        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{editMode ? 'Edit Client' : 'New Client'}</h1>
              <p className="text-sm text-slate-500">{editMode ? 'Update client information and pricing' : 'Add a new client to your organization'}</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="general" value={activeTab} onValueChange={setActiveTab}>
          <TabsList style={{ marginBottom: '24px' }}>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
          </TabsList>

          {/* ─── GENERAL TAB ─── */}
          <TabsContent value="general">
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">

                {/* Client info */}
                <Card>
                  <CardHeader>
                    <SectionHeading icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}>
                      Client Information
                    </SectionHeading>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                      <FieldGroup label="Client Name" required>
                        <CompactInput value={val('client_name')} onChange={set('client_name')} required placeholder="Enter client name" />
                      </FieldGroup>
                      <FieldGroup label="Category">
                        <select className={selectCn} value={val('category') || 'Active'} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                          <option value="Prospect">Prospect</option>
                        </select>
                      </FieldGroup>
                      <FieldGroup label="GST IN" error={gstError}>
                        <CompactInput value={val('gstin')} onChange={handleGstChange} placeholder="15 character GSTIN" maxLength={15} />
                      </FieldGroup>
                      <FieldGroup label="Vendor No">
                        <CompactInput value={val('vendor_no')} onChange={set('vendor_no')} placeholder="Vendor reference number" />
                      </FieldGroup>
                    </div>
                  </CardContent>
                </Card>

                {/* Contact persons */}
                <Card>
                  <CardHeader>
                    <SectionHeading icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}>
                      Contact Persons
                    </SectionHeading>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-5">
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Primary Contact</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <CompactInput value={val('contact_person')} onChange={set('contact_person')} placeholder="Full name" />
                          <CompactInput value={val('contact_designation')} onChange={set('contact_designation')} placeholder="Designation" />
                          <CompactInput value={val('contact')} onChange={set('contact')} placeholder="Phone" />
                          <CompactInput type="email" value={val('contact_person_email')} onChange={set('contact_person_email')} placeholder="Email" />
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Secondary Contact</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <CompactInput value={val('contact_person_2')} onChange={set('contact_person_2')} placeholder="Full name" />
                          <CompactInput value={val('contact_designation_2')} onChange={set('contact_designation_2')} placeholder="Designation" />
                          <CompactInput value={val('contact_person_2_contact')} onChange={set('contact_person_2_contact')} placeholder="Phone" />
                          <CompactInput type="email" value={val('contact_person_2_email')} onChange={set('contact_person_2_email')} placeholder="Email" />
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Purchase Contact</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <CompactInput value={val('purchase_person')} onChange={set('purchase_person')} placeholder="Full name" />
                          <CompactInput value={val('purchase_designation')} onChange={set('purchase_designation')} placeholder="Designation" />
                          <CompactInput value={val('purchase_contact')} onChange={set('purchase_contact')} placeholder="Phone" />
                          <CompactInput type="email" value={val('purchase_email')} onChange={set('purchase_email')} placeholder="Email" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Addresses */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                  {/* Billing */}
                  <Card>
                    <CardHeader>
                      <SectionHeading icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}>
                        Billing Address
                      </SectionHeading>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <CompactInput value={val('address1')} onChange={set('address1')} placeholder="Address Line 1" />
                        <CompactInput value={val('address2')} onChange={set('address2')} placeholder="Address Line 2" />
                        <div className="grid grid-cols-3 gap-3">
                          <FieldGroup label="State">
                            <select className={cn(selectCn, 'text-xs')} value={val('state')} onChange={e => setFormData({ ...formData, state: e.target.value })}>
                              <option value="">Select</option>
                              {indianStates.map(state => (<option key={state} value={state}>{state}</option>))}
                            </select>
                          </FieldGroup>
                          <FieldGroup label="City">
                            <CompactInput value={val('city')} onChange={set('city')} placeholder="City" />
                          </FieldGroup>
                          <FieldGroup label="Pincode">
                            <CompactInput value={val('pincode')} onChange={set('pincode')} placeholder="Pincode" />
                          </FieldGroup>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Shipping */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <SectionHeading icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>}>
                          Shipping Addresses
                        </SectionHeading>
                        <Button variant="ghost" size="sm" onClick={copyBillingToShipping}>Copy Billing</Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {shippingAddresses.map((addr: any) => (
                          <div key={addr.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 transition-shadow hover:shadow-sm">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                <span className="truncate">{addr.address_name || 'Address'}</span>
                                {addr.is_default && <Badge variant="default" size="sm">Default</Badge>}
                              </div>
                              <p className="mt-1 text-xs text-slate-500 leading-relaxed">{addr.address_line1} {addr.address_line2}</p>
                              <p className="text-xs text-slate-500">{addr.city}, {addr.state} - {addr.pincode}</p>
                            </div>
                            <button type="button" onClick={() => deleteShippingAddress(addr.id)} className="shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        ))}

                        {showShippingForm && (
                          <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
                            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">New Shipping Address</p>
                            <div className="grid grid-cols-2 gap-3">
                              <CompactInput value={newShipping.address_name} onChange={e => setNewShipping({ ...newShipping, address_name: (e.target as HTMLInputElement).value })} placeholder="Address Name" />
                              <CompactInput value={newShipping.contact} onChange={e => setNewShipping({ ...newShipping, contact: (e.target as HTMLInputElement).value })} placeholder="Contact" />
                            </div>
                            <CompactInput value={newShipping.address_line1} onChange={e => setNewShipping({ ...newShipping, address_line1: (e.target as HTMLInputElement).value })} placeholder="Address Line 1" />
                            <CompactInput value={newShipping.address_line2} onChange={e => setNewShipping({ ...newShipping, address_line2: (e.target as HTMLInputElement).value })} placeholder="Address Line 2" />
                            <div className="grid grid-cols-3 gap-3">
                              <select className={cn(selectCn, 'text-xs')} value={newShipping.state} onChange={e => setNewShipping({ ...newShipping, state: e.target.value })}>
                                <option value="">State</option>
                                {indianStates.map(state => (<option key={state} value={state}>{state}</option>))}
                              </select>
                              <CompactInput value={newShipping.city} onChange={e => setNewShipping({ ...newShipping, city: (e.target as HTMLInputElement).value })} placeholder="City" />
                              <CompactInput value={newShipping.pincode} onChange={e => setNewShipping({ ...newShipping, pincode: (e.target as HTMLInputElement).value })} placeholder="Pincode" />
                            </div>
                            <div className="flex gap-2 pt-1">
                              <Button variant="primary" size="sm" onClick={addShippingAddress}>Save Address</Button>
                              <Button variant="secondary" size="sm" onClick={() => setShowShippingForm(false)}>Cancel</Button>
                            </div>
                          </div>
                        )}

                        {!showShippingForm && shippingAddresses.length === 0 && (
                          <button
                            type="button"
                            className="w-full rounded-lg border-2 border-dashed border-slate-200 py-5 text-sm text-slate-400 transition-colors hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/30"
                            onClick={() => setShowShippingForm(true)}
                          >
                            <span className="flex items-center justify-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                              Add Shipping Address
                            </span>
                          </button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Notes */}
                <Card>
                  <CardHeader>
                    <SectionHeading icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}>
                      Notes
                    </SectionHeading>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FieldGroup label="Remarks">
                        <CompactTextarea rows={3} value={val('remarks')} onChange={e => setFormData({ ...formData, remarks: e.target.value })} placeholder="Internal remarks..." />
                      </FieldGroup>
                      <FieldGroup label="About Client">
                        <CompactTextarea rows={3} value={val('about_client')} onChange={e => setFormData({ ...formData, about_client: e.target.value })} placeholder="Additional information..." />
                      </FieldGroup>
                    </div>
                  </CardContent>
                </Card>

                {/* Footer actions */}
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-6 py-4">
                  <p className="text-sm text-slate-400">{isDirty ? 'Unsaved changes' : 'No changes'}</p>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="secondary" type="button" onClick={onCancel} disabled={saving}>Cancel</Button>
                    {editMode && (
                      <Button variant="danger" type="button" onClick={deleteClient} disabled={saving}>Delete</Button>
                    )}
                    <Button variant="primary" type="submit" disabled={saving}>
                      {saving ? 'Saving...' : editMode ? 'Update Client' : 'Create Client'}
                    </Button>
                  </div>
                </div>
              </div>
            </form>
          </TabsContent>

          {/* ─── PRICING TAB ─── */}
          <TabsContent value="pricing">
            <div className="space-y-6">
              <ClientDiscountPortfolio formData={formData} setFormData={setFormData} isAdmin={isAdmin} />
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-6 py-4">
                <p className="text-sm text-slate-400">Pricing configuration</p>
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                  <Button variant="primary" onClick={() => handleSubmit()}>
                    {editMode ? 'Update Pricing' : 'Submit'}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}

export default CreateClient;
