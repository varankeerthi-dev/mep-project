import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { ChevronLeft, Save, Info, Building2, User, MapPin, FileText, Tag, Percent, Users, PhoneCall, Plus } from 'lucide-react';

interface ClientFormScreenProps {
  onBack: () => void;
  clientData?: any;
  isDemo?: boolean;
}

type Tab = 'general' | 'discount';

interface DiscountCategory {
  id: string;
  name: string;
  default_discount_percent: number;
  min_discount_percent: number;
  max_discount_percent: number;
}

interface PriceList {
  id: string;
  pricelist_name: string;
  discount_percent: number;
}

const indianStates = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry',
];

const inputCn = 'w-full h-11 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 transition-colors';
const selectCn = 'w-full h-11 px-3 rounded-xl border border-border bg-background text-sm text-foreground outline-none focus:border-primary/50 transition-colors appearance-none';

export const ClientFormScreen: React.FC<ClientFormScreenProps> = ({ onBack, clientData, isDemo = false }) => {
  const editMode = !!clientData?.id;

  const [tab, setTab] = useState<Tab>('general');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [showSecondary, setShowSecondary] = useState(false);
  const [showPurchase, setShowPurchase] = useState(false);
  const [form, setForm] = useState<any>({
    client_name: '', client_type: 'Business', category: 'Active',
    contact_person: '', contact_designation: '', contact: '', email: '',
    contact_person_2: '', contact_designation_2: '', contact_person_2_contact: '', contact_person_2_email: '',
    purchase_person: '', purchase_designation: '', purchase_contact: '', purchase_email: '',
    city: '', state: '', gstin: '', gst_treatment: '',
    msme_register_type: '', msme_number: '',
    address1: '', address2: '', pincode: '', remarks: '',
    discount_type: 'Standard', standard_pricelist_id: null, custom_discounts: {},
  });
  const [customDiscounts, setCustomDiscounts] = useState<Record<string, number>>({});
  const [discountSaving, setDiscountSaving] = useState(false);
  const [discountSaveMsg, setDiscountSaveMsg] = useState('');

  const [pricelists, setPricelists] = useState<PriceList[]>([]);
  const [discountCategories, setDiscountCategories] = useState<DiscountCategory[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  useEffect(() => {
    if (clientData) {
      setForm((prev: any) => ({ ...prev, ...clientData }));
      if (clientData.custom_discounts && typeof clientData.custom_discounts === 'object') {
        setCustomDiscounts(clientData.custom_discounts);
      }
    }
  }, [clientData]);

  useEffect(() => {
    if (!isDemo) {
      loadMeta();
    } else {
      setPricelists([
        { id: 'pl-demo-1', pricelist_name: 'Standard Retail', discount_percent: 3 },
        { id: 'pl-demo-2', pricelist_name: 'Wholesale Partner', discount_percent: 8 },
      ]);
      setDiscountCategories([
        { id: 'dc-demo-1', name: 'Standard', default_discount_percent: 5, min_discount_percent: 0, max_discount_percent: 5 },
        { id: 'dc-demo-2', name: 'Wholesale', default_discount_percent: 10, min_discount_percent: 0, max_discount_percent: 15 },
        { id: 'dc-demo-3', name: 'Distributor', default_discount_percent: 20, min_discount_percent: 0, max_discount_percent: 25 },
      ]);
      setLoadingMeta(false);
    }
  }, [isDemo]);

  const loadMeta = async () => {
    setLoadingMeta(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: memberData } = await supabase
        .from('org_members')
        .select('organisation_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      const orgId = memberData?.organisation_id;
      if (!orgId) return;

      const [plRes, dcRes] = await Promise.all([
        supabase.from('standard_discount_pricelists').select('*').eq('organisation_id', orgId).eq('is_active', true),
        supabase.from('discount_categories').select('*').or(`organisation_id.eq.${orgId},organisation_id.is.null`).eq('is_active', true).order('name'),
      ]);

      setPricelists((plRes.data as PriceList[]) || []);
      setDiscountCategories((dcRes.data as DiscountCategory[]) || []);
    } catch (err: any) {
      console.error('Load meta error:', err);
    } finally {
      setLoadingMeta(false);
    }
  };

  const set = (field: string) => (e: any) => setForm({ ...form, [field]: e.target.value });

  const handleSave = async () => {
    if (!form.client_name?.trim()) {
      setSaveMsg('Client name is required');
      return;
    }
    setSaving(true);
    setSaveMsg('');
    try {
      if (isDemo) {
        await new Promise(r => setTimeout(r, 500));
        setSaveMsg(editMode ? 'Client updated (demo)' : 'Client created (demo)');
        setTimeout(onBack, 800);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data: memberData } = await supabase
        .from('org_members')
        .select('organisation_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      const orgId = memberData?.organisation_id;
      if (!orgId) throw new Error('No organisation');

      if (editMode) {
        const { error } = await supabase
          .from('clients')
          .update({ ...form, updated_at: new Date().toISOString() })
          .eq('id', clientData.id)
          .eq('organisation_id', orgId);
        if (error) throw error;
      } else {
        const clientId = 'CLT-' + Date.now().toString().slice(-6);
        const { error } = await supabase
          .from('clients')
          .insert({ ...form, client_id: clientId, organisation_id: orgId });
        if (error) throw error;
      }
      setSaveMsg(editMode ? 'Client updated!' : 'Client created!');
      setTimeout(onBack, 800);
    } catch (err: any) {
      setSaveMsg('Error: ' + (err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCustomDiscounts = async () => {
    if (!clientData?.id) {
      setDiscountSaveMsg('Save the client first before setting discounts');
      return;
    }
    setDiscountSaving(true);
    setDiscountSaveMsg('');
    try {
      const validated: Record<string, number> = {};
      for (const [id, val] of Object.entries(customDiscounts)) {
        const num = typeof val === 'number' ? val : parseFloat(val || '0');
        validated[id] = isNaN(num) ? 0 : Math.max(0, Math.min(100, num));
      }
      if (isDemo) {
        await new Promise(r => setTimeout(r, 500));
        setDiscountSaveMsg('Discounts saved (demo)');
        return;
      }
      const { error } = await supabase
        .from('clients')
        .update({ custom_discounts: validated })
        .eq('id', clientData.id);
      if (error) throw error;
      setForm((prev: any) => ({ ...prev, custom_discounts: validated }));
      setDiscountSaveMsg('Discounts saved!');
    } catch (err: any) {
      setDiscountSaveMsg('Error: ' + (err?.message || err));
    } finally {
      setDiscountSaving(false);
    }
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'general', label: 'General Info' },
    { key: 'discount', label: 'Discount Settings' },
  ];

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto flex flex-col">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="px-4 pt-10 pb-4 flex items-center gap-3 border-b border-border bg-card"
      >
        <button onClick={onBack} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-muted-foreground active:scale-95 transition-all cursor-pointer">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{editMode ? 'Edit Client' : 'Add Client'}</h1>
          <p className="text-[10px] font-medium text-muted-foreground uppercase">Module</p>
        </div>
      </motion.header>

      {/* Sub-tabs */}
      <div className="flex px-4 pt-3 pb-0 bg-card border-b border-border">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 pt-5 pb-24 space-y-5">
        {saveMsg && (
          <div className="p-3 text-xs rounded-xl bg-primary/10 border border-primary/20 text-primary text-center">{saveMsg}</div>
        )}

        {/* ═══════════════════ GENERAL INFO ═══════════════════ */}
        {tab === 'general' && (
          <div className="space-y-5">
            {/* Client Information */}
            <div className="glass-card rounded-2xl p-5 border border-border/50 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <Building2 className="h-4 w-4" />
                Client Information
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Client Name *</label>
                  <input type="text" required value={form.client_name} onChange={set('client_name')} placeholder="Enter client name" className={inputCn} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Type</label>
                    <select value={form.client_type} onChange={set('client_type')} className={selectCn}>
                      <option value="Business">Business</option>
                      <option value="Individual">Individual</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Status</label>
                    <select value={form.category} onChange={set('category')} className={selectCn}>
                      <option value="Active">Active</option>
                      <option value="Prospect">Prospect</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">GSTIN</label>
                  <input type="text" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} placeholder="15 Digit GST Number" maxLength={15} className={`${inputCn} uppercase font-mono`} />
                </div>
              </div>
            </div>

            {/* Primary Contact */}
            <div className="glass-card rounded-2xl p-5 border border-border/50 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <User className="h-4 w-4" />
                Primary Contact
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Name</label>
                    <input type="text" value={form.contact_person} onChange={set('contact_person')} placeholder="Contact person" className={inputCn} />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Designation</label>
                    <input type="text" value={form.contact_designation} onChange={set('contact_designation')} placeholder="e.g. Manager" className={inputCn} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Phone</label>
                    <input type="tel" value={form.contact} onChange={set('contact')} placeholder="Phone number" className={inputCn} />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Email</label>
                    <input type="email" value={form.email} onChange={set('email')} placeholder="Email address" className={inputCn} />
                  </div>
                </div>
              </div>
            </div>

            {/* Secondary Contact — collapsed by default */}
            {showSecondary ? (
              <div className="glass-card rounded-2xl p-5 border border-border/50 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <PhoneCall className="h-4 w-4" />
                    Secondary Contact
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSecondary(false)}
                    className="text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Name</label>
                      <input type="text" value={form.contact_person_2} onChange={set('contact_person_2')} placeholder="Secondary contact" className={inputCn} />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Designation</label>
                      <input type="text" value={form.contact_designation_2} onChange={set('contact_designation_2')} placeholder="e.g. Engineer" className={inputCn} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Phone</label>
                      <input type="tel" value={form.contact_person_2_contact} onChange={set('contact_person_2_contact')} placeholder="Phone number" className={inputCn} />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Email</label>
                      <input type="email" value={form.contact_person_2_email} onChange={set('contact_person_2_email')} placeholder="Email address" className={inputCn} />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowSecondary(true)}
                className="w-full glass-card rounded-2xl p-4 flex items-center gap-3 border border-dashed border-border/60 text-left active:scale-[0.98] transition-all cursor-pointer"
              >
                <div className="h-9 w-9 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Add Secondary Contact</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Additional contact person</p>
                </div>
              </button>
            )}

            {/* Purchase Contact — collapsed by default */}
            {showPurchase ? (
              <div className="glass-card rounded-2xl p-5 border border-border/50 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <PhoneCall className="h-4 w-4" />
                    Purchase Contact
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPurchase(false)}
                    className="text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Name</label>
                      <input type="text" value={form.purchase_person} onChange={set('purchase_person')} placeholder="Purchase person" className={inputCn} />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Designation</label>
                      <input type="text" value={form.purchase_designation} onChange={set('purchase_designation')} placeholder="e.g. Procurement" className={inputCn} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Phone</label>
                      <input type="tel" value={form.purchase_contact} onChange={set('purchase_contact')} placeholder="Phone number" className={inputCn} />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Email</label>
                      <input type="email" value={form.purchase_email} onChange={set('purchase_email')} placeholder="Email address" className={inputCn} />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowPurchase(true)}
                className="w-full glass-card rounded-2xl p-4 flex items-center gap-3 border border-dashed border-border/60 text-left active:scale-[0.98] transition-all cursor-pointer"
              >
                <div className="h-9 w-9 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Add Purchase Contact</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Procurement contact person</p>
                </div>
              </button>
            )}

            {/* Address */}
            <div className="glass-card rounded-2xl p-5 border border-border/50 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <MapPin className="h-4 w-4" />
                Address
              </div>
              <div className="space-y-3">
                <input type="text" value={form.address1} onChange={set('address1')} placeholder="Address Line 1" className={inputCn} />
                <input type="text" value={form.address2} onChange={set('address2')} placeholder="Address Line 2" className={inputCn} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">State</label>
                    <select value={form.state} onChange={set('state')} className={selectCn}>
                      <option value="">Select State</option>
                      {indianStates.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">City</label>
                    <input type="text" value={form.city} onChange={set('city')} placeholder="City" className={inputCn} />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">PIN Code</label>
                  <input type="text" value={form.pincode} onChange={set('pincode')} placeholder="PIN code" className={`${inputCn} font-mono`} />
                </div>
              </div>
            </div>

            {/* Tax & Registration */}
            <div className="glass-card rounded-2xl p-5 border border-border/50 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <FileText className="h-4 w-4" />
                Tax & Registration
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">GST Treatment</label>
                  <select value={form.gst_treatment} onChange={set('gst_treatment')} className={selectCn}>
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
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">MSME Type</label>
                    <select value={form.msme_register_type} onChange={set('msme_register_type')} className={selectCn}>
                      <option value="">Select Type</option>
                      <option value="micro">Micro Enterprise</option>
                      <option value="small">Small Enterprise</option>
                      <option value="macro">Macro Enterprise</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">MSME Number</label>
                    <input type="text" value={form.msme_number} onChange={(e) => setForm({ ...form, msme_number: e.target.value.toUpperCase() })} placeholder="UDYAM number" className={`${inputCn} uppercase font-mono`} />
                  </div>
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div className="glass-card rounded-2xl p-5 border border-border/50 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                <Info className="h-4 w-4" />
                Notes
              </div>
              <textarea
                rows={3}
                value={form.remarks}
                onChange={set('remarks')}
                placeholder="Internal remarks…"
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 transition-colors resize-none"
              />
            </div>
          </div>
        )}

        {/* ═══════════════════ DISCOUNT SETTINGS ═══════════════════ */}
        {tab === 'discount' && (
          <div className="space-y-5">
            {loadingMeta ? (
              <div className="glass-card rounded-2xl p-6 text-center text-sm text-muted-foreground">Loading discount data…</div>
            ) : (
              <>
                {/* Billing & Tax Details */}
                <div className="glass-card rounded-2xl p-5 border border-border/50 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <Percent className="h-4 w-4" />
                    Billing & Tax Details
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Pricing Tier</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, discount_type: 'Standard', standard_pricelist_id: null })}
                          className={`flex-1 h-11 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            form.discount_type === 'Standard'
                              ? 'bg-primary border-primary text-white shadow-sm'
                              : 'bg-card border-border text-muted-foreground hover:text-foreground active:bg-secondary'
                          }`}
                        >
                          Standard
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, discount_type: 'Bulk' })}
                          className={`flex-1 h-11 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            form.discount_type === 'Bulk'
                              ? 'bg-primary border-primary text-white shadow-sm'
                              : 'bg-card border-border text-muted-foreground hover:text-foreground active:bg-secondary'
                          }`}
                        >
                          Bulk
                        </button>
                      </div>
                    </div>
                    {form.discount_type === 'Standard' && (
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Price List</label>
                        <select
                          value={form.standard_pricelist_id || ''}
                          onChange={(e) => setForm({ ...form, standard_pricelist_id: e.target.value })}
                          className={selectCn}
                        >
                          <option value="">-- Assign a List --</option>
                          {pricelists.map((pl) => (
                            <option key={pl.id} value={pl.id}>{pl.pricelist_name} ({pl.discount_percent}% Baseline)</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* Customized Discounts (Bulk only) */}
                {form.discount_type !== 'Standard' && (
                  <div className="glass-card rounded-2xl p-5 border border-border/50 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        <Tag className="h-4 w-4" />
                        Customized Discounts
                      </div>
                      <button
                        onClick={handleSaveCustomDiscounts}
                        disabled={discountSaving}
                        className="h-8 px-3 rounded-xl bg-primary text-white text-[10px] font-semibold flex items-center gap-1 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Save className="h-3 w-3" />
                        {discountSaving ? 'Saving…' : 'Save'}
                      </button>
                    </div>

                    {discountSaveMsg && (
                      <div className={`p-2.5 text-xs rounded-xl text-center ${
                        discountSaveMsg.includes('Error')
                          ? 'bg-destructive/10 border border-destructive/20 text-destructive'
                          : 'bg-primary/10 border border-primary/20 text-primary'
                      }`}>
                        {discountSaveMsg}
                      </div>
                    )}

                    <div className="space-y-2">
                      {discountCategories.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">No discount categories configured.</p>
                      ) : (
                        discountCategories.map((dc) => (
                          <div key={dc.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-secondary/30 border border-border/50">
                            <span className="text-xs font-semibold text-foreground">{dc.name}</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={customDiscounts[dc.id] ?? 0}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setCustomDiscounts((prev) => ({ ...prev, [dc.id]: val === '' ? 0 : parseFloat(val) }));
                                }}
                                min="0"
                                max="100"
                                step="0.01"
                                className="w-20 h-9 px-2 rounded-lg border border-border bg-background text-sm font-semibold text-right text-foreground outline-none focus:border-primary/50 transition-colors"
                              />
                              <span className="text-xs text-muted-foreground">%</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Discount Matrix Preview */}
                <div className="glass-card rounded-2xl p-5 border border-border/50 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <Users className="h-4 w-4" />
                    Discount Matrix Preview
                  </div>
                  {form.discount_type === 'Standard' ? (
                    <div className="p-4 rounded-xl bg-secondary/30 text-center">
                      <p className="text-xs text-muted-foreground">
                        Standard pricing active —{' '}
                        <strong className="text-foreground">
                          {pricelists.find((pl) => pl.id === form.standard_pricelist_id)?.discount_percent || 0}%
                        </strong>{' '}
                        baseline across all categories.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-2">
                        <span className="flex-1">Category</span>
                        <span className="w-16 text-center">Default</span>
                        <span className="w-16 text-center">Min</span>
                        <span className="w-16 text-center">Max</span>
                      </div>
                      {discountCategories.map((dc) => (
                        <div key={dc.id} className="flex items-center text-xs px-3 py-2 rounded-lg bg-secondary/20">
                          <span className="flex-1 font-medium text-foreground">{dc.name}</span>
                          <span className="w-16 text-center text-muted-foreground">{dc.default_discount_percent}%</span>
                          <span className="w-16 text-center text-muted-foreground">{dc.min_discount_percent}%</span>
                          <span className="w-16 text-center font-bold text-primary">{dc.max_discount_percent}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Sticky Save Footer */}
      <div className="sticky bottom-0 left-0 right-0 z-50 px-4 py-3 bg-card/95 backdrop-blur-xl border-t border-border">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 rounded-xl bg-primary text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : editMode ? 'Update Client' : 'Save Client'}
        </button>
      </div>
    </div>
  );
};
