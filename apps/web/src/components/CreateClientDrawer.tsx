import React, { useState, useEffect, useMemo, ChangeEvent, ComponentProps } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  X, Building2, User, Phone, Mail, MapPin, FileText, Check, 
  Loader2, Sparkles, Plus, Trash2, Copy, Truck, Percent, ChevronRight, AlertCircle
} from 'lucide-react';

interface CreateClientDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newClientId: string, clientName?: string) => void;
}

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh'
];

const GST_STATE_CODES: Record<string, string> = {
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

const COUNTRY_CODES = [
  '+91', '+1', '+971', '+966', '+44', '+65', '+61', '+49', '+33', '+81',
  '+7', '+20', '+27', '+31', '+34', '+39', '+41', '+46', '+55', '+60',
  '+62', '+63', '+64', '+66', '+82', '+86', '+90', '+92', '+93', '+94',
  '+95', '+98', '+212', '+234', '+254', '+351', '+353', '+358', '+420',
  '+880', '+961', '+962', '+964', '+965', '+968', '+973', '+974', '+977'
];

const COUNTRIES = [
  'India', 'United Arab Emirates', 'Saudi Arabia', 'United States', 'United Kingdom',
  'Singapore', 'Australia', 'Germany', 'France', 'Canada', 'Qatar', 'Oman', 'Kuwait',
  'Bahrain', 'Malaysia', 'Japan', 'South Korea', 'South Africa', 'New Zealand', 'Other'
];

export function CreateClientDrawer({ isOpen, onClose, onSuccess }: CreateClientDrawerProps) {
  const { organisation, user, organisations } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = organisations?.find((o: any) => o.organisation.id === organisation?.id)?.role?.toLowerCase() === 'admin';

  const [activeTab, setActiveTab] = useState<'general' | 'pricing'>('general');

  // Form State matching 100% of old fields
  const [formData, setFormData] = useState<any>({
    client_name: '', address1: '', address2: '', state: '', city: '', pincode: '',
    gstin: '', contact: '', email: '', vendor_no: '', remarks: '', category: 'Active',
    contact_person: '', contact_designation: '', contact_person_email: '',
    contact_person_2: '', contact_designation_2: '', contact_person_2_contact: '', contact_person_2_email: '',
    purchase_person: '', purchase_designation: '', purchase_contact: '', purchase_email: '',
    about_client: '', discount_type: 'Standard', standard_pricelist_id: null,
    msme_register_type: '', msme_number: '',
    gst_treatment: 'Registered Business Regular', client_type: 'Business', country: 'India',
    contact_code: '+91', contact_person_2_contact_code: '+91', purchase_contact_code: '+91',
    use_arc_pricing: false, custom_discounts: {}
  });

  const [additionalContacts, setAdditionalContacts] = useState<any[]>([]);
  const [shippingAddresses, setShippingAddresses] = useState<any[]>([]);
  const [showShippingForm, setShowShippingForm] = useState(false);
  const [newShipping, setNewShipping] = useState({
    address_name: '', address_line1: '', address_line2: '', city: '', state: '',
    pincode: '', gstin: '', contact: '', is_default: false
  });

  const [stateSearchText, setStateSearchText] = useState('');
  const [isStateDropdownOpen, setIsStateDropdownOpen] = useState(false);
  const [gstError, setGstError] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Reset form when drawer opens
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setActiveTab('general');
      setFormData({
        client_name: '', address1: '', address2: '', state: '', city: '', pincode: '',
        gstin: '', contact: '', email: '', vendor_no: '', remarks: '', category: 'Active',
        contact_person: '', contact_designation: '', contact_person_email: '',
        contact_person_2: '', contact_designation_2: '', contact_person_2_contact: '', contact_person_2_email: '',
        purchase_person: '', purchase_designation: '', purchase_contact: '', purchase_email: '',
        about_client: '', discount_type: 'Standard', standard_pricelist_id: null,
        msme_register_type: '', msme_number: '',
        gst_treatment: 'Registered Business Regular', client_type: 'Business', country: 'India',
        contact_code: '+91', contact_person_2_contact_code: '+91', purchase_contact_code: '+91',
        use_arc_pricing: false, custom_discounts: {}
      });
      setAdditionalContacts([]);
      setShippingAddresses([]);
      setShowShippingForm(false);
      setGstError('');
      setErrorMessage('');
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.state-dropdown-container')) {
        setIsStateDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Pricelists query for Discount tab (including global and org-specific)
  const pricelistsQuery = useQuery({
    queryKey: ['discountPricelists', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('standard_discount_pricelists')
        .select('*')
        .or(`organisation_id.eq.${organisation.id},organisation_id.is.null`)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && !!organisation?.id
  });

  // Discount categories query (including global and org-specific)
  const discountCategoriesQuery = useQuery({
    queryKey: ['discountCategories', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('discount_categories')
        .select('*')
        .or(`organisation_id.eq.${organisation.id},organisation_id.is.null`)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && !!organisation?.id
  });

  const pricelists = pricelistsQuery.data || [];
  const discountCategories = discountCategoriesQuery.data || [];

  const handleCustomDiscountChange = (catId: string, valStr: string) => {
    if (valStr === '') {
      setFormData((prev: any) => {
        const copy = { ...(prev.custom_discounts || {}) };
        delete copy[catId];
        return { ...prev, custom_discounts: copy };
      });
      return;
    }
    const num = parseFloat(valStr);
    if (isNaN(num)) return;
    const clamped = Math.min(100, Math.max(0, num));
    setFormData((prev: any) => ({
      ...prev,
      custom_discounts: {
        ...(prev.custom_discounts || {}),
        [catId]: clamped
      }
    }));
  };

  if (!isOpen) return null;

  const val = (field: string) => formData[field] || '';
  const setField = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleGstChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().trim();
    if (value.length <= 15) {
      setField('gstin', value);
      if (value.length >= 2) {
        const stateCode = value.substring(0, 2);
        const detectedState = GST_STATE_CODES[stateCode];
        if (detectedState && !formData.state) {
          setField('state', detectedState);
        }
      }
      if (value.length > 0 && value.length < 15) {
        setGstError('GSTIN must be exactly 15 characters');
      } else {
        setGstError('');
      }
    }
  };

  const copyBillingToShipping = () => {
    setNewShipping({
      ...newShipping,
      address_name: formData.client_name ? `${formData.client_name} - Primary` : 'Main Site',
      address_line1: formData.address1 || '',
      address_line2: formData.address2 || '',
      city: formData.city || '',
      state: formData.state || '',
      pincode: formData.pincode || '',
      contact: formData.contact || ''
    });
    setShowShippingForm(true);
  };

  const handleAddLocalShipping = () => {
    if (!newShipping.address_line1 && !newShipping.address_name) {
      alert('Please enter at least address line 1 or address name.');
      return;
    }
    setShippingAddresses(prev => [...prev, { ...newShipping, id: 'temp-' + Date.now() }]);
    setNewShipping({
      address_name: '', address_line1: '', address_line2: '', city: '', state: '',
      pincode: '', gstin: '', contact: '', is_default: false
    });
    setShowShippingForm(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_name.trim()) {
      setErrorMessage('Client name is required.');
      return;
    }
    if (!organisation?.id) {
      setErrorMessage('Active organisation session not found.');
      return;
    }

    setSaving(true);
    setErrorMessage('');

    try {
      const generatedClientId = 'CLT-' + Date.now().toString().slice(-6);

      const clientPayload: Record<string, unknown> = {
        organisation_id: organisation.id,
        client_id: generatedClientId,
        client_name: formData.client_name.trim(),
        name: formData.client_name.trim(),
        client_type: formData.client_type || 'Business',
        category: formData.category || 'Active',
        gstin: formData.gstin?.trim() || null,
        gst_number: formData.gstin?.trim() || null,
        gst_treatment: formData.gst_treatment || null,
        vendor_no: formData.vendor_no?.trim() || null,
        msme_register_type: formData.msme_register_type || null,
        msme_number: formData.msme_number?.trim() || null,
        
        // Primary contact
        contact_person: formData.contact_person?.trim() || null,
        contact_designation: formData.contact_designation?.trim() || null,
        contact_code: formData.contact_code || '+91',
        contact: formData.contact?.trim() || null,
        email: formData.email?.trim() || formData.contact_person_email?.trim() || null,
        contact_person_email: formData.contact_person_email?.trim() || null,

        // Secondary contact
        contact_person_2: formData.contact_person_2?.trim() || null,
        contact_designation_2: formData.contact_designation_2?.trim() || null,
        contact_person_2_contact_code: formData.contact_person_2_contact_code || '+91',
        contact_person_2_contact: formData.contact_person_2_contact?.trim() || null,
        contact_person_2_email: formData.contact_person_2_email?.trim() || null,

        // Purchase contact
        purchase_person: formData.purchase_person?.trim() || null,
        purchase_designation: formData.purchase_designation?.trim() || null,
        purchase_contact_code: formData.purchase_contact_code || '+91',
        purchase_contact: formData.purchase_contact?.trim() || null,
        purchase_email: formData.purchase_email?.trim() || null,

        // Address
        address1: formData.address1?.trim() || null,
        address2: formData.address2?.trim() || null,
        city: formData.city?.trim() || null,
        state: formData.state?.trim() || null,
        pincode: formData.pincode?.trim() || null,
        country: formData.country || 'India',

        // Notes & Pricing
        remarks: formData.remarks?.trim() || null,
        about_client: formData.about_client?.trim() || null,
        discount_type: formData.discount_type || 'Standard',
        standard_pricelist_id: formData.standard_pricelist_id || null,
        use_arc_pricing: !!formData.use_arc_pricing,
        custom_discounts: formData.custom_discounts || {},
        party_type: 'client',
        created_by: user?.id || null
      };

      const { data: newClient, error: clientErr } = await supabase
        .from('clients')
        .insert(clientPayload)
        .select('id, client_name')
        .single();

      if (clientErr) throw clientErr;

      const newId = newClient?.id;

      // Sync primary contact
      if (newId && formData.contact_person?.trim()) {
        await supabase.from('client_contacts').insert({
          client_id: newId,
          organisation_id: organisation.id,
          name: formData.contact_person.trim(),
          designation: formData.contact_designation?.trim() || null,
          phone_code: formData.contact_code || '+91',
          phone: formData.contact?.trim() || null,
          email: formData.contact_person_email?.trim() || formData.email?.trim() || null,
          is_primary: true
        });
      }

      // Sync additional CFT contacts
      if (newId && additionalContacts.length > 0) {
        const validContacts = additionalContacts
          .filter(c => (c.name || '').trim())
          .map(c => ({
            client_id: newId,
            organisation_id: organisation.id,
            name: c.name.trim(),
            designation: c.designation?.trim() || null,
            phone_code: c.phone_code || '+91',
            phone: c.phone?.trim() || null,
            email: c.email?.trim() || null,
            is_primary: !!c.is_primary
          }));
        if (validContacts.length > 0) {
          await supabase.from('client_contacts').insert(validContacts);
        }
      }

      // Sync shipping addresses
      if (newId && shippingAddresses.length > 0) {
        const validShipping = shippingAddresses.map(addr => ({
          client_id: newId,
          organisation_id: organisation.id,
          address_name: addr.address_name || 'Shipping Address',
          address_line1: addr.address_line1 || '',
          address_line2: addr.address_line2 || '',
          city: addr.city || '',
          state: addr.state || '',
          pincode: addr.pincode || '',
          contact: addr.contact || '',
          is_default: !!addr.is_default
        }));
        await supabase.from('client_shipping_addresses').insert(validShipping);
      }

      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients', organisation.id] });

      onSuccess(newId, formData.client_name.trim());
      onClose();
    } catch (err: any) {
      console.error('Error creating client:', err);
      setErrorMessage(err.message || 'Failed to save client profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1050] flex justify-end font-sans">
      {/* Backdrop without blur */}
      <div 
        onClick={onClose} 
        className="fixed inset-0 bg-slate-900/40 transition-opacity animate-in fade-in duration-200" 
      />

      {/* Drawer Container */}
      <div className="relative w-full sm:w-[680px] bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300 border-l border-slate-200">
        
        {/* ─── CLEAN DESIGN SYSTEM HEADER ─── */}
        <div className="bg-white p-5 sm:p-6 border-b border-slate-200 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-xs">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 tracking-tight font-heading">
                    Add New Client
                  </h2>
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                    <Sparkles className="w-2.5 h-2.5 text-blue-600" />
                    Full Profile
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure company profile, GST, contacts, billing, and discounts
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 max-w-sm">
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'general'
                  ? 'bg-white text-blue-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              General Info
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pricing')}
              className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'pricing'
                  ? 'bg-white text-blue-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
              Discount Settings
            </button>
          </div>
        </div>

        {/* ─── SCROLLABLE FORM BODY ─── */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {activeTab === 'general' ? (
            <>
              {/* 1. Identity & Classification */}
              <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    1. Client Identity & Classification
                  </span>
                  
                  {/* Type Switcher Pills */}
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setField('client_type', 'Business')}
                      className={`px-3 py-1 rounded-md font-medium text-xs transition-all ${
                        formData.client_type === 'Business' 
                          ? 'bg-white text-blue-700 shadow-sm font-semibold' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Business
                    </button>
                    <button
                      type="button"
                      onClick={() => setField('client_type', 'Individual')}
                      className={`px-3 py-1 rounded-md font-medium text-xs transition-all ${
                        formData.client_type === 'Individual' 
                          ? 'bg-white text-blue-700 shadow-sm font-semibold' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Individual
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Client / Company Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={val('client_name')}
                      onChange={e => setField('client_name', e.target.value)}
                      placeholder="e.g. Larsen & Toubro Limited"
                      required
                      className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900 font-medium transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Status / Category</label>
                      <select
                        value={val('category') || 'Active'}
                        onChange={e => setField('category', e.target.value)}
                        className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-800"
                      >
                        <option value="Active">Active</option>
                        <option value="Prospect">Prospect</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor Code</label>
                      <input
                        type="text"
                        value={val('vendor_no')}
                        onChange={e => setField('vendor_no', e.target.value)}
                        placeholder="e.g. VEN-9042"
                        className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Tax & Legal Compliance */}
              <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm space-y-3">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  2. Tax & Legal Compliance
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      GSTIN (15 Digits)
                    </label>
                    <input
                      type="text"
                      value={val('gstin')}
                      onChange={handleGstChange}
                      maxLength={15}
                      placeholder="e.g. 27AABCB1518L1Z9"
                      className={`w-full h-9 px-3 text-xs font-mono uppercase bg-white border rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${
                        gstError ? 'border-red-400 focus:border-red-500' : 'border-slate-200 focus:border-blue-600'
                      }`}
                    />
                    {gstError && (
                      <p className="text-[11px] text-red-600 mt-1">{gstError}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">GST Treatment</label>
                    <select
                      value={val('gst_treatment') || 'Registered Business Regular'}
                      onChange={e => setField('gst_treatment', e.target.value)}
                      className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-800"
                    >
                      <option value="Registered Business Regular">Registered Business Regular</option>
                      <option value="Registered Business Composition">Registered Business Composition</option>
                      <option value="Unregistered Business">Unregistered Business</option>
                      <option value="Consumer">Consumer</option>
                      <option value="Overseas">Overseas</option>
                      <option value="Special Economic Zone (SEZ)">Special Economic Zone (SEZ)</option>
                      <option value="Deemed Export">Deemed Export</option>
                      <option value="Tax Deductor">Tax Deductor</option>
                      <option value="SEZ Developer">SEZ Developer</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">MSME Registration Type</label>
                    <select
                      value={val('msme_register_type')}
                      onChange={e => setField('msme_register_type', e.target.value)}
                      className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-800"
                    >
                      <option value="">Select MSME Type (Optional)</option>
                      <option value="micro">Micro Enterprise</option>
                      <option value="small">Small Enterprise</option>
                      <option value="medium">Medium Enterprise</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">UDYAM / MSME Number</label>
                    <input
                      type="text"
                      value={val('msme_number')}
                      onChange={e => setField('msme_number', e.target.value.toUpperCase())}
                      placeholder="UDYAM-XX-00-0000000"
                      className="w-full h-9 px-3 text-xs font-mono uppercase bg-white border border-slate-200 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Contact Details */}
              <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm space-y-4">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <User className="w-3.5 h-3.5 text-indigo-600" />
                  3. Key Contacts
                </span>

                {/* Primary Contact */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2.5">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    Primary Contact Person
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      value={val('contact_person')}
                      onChange={e => setField('contact_person', e.target.value)}
                      placeholder="Contact Person Name"
                      className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900"
                    />
                    <input
                      type="text"
                      value={val('contact_designation')}
                      onChange={e => setField('contact_designation', e.target.value)}
                      placeholder="Designation"
                      className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900"
                    />
                    <div className="flex gap-1.5">
                      <select
                        value={formData.contact_code || '+91'}
                        onChange={e => setField('contact_code', e.target.value)}
                        className="w-20 h-9 px-2 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-400 text-slate-700"
                      >
                        {COUNTRY_CODES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input
                        type="tel"
                        value={val('contact')}
                        onChange={e => setField('contact', e.target.value)}
                        placeholder="Phone"
                        className="flex-1 h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900"
                      />
                    </div>
                    <input
                      type="email"
                      value={val('contact_person_email')}
                      onChange={e => setField('contact_person_email', e.target.value)}
                      placeholder="Email Address"
                      className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900"
                    />
                  </div>
                </div>

                {/* Secondary Contact */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2.5">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    Secondary Contact Person
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      value={val('contact_person_2')}
                      onChange={e => setField('contact_person_2', e.target.value)}
                      placeholder="Secondary Contact Name"
                      className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900"
                    />
                    <input
                      type="text"
                      value={val('contact_designation_2')}
                      onChange={e => setField('contact_designation_2', e.target.value)}
                      placeholder="Designation"
                      className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900"
                    />
                    <div className="flex gap-1.5">
                      <select
                        value={formData.contact_person_2_contact_code || '+91'}
                        onChange={e => setField('contact_person_2_contact_code', e.target.value)}
                        className="w-20 h-9 px-2 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-400 text-slate-700"
                      >
                        {COUNTRY_CODES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input
                        type="tel"
                        value={val('contact_person_2_contact')}
                        onChange={e => setField('contact_person_2_contact', e.target.value)}
                        placeholder="Phone"
                        className="flex-1 h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900"
                      />
                    </div>
                    <input
                      type="email"
                      value={val('contact_person_2_email')}
                      onChange={e => setField('contact_person_2_email', e.target.value)}
                      placeholder="Email Address"
                      className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900"
                    />
                  </div>
                </div>

                {/* Purchase Contact */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2.5">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-amber-600" />
                    Purchase Department Contact
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      value={val('purchase_person')}
                      onChange={e => setField('purchase_person', e.target.value)}
                      placeholder="Purchase Officer Name"
                      className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900"
                    />
                    <input
                      type="text"
                      value={val('purchase_designation')}
                      onChange={e => setField('purchase_designation', e.target.value)}
                      placeholder="Designation"
                      className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900"
                    />
                    <div className="flex gap-1.5">
                      <select
                        value={formData.purchase_contact_code || '+91'}
                        onChange={e => setField('purchase_contact_code', e.target.value)}
                        className="w-20 h-9 px-2 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-400 text-slate-700"
                      >
                        {COUNTRY_CODES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input
                        type="tel"
                        value={val('purchase_contact')}
                        onChange={e => setField('purchase_contact', e.target.value)}
                        placeholder="Phone"
                        className="flex-1 h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900"
                      />
                    </div>
                    <input
                      type="email"
                      value={val('purchase_email')}
                      onChange={e => setField('purchase_email', e.target.value)}
                      placeholder="Email Address"
                      className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900"
                    />
                  </div>
                </div>

                {/* Additional Contacts (CFT) */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Additional Contacts (CFT)</span>
                    <button
                      type="button"
                      onClick={() => setAdditionalContacts(prev => [...prev, { name: '', designation: '', phone_code: '+91', phone: '', email: '', is_primary: false }])}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Contact
                    </button>
                  </div>

                  {additionalContacts.map((c, idx) => (
                    <div key={idx} className="p-3 bg-white border border-slate-200 rounded-lg space-y-2 relative shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-blue-700 uppercase">
                          Contact #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => setAdditionalContacts(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Name *"
                          value={c.name}
                          onChange={e => setAdditionalContacts(prev => prev.map((item, i) => i === idx ? { ...item, name: e.target.value } : item))}
                          className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-md text-slate-900"
                        />
                        <input
                          type="text"
                          placeholder="Designation"
                          value={c.designation}
                          onChange={e => setAdditionalContacts(prev => prev.map((item, i) => i === idx ? { ...item, designation: e.target.value } : item))}
                          className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-md text-slate-900"
                        />
                        <div className="flex gap-1">
                          <input
                            type="text"
                            placeholder="+91"
                            value={c.phone_code}
                            onChange={e => setAdditionalContacts(prev => prev.map((item, i) => i === idx ? { ...item, phone_code: e.target.value } : item))}
                            className="w-14 h-8 px-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-900"
                          />
                          <input
                            type="tel"
                            placeholder="Phone"
                            value={c.phone}
                            onChange={e => setAdditionalContacts(prev => prev.map((item, i) => i === idx ? { ...item, phone: e.target.value } : item))}
                            className="flex-1 h-8 px-2 text-xs bg-white border border-slate-200 rounded-md text-slate-900"
                          />
                        </div>
                        <input
                          type="email"
                          placeholder="Email"
                          value={c.email}
                          onChange={e => setAdditionalContacts(prev => prev.map((item, i) => i === idx ? { ...item, email: e.target.value } : item))}
                          className="w-full h-8 px-2.5 text-xs bg-white border border-slate-200 rounded-md text-slate-900"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Billing Address Details */}
              <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm space-y-3">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <MapPin className="w-3.5 h-3.5 text-amber-600" />
                  4. Billing Address
                </span>

                <div className="space-y-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Address Line 1</label>
                    <input
                      type="text"
                      value={val('address1')}
                      onChange={e => setField('address1', e.target.value)}
                      placeholder="e.g. Plot No 45, Industrial Zone"
                      className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Address Line 2 (Optional)</label>
                    <input
                      type="text"
                      value={val('address2')}
                      onChange={e => setField('address2', e.target.value)}
                      placeholder="e.g. Near Metro Station / Landmark"
                      className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Searchable State Dropdown */}
                    <div className="state-dropdown-container relative">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
                      <input
                        type="text"
                        value={isStateDropdownOpen ? stateSearchText : (val('state') || '')}
                        onChange={e => { setStateSearchText(e.target.value); setIsStateDropdownOpen(true); }}
                        onFocus={() => setIsStateDropdownOpen(true)}
                        placeholder="Search State..."
                        className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900"
                      />
                      {isStateDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto mt-1 divide-y divide-slate-100">
                          {INDIAN_STATES
                            .filter(s => !stateSearchText || s.toLowerCase().includes(stateSearchText.toLowerCase()))
                            .map(s => (
                              <div
                                key={s}
                                onClick={() => { setField('state', s); setStateSearchText(''); setIsStateDropdownOpen(false); }}
                                className="px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                              >
                                {s}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                      <input
                        type="text"
                        value={val('city')}
                        onChange={e => setField('city', e.target.value)}
                        placeholder="e.g. Mumbai"
                        className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Pincode</label>
                      <input
                        type="text"
                        value={val('pincode')}
                        onChange={e => setField('pincode', e.target.value)}
                        placeholder="400001"
                        maxLength={10}
                        className="w-full h-9 px-3 text-xs font-mono bg-white border border-slate-200 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Country</label>
                      <select
                        value={val('country') || 'India'}
                        onChange={e => setField('country', e.target.value)}
                        className="w-full h-9 px-2 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-800"
                      >
                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Shipping Addresses Sub-Section */}
              <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-blue-600" />
                    5. Shipping Addresses ({shippingAddresses.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={copyBillingToShipping}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      Copy Billing
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowShippingForm(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md border border-slate-200 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Add Address
                    </button>
                  </div>
                </div>

                {/* List of added shipping addresses */}
                {shippingAddresses.length > 0 && (
                  <div className="space-y-2">
                    {shippingAddresses.map((addr, i) => (
                      <div key={i} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-start justify-between gap-2 text-xs">
                        <div>
                          <div className="font-semibold text-slate-900 flex items-center gap-2">
                            <span>{addr.address_name || 'Shipping Location'}</span>
                            {addr.is_default && (
                              <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] rounded font-bold">
                                Default
                              </span>
                            )}
                          </div>
                          <div className="text-slate-600 mt-0.5">{addr.address_line1} {addr.address_line2}</div>
                          <div className="text-slate-500 text-[11px]">{addr.city}, {addr.state} • {addr.pincode}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShippingAddresses(prev => prev.filter((_, idx) => idx !== i))}
                          className="p-1 text-slate-400 hover:text-red-600 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Inline Shipping Form */}
                {showShippingForm && (
                  <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 space-y-2.5 animate-in fade-in">
                    <span className="text-xs font-bold text-blue-900 block">New Shipping Location</span>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Address Name (e.g. Site 1)"
                        value={newShipping.address_name}
                        onChange={e => setNewShipping({ ...newShipping, address_name: e.target.value })}
                        className="w-full h-8 px-2 text-xs bg-white border border-slate-200 rounded-md"
                      />
                      <input
                        type="text"
                        placeholder="Contact Phone"
                        value={newShipping.contact}
                        onChange={e => setNewShipping({ ...newShipping, contact: e.target.value })}
                        className="w-full h-8 px-2 text-xs bg-white border border-slate-200 rounded-md"
                      />
                      <input
                        type="text"
                        placeholder="Address Line 1"
                        value={newShipping.address_line1}
                        onChange={e => setNewShipping({ ...newShipping, address_line1: e.target.value })}
                        className="col-span-2 w-full h-8 px-2 text-xs bg-white border border-slate-200 rounded-md"
                      />
                      <input
                        type="text"
                        placeholder="City"
                        value={newShipping.city}
                        onChange={e => setNewShipping({ ...newShipping, city: e.target.value })}
                        className="w-full h-8 px-2 text-xs bg-white border border-slate-200 rounded-md"
                      />
                      <input
                        type="text"
                        placeholder="Pincode"
                        value={newShipping.pincode}
                        onChange={e => setNewShipping({ ...newShipping, pincode: e.target.value })}
                        className="w-full h-8 px-2 text-xs bg-white border border-slate-200 rounded-md"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowShippingForm(false)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddLocalShipping}
                        className="px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs"
                      >
                        Add Address
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 6. Notes & Remarks */}
              <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm space-y-3">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  6. Internal Notes & Remarks
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Internal Remarks</label>
                    <textarea
                      rows={3}
                      value={val('remarks')}
                      onChange={e => setField('remarks', e.target.value)}
                      placeholder="Payment behavior, project preferences..."
                      className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Client Notes</label>
                    <textarea
                      rows={3}
                      value={val('about_client')}
                      onChange={e => setField('about_client', e.target.value)}
                      placeholder="Company background, directors..."
                      className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* ─── TAB 2: DISCOUNT & PRICING SETTINGS ─── */
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-heading">
                    Client Discount & Pricing Settings
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure default price lists or custom discount structures per material category
                  </p>
                </div>

                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Discount Profile Type</label>
                    <select
                      value={val('discount_type') || 'Standard'}
                      onChange={e => setField('discount_type', e.target.value)}
                      className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-800 font-medium"
                    >
                      <option value="Standard">Standard Matrix (Price List)</option>
                      <option value="Special">Special Custom Discount (Per Category)</option>
                      <option value="Bulk">Bulk Tier Pricing (Volume Schema)</option>
                    </select>
                  </div>

                  {formData.discount_type === 'Standard' ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Standard Price List</label>
                        <select
                          value={val('standard_pricelist_id') || ''}
                          onChange={e => setField('standard_pricelist_id', e.target.value || null)}
                          className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-800"
                        >
                          <option value="">-- Assign a Price List --</option>
                          {pricelists.map((pl: any) => (
                            <option key={pl.id} value={pl.id}>
                              {pl.pricelist_name} ({pl.discount_percent}% Baseline)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200/80 text-xs text-blue-900 flex items-center gap-2">
                        <Percent className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>
                          Standard pricing active —{' '}
                          <strong>
                            {pricelists.find((pl: any) => pl.id === formData.standard_pricelist_id)?.discount_percent || 0}%
                          </strong>{' '}
                          baseline discount across all material categories.
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* ─── SPECIAL / BULK CATEGORY DISCOUNTS TABLE ─── */
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">
                            Special Category Discounts
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Override baseline discount % for specific material categories.
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-200">
                          {discountCategories.length} Categories
                        </span>
                      </div>

                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                            <tr>
                              <th className="px-4 py-2.5">Discount Category</th>
                              <th className="px-4 py-2.5 w-36 text-right">Discount %</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {discountCategories.length === 0 ? (
                              <tr>
                                <td colSpan={2} className="p-4 text-center text-slate-400 italic">
                                  No discount categories configured in database.
                                </td>
                              </tr>
                            ) : (
                              discountCategories.map((dc: any) => {
                                const currentDiscount = formData.custom_discounts?.[dc.id] ?? '';
                                return (
                                  <tr key={dc.id} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="px-4 py-2.5 font-medium text-slate-800">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                                        <span>{dc.name}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                      <div className="inline-flex items-center gap-1 justify-end">
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          step="0.01"
                                          placeholder="0.00"
                                          value={currentDiscount}
                                          onChange={e => handleCustomDiscountChange(dc.id, e.target.value)}
                                          className="w-24 h-8 px-2.5 text-right text-xs font-semibold text-indigo-700 bg-white border border-slate-200 rounded-lg hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                                        />
                                        <span className="text-slate-400 font-bold text-xs">%</span>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">Annual Rate Contract (ARC) Pricing</span>
                        <span className="text-[11px] text-slate-500">Apply fixed contract pricing on items for this client</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={!!formData.use_arc_pricing}
                        onChange={e => setField('use_arc_pricing', e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* ─── STICKY FOOTER ACTION BAR ─── */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 shadow-lg">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !formData.client_name.trim()}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving Client...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Save Client Profile</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
