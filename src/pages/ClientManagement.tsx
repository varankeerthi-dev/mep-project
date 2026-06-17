import React, { useState, useEffect, useMemo } from 'react';
import type { ChangeEvent, FormEvent, ComponentProps } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ensureValidSession } from '../queryClient';
import { withTimeout } from '../utils/queryTimeout';
import {
  Button,
  Input,
  Label,
  Badge,
  Tabs, TabsList, TabsTrigger, TabsContent,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Separator,
} from '@/components/ui';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '../lib/utils';
import { 
  Building2, 
  MapPin, 
  CreditCard, 
  Users, 
  Settings, 
  AlignLeft,
  Truck,
  Plus,
  Trash2,
  Copy,
  Info,
  Archive,
  Save,
  ChevronLeft
} from 'lucide-react';

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
  organisation: any
}

type CreateClientProps = {
  onSuccess: () => void
  onCancel: () => void
  editMode?: boolean
  clientData?: any
}

const selectCn = 'h-11 w-full border border-zinc-200 bg-white px-3 text-sm outline-none';

const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-4">
    <h3 className="text-base font-semibold" style={{ color: '#3A6963' }}>{children}</h3>
  </div>
);

const FieldGroup = ({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <Label className="text-xs font-medium" style={{ color: '#3A6963' }}>
      {label}{required && <span className="text-red-500 ml-1">*</span>}
    </Label>
    {children}
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
);

const CompactInput = (props: ComponentProps<typeof Input>) => (
  <Input {...props} className={cn("h-10 border-zinc-200 text-sm", props.className)} />
);

const CompactTextarea = (props: ComponentProps<typeof Textarea>) => (
  <Textarea {...props} className={cn("min-h-[100px] rounded-xl border-zinc-200/80 bg-white p-4 text-[14px] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] transition-all focus-visible:ring-4 focus-visible:ring-indigo-500/15 focus-visible:border-indigo-500 hover:border-zinc-300 resize-y", props.className)} style={undefined} />
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
    enabled: !!clientId && clientId !== 'undefined'
  });

  if (clientQuery.isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-[#f8fafc] p-6 md:p-10">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
          <p className="text-sm font-medium text-zinc-500 tracking-wide uppercase">Initializing...</p>
        </div>
      </div>
    );
  }

  if (clientQuery.isError) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-6 md:p-10 flex items-center justify-center">
        <div className="mx-auto max-w-lg w-full rounded-3xl bg-white border border-rose-100 p-10 text-center shadow-xl shadow-rose-900/5">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600">
             <Info className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-zinc-900 mb-2">Error Loading Client</h3>
          <p className="text-[14px] text-zinc-500 mb-8 leading-relaxed">We could not retrieve the client profile. Please check the network or try again.</p>
          <Button variant="secondary" className="h-11 rounded-xl px-8" onClick={onCancel}>Return to Directory</Button>
        </div>
      </div>
    );
  }

  return <CreateClient editMode={true} clientData={clientQuery.data} onSuccess={onSuccess} onCancel={onCancel} />;
}

function ClientDiscountPortfolio({ formData, setFormData, isAdmin, organisation }: ClientDiscountPortfolioProps) {
  const [customDiscounts, setCustomDiscounts] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: string; text: string }>({ type: '', text: '' });

  const pricelistsQuery = useQuery({
    queryKey: ['discountPricelists', organisation?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('standard_discount_pricelists')
        .select('*')
        .eq('organisation_id', organisation?.id)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
    staleTime: 10 * 60 * 1000
  });

  const structuresQuery = useQuery({
    queryKey: ['discountStructures', organisation?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discount_structures')
        .select('*')
        .eq('organisation_id', organisation?.id)
        .eq('is_active', true)
        .neq('structure_name', 'Standard');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
    staleTime: 10 * 60 * 1000
  });

  const discountCategoriesQuery = useQuery({
    queryKey: ['discountCategories', organisation?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discount_categories')
        .select('*')
        .or(`organisation_id.eq.${organisation?.id},organisation_id.is.null`)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
    staleTime: 10 * 60 * 1000
  });

  const pricelists = pricelistsQuery.data || [];
  const structures = structuresQuery.data || [];
  const discountCategories = discountCategoriesQuery.data || [];

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
    queryKey: ['discountVariantSettings', selectedStructureId, organisation?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discount_variant_settings')
        .select('*, discount_category:discount_categories(name)')
        .eq('structure_id', selectedStructureId)
        .eq('organisation_id', organisation?.id)
        .not('discount_category_id', 'is', null);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedStructureId && !!organisation?.id
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
      setSaveMessage({ type: 'error', text: 'Please save the client general profile first before saving customized discounts.' });
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
      setSaveMessage({ type: 'success', text: 'Discounts securely deployed to database.' });
    } catch (err: any) {
      setSaveMessage({ type: 'error', text: 'Encountered an exception while saving: ' + (err?.message || err) });
    } finally {
      setSaving(false);
    }
  };

  const sectionHeadStyle: React.CSSProperties = {
    fontWeight: 600, fontSize: '11px', color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px'
  };

  const labelStyle: React.CSSProperties = {
    minWidth: '70px', maxWidth: '70px',
    fontWeight: 600, fontSize: '11px', color: '#374151'
  };

  const renderHeaderField = (label: string, field: React.ReactNode, isLast = false) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: isLast ? 0 : '8px' }}>
      <span style={labelStyle}>{label}</span>
      <div style={{ flex: 1 }}>{field}</div>
    </div>
  );

  const primaryBtnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '4px',
    padding: '6px 14px', background: '#185FA5',
    border: '1px solid #185FA5', color: '#fff',
    borderRadius: '6px', fontSize: '12px', fontWeight: 500,
    cursor: saving || !formData.id ? 'not-allowed' : 'pointer',
    opacity: saving || !formData.id ? 0.6 : 1,
    transition: 'all 0.15s'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingTop: '16px' }}>
      {/* Billing & Tax Details */}
      <section>
        <div style={sectionHeadStyle}>Billing & Tax Details</div>
        <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '6px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {renderHeaderField('Pricing Tier:', (
                <div className="relative">
                  <select
                    className={selectCn}
                    value={formData.discount_type || 'Special'}
                    onChange={e => setFormData({ ...formData, discount_type: e.target.value, standard_pricelist_id: e.target.value === 'Standard' ? formData.standard_pricelist_id : null })}
                    disabled={!isAdmin}
                    style={{ padding: '4px 8px', fontSize: '12px' }}
                  >
                    <option value="Standard">Standard Matrix (Price List)</option>
                    <option value="Premium">Premium Schema (Variant Match)</option>
                    <option value="Bulk">Bulk Schema (Variant Match)</option>
                    <option value="Special">Special Schema (Variant Match)</option>
                  </select>
                </div>
              ))}
            </div>
            {formData.discount_type === 'Standard' && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {renderHeaderField('Price List:', (
                  <div className="relative">
                    <select
                      className={cn(selectCn, "bg-[#f1f5f9] border-indigo-200/60")}
                      value={formData.standard_pricelist_id || ''}
                      onChange={e => setFormData({ ...formData, standard_pricelist_id: e.target.value })}
                      required
                      disabled={!isAdmin}
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                    >
                      <option value="">-- Assign a List --</option>
                      {pricelists.map((pl: any) => (
                        <option key={pl.id} value={pl.id}>{pl.pricelist_name} ({pl.discount_percent}% Baseline)</option>
                      ))}
                    </select>
                  </div>
                ), true)}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Customized Discounts */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e5e7eb', gap: '16px' }}>
          <div>
            <div style={sectionHeadStyle}>Customized Discounts</div>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#9ca3af' }}>Override default discounts per category.</p>
          </div>
          <button
            type="button"
            style={primaryBtnStyle}
            onClick={handleSaveCustomDiscounts}
            disabled={saving || !formData.id}
            onMouseEnter={e => { if (!saving && formData.id) { e.currentTarget.style.background = '#0C447C'; e.currentTarget.style.borderColor = '#0C447C'; }}}
            onMouseLeave={e => { e.currentTarget.style.background = '#185FA5'; e.currentTarget.style.borderColor = '#185FA5'; }}
          >
            {saving ? 'Saving...' : (
              <><Save size={13} /> Save Discount Map</>
            )}
          </button>
        </div>

        {saveMessage.text && (
          <div className={cn(
            'mb-6 rounded-xl px-5 py-4 text-[14px] font-medium leading-relaxed flex items-center gap-3',
            saveMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-l-4 border-emerald-500' : 'bg-rose-50 text-rose-800 border-l-4 border-rose-500'
          )}>
            <Info className="w-5 h-5 shrink-0" />
            {saveMessage.text}
          </div>
        )}

        <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', background: '#fff', overflow: 'hidden' }}>
          <div className="max-h-[380px] overflow-auto">
            <Table>
              <TableHeader className="bg-zinc-50/80 sticky top-0 z-10">
                <TableRow className="border-b-zinc-200/80">
                  <TableHead className="w-[60%] font-bold text-zinc-600 uppercase tracking-wider">Category Name</TableHead>
                  <TableHead className="w-[40%] font-bold text-zinc-600 uppercase tracking-wider text-right">Discount %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discountCategories.length === 0 ? (
                  <TableRow><td colSpan={2} style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: '#9ca3af' }}>No discount categories configured.</td></TableRow>
                ) : (
                  discountCategories.map((dc: any) => (
                    <TableRow key={dc.id} className="border-b-zinc-100 hover:bg-zinc-50/50 transition-colors">
                      <TableCell className="font-semibold text-zinc-700">{dc.name}</TableCell>
                      <TableCell className="text-right">
                        <CompactInput
                          type="number"
                          className="h-10 w-28 rounded-lg border-zinc-200 bg-white px-3 text-right text-[14px] font-semibold text-indigo-700 shadow-inner ml-auto"
                          value={customDiscounts[dc.id] || 0}
                          onChange={(e) => handleCustomDiscountChange(dc.id, e.target.value)}
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
        </div>
      </section>

      {/* Discount Matrix Preview */}
      <section>
        <div style={sectionHeadStyle}>Discount Matrix Preview</div>
        <div className="max-w-4xl">
         {formData.discount_type === 'Standard' ? (
           <div style={{ background: '#f8f9fa', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px', textAlign: 'center' }}>
             <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
               Standard pricing active — <strong>{pricelists.find((pl: any) => pl.id === formData.standard_pricelist_id)?.discount_percent || 0}%</strong> baseline across all categories.
             </p>
           </div>
         ) : (
           <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', background: '#fff', overflow: 'hidden' }}>
             <Table>
                <TableHeader style={{ background: '#f9fafb' }}>
                  <TableRow>
                    <TableHead className="w-[40%] font-bold text-zinc-600 uppercase tracking-wider">Category</TableHead>
                    <TableHead className="w-[20%] font-bold text-zinc-600 uppercase tracking-wider text-center">Default</TableHead>
                    <TableHead className="w-[20%] font-bold text-zinc-600 uppercase tracking-wider text-center">Min</TableHead>
                    <TableHead className="w-[20%] font-bold text-zinc-600 uppercase tracking-wider text-center">Max</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><td colSpan={4} style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: '#9ca3af' }}>Loading...</td></TableRow>
                  ) : previewSettings.length === 0 ? (
                    <TableRow><td colSpan={4} style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: '#9ca3af' }}>No settings found for this structure.</td></TableRow>
                  ) : (
                    previewSettings.map((s: any) => (
                       <TableRow key={s.id} className="border-b-zinc-100/60">
                         <TableCell className="font-semibold text-zinc-700">{s.discount_category?.name || 'Unknown Category'}</TableCell>
                        <TableCell className="text-center font-medium bg-zinc-50/30">{s.default_discount_percent}%</TableCell>
                        <TableCell className="text-center font-medium text-zinc-500">{s.min_discount_percent}%</TableCell>
                        <TableCell className="text-center font-bold text-indigo-700">{s.max_discount_percent}%</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
             </Table>
           </div>
         )}
        </div>
      </section>
    </div>
  );
}

export function CreateClient({ onSuccess, onCancel, editMode, clientData }: CreateClientProps) {
  const { organisation, organisations } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = organisations?.find((o: any) => o.organisation.id === organisation?.id)?.role?.toLowerCase() === 'admin';

  const [activeTab, setActiveTab] = useState('general');
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<any>({
    client_name: '', address1: '', address2: '', state: '', city: '', pincode: '',
    gstin: '', contact: '', email: '', vendor_no: '', remarks: '', category: 'Active',
    contact_person: '', contact_designation: '', contact_person_email: '',
    contact_person_2: '', contact_designation_2: '', contact_person_2_contact: '', contact_person_2_email: '',
    purchase_person: '', purchase_designation: '', purchase_contact: '', purchase_email: '',
    about_client: '', discount_type: 'Special', standard_pricelist_id: null,
    msme_register_type: '', msme_number: '',
    gst_treatment: ''
  });
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const primaryBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '4px',
    padding: '6px 14px', background: '#185FA5',
    border: '1px solid #185FA5', color: '#fff',
    borderRadius: '6px', fontSize: '12px', fontWeight: 500,
    cursor: 'pointer', transition: 'all 0.15s'
  };

  const secondaryBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '4px',
    padding: '6px 14px', background: '#fff',
    border: '1px solid #d1d5db', color: '#374151',
    borderRadius: '6px', fontSize: '12px', fontWeight: 500,
    cursor: 'pointer', transition: 'all 0.15s'
  };

  const destructiveBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '4px',
    padding: '6px 14px', background: '#fff',
    border: '1px solid #d1d5db', color: '#000',
    borderRadius: '6px', fontSize: '12px', fontWeight: 500,
    cursor: 'pointer', transition: 'all 0.15s'
  };

  useEffect(() => {
    if (clientData) {
      setFormData(clientData);
      const timer = setTimeout(() => setIsDirty(false), 100);
      return () => clearTimeout(timer);
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
    queryKey: ['clientShipping', clientData?.id, organisation?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_shipping_addresses')
        .select('*')
        .eq('client_id', clientData.id)
        .eq('organisation_id', organisation?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: editMode && !!clientData?.id && clientData.id !== 'undefined' && !!organisation?.id
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
      alert('Please save the primary client profile first before adding separate shipping locations.');
      return;
    }
    const { error } = await supabase.from('client_shipping_addresses').insert({
      client_id: clientData.id,
      organisation_id: organisation?.id,
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
    if (!confirm('Are you absolutely certain you want to purge this shipping address location?')) return;
    await supabase.from('client_shipping_addresses').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['clientShipping', clientData.id] });
  };

  const deleteClient = async () => {
    if (!editMode || !clientData?.id) return;
    if (!confirm(`Are you certain you want to permanently delete the client "${formData.client_name}"? This operation cannot be reversed.`)) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('clients').delete().eq('id', clientData.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-ui', 'clients', organisation?.id] });
      setIsDirty(false);
      onCancel();
    } catch (err: any) {
      alert('Deletion Failed: ' + (err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e?: FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (saving) return;
    
    if (!formData.client_name || formData.client_name.trim() === '') {
      alert('The core identifier (Client Name) must be supplied.');
      return;
    }
    
    if (formData.gstin && formData.gstin.length !== 15) {
      alert('Enterprise GSTIN identifier requires strictly 15 characters.');
      return;
    }
    
    setSaving(true);
    try {
      const orgId = organisation?.id;
      if (!orgId) throw new Error('Organization context is missing. Please refresh and try again.');

      const sessionValid = await withTimeout(ensureValidSession(), 12000, 'Client save session check');
      if (!sessionValid) {
        throw new Error('Session expired. Please refresh the page and sign in again.');
      }

      if (editMode && clientData?.id) {
        const { error } = await withTimeout(
          supabase
            .from('clients')
            .update({ ...formData, updated_at: new Date().toISOString() })
            .eq('id', clientData.id)
            .eq('organisation_id', orgId),
          30000,
          'Client update'
        );
        if (error) throw error;
      } else {
        const clientId = 'CLT-' + Date.now().toString().slice(-6);
        const { error } = await withTimeout(
          supabase.from('clients').insert({ 
            ...formData, 
            client_id: clientId, 
            organisation_id: orgId 
          }),
          30000,
          'Client create'
        );
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients', orgId] });
      queryClient.invalidateQueries({ queryKey: ['invoice-ui', 'clients', orgId] });
      setIsDirty(false);
      onSuccess();
    } catch (error: any) {
      console.error('Save Exception:', error);
      alert('Transaction Error: ' + (error?.message || error));
    } finally {
      setSaving(false);
    }
  };

  const val = (field: string) => formData[field] || '';
  const set = (field: string) => (e: any) => setFormData({ ...formData, [field]: (e.target as HTMLInputElement).value });

  return (
    <div className="min-h-screen bg-[#f8fafc] px-4 pt-4 pb-8 md:px-10 md:pt-6 md:pb-16 font-sans">
      <div className="mx-auto max-w-[1000px]">

        {/* Header Block & Navigation Row */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onCancel as any}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-lg font-semibold text-zinc-800">{editMode ? 'Edit Client' : 'New Client'}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" style={secondaryBtn}
              onClick={onCancel as any}
              onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
            >Cancel</button>
            <button type="submit" style={{...primaryBtn, opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer'}}
              onClick={handleSubmit as any} disabled={saving}
              onMouseEnter={e => { if (!saving) { e.currentTarget.style.background = '#0C447C'; e.currentTarget.style.borderColor = '#0C447C'; }}}
              onMouseLeave={e => { e.currentTarget.style.background = '#185FA5'; e.currentTarget.style.borderColor = '#185FA5'; }}
            >{saving ? 'Saving...' : (editMode ? 'Update Client' : 'Save Client')}</button>
          </div>
        </div>

        <Tabs defaultValue="general" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-2 pb-8">
            <TabsList className="h-14 w-full md:w-auto p-1.5 bg-zinc-200/60 rounded-2xl">
              <TabsTrigger 
                 value="general" 
                 className="rounded-xl h-full px-8 text-[14px] font-bold text-zinc-500 data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-md transition-all duration-300"
              >
                General Info
              </TabsTrigger>
              <TabsTrigger 
                 value="pricing" 
                 className="rounded-xl h-full px-8 text-[14px] font-bold text-zinc-500 data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-md transition-all duration-300"
              >
                Discount Settings
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ─── GENERAL TAB ─── */}
          <TabsContent value="general" className="mt-0 ring-0 outline-none">
            <form onSubmit={handleSubmit} className="relative">
              <div className="border border-zinc-200 bg-white">
                
                <div className="p-6 space-y-8">
                  
                  {/* Identity Block */}
                  <section>
                    <SectionHeading>Client Information</SectionHeading>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ paddingLeft: '16px' }}>
                      <FieldGroup label="Client Name" required>
                        <CompactInput value={val('client_name')} onChange={set('client_name')} required placeholder="Enter client name" />
                      </FieldGroup>
                      
                      <FieldGroup label="Status">
                         <div className="relative">
                            <select className={selectCn} value={val('category') || 'Active'} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                              <option value="Active">Active</option>
                              <option value="Prospect">Prospect</option>
                              <option value="Inactive">Inactive</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-zinc-400">
                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                         </div>
                      </FieldGroup>

                      <FieldGroup label="GST Number" error={gstError}>
                        <CompactInput value={val('gstin')} onChange={handleGstChange} placeholder="15 Digit GST Number" maxLength={15} className="font-mono text-[14px] font-semibold tracking-wider placeholder:tracking-normal placeholder:font-sans uppercase" />
                      </FieldGroup>

                      <FieldGroup label="GST Treatment">
                        <div className="relative">
                           <select className={selectCn} value={val('gst_treatment') || ''} onChange={e => setFormData({ ...formData, gst_treatment: e.target.value })}>
                             <option value="">Select GST Treatment</option>
                             <option value="Registered Business Regular">Registered Business Regular - Standard GST registered business</option>
                             <option value="Registered Business Composition">Registered Business Composition - Business under GST Composition Scheme</option>
                             <option value="Unregistered Business">Unregistered Business - Not registered under GST</option>
                             <option value="Consumer">Consumer - Regular end-consumer</option>
                             <option value="Overseas">Overseas - Import/Export outside India</option>
                             <option value="Special Economic Zone (SEZ)">Special Economic Zone (SEZ) - Units located in an Indian SEZ</option>
                             <option value="Deemed Export">Deemed Export - Supply to EOUs or against Advance Authorization</option>
                             <option value="Tax Deductor">Tax Deductor - Government departments/local authorities</option>
                             <option value="SEZ Developer">SEZ Developer - Owners of SEZ infrastructure</option>
                             <option value="Input Service Distributor">Input Service Distributor - For distributing ITC across different branches</option>
                           </select>
                           <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-zinc-400">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                           </div>
                        </div>
                      </FieldGroup>

                      <FieldGroup label="Vendor Code">
                        <CompactInput value={val('vendor_no')} onChange={set('vendor_no')} placeholder="Vendor Code" />
                      </FieldGroup>

                      <FieldGroup label="MSME Register Type">
                        <div className="relative">
                           <select className={selectCn} value={val('msme_register_type') || ''} onChange={e => setFormData({ ...formData, msme_register_type: e.target.value })}>
                             <option value="">Select MSME Type</option>
                             <option value="micro">Micro Enterprise</option>
                             <option value="small">Small Enterprise</option>
                             <option value="macro">Macro Enterprise</option>
                           </select>
                           <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-zinc-400">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                           </div>
                        </div>
                      </FieldGroup>

                      <FieldGroup label="MSME Number">
                        <CompactInput value={val('msme_number')} onChange={set('msme_number')} placeholder="UDYAM/MSME Registration Number" className="font-mono text-[14px] font-semibold tracking-wider placeholder:tracking-normal placeholder:font-sans uppercase" />
                      </FieldGroup>
                    </div>
                  </section>

                  {/* Operational Nodes (Contacts) */}
                  <section>
                    <SectionHeading>
                        Contact Information
                    </SectionHeading>
                    
                    <div className="space-y-8">
                      <div>
                        <p className="text-[14px] font-semibold mb-4" style={{ color: '#3A6963' }}>Primary Contact</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" style={{ marginLeft: '7px', border: '1px solid #e2e8f0', paddingLeft: '16px', borderRadius: '8px' }}>
                          <CompactInput value={val('contact_person')} onChange={set('contact_person')} placeholder="Contact Person Name" />
                          <CompactInput value={val('contact_designation')} onChange={set('contact_designation')} placeholder="Designation" />
                          <CompactInput value={val('contact')} onChange={set('contact')} placeholder="Phone number" />
                          <CompactInput type="email" value={val('contact_person_email')} onChange={set('contact_person_email')} placeholder="Email address" />
                        </div>
                      </div>

                      <div className="border-t border-zinc-100"></div>

                      <div>
                        <p className="text-[14px] font-semibold mb-4" style={{ color: '#3A6963' }}>Secondary Contact</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" style={{ marginLeft: '7px', border: '1px solid #e2e8f0', paddingLeft: '16px', borderRadius: '8px' }}>
                          <CompactInput value={val('contact_person_2')} onChange={set('contact_person_2')} placeholder="Contact Person Name" />
                          <CompactInput value={val('contact_designation_2')} onChange={set('contact_designation_2')} placeholder="Designation" />
                          <CompactInput value={val('contact_person_2_contact')} onChange={set('contact_person_2_contact')} placeholder="Phone Number" />
                          <CompactInput type="email" value={val('contact_person_2_email')} onChange={set('contact_person_2_email')} placeholder="Email Address" />
                        </div>
                      </div>

                      <div className="border-t border-zinc-100"></div>

                      <div>
                        <p className="text-[14px] font-semibold mb-4" style={{ color: '#3A6963' }}>Purchase Contact</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" style={{ marginLeft: '7px', border: '1px solid #e2e8f0', paddingLeft: '16px', borderRadius: '8px' }}>
                          <CompactInput value={val('purchase_person')} onChange={set('purchase_person')} placeholder="Contact Person Name" />
                          <CompactInput value={val('purchase_designation')} onChange={set('purchase_designation')} placeholder="Designation" />
                          <CompactInput value={val('purchase_contact')} onChange={set('purchase_contact')} placeholder="Phone Number" />
                          <CompactInput type="email" value={val('purchase_email')} onChange={set('purchase_email')} placeholder="Email Address" />
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Physical Domains */}
                  <section>
<SectionHeading>Address Details</SectionHeading>

                    <div className="grid grid-cols-1 max-w-4xl gap-8" style={{ paddingLeft: '16px' }}>
                      {/* Billing Address */}
                      <div className="rounded-xl border border-zinc-200 p-6">
                        <h4 className="text-[15px] font-semibold text-zinc-900 mb-4">Billing Address</h4>
                        <div className="space-y-4">
                          <CompactInput value={val('address1')} onChange={set('address1')} placeholder="Address Line 1" />
                          <CompactInput value={val('address2')} onChange={set('address2')} placeholder="Address Line 2" />
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FieldGroup label="State">
                               <div className="relative">
                                  <select className={selectCn} value={val('state')} onChange={e => setFormData({ ...formData, state: e.target.value })}>
                                    <option value="">Select State</option>
                                    {indianStates.map(state => (<option key={state} value={state}>{state}</option>))}
                                  </select>
                                  <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-zinc-400">
                                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                  </div>
                               </div>
                            </FieldGroup>
                            <FieldGroup label="City">
                              <CompactInput value={val('city')} onChange={set('city')} placeholder="City" />
                            </FieldGroup>
                            <FieldGroup label="PIN Code">
                              <CompactInput value={val('pincode')} onChange={set('pincode')} placeholder="PIN Code" className="font-mono" />
                            </FieldGroup>
                          </div>
                        </div>
                      </div>

                      {/* Shipping Addresses */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-[15px] font-semibold text-zinc-900">Shipping Addresses</h4>
                          {shippingAddresses.length > 0 && (
                            <Button type="button" variant="ghost" size="sm" onClick={copyBillingToShipping} className="text-indigo-600 font-semibold hover:bg-indigo-50">
                               <Copy className="w-4 h-4 mr-2" /> Copy from Billing
                            </Button>
                          )}
                        </div>
                        
                        <div className="space-y-4">
                          {shippingAddresses.map((addr: any) => (
                            <div key={addr.id} className="group flex items-start justify-between gap-4 rounded-2xl border border-zinc-200/80 bg-white p-6 transition-all hover:border-zinc-300 hover:shadow-md">
                              <div className="min-w-0">
                                <div className="flex items-center gap-3 text-[15px] font-bold text-zinc-800 mb-1.5">
                                  <span className="truncate">{addr.address_name || 'Unnamed Address'}</span>
                                  {addr.is_default && <Badge variant="default" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">Default</Badge>}
                                </div>
                                <p className="text-[14px] font-medium text-zinc-600 line-clamp-2 md:line-clamp-none">{addr.address_line1} {addr.address_line2}</p>
                                <p className="text-[14px] text-zinc-500 mt-0.5">{addr.city}, {addr.state} • {addr.pincode}</p>
                              </div>
                              <button type="button" onClick={() => deleteShippingAddress(addr.id)} className="shrink-0 rounded-xl p-2.5 text-zinc-300 transition-colors hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-4 focus:ring-rose-500/20">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}

                          {showShippingForm && (
                            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-6 space-y-6 slide-in-from-top-2 animate-in duration-300">
                              <div className="flex items-center gap-2 text-indigo-700">
                                 <Truck className="w-4 h-4" />
                                 <p className="text-[13px] font-bold uppercase tracking-widest">Provision New Line</p>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FieldGroup label="Address Name">
                                    <CompactInput value={newShipping.address_name} onChange={e => setNewShipping({ ...newShipping, address_name: (e.target as HTMLInputElement).value })} placeholder="Address Name" className="bg-white/60" />
                                </FieldGroup>
                                <FieldGroup label="Contact Phone">
                                    <CompactInput value={newShipping.contact} onChange={e => setNewShipping({ ...newShipping, contact: (e.target as HTMLInputElement).value })} placeholder="Contact Phone" className="bg-white/60" />
                                </FieldGroup>
                              </div>
                              
                              <div className="space-y-4">
                                <CompactInput value={newShipping.address_line1} onChange={e => setNewShipping({ ...newShipping, address_line1: (e.target as HTMLInputElement).value })} placeholder="Address Line 1" className="bg-white/60" />
                                <CompactInput value={newShipping.address_line2} onChange={e => setNewShipping({ ...newShipping, address_line2: (e.target as HTMLInputElement).value })} placeholder="Address Line 2" className="bg-white/60" />
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <FieldGroup label="State">
                                   <div className="relative">
                                      <select className={cn(selectCn, "bg-white/60")} value={newShipping.state} onChange={e => setNewShipping({ ...newShipping, state: e.target.value })}>
                                        <option value="">Select State</option>
                                        {indianStates.map(state => (<option key={state} value={state}>{state}</option>))}
                                      </select>
                                      <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-zinc-400">
                                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                      </div>
                                   </div>
                                </FieldGroup>
                                <FieldGroup label="City">
                                    <CompactInput value={newShipping.city} onChange={e => setNewShipping({ ...newShipping, city: (e.target as HTMLInputElement).value })} placeholder="City" className="bg-white/60" />
                                </FieldGroup>
                                <FieldGroup label="Routing Code">
                                    <CompactInput value={newShipping.pincode} onChange={e => setNewShipping({ ...newShipping, pincode: (e.target as HTMLInputElement).value })} placeholder="Pincode" className="bg-white/60 font-mono" />
                                </FieldGroup>
                              </div>
                              
                              <div className="flex gap-3 pt-2">
                                <Button type="button" className="h-11 rounded-xl px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold" onClick={addShippingAddress}>Add Shipping Address</Button>
                                <Button type="button" variant="secondary" className="h-11 rounded-xl px-6" onClick={() => setShowShippingForm(false)}>Cancel</Button>
                              </div>
                            </div>
                          )}

                          {!showShippingForm && shippingAddresses.length === 0 && (
                            <button
                              type="button"
                              className="w-full rounded-2xl border-2 border-dashed border-zinc-200 py-10 text-[14px] font-bold tracking-wide text-zinc-400 transition-all hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20"
                              onClick={() => {
                                 copyBillingToShipping();
                                 setShowShippingForm(true);
                              }}
                            >
                              <span className="flex items-center justify-center gap-2">
                                <Plus className="w-5 h-5 pointer-events-none" />
                                Add Shipping Address
                              </span>
                            </button>
                          )}
                          {!showShippingForm && shippingAddresses.length > 0 && (
                            <button
                              type="button"
                              className="w-full rounded-2xl border border-zinc-200/80 bg-zinc-50/50 py-5 text-[14px] font-bold tracking-wide text-zinc-500 transition-all hover:border-zinc-300 hover:text-zinc-800 hover:bg-zinc-100"
                              onClick={() => {
                                 setNewShipping({ address_name: '', address_line1: '', address_line2: '', city: '', state: '', pincode: '', gstin: '', contact: '', is_default: false });
                                 setShowShippingForm(true);
                              }}
                            >
                              <span className="flex items-center justify-center gap-2">
                                <Plus className="w-4 h-4" /> Add More Shipping Address
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Operational Notes */}
                  <section>
<SectionHeading>Notes</SectionHeading>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl" style={{ paddingLeft: '16px' }}>
                      <FieldGroup label="Internal Remarks">
                        <CompactTextarea rows={4} value={val('remarks')} onChange={e => setFormData({ ...formData, remarks: e.target.value })} placeholder="Internal remarks..." />
                      </FieldGroup>
                      <FieldGroup label="Client Notes">
                        <CompactTextarea rows={4} value={val('about_client')} onChange={e => setFormData({ ...formData, about_client: e.target.value })} placeholder="Client notes..." />
                      </FieldGroup>
                    </div>
                  </section>

                </div>

                {/* Main Action Footer */}
                <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50 px-6 py-4 gap-4">
                  <div className="flex items-center gap-3">
                    <button type="button" style={secondaryBtn}
                      onClick={onCancel as any}
                      onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                    ><ChevronLeft size={13} /> Back</button>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" style={{...secondaryBtn, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1}}
                      onClick={onCancel} disabled={saving}
                      onMouseEnter={e => { if (!saving) { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}}
                      onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                    >Cancel</button>
                    {editMode && (
                      <button type="button" style={{...destructiveBtn, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1}}
                        onClick={deleteClient} disabled={saving}
                        onMouseEnter={e => { if (!saving) { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}}
                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                      ><Trash2 size={13} /> Delete Client</button>
                    )}
                    <button type="submit" style={{...primaryBtn, opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer'}}
                      disabled={saving}
                      onMouseEnter={e => { if (!saving) { e.currentTarget.style.background = '#0C447C'; e.currentTarget.style.borderColor = '#0C447C'; }}}
                      onMouseLeave={e => { e.currentTarget.style.background = '#185FA5'; e.currentTarget.style.borderColor = '#185FA5'; }}
                    >{saving ? 'Saving...' : editMode ? 'Update Client' : 'Save Client'}</button>
                  </div>
                </div>

              </div>
            </form>
          </TabsContent>

          {/* ─── PRICING TAB ─── */}
<TabsContent value="pricing" className="mt-0 ring-0 outline-none">
<div className="rounded-xl border border-zinc-200 bg-white">
                <div className="p-6">
                  <ClientDiscountPortfolio formData={formData} setFormData={setFormData} isAdmin={isAdmin} organisation={organisation} />
                </div>                
              </div>
            </TabsContent>
          
        </Tabs>

      </div>
    </div>
  );
}

export default CreateClient;
