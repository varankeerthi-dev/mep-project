import { useState, useEffect, useMemo } from 'react';
import type { ChangeEvent, FormEvent, ComponentProps } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { cn } from '@/lib/utils';
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
}

type CreateClientProps = {
  onSuccess: () => void
  onCancel: () => void
  editMode?: boolean
  clientData?: any
}

const selectCn = 'h-[44px] w-full rounded-xl border border-slate-200/80 bg-white px-4 text-[14px] text-slate-800 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50 appearance-none';

const SectionHeading = ({ icon, children, description }: { icon: React.ReactNode; children: React.ReactNode; description?: string }) => (
  <div className="flex flex-col gap-1 mb-8 pb-5 border-b border-slate-100">
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100/50 shadow-sm">
        {icon}
      </div>
      <div>
        <h3 className="text-[17px] font-bold text-slate-900 tracking-tight">{children}</h3>
        {description && <p className="text-[13px] text-slate-500 mt-0.5 font-medium">{description}</p>}
      </div>
    </div>
  </div>
);

const FieldGroup = ({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-2 group">
    <Label className="text-[13px] font-bold tracking-wide text-slate-600 group-focus-within:text-indigo-600 transition-colors">
      {label}{required && <span className="text-rose-500 ml-1.5 opacity-80">*</span>}
    </Label>
    {children}
    {error && <p className="text-[12px] font-semibold text-rose-500 mt-1">{error}</p>}
  </div>
);

const CompactInput = (props: ComponentProps<typeof Input>) => (
  <Input {...props} className={cn("h-[44px] rounded-xl border-slate-200/80 bg-white px-4 text-[14px] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] transition-all focus-visible:ring-4 focus-visible:ring-indigo-500/15 focus-visible:border-indigo-500 hover:border-slate-300", props.className)} style={undefined} />
);

const CompactTextarea = (props: ComponentProps<typeof Textarea>) => (
  <Textarea {...props} className={cn("min-h-[100px] rounded-xl border-slate-200/80 bg-white p-4 text-[14px] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] transition-all focus-visible:ring-4 focus-visible:ring-indigo-500/15 focus-visible:border-indigo-500 hover:border-slate-300 resize-y", props.className)} style={undefined} />
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
      <div className="min-h-[80vh] flex items-center justify-center bg-[oklch(0.98_0.005_250)] p-6 md:p-10">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
          <p className="text-sm font-medium text-slate-500 tracking-wide uppercase">Initializing...</p>
        </div>
      </div>
    );
  }

  if (clientQuery.isError) {
    return (
      <div className="min-h-screen bg-[oklch(0.98_0.005_250)] p-6 md:p-10 flex items-center justify-center">
        <div className="mx-auto max-w-lg w-full rounded-3xl bg-white border border-rose-100 p-10 text-center shadow-xl shadow-rose-900/5">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600">
             <Info className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Error Loading Client</h3>
          <p className="text-[14px] text-slate-500 mb-8 leading-relaxed">We could not retrieve the client profile. Please check the network or try again.</p>
          <Button variant="secondary" className="h-11 rounded-xl px-8" onClick={onCancel}>Return to Directory</Button>
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

  return (
    <div className="space-y-16 py-4">
      {/* Strategy Selector */}
      <section>
        <SectionHeading icon={<CreditCard className="w-5 h-5" />} description="Choose the commercial pricing strategy applicable to this client globally.">
          Strategic Discount Portfolio
        </SectionHeading>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl">
          <FieldGroup label="Pricing Tier" required>
            <div className="relative">
               <select
                 className={selectCn}
                 value={formData.discount_type || 'Special'}
                 onChange={e => setFormData({ ...formData, discount_type: e.target.value, standard_pricelist_id: e.target.value === 'Standard' ? formData.standard_pricelist_id : null })}
                 disabled={!isAdmin}
               >
                 <option value="Standard">Standard Matrix (Price List)</option>
                 <option value="Premium">Premium Schema (Variant Match)</option>
                 <option value="Bulk">Bulk Schema (Variant Match)</option>
                 <option value="Special">Special Schema (Variant Match)</option>
               </select>
               <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
               </div>
            </div>
          </FieldGroup>
          {formData.discount_type === 'Standard' && (
            <FieldGroup label="Active Price List" required>
               <div className="relative">
                  <select
                    className={cn(selectCn, "bg-[oklch(0.98_0.02_260)] border-indigo-200/60")}
                    value={formData.standard_pricelist_id || ''}
                    onChange={e => setFormData({ ...formData, standard_pricelist_id: e.target.value })}
                    required
                    disabled={!isAdmin}
                  >
                    <option value="">-- Assign a List --</option>
                    {pricelists.map((pl: any) => (
                      <option key={pl.id} value={pl.id}>{pl.pricelist_name} ({pl.discount_percent}% Baseline)</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                  </div>
               </div>
            </FieldGroup>
          )}
        </div>
      </section>

      {/* Custom Overrides */}
      <section>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 pb-5 border-b border-slate-100 gap-4">
          <div>
            <h3 className="text-[17px] font-bold text-slate-900 tracking-tight flex items-center gap-2">
               <Settings className="w-5 h-5 text-indigo-500" />
               Custom Variant Definitions
            </h3>
            <p className="text-[13px] text-slate-500 mt-1 font-medium">Override maximum limit allowed for particular products.</p>
          </div>
          <Button 
            type="button"
            className="h-11 rounded-xl bg-slate-900 px-6 text-white text-[14px] font-semibold hover:bg-slate-800 focus:ring-4 focus:ring-slate-900/10 shadow-lg shadow-slate-900/20" 
            onClick={handleSaveCustomDiscounts} 
            disabled={saving || !formData.id}
          >
            {saving ? 'Synchronizing...' : (
               <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Discount Map
               </>
            )}
          </Button>
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

        <div className="rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden bg-white">
          <div className="max-h-[380px] overflow-auto">
            <Table>
              <TableHeader className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-md">
                <TableRow className="border-b-slate-200/80">
                  <TableHead className="w-[60%] text-[13px] font-bold text-slate-600 uppercase tracking-wider py-4">Resource Variant</TableHead>
                  <TableHead className="w-[40%] text-[13px] font-bold text-slate-600 uppercase tracking-wider py-4 text-right">Fixed Discount %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variants.length === 0 ? (
                  <TableRow><td colSpan={2} className="px-6 py-12 text-center text-[14px] text-slate-400 font-medium">System has no variants configured.</td></TableRow>
                ) : (
                  variants.map((v: any) => (
                    <TableRow key={v.id} className="border-b-slate-100 hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-semibold text-slate-700 py-3.5 px-4">{v.variant_name}</TableCell>
                      <TableCell className="py-3.5 px-4 text-right">
                        <CompactInput
                          type="number"
                          className="h-10 w-28 rounded-lg border-slate-200 bg-white px-3 text-right text-[14px] font-semibold text-indigo-700 shadow-inner ml-auto"
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
        </div>
      </section>

      {/* Projection Matrix */}
      <section className="pt-2">
         <SectionHeading icon={<Archive className="w-5 h-5" />} description="Projection of maximum allowed thresholds resulting from the selected structure.">
            Projection Matrix Preview
         </SectionHeading>

        <div className="max-w-4xl">
         {formData.discount_type === 'Standard' ? (
            <div className="rounded-2xl bg-indigo-50/50 border border-indigo-100/60 px-8 py-8 shadow-sm text-center">
             <Info className="w-8 h-8 text-indigo-400 mx-auto mb-4" />
             <h4 className="text-[17px] font-bold text-slate-900 tracking-tight">Active Matrix Enforced</h4>
             <p className="text-[14px] text-slate-600 mt-2 max-w-lg mx-auto">
               This client is tethered to a fixed standard pricing list. They will receive <strong className="text-indigo-700">{pricelists.find((pl: any) => pl.id === formData.standard_pricelist_id)?.discount_percent || 0}%</strong> baseline off list price across all variant items universally.
             </p>
           </div>
         ) : (
           <div className="rounded-2xl border border-slate-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] overflow-hidden bg-white">
             <Table>
               <TableHeader className="bg-slate-50/80">
                 <TableRow className="border-b-slate-200/80">
                   <TableHead className="w-[40%] text-[13px] font-bold text-slate-600 uppercase tracking-wider py-4">Linked Variant</TableHead>
                   <TableHead className="w-[20%] text-[13px] font-bold text-slate-600 uppercase tracking-wider py-4 text-center">Default</TableHead>
                   <TableHead className="w-[20%] text-[13px] font-bold text-slate-600 uppercase tracking-wider py-4 text-center">Min Floor</TableHead>
                   <TableHead className="w-[20%] text-[13px] font-bold text-slate-600 uppercase tracking-wider py-4 text-center">Max Ceiling</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {loading ? (
                   <TableRow><td colSpan={4} className="px-6 py-12 text-center text-[14px] font-medium text-slate-400">Loading projection models...</td></TableRow>
                 ) : previewSettings.length === 0 ? (
                   <TableRow><td colSpan={4} className="px-6 py-16 flex flex-col items-center justify-center text-center">
                     <Archive className="h-10 w-10 text-slate-200 mb-3" />
                     <p className="text-[14px] font-medium text-slate-500">No rule limits found for this structure.</p>
                   </td></TableRow>
                 ) : (
                   previewSettings.map((s: any) => (
                     <TableRow key={s.id} className="border-b-slate-100/60">
                       <TableCell className="font-semibold text-slate-700 py-4 text-[14px]">{s.variant?.variant_name}</TableCell>
                       <TableCell className="text-center font-medium py-4 text-[14px] bg-slate-50/30">{s.default_discount_percent}%</TableCell>
                       <TableCell className="text-center font-medium py-4 text-[14px] text-slate-500">{s.min_discount_percent}%</TableCell>
                       <TableCell className="text-center font-bold py-4 text-[14px] text-indigo-700">{s.max_discount_percent}%</TableCell>
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
      alert('Please save the primary client profile first before adding separate shipping locations.');
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
      if (editMode && clientData?.id) {
        const { error } = await supabase.from('clients').update(formData).eq('id', clientData.id);
        if (error) throw error;
      } else {
        const clientId = 'CLT-' + Date.now().toString().slice(-6);
        const { error } = await supabase.from('clients').insert({ ...formData, client_id: clientId });
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ['clients'] });
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
    <div className="min-h-screen bg-[oklch(0.98_0.005_255)] px-4 py-8 md:px-10 md:py-16 font-sans">
      <div className="mx-auto max-w-[1000px]">

        {/* Header Block & Navigation Row */}
        <div className="mb-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between px-2">
          <div className="flex items-start gap-4">
            <button type="button" onClick={onCancel} className="mt-1 flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors shrink-0">
               <ChevronLeft className="w-6 h-6 ml-0.5" />
            </button>
            <div className="flex flex-col justify-center items-center rounded-[18px] bg-indigo-600 w-14 h-14 shadow-lg shadow-indigo-600/20 text-white shrink-0 mt-0.5">
               <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-[32px] leading-none font-bold text-slate-900 tracking-tight">{editMode ? 'Edit Client Record' : 'Register External Client'}</h1>
              <p className="text-[15px] font-medium text-slate-500 mt-2.5 max-w-lg">{editMode ? 'Manage identity properties, multiple shipping nodes, & robust discounting logic across your supply chains.' : 'Initiate a new client entity to unlock quoting mechanisms and comprehensive order routing.'}</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="general" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-2 pb-8">
            <TabsList className="h-14 w-full md:w-auto p-1.5 bg-slate-200/60 rounded-2xl">
              <TabsTrigger 
                 value="general" 
                 className="rounded-xl h-full px-8 text-[14px] font-bold text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-md transition-all duration-300"
              >
                Identification Profile
              </TabsTrigger>
              <TabsTrigger 
                 value="pricing" 
                 className="rounded-xl h-full px-8 text-[14px] font-bold text-slate-500 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-md transition-all duration-300"
              >
                Financial & Portfolio Rules
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ─── GENERAL TAB ─── */}
          <TabsContent value="general" className="mt-0 ring-0 outline-none">
            <form onSubmit={handleSubmit} className="relative">
              <div className="rounded-[32px] border border-slate-200/80 bg-white shadow-2xl shadow-slate-200/40">
                
                <div className="p-8 md:p-14 space-y-16">
                  
                  {/* Identity Block */}
                  <section>
                    <SectionHeading icon={<Building2 className="w-5 h-5 pointer-events-none" />}>Corporate Indentity</SectionHeading>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-8">
                      <FieldGroup label="Registered Name" required>
                        <CompactInput value={val('client_name')} onChange={set('client_name')} required placeholder="e.g. Acme Corporation Pvt. Ltd." />
                      </FieldGroup>
                      
                      <FieldGroup label="Lifecycle Status">
                         <div className="relative">
                            <select className={selectCn} value={val('category') || 'Active'} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                              <option value="Active">Active Partner</option>
                              <option value="Prospect">Warm Prospect</option>
                              <option value="Inactive">Dormant / Inactive</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400">
                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                         </div>
                      </FieldGroup>

                      <FieldGroup label="Federal GSTIN Structure" error={gstError}>
                        <CompactInput value={val('gstin')} onChange={handleGstChange} placeholder="Enter exact 15-char structure" maxLength={15} className="font-mono text-[14px] font-semibold tracking-wider placeholder:tracking-normal placeholder:font-sans uppercase" />
                      </FieldGroup>

                      <FieldGroup label="Legacy Vendor Record #">
                        <CompactInput value={val('vendor_no')} onChange={set('vendor_no')} placeholder="Unique ledger alias if applicable" />
                      </FieldGroup>
                    </div>
                  </section>

                  {/* Operational Nodes (Contacts) */}
                  <section>
                    <SectionHeading icon={<Users className="w-5 h-5 pointer-events-none" />} description="Critical routing personnel designated to operational, secondary, and financial workflows.">
                        Key Routing Personnel
                    </SectionHeading>
                    
                    <div className="space-y-10">
                      <div>
                        <div className="flex items-center gap-3 mb-5">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white text-[11px] font-black">1</span>
                            <p className="text-[14px] font-bold text-slate-900 tracking-wide">Primary Representative</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pl-9">
                          <CompactInput value={val('contact_person')} onChange={set('contact_person')} placeholder="FullName Identity" />
                          <CompactInput value={val('contact_designation')} onChange={set('contact_designation')} placeholder="Role or Title" />
                          <CompactInput value={val('contact')} onChange={set('contact')} placeholder="Primary Phone" />
                          <CompactInput type="email" value={val('contact_person_email')} onChange={set('contact_person_email')} placeholder="Digital Inbox" />
                        </div>
                      </div>

                      <div className="pl-9"><Separator className="bg-slate-100" /></div>

                      <div>
                        <div className="flex items-center gap-3 mb-5">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400 text-[11px] font-black">2</span>
                            <p className="text-[14px] font-bold text-slate-700 tracking-wide">Secondary Point</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pl-9">
                          <CompactInput value={val('contact_person_2')} onChange={set('contact_person_2')} placeholder="FullName Identity" />
                          <CompactInput value={val('contact_designation_2')} onChange={set('contact_designation_2')} placeholder="Role or Title" />
                          <CompactInput value={val('contact_person_2_contact')} onChange={set('contact_person_2_contact')} placeholder="Secondary Phone" />
                          <CompactInput type="email" value={val('contact_person_2_email')} onChange={set('contact_person_2_email')} placeholder="Digital Inbox" />
                        </div>
                      </div>

                      <div className="pl-9"><Separator className="bg-slate-100" /></div>

                      <div>
                        <div className="flex items-center gap-3 mb-5">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-[11px] font-black">$</span>
                            <p className="text-[14px] font-bold text-slate-800 tracking-wide">Procurement / Desk</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pl-9">
                          <CompactInput value={val('purchase_person')} onChange={set('purchase_person')} placeholder="Auth Agent" />
                          <CompactInput value={val('purchase_designation')} onChange={set('purchase_designation')} placeholder="Contract Dept" />
                          <CompactInput value={val('purchase_contact')} onChange={set('purchase_contact')} placeholder="Line Terminal" />
                          <CompactInput type="email" value={val('purchase_email')} onChange={set('purchase_email')} placeholder="Financial Inbox" />
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Physical Domains */}
                  <section>
                    <SectionHeading icon={<MapPin className="w-5 h-5" />} description="Establish primary registration alongside flexible receiving nodes for deliveries.">
                       Physical Geography Networks
                    </SectionHeading>

                    <div className="grid grid-cols-1 max-w-4xl gap-12">
                      {/* Primary Nexus */}
                      <div className="rounded-2xl bg-[oklch(0.99_0.005_250)] border border-slate-200/80 p-8 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                           <div className="w-2 h-2 rounded-full bg-indigo-500" />
                           <h4 className="text-[15px] font-bold text-slate-900 tracking-tight">Main Registered Address (Billing)</h4>
                        </div>
                        <div className="space-y-6">
                          <CompactInput value={val('address1')} onChange={set('address1')} placeholder="Street Topology Line #1" className="h-[48px]" />
                          <CompactInput value={val('address2')} onChange={set('address2')} placeholder="Continuation Plot / Building"  className="h-[48px]"/>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <FieldGroup label="Registered State">
                               <div className="relative">
                                  <select className={selectCn} value={val('state')} onChange={e => setFormData({ ...formData, state: e.target.value })}>
                                    <option value="">Pending Selection</option>
                                    {indianStates.map(state => (<option key={state} value={state}>{state}</option>))}
                                  </select>
                                  <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400">
                                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                  </div>
                               </div>
                            </FieldGroup>
                            <FieldGroup label="Local District / City">
                              <CompactInput value={val('city')} onChange={set('city')} placeholder="Jurisdiction" />
                            </FieldGroup>
                            <FieldGroup label="Zone Pincode">
                              <CompactInput value={val('pincode')} onChange={set('pincode')} placeholder="Code Node" className="font-mono tracking-wider text-[14px] font-semibold" />
                            </FieldGroup>
                          </div>
                        </div>
                      </div>

                      {/* Terminals (Shipping) */}
                      <div>
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                             <div className="w-2 h-2 rounded-full bg-emerald-500" />
                             <h4 className="text-[15px] font-bold text-slate-900 tracking-tight">Delivery Transfer Nodes (Shipping)</h4>
                          </div>
                          {shippingAddresses.length > 0 && (
                            <Button type="button" variant="ghost" size="sm" onClick={copyBillingToShipping} className="text-indigo-600 font-semibold hover:bg-indigo-50">
                               <Copy className="w-4 h-4 mr-2" /> Match via Billing
                            </Button>
                          )}
                        </div>
                        
                        <div className="space-y-4">
                          {shippingAddresses.map((addr: any) => (
                            <div key={addr.id} className="group flex items-start justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 transition-all hover:border-slate-300 hover:shadow-md">
                              <div className="min-w-0">
                                <div className="flex items-center gap-3 text-[15px] font-bold text-slate-800 mb-1.5">
                                  <span className="truncate">{addr.address_name || 'Unnamed Depot'}</span>
                                  {addr.is_default && <Badge variant="default" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">System Default</Badge>}
                                </div>
                                <p className="text-[14px] font-medium text-slate-600 line-clamp-2 md:line-clamp-none">{addr.address_line1} {addr.address_line2}</p>
                                <p className="text-[14px] text-slate-500 mt-0.5">{addr.city}, {addr.state} • {addr.pincode}</p>
                              </div>
                              <button type="button" onClick={() => deleteShippingAddress(addr.id)} className="shrink-0 rounded-xl p-2.5 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus:ring-4 focus:ring-rose-500/20">
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
                                <FieldGroup label="Facility Alias">
                                    <CompactInput value={newShipping.address_name} onChange={e => setNewShipping({ ...newShipping, address_name: (e.target as HTMLInputElement).value })} placeholder="e.g. Warehouse Gamma" className="bg-white/60" />
                                </FieldGroup>
                                <FieldGroup label="Local Dispatch Contact">
                                    <CompactInput value={newShipping.contact} onChange={e => setNewShipping({ ...newShipping, contact: (e.target as HTMLInputElement).value })} placeholder="Handler phone" className="bg-white/60" />
                                </FieldGroup>
                              </div>
                              
                              <div className="space-y-4">
                                <CompactInput value={newShipping.address_line1} onChange={e => setNewShipping({ ...newShipping, address_line1: (e.target as HTMLInputElement).value })} placeholder="Address String 1" className="bg-white/60" />
                                <CompactInput value={newShipping.address_line2} onChange={e => setNewShipping({ ...newShipping, address_line2: (e.target as HTMLInputElement).value })} placeholder="Address String 2" className="bg-white/60" />
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <FieldGroup label="State Bounds">
                                   <div className="relative">
                                      <select className={cn(selectCn, "bg-white/60")} value={newShipping.state} onChange={e => setNewShipping({ ...newShipping, state: e.target.value })}>
                                        <option value="">Undefined</option>
                                        {indianStates.map(state => (<option key={state} value={state}>{state}</option>))}
                                      </select>
                                      <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400">
                                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                      </div>
                                   </div>
                                </FieldGroup>
                                <FieldGroup label="Municipality">
                                    <CompactInput value={newShipping.city} onChange={e => setNewShipping({ ...newShipping, city: (e.target as HTMLInputElement).value })} placeholder="City block" className="bg-white/60" />
                                </FieldGroup>
                                <FieldGroup label="Routing Code">
                                    <CompactInput value={newShipping.pincode} onChange={e => setNewShipping({ ...newShipping, pincode: (e.target as HTMLInputElement).value })} placeholder="Pincode" className="bg-white/60 font-mono" />
                                </FieldGroup>
                              </div>
                              
                              <div className="flex gap-3 pt-2">
                                <Button type="button" className="h-11 rounded-xl px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold" onClick={addShippingAddress}>Mount Node</Button>
                                <Button type="button" variant="secondary" className="h-11 rounded-xl px-6" onClick={() => setShowShippingForm(false)}>Discard</Button>
                              </div>
                            </div>
                          )}

                          {!showShippingForm && shippingAddresses.length === 0 && (
                            <button
                              type="button"
                              className="w-full rounded-2xl border-2 border-dashed border-slate-200 py-10 text-[14px] font-bold tracking-wide text-slate-400 transition-all hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20"
                              onClick={() => {
                                 copyBillingToShipping();
                                 setShowShippingForm(true);
                              }}
                            >
                              <span className="flex items-center justify-center gap-2">
                                <Plus className="w-5 h-5 pointer-events-none" />
                                Append Physical Drop Location
                              </span>
                            </button>
                          )}
                          {!showShippingForm && shippingAddresses.length > 0 && (
                            <button
                              type="button"
                              className="w-full rounded-2xl border border-slate-200/80 bg-slate-50/50 py-5 text-[14px] font-bold tracking-wide text-slate-500 transition-all hover:border-slate-300 hover:text-slate-800 hover:bg-slate-100"
                              onClick={() => {
                                 setNewShipping({ address_name: '', address_line1: '', address_line2: '', city: '', state: '', pincode: '', gstin: '', contact: '', is_default: false });
                                 setShowShippingForm(true);
                              }}
                            >
                              <span className="flex items-center justify-center gap-2">
                                <Plus className="w-4 h-4" /> Expand Network Nodes
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Operational Notes */}
                  <section>
                    <SectionHeading icon={<AlignLeft className="w-5 h-5" />} description="Store unstructured operational mandates directly mapped to this identity file.">
                        Internal Ledger Notes
                    </SectionHeading>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl">
                      <FieldGroup label="System Remarks">
                        <CompactTextarea rows={4} value={val('remarks')} onChange={e => setFormData({ ...formData, remarks: e.target.value })} placeholder="Arbitrary operator remarks kept internally valid..." />
                      </FieldGroup>
                      <FieldGroup label="Background Dossier / Briefing">
                        <CompactTextarea rows={4} value={val('about_client')} onChange={e => setFormData({ ...formData, about_client: e.target.value })} placeholder="Saturated client back-history, preferences, instructions..." />
                      </FieldGroup>
                    </div>
                  </section>

                </div>

                {/* Main Action Footer */}
                <div className="sticky bottom-0 z-30 flex flex-col-reverse md:flex-row items-center justify-between rounded-b-[32px] border-t border-slate-200/80 bg-white/90 px-8 md:px-14 py-6 backdrop-blur-xl shadow-[0_-20px_40px_-20px_rgba(0,0,0,0.05)] gap-4">
                  <p className="text-[14px] font-bold text-slate-500 flex items-center gap-3 uppercase tracking-widest w-full md:w-auto justify-center md:justify-start">
                    <span className={cn("w-2.5 h-2.5 rounded-full shadow-inner", isDirty ? "bg-amber-400" : "bg-emerald-400")} />
                    {isDirty ? 'UNCOMMITTED DRIFT' : 'SYNCHRONIZED'}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3 w-full md:w-auto">
                    <Button type="button" variant="ghost" className="h-12 rounded-xl px-6 text-[14px] font-bold hover:bg-slate-100" onClick={onCancel} disabled={saving}>Halt & Return</Button>
                    {editMode && (
                      <Button type="button" variant="danger" className="h-12 rounded-xl px-6 text-[14px] font-bold bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 hover:border-rose-300" onClick={deleteClient} disabled={saving}>Eradicate Record</Button>
                    )}
                    <Button type="submit" className="h-12 rounded-xl px-10 text-[15px] font-bold shadow-lg shadow-indigo-600/20 bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-4 focus:ring-indigo-600/20" disabled={saving}>
                      {saving ? 'Processing Txn...' : editMode ? 'Deploy Edits' : 'Register Construct'}
                    </Button>
                  </div>
                </div>

              </div>
            </form>
          </TabsContent>

          {/* ─── PRICING TAB ─── */}
          <TabsContent value="pricing" className="mt-0 ring-0 outline-none">
            <div className="rounded-[32px] border border-slate-200/80 bg-white shadow-2xl shadow-slate-200/40">
               <div className="p-8 md:p-14 pb-0">
                 <ClientDiscountPortfolio formData={formData} setFormData={setFormData} isAdmin={isAdmin} />
               </div>
               
               <div className="sticky bottom-0 z-30 mt-6 flex flex-col-reverse md:flex-row items-center justify-between rounded-b-[32px] border-t border-slate-200/80 bg-white/90 px-8 md:px-14 py-6 backdrop-blur-xl shadow-[0_-20px_40px_-20px_rgba(0,0,0,0.05)] gap-4">
                  <p className="text-[14px] font-bold text-slate-500 flex items-center gap-3 uppercase tracking-widest w-full md:w-auto justify-center md:justify-start">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-inner" />
                    FINANCIAL COMPLIANCE
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3 w-full md:w-auto">
                    <Button type="button" variant="ghost" className="h-12 rounded-xl px-6 text-[14px] font-bold" onClick={onCancel}>Exit Settings</Button>
                    <Button type="button" onClick={() => handleSubmit()} className="h-12 rounded-xl px-10 text-[15px] font-bold shadow-lg shadow-indigo-600/20 bg-indigo-600 hover:bg-indigo-700 text-white">
                      {editMode ? 'Approve & Release Matrix' : 'Approve Baseline Matrix'}
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
