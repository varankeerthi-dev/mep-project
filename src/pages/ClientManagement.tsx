import React, { useState, useEffect, useMemo } from 'react';
import type { ChangeEvent, FormEvent, ComponentProps } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ensureValidSession } from '../queryClient';
import { withTimeout } from '../utils/queryTimeout';
import { z } from 'zod';
import {
  Input,
  Tabs, TabsList, TabsTrigger, TabsContent,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '../lib/utils';
import { 
  Truck,
  Plus,
  Trash2,
  Copy,
  Info,
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

const sectionHeadStyle: React.CSSProperties = {
  fontWeight: 600, fontSize: '11px', color: '#6b7280',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px'
};

const labelStyle: React.CSSProperties = {
  minWidth: '70px', maxWidth: '70px',
  fontWeight: 600, fontSize: '11px', color: '#374151'
};

const inputStyle: React.CSSProperties = {
  padding: '8px 10px', fontSize: '12px', lineHeight: '20px', outline: 'none'
};

const headerFieldStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px'
};

const fieldColStyle: React.CSSProperties = {
  flex: 1
};

const renderHeaderField = (label: string, field: React.ReactNode, isLast = false) => (
  <div style={{ ...headerFieldStyle, marginBottom: isLast ? 0 : '8px' }}>
    <span style={labelStyle}>{label}</span>
    <div style={fieldColStyle}>{field}</div>
  </div>
);

const sectionBgStyle: React.CSSProperties = {
  background: '#f8f9fa', padding: '12px', borderRadius: '6px'
};

const sectionGridStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px'
};

const CompactInput = (props: ComponentProps<typeof Input>) => (
  <Input {...props} style={{ ...inputStyle, ...(props.style || {}) } as React.CSSProperties} className={cn("border-zinc-200 w-full", props.className)} />
);

const CompactTextarea = (props: ComponentProps<typeof Textarea>) => (
  <Textarea {...props} className={cn("min-h-[80px] border border-zinc-200 bg-white p-2 text-[12px] resize-y", props.className)} style={undefined} />
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
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div className="animate-spin" style={{ width: '28px', height: '28px', borderRadius: '50%', border: '3px solid rgba(24,95,165,0.2)', borderTopColor: '#185FA5' }}></div>
          <p style={{ fontSize: '12px', fontWeight: 500, color: '#71717a', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (clientQuery.isError) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '24px' }}>
        <div style={{ maxWidth: '400px', width: '100%', background: 'white', border: '1px solid #fecdd3', borderRadius: '6px', padding: '24px', textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
             <Info style={{ width: '20px', height: '20px', color: '#e11d48' }} />
          </div>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#18181b', margin: '0 0 4px' }}>Error Loading Client</h3>
          <p style={{ fontSize: '12px', color: '#71717a', marginBottom: '20px' }}>Could not retrieve the client profile. Please try again.</p>
          <button type="button" style={{ padding: '6px 14px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
            onClick={onCancel}
            onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
          >Return to Directory</button>
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
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

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
        .eq('is_active', true);
      if (error) throw error;
      return (data || []).filter((s: any) => s.structure_name === 'Bulk');
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
    if (value === '') {
      setCustomDiscounts((prev: any) => ({
        ...prev,
        [variantId]: '' as any
      }));
      setValidationErrors(prev => {
        const copy = { ...prev };
        delete copy[variantId];
        return copy;
      });
      return;
    }

    const num = parseFloat(value);
    if (isNaN(num)) return;

    let clampedNum = num;
    if (num > 100) {
      clampedNum = 100;
    } else if (num < 0) {
      clampedNum = 0;
    }

    // Validate with Zod schema
    const result = z.number()
      .min(0, { message: 'Discount cannot be negative' })
      .max(100, { message: 'Discount cannot exceed 100%' })
      .safeParse(clampedNum);
      
    if (!result.success) {
      setValidationErrors(prev => ({
        ...prev,
        [variantId]: result.error.errors[0].message
      }));
    } else {
      setValidationErrors(prev => {
        const copy = { ...prev };
        delete copy[variantId];
        return copy;
      });
    }

    setCustomDiscounts((prev: any) => ({
      ...prev,
      [variantId]: clampedNum
    }));
  };

  const handleSaveCustomDiscounts = async () => {
    if (!formData.id) {
      setSaveMessage({ type: 'error', text: 'Please save the client general profile first before saving customized discounts.' });
      return;
    }

    // Double check all validations using Zod
    const validatedDiscounts: Record<string, number> = {};
    for (const [id, val] of Object.entries(customDiscounts)) {
      const num = val === '' ? 0 : (typeof val === 'string' ? parseFloat(val) : val);
      const result = z.number()
        .min(0, { message: 'Discount cannot be negative' })
        .max(100, { message: 'Discount cannot exceed 100%' })
        .safeParse(isNaN(num) ? 0 : num);
      if (!result.success) {
        const catName = discountCategories.find(dc => dc.id === id)?.name || 'Unknown Category';
        setSaveMessage({ type: 'error', text: `Validation failed: "${catName}" ${result.error.errors[0].message}` });
        return;
      }
      validatedDiscounts[id] = isNaN(num) ? 0 : num;
    }

    setSaving(true);
    setSaveMessage({ type: '', text: '' });
    try {
      const { error } = await supabase
        .from('clients')
        .update({ custom_discounts: validatedDiscounts })
        .eq('id', formData.id);
      if (error) throw error;
      setFormData((prev: any) => ({ ...prev, custom_discounts: validatedDiscounts }));
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

  const hasValidationErrors = Object.keys(validationErrors).length > 0;
  const isSaveDisabled = saving || !formData.id || formData.discount_type === 'Standard' || hasValidationErrors;

  const primaryBtnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '4px',
    padding: '6px 14px', background: '#185FA5',
    border: '1px solid #185FA5', color: '#fff',
    borderRadius: '6px', fontSize: '12px', fontWeight: 500,
    cursor: isSaveDisabled ? 'not-allowed' : 'pointer',
    opacity: isSaveDisabled ? 0.6 : 1,
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
                    value={formData.discount_type || 'Standard'}
                    onChange={e => setFormData({ ...formData, discount_type: e.target.value, standard_pricelist_id: e.target.value === 'Standard' ? formData.standard_pricelist_id : null })}
                    disabled={!isAdmin}
                    style={{ padding: '4px 8px', fontSize: '12px' }}
                  >
                    <option value="Standard">Standard Matrix (Price List)</option>
                    <option value="Bulk">Bulk Schema (Variant Match)</option>
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
      {formData.discount_type !== 'Standard' && (
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
              disabled={isSaveDisabled}
              onMouseEnter={e => { if (!isSaveDisabled) { e.currentTarget.style.background = '#0C447C'; e.currentTarget.style.borderColor = '#0C447C'; }}}
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
                          <div className="flex flex-col items-end gap-1">
                            <CompactInput
                              type="number"
                              className={cn(
                                "h-10 w-28 rounded-lg border-zinc-200 bg-white px-3 text-right text-[14px] font-semibold text-indigo-700 shadow-inner ml-auto",
                                validationErrors[dc.id] && "border-red-500 focus-visible:ring-red-500/15 focus-visible:border-red-500"
                              )}
                              value={customDiscounts[dc.id] ?? 0}
                              onChange={(e) => handleCustomDiscountChange(dc.id, e.target.value)}
                              min="0"
                              max="100"
                              step="0.01"
                              disabled={formData.discount_type === 'Standard' || !isAdmin}
                            />
                            {validationErrors[dc.id] && (
                              <span className="text-[10px] text-red-500 font-medium">
                                {validationErrors[dc.id]}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </section>
      )}

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
    about_client: '', discount_type: 'Standard', standard_pricelist_id: null,
    msme_register_type: '', msme_number: '',
    gst_treatment: '', client_type: 'Business', country: 'India',
    contact_code: '+91', contact_person_2_contact_code: '+91', purchase_contact_code: '+91'
  });
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

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
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.state-dropdown-container')) {
        setIsStateDropdownOpen(false);
      }
      if (!(e.target as HTMLElement).closest('.country-code-container')) {
        setIsCountryCodeOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [stateSearchText, setStateSearchText] = useState('');
  const [isStateDropdownOpen, setIsStateDropdownOpen] = useState(false);
  const [countryCodeSearchText, setCountryCodeSearchText] = useState('');
  const [isCountryCodeOpen, setIsCountryCodeOpen] = useState(false);
  const [activeCountryField, setActiveCountryField] = useState('');
  const [showShippingForm, setShowShippingForm] = useState(false);
  const [newShipping, setNewShipping] = useState({
    address_name: '', address_line1: '', address_line2: '', city: '', state: '',
    pincode: '', gstin: '', contact: '', is_default: false
  });

  const countryCodes = [
  '+1', '+7', '+20', '+27', '+30', '+31', '+32', '+33', '+34', '+36',
  '+39', '+40', '+41', '+43', '+44', '+45', '+46', '+47', '+48', '+49',
  '+51', '+52', '+53', '+54', '+55', '+56', '+57', '+58', '+60', '+61',
  '+62', '+63', '+64', '+65', '+66', '+81', '+82', '+84', '+86', '+90',
  '+91', '+92', '+93', '+94', '+95', '+96', '+97', '+98', '+212', '+213',
  '+216', '+218', '+220', '+221', '+222', '+223', '+224', '+225', '+226',
  '+227', '+228', '+229', '+230', '+231', '+232', '+233', '+234', '+235',
  '+236', '+237', '+238', '+239', '+240', '+241', '+242', '+243', '+244',
  '+245', '+246', '+247', '+248', '+249', '+250', '+251', '+252', '+253',
  '+254', '+255', '+256', '+257', '+258', '+260', '+261', '+262', '+263',
  '+264', '+265', '+266', '+267', '+268', '+269', '+290', '+291', '+297',
  '+298', '+299', '+350', '+351', '+352', '+353', '+354', '+355', '+356',
  '+357', '+358', '+359', '+370', '+371', '+372', '+373', '+374', '+375',
  '+376', '+377', '+378', '+379', '+380', '+381', '+382', '+385', '+386',
  '+387', '+389', '+420', '+421', '+423', '+500', '+501', '+502', '+503',
  '+504', '+505', '+506', '+507', '+508', '+509', '+590', '+591', '+592',
  '+593', '+594', '+595', '+596', '+597', '+598', '+599', '+670', '+672',
  '+673', '+674', '+675', '+676', '+677', '+678', '+679', '+680', '+681',
  '+682', '+683', '+685', '+686', '+687', '+688', '+689', '+690', '+691',
  '+692', '+850', '+852', '+853', '+855', '+856', '+880', '+886', '+960',
  '+961', '+962', '+963', '+964', '+965', '+966', '+967', '+968', '+970',
  '+971', '+972', '+973', '+974', '+975', '+976', '+977', '+992', '+993',
  '+994', '+995', '+996', '+998'
];

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

  const confirmDeleteClient = async () => {
    if (!editMode || !clientData?.id) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('clients').delete().eq('id', clientData.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-ui', 'clients', organisation?.id] });
      setIsDirty(false);
      setShowDeleteModal(false);
      onCancel();
    } catch (err: any) {
      alert('Deletion Failed: ' + (err?.message || err));
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async (e?: FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (saving) return;
    
    const phonePattern = /^[0-9\s\-\+\(\)]{6,20}$/;
    const clientSchema = z.object({
      client_name: z.string()
        .min(1, 'Client Name is required')
        .regex(/^[A-Za-z\s\&\'\-\.\,\(\)\[\]\/]+$/, 'Client Name must only contain letters and symbols'),
      gstin: z.string().length(15, 'GSTIN must be exactly 15 characters').optional().or(z.literal('')),
      contact_person_email: z.string().email('Invalid email in Primary Contact').optional().or(z.literal('')),
      contact_person_2_email: z.string().email('Invalid email in Secondary Contact').optional().or(z.literal('')),
      purchase_email: z.string().email('Invalid email in Purchase Contact').optional().or(z.literal('')),
    });

    const result = clientSchema.safeParse({
      client_name: formData.client_name,
      gstin: formData.gstin || '',
      contact_person_email: formData.contact_person_email || '',
      contact_person_2_email: formData.contact_person_2_email || '',
      purchase_email: formData.purchase_email || '',
    });

    if (!result.success) {
      const errs: Record<string, string> = {};
      for (const issue of result.error.errors) {
        const field = issue.path[0] as string;
        if (!errs[field]) errs[field] = 'Enter proper email';
      }
      setValidationErrors(prev => ({ ...prev, ...errs }));
      return;
    } else {
      setValidationErrors(prev => {
        const { contact_person_email, contact_person_2_email, purchase_email, ...rest } = prev;
        return rest;
      });
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
            <button type="button"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
              onClick={onCancel as any}
              onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
            ><ChevronLeft size={13} /> Back</button>
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
          <div className="pb-6">
            <TabsList className="h-9 p-0.5 bg-zinc-100 rounded-md">
              <TabsTrigger 
                 value="general" 
                 className="h-full px-4 text-[12px] font-medium text-zinc-500 data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-sm rounded transition-all"
              >
                General Info
              </TabsTrigger>
              <TabsTrigger 
                 value="pricing" 
                 className="h-full px-4 text-[12px] font-medium text-zinc-500 data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-sm rounded transition-all"
              >
                Discount Settings
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ─── GENERAL TAB ─── */}
          <TabsContent value="general" className="mt-0 ring-0 outline-none">
            <form onSubmit={handleSubmit} className="relative">
              <div className="border border-zinc-200 bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]">
                
                <div className="p-6 space-y-8">
                  
                  {/* Identity Block */}
                  <section>
                    <div style={sectionHeadStyle}>Client Information</div>
                    <div style={sectionBgStyle}>
                      <div style={sectionGridStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={headerFieldStyle}>
                            <span style={labelStyle}>Type:</span>
                            <div style={{ ...fieldColStyle, display: 'flex', gap: '4px' }}>
                              <button type="button"
                                style={{ padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, border: '1px solid', cursor: 'pointer', transition: 'all 0.15s', background: formData.client_type === 'Business' ? '#185FA5' : '#fff', color: formData.client_type === 'Business' ? '#fff' : '#374151', borderColor: formData.client_type === 'Business' ? '#185FA5' : '#d1d5db' }}
                                onClick={() => setFormData({ ...formData, client_type: 'Business' })}
                              >Business</button>
                              <button type="button"
                                style={{ padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, border: '1px solid', cursor: 'pointer', transition: 'all 0.15s', background: formData.client_type === 'Individual' ? '#185FA5' : '#fff', color: formData.client_type === 'Individual' ? '#fff' : '#374151', borderColor: formData.client_type === 'Individual' ? '#185FA5' : '#d1d5db' }}
                                onClick={() => setFormData({ ...formData, client_type: 'Individual' })}
                              >Individual</button>
                            </div>
                          </div>
                          {renderHeaderField('Client Name:', <input style={inputStyle} className="border border-zinc-200 w-full" value={val('client_name')} onChange={set('client_name')} required placeholder="Enter client name" />)}
                          {renderHeaderField('GSTIN:', <input style={{ ...inputStyle, fontFamily: 'monospace' }} className="border border-zinc-200 w-full uppercase" value={val('gstin')} onChange={handleGstChange} placeholder="15 Digit GST Number" maxLength={15} />)}
                          {renderHeaderField('Vendor Code:', <input style={inputStyle} className="border border-zinc-200 w-full" value={val('vendor_no')} onChange={set('vendor_no')} placeholder="Vendor Code" />)}
                          {renderHeaderField('MSME No:', <input style={{ ...inputStyle, fontFamily: 'monospace' }} className="border border-zinc-200 w-full uppercase" value={val('msme_number')} onChange={set('msme_number')} placeholder="UDYAM/MSME Registration Number" />)}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {renderHeaderField('Status:', (
                            <select style={inputStyle} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]" value={val('category') || 'Active'} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                              <option value="Active">Active</option>
                              <option value="Prospect">Prospect</option>
                              <option value="Inactive">Inactive</option>
                            </select>
                          ))}
                          {renderHeaderField('GST Treatment:', (
                            <select style={inputStyle} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]" value={val('gst_treatment') || ''} onChange={e => setFormData({ ...formData, gst_treatment: e.target.value })}>
                              <option value="">Select GST Treatment</option>
                              <option value="Registered Business Regular">Registered Business Regular</option>
                              <option value="Registered Business Composition">Registered Business Composition</option>
                              <option value="Unregistered Business">Unregistered Business</option>
                              <option value="Consumer">Consumer</option>
                              <option value="Overseas">Overseas</option>
                              <option value="Special Economic Zone (SEZ)">Special Economic Zone (SEZ)</option>
                              <option value="Deemed Export">Deemed Export</option>
                              <option value="Tax Deductor">Tax Deductor</option>
                              <option value="SEZ Developer">SEZ Developer</option>
                              <option value="Input Service Distributor">Input Service Distributor</option>
                            </select>
                          ))}
                          {renderHeaderField('MSME Type:', (
                            <select style={inputStyle} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]" value={val('msme_register_type') || ''} onChange={e => setFormData({ ...formData, msme_register_type: e.target.value })}>
                              <option value="">Select MSME Type</option>
                              <option value="micro">Micro Enterprise</option>
                              <option value="small">Small Enterprise</option>
                              <option value="macro">Macro Enterprise</option>
                            </select>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Operational Nodes (Contacts) */}
                  <div style={sectionHeadStyle}>Contact Information</div>
                    <div style={sectionBgStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={headerFieldStyle}>
                          <span style={{ ...labelStyle, minWidth: '110px', maxWidth: '110px' }}>Primary Contact:</span>
                          <div style={{ ...fieldColStyle, display: 'flex', gap: '8px' }}>
                            <input style={inputStyle} className="border border-zinc-200 bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]" placeholder="Contact Person Name" value={val('contact_person')} onChange={set('contact_person')} />
                            <input style={inputStyle} className="border border-zinc-200 bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]" placeholder="Designation" value={val('contact_designation')} onChange={set('contact_designation')} />
                            <div className="country-code-container hover:border-zinc-400 focus-within:ring-2 focus-within:ring-[#185FA5]/20 focus-within:border-[#185FA5]" style={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', position: 'relative' }}>
                              <input style={{ ...inputStyle, border: 'none', outline: 'none', width: '75px', padding: '8px 4px 8px 8px', background: '#fff', cursor: 'pointer' }}
                                value={isCountryCodeOpen && activeCountryField === 'primary' ? countryCodeSearchText : formData.contact_code || '+91'}
                                onChange={e => { setCountryCodeSearchText(e.target.value); setIsCountryCodeOpen(true); setActiveCountryField('primary'); }}
                                onFocus={() => { setIsCountryCodeOpen(true); setActiveCountryField('primary'); }}
                                readOnly={!isCountryCodeOpen || activeCountryField !== 'primary'}
                              />
                              {isCountryCodeOpen && activeCountryField === 'primary' && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, background: 'white', border: '1px solid #d1d5db', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', maxHeight: '180px', overflowY: 'auto', minWidth: '120px' }}>
                                  {countryCodes.filter(c => !countryCodeSearchText || c.includes(countryCodeSearchText)).map(c => (
                                    <div key={c} style={{ padding: '4px 10px', cursor: 'pointer', fontSize: '11px', borderBottom: '1px solid #f3f4f6' }}
                                      onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                                      onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                      onClick={() => { setFormData({ ...formData, contact_code: c }); setCountryCodeSearchText(''); setIsCountryCodeOpen(false); }}
                                    >{c}</div>
                                  ))}
                                </div>
                              )}
                              <span style={{ borderLeft: '1px solid #e5e7eb', height: '20px', margin: 'auto 0' }}></span>
                              <input style={{ ...inputStyle, border: 'none', outline: 'none', flex: 1, background: '#fff' }} placeholder="Phone" value={val('contact')} onChange={set('contact')} />
                            </div>
                            <div className={validationErrors.contact_person_email ? 'error-shake' : ''}>
                              <input style={{ ...inputStyle, borderColor: validationErrors.contact_person_email ? '#e11d48' : undefined }} className="border border-zinc-200 bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]" type="email" placeholder="Email" value={val('contact_person_email')} onChange={e => { setFormData({ ...formData, contact_person_email: e.target.value }); setValidationErrors(prev => { const { contact_person_email, ...rest } = prev; return rest; }); }} />
                              {validationErrors.contact_person_email && <div style={{ fontSize: '11px', color: '#e11d48', marginTop: '2px', lineHeight: 1.3 }}>Enter proper email</div>}
                            </div>
                          </div>
                        </div>
                        <div style={headerFieldStyle}>
                          <span style={{ ...labelStyle, minWidth: '110px', maxWidth: '110px' }}>Secondary Contact:</span>
                          <div style={{ ...fieldColStyle, display: 'flex', gap: '8px' }}>
                            <input style={inputStyle} className="border border-zinc-200 bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]" placeholder="Contact Person Name" value={val('contact_person_2')} onChange={set('contact_person_2')} />
                            <input style={inputStyle} className="border border-zinc-200 bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]" placeholder="Designation" value={val('contact_designation_2')} onChange={set('contact_designation_2')} />
                            <div className="country-code-container hover:border-zinc-400 focus-within:ring-2 focus-within:ring-[#185FA5]/20 focus-within:border-[#185FA5]" style={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', position: 'relative' }}>
                              <input style={{ ...inputStyle, border: 'none', outline: 'none', width: '75px', padding: '8px 4px 8px 8px', background: '#fff', cursor: 'pointer' }}
                                value={isCountryCodeOpen && activeCountryField === 'secondary' ? countryCodeSearchText : formData.contact_person_2_contact_code || '+91'}
                                onChange={e => { setCountryCodeSearchText(e.target.value); setIsCountryCodeOpen(true); setActiveCountryField('secondary'); }}
                                onFocus={() => { setIsCountryCodeOpen(true); setActiveCountryField('secondary'); }}
                                readOnly={!isCountryCodeOpen || activeCountryField !== 'secondary'}
                              />
                              {isCountryCodeOpen && activeCountryField === 'secondary' && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, background: 'white', border: '1px solid #d1d5db', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', maxHeight: '180px', overflowY: 'auto', minWidth: '120px' }}>
                                  {countryCodes.filter(c => !countryCodeSearchText || c.includes(countryCodeSearchText)).map(c => (
                                    <div key={c} style={{ padding: '4px 10px', cursor: 'pointer', fontSize: '11px', borderBottom: '1px solid #f3f4f6' }}
                                      onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                                      onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                      onClick={() => { setFormData({ ...formData, contact_person_2_contact_code: c }); setCountryCodeSearchText(''); setIsCountryCodeOpen(false); }}
                                    >{c}</div>
                                  ))}
                                </div>
                              )}
                              <span style={{ borderLeft: '1px solid #e5e7eb', height: '20px', margin: 'auto 0' }}></span>
                              <input style={{ ...inputStyle, border: 'none', outline: 'none', flex: 1, background: '#fff' }} placeholder="Phone" value={val('contact_person_2_contact')} onChange={set('contact_person_2_contact')} />
                            </div>
                            <div className={validationErrors.contact_person_2_email ? 'error-shake' : ''}>
                              <input style={{ ...inputStyle, borderColor: validationErrors.contact_person_2_email ? '#e11d48' : undefined }} className="border border-zinc-200 bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]" type="email" placeholder="Email" value={val('contact_person_2_email')} onChange={e => { setFormData({ ...formData, contact_person_2_email: e.target.value }); setValidationErrors(prev => { const { contact_person_2_email, ...rest } = prev; return rest; }); }} />
                              {validationErrors.contact_person_2_email && <div style={{ fontSize: '11px', color: '#e11d48', marginTop: '2px', lineHeight: 1.3 }}>Enter proper email</div>}
                            </div>
                          </div>
                        </div>
                        <div style={headerFieldStyle}>
                          <span style={{ ...labelStyle, minWidth: '110px', maxWidth: '110px' }}>Purchase Contact:</span>
                          <div style={{ ...fieldColStyle, display: 'flex', gap: '8px' }}>
                            <input style={inputStyle} className="border border-zinc-200 bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]" placeholder="Contact Person Name" value={val('purchase_person')} onChange={set('purchase_person')} />
                            <input style={inputStyle} className="border border-zinc-200 bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]" placeholder="Designation" value={val('purchase_designation')} onChange={set('purchase_designation')} />
                            <div className="country-code-container hover:border-zinc-400 focus-within:ring-2 focus-within:ring-[#185FA5]/20 focus-within:border-[#185FA5]" style={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', position: 'relative' }}>
                              <input style={{ ...inputStyle, border: 'none', outline: 'none', width: '75px', padding: '8px 4px 8px 8px', background: '#fff', cursor: 'pointer' }}
                                value={isCountryCodeOpen && activeCountryField === 'purchase' ? countryCodeSearchText : formData.purchase_contact_code || '+91'}
                                onChange={e => { setCountryCodeSearchText(e.target.value); setIsCountryCodeOpen(true); setActiveCountryField('purchase'); }}
                                onFocus={() => { setIsCountryCodeOpen(true); setActiveCountryField('purchase'); }}
                                readOnly={!isCountryCodeOpen || activeCountryField !== 'purchase'}
                              />
                              {isCountryCodeOpen && activeCountryField === 'purchase' && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, background: 'white', border: '1px solid #d1d5db', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', maxHeight: '180px', overflowY: 'auto', minWidth: '120px' }}>
                                  {countryCodes.filter(c => !countryCodeSearchText || c.includes(countryCodeSearchText)).map(c => (
                                    <div key={c} style={{ padding: '4px 10px', cursor: 'pointer', fontSize: '11px', borderBottom: '1px solid #f3f4f6' }}
                                      onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                                      onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                      onClick={() => { setFormData({ ...formData, purchase_contact_code: c }); setCountryCodeSearchText(''); setIsCountryCodeOpen(false); }}
                                    >{c}</div>
                                  ))}
                                </div>
                              )}
                              <span style={{ borderLeft: '1px solid #e5e7eb', height: '20px', margin: 'auto 0' }}></span>
                              <input style={{ ...inputStyle, border: 'none', outline: 'none', flex: 1, background: '#fff' }} placeholder="Phone" value={val('purchase_contact')} onChange={set('purchase_contact')} />
                            </div>
                            <div className={validationErrors.purchase_email ? 'error-shake' : ''}>
                              <input style={{ ...inputStyle, borderColor: validationErrors.purchase_email ? '#e11d48' : undefined }} className="border border-zinc-200 bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]" type="email" placeholder="Email" value={val('purchase_email')} onChange={e => { setFormData({ ...formData, purchase_email: e.target.value }); setValidationErrors(prev => { const { purchase_email, ...rest } = prev; return rest; }); }} />
                              {validationErrors.purchase_email && <div style={{ fontSize: '11px', color: '#e11d48', marginTop: '2px', lineHeight: 1.3 }}>Enter proper email</div>}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  <div style={sectionHeadStyle}>Address Details</div>
                  <div style={sectionBgStyle}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {renderHeaderField('Address Line 1:', <input style={inputStyle} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]" value={val('address1')} onChange={set('address1')} placeholder="Address Line 1" />)}
                      {renderHeaderField('Address Line 2:', <input style={inputStyle} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]" value={val('address2')} onChange={set('address2')} placeholder="Address Line 2" />)}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={labelStyle}>State:</span>
                        <div className="state-dropdown-container" style={{ flex: 1, position: 'relative' }}>
                          <input
                            style={inputStyle}
                            className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]"
                            value={isStateDropdownOpen ? stateSearchText : (val('state') || '')}
                            onChange={e => { setStateSearchText(e.target.value); setIsStateDropdownOpen(true); }}
                            onFocus={() => setIsStateDropdownOpen(true)}
                            placeholder="Search state..."
                          />
                          {isStateDropdownOpen && (
                            <div style={{
                              position: 'absolute', top: '100%', left: 0, right: 0,
                              zIndex: 50, background: 'white', border: '1px solid #d1d5db',
                              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                              maxHeight: '200px', overflowY: 'auto'
                            }}>
                              {indianStates
                                .filter(s => !stateSearchText || s.toLowerCase().includes(stateSearchText.toLowerCase()))
                                .map(s => (
                                  <div key={s} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                    onClick={() => { setFormData({ ...formData, state: s }); setStateSearchText(''); setIsStateDropdownOpen(false); }}
                                  >{s}</div>
                                ))}
                              {indianStates.filter(s => !stateSearchText || s.toLowerCase().includes(stateSearchText.toLowerCase())).length === 0 && (
                                <div style={{ padding: '6px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>No states found</div>
                              )}
                            </div>
                          )}
                        </div>
                        <span style={{ ...labelStyle, minWidth: '45px', maxWidth: '45px' }}>City:</span>
                        <input style={{ ...inputStyle, width: '160px' }} className="border border-zinc-200 bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]" value={val('city')} onChange={set('city')} placeholder="City" />
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={labelStyle}>PIN:</span>
                        <input style={{ ...inputStyle, width: '140px', fontFamily: 'monospace' }} className="border border-zinc-200 bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]" value={val('pincode')} onChange={set('pincode')} placeholder="PIN Code" />
                        <span style={{ ...labelStyle, minWidth: '55px', maxWidth: '55px' }}>Country:</span>
                        <select style={inputStyle} className="border border-zinc-200 bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]" value={val('country') || 'India'} onChange={e => setFormData({ ...formData, country: e.target.value })}>
                          <option value="India">India</option>
                          <option value="Afghanistan">Afghanistan</option>
                          <option value="Albania">Albania</option>
                          <option value="Algeria">Algeria</option>
                          <option value="Angola">Angola</option>
                          <option value="Argentina">Argentina</option>
                          <option value="Armenia">Armenia</option>
                          <option value="Australia">Australia</option>
                          <option value="Austria">Austria</option>
                          <option value="Azerbaijan">Azerbaijan</option>
                          <option value="Bahrain">Bahrain</option>
                          <option value="Bangladesh">Bangladesh</option>
                          <option value="Belarus">Belarus</option>
                          <option value="Belgium">Belgium</option>
                          <option value="Bhutan">Bhutan</option>
                          <option value="Botswana">Botswana</option>
                          <option value="Brazil">Brazil</option>
                          <option value="Brunei">Brunei</option>
                          <option value="Bulgaria">Bulgaria</option>
                          <option value="Cambodia">Cambodia</option>
                          <option value="Cameroon">Cameroon</option>
                          <option value="Canada">Canada</option>
                          <option value="Chile">Chile</option>
                          <option value="China">China</option>
                          <option value="Colombia">Colombia</option>
                          <option value="Croatia">Croatia</option>
                          <option value="Cyprus">Cyprus</option>
                          <option value="Czech Republic">Czech Republic</option>
                          <option value="Denmark">Denmark</option>
                          <option value="Egypt">Egypt</option>
                          <option value="Estonia">Estonia</option>
                          <option value="Ethiopia">Ethiopia</option>
                          <option value="Finland">Finland</option>
                          <option value="France">France</option>
                          <option value="Georgia">Georgia</option>
                          <option value="Germany">Germany</option>
                          <option value="Ghana">Ghana</option>
                          <option value="Greece">Greece</option>
                          <option value="Hong Kong">Hong Kong</option>
                          <option value="Hungary">Hungary</option>
                          <option value="Iceland">Iceland</option>
                          <option value="Indonesia">Indonesia</option>
                          <option value="Iran">Iran</option>
                          <option value="Iraq">Iraq</option>
                          <option value="Ireland">Ireland</option>
                          <option value="Israel">Israel</option>
                          <option value="Italy">Italy</option>
                          <option value="Japan">Japan</option>
                          <option value="Jordan">Jordan</option>
                          <option value="Kazakhstan">Kazakhstan</option>
                          <option value="Kenya">Kenya</option>
                          <option value="Kuwait">Kuwait</option>
                          <option value="Kyrgyzstan">Kyrgyzstan</option>
                          <option value="Laos">Laos</option>
                          <option value="Latvia">Latvia</option>
                          <option value="Lebanon">Lebanon</option>
                          <option value="Libya">Libya</option>
                          <option value="Lithuania">Lithuania</option>
                          <option value="Luxembourg">Luxembourg</option>
                          <option value="Malaysia">Malaysia</option>
                          <option value="Maldives">Maldives</option>
                          <option value="Mali">Mali</option>
                          <option value="Malta">Malta</option>
                          <option value="Mauritius">Mauritius</option>
                          <option value="Mexico">Mexico</option>
                          <option value="Moldova">Moldova</option>
                          <option value="Monaco">Monaco</option>
                          <option value="Mongolia">Mongolia</option>
                          <option value="Morocco">Morocco</option>
                          <option value="Myanmar">Myanmar</option>
                          <option value="Namibia">Namibia</option>
                          <option value="Nepal">Nepal</option>
                          <option value="Netherlands">Netherlands</option>
                          <option value="New Zealand">New Zealand</option>
                          <option value="Nigeria">Nigeria</option>
                          <option value="North Korea">North Korea</option>
                          <option value="Norway">Norway</option>
                          <option value="Oman">Oman</option>
                          <option value="Pakistan">Pakistan</option>
                          <option value="Palestine">Palestine</option>
                          <option value="Peru">Peru</option>
                          <option value="Philippines">Philippines</option>
                          <option value="Poland">Poland</option>
                          <option value="Portugal">Portugal</option>
                          <option value="Qatar">Qatar</option>
                          <option value="Romania">Romania</option>
                          <option value="Russia">Russia</option>
                          <option value="Saudi Arabia">Saudi Arabia</option>
                          <option value="Serbia">Serbia</option>
                          <option value="Singapore">Singapore</option>
                          <option value="Slovakia">Slovakia</option>
                          <option value="Slovenia">Slovenia</option>
                          <option value="Somalia">Somalia</option>
                          <option value="South Africa">South Africa</option>
                          <option value="South Korea">South Korea</option>
                          <option value="Spain">Spain</option>
                          <option value="Sudan">Sudan</option>
                          <option value="Sweden">Sweden</option>
                          <option value="Switzerland">Switzerland</option>
                          <option value="Syria">Syria</option>
                          <option value="Taiwan">Taiwan</option>
                          <option value="Tajikistan">Tajikistan</option>
                          <option value="Tanzania">Tanzania</option>
                          <option value="Thailand">Thailand</option>
                          <option value="Tunisia">Tunisia</option>
                          <option value="Turkey">Turkey</option>
                          <option value="Turkmenistan">Turkmenistan</option>
                          <option value="Uganda">Uganda</option>
                          <option value="Ukraine">Ukraine</option>
                          <option value="United Arab Emirates">United Arab Emirates</option>
                          <option value="United Kingdom">United Kingdom</option>
                          <option value="United States">United States</option>
                          <option value="Uzbekistan">Uzbekistan</option>
                          <option value="Vietnam">Vietnam</option>
                          <option value="Yemen">Yemen</option>
                          <option value="Zimbabwe">Zimbabwe</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div style={{ ...sectionHeadStyle, marginTop: '24px' }}>Shipping Addresses</div>
                  <div style={sectionBgStyle}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginBottom: '4px' }}>
                        {shippingAddresses.length > 0 && (
                          <button type="button"
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', borderRadius: '6px', fontSize: '11px', fontWeight: 500, cursor: 'pointer' }}
                            onClick={copyBillingToShipping}
                            onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                          ><Copy size={12} /> Copy from Billing</button>
                        )}
                      </div>
                      {shippingAddresses.map((addr: any) => (
                        <div key={addr.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '12px', color: '#1f2937', marginBottom: '2px' }}>
                              <span>{addr.address_name || 'Unnamed Address'}</span>
                              {addr.is_default && <span style={{ fontSize: '10px', background: '#d1fae5', color: '#065f46', padding: '1px 6px', borderRadius: '3px', fontWeight: 600 }}>Default</span>}
                            </div>
                            <div style={{ fontSize: '11px', color: '#6b7280' }}>{addr.address_line1} {addr.address_line2}</div>
                            <div style={{ fontSize: '11px', color: '#9ca3af' }}>{addr.city}, {addr.state} &bull; {addr.pincode}</div>
                          </div>
                          <button type="button" onClick={() => deleteShippingAddress(addr.id)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', border: 'none', background: 'transparent', color: '#9ca3af', borderRadius: '4px', cursor: 'pointer', flexShrink: 0 }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#e11d48'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}
                          ><Trash2 size={14} /></button>
                        </div>
                      ))}

                      {showShippingForm && (
                        <div style={{ padding: '12px', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                            <Truck size={13} style={{ color: '#6b7280' }} />
                            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>New Shipping Address</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input style={{ ...inputStyle, flex: 1 }} className="border border-zinc-200 bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]" value={newShipping.address_name} onChange={e => setNewShipping({ ...newShipping, address_name: e.target.value })} placeholder="Address Name" />
                              <input style={{ ...inputStyle, flex: 1 }} className="border border-zinc-200 bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]" value={newShipping.contact} onChange={e => setNewShipping({ ...newShipping, contact: e.target.value })} placeholder="Contact Phone" />
                            </div>
                            <button type="button"
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', border: '1px dashed #185FA5', background: '#eff6ff', color: '#185FA5', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}
                              onClick={copyBillingToShipping}
                              onMouseEnter={e => { e.currentTarget.style.background = '#dbeafe'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#eff6ff'; }}
                            ><Copy size={12} /> Copy Billing Address</button>
                            <input style={inputStyle} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]" value={newShipping.address_line1} onChange={e => setNewShipping({ ...newShipping, address_line1: e.target.value })} placeholder="Address Line 1" />
                            <input style={inputStyle} className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]" value={newShipping.address_line2} onChange={e => setNewShipping({ ...newShipping, address_line2: e.target.value })} placeholder="Address Line 2" />
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <select style={inputStyle} className="border border-zinc-200 bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]" value={newShipping.state} onChange={e => setNewShipping({ ...newShipping, state: e.target.value })}>
                                <option value="">Select State</option>
                                {indianStates.map(state => (<option key={state} value={state}>{state}</option>))}
                              </select>
                              <input style={inputStyle} className="border border-zinc-200 bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]" value={newShipping.city} onChange={e => setNewShipping({ ...newShipping, city: e.target.value })} placeholder="City" />
                              <input style={{ ...inputStyle, fontFamily: 'monospace' }} className="border border-zinc-200 bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]" value={newShipping.pincode} onChange={e => setNewShipping({ ...newShipping, pincode: e.target.value })} placeholder="Pincode" />
                            </div>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                              <button type="button"
                                style={{ padding: '6px 14px', background: '#185FA5', border: '1px solid #185FA5', color: '#fff', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
                                onClick={addShippingAddress}
                                onMouseEnter={e => { e.currentTarget.style.background = '#0C447C'; e.currentTarget.style.borderColor = '#0C447C'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#185FA5'; e.currentTarget.style.borderColor = '#185FA5'; }}
                              >Add Address</button>
                              <button type="button"
                                style={{ padding: '6px 14px', background: '#fff', border: '1px solid #d1d5db', color: '#374151', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
                                onClick={() => setShowShippingForm(false)}
                                onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                              >Cancel</button>
                            </div>
                          </div>
                        </div>
                      )}

                      {!showShippingForm && shippingAddresses.length === 0 && (
                        <button type="button"
                          style={{ padding: '24px', border: '2px dashed #d1d5db', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                          onClick={() => { copyBillingToShipping(); setShowShippingForm(true); }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = '#185FA5'; e.currentTarget.style.color = '#185FA5'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#9ca3af'; }}
                        ><Plus size={14} /> Add Shipping Address</button>
                      )}
                      {!showShippingForm && shippingAddresses.length > 0 && (
                        <button type="button"
                          style={{ padding: '12px', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#f9fafb', cursor: 'pointer', fontSize: '12px', fontWeight: 500, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                          onClick={() => { setNewShipping({ address_name: '', address_line1: '', address_line2: '', city: '', state: '', pincode: '', gstin: '', contact: '', is_default: false }); setShowShippingForm(true); }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#374151'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.color = '#6b7280'; }}
                        ><Plus size={13} /> Add More Shipping Address</button>
                      )}
                    </div>
                  </div>

                  <div style={{ ...sectionHeadStyle, marginTop: '24px' }}>Notes</div>
                  <div style={sectionBgStyle}>
                    <div style={sectionGridStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={labelStyle}>Internal Remarks</span>
                        <CompactTextarea rows={4} value={val('remarks')} onChange={e => setFormData({ ...formData, remarks: e.target.value })} placeholder="Internal remarks..." />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={labelStyle}>Client Notes</span>
                        <CompactTextarea rows={4} value={val('about_client')} onChange={e => setFormData({ ...formData, about_client: e.target.value })} placeholder="Client notes..." />
                      </div>
                    </div>
                  </div>

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
                        onClick={() => setShowDeleteModal(true)} disabled={saving}
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
              <div className="border border-zinc-200 bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5]">
                <div style={{ padding: '24px' }}>
                  <ClientDiscountPortfolio formData={formData} setFormData={setFormData} isAdmin={isAdmin} organisation={organisation} />
                </div>                
              </div>
            </TabsContent>
          
        </Tabs>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}
            onClick={() => { if (!deleting) setShowDeleteModal(false); }}>
            <div style={{ background: 'white', borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Trash2 style={{ width: '20px', height: '20px', color: '#e11d48' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#18181b', margin: 0 }}>Delete Client</h3>
                </div>
              </div>
              <p style={{ fontSize: '13px', color: '#52525b', lineHeight: '18px', margin: '0 0 20px 0' }}>
                Are you sure you want to permanently delete <strong>{formData.client_name}</strong>? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button"
                  style={{ height: '36px', padding: '0 16px', border: '1px solid #e4e4e7', background: 'white', color: '#52525b', borderRadius: '8px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                >Cancel</button>
                <button type="button"
                  style={{ height: '36px', padding: '0 16px', border: 'none', background: '#e11d48', color: 'white', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={confirmDeleteClient}
                  disabled={deleting}
                  onMouseEnter={e => { if (!deleting) e.currentTarget.style.background = '#be123c'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#e11d48'; }}
                >{deleting ? <><span className="animate-spin" style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block' }}></span> Deleting...</> : 'Delete'}</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default CreateClient;
