import React, { useState, useEffect, useMemo, useRef } from 'react';import {
  Plus, 
  Search,
  Upload,
  FileText,
  X,
  X as XIcon,
  MoreHorizontal as MoreHorizontalIcon,
  Eye as EyeIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../contexts/AuthContext';
import { useVendors, useCreateVendor, useUpdateVendor } from '../hooks/usePurchaseQueries';
import { supabase } from '../../../supabase';
import VendorLedgerDialog from './VendorLedgerDialog';
import { Party360 } from '../../../components/Party360';

// Import local UI components
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { cn } from '../../../lib/utils';

import { vendorValidationSchema, formatZodErrors } from '../utils/validation';
import { formatCurrency } from '../../../utils/formatters';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir',
  'Ladakh', 'Puducherry'
];

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];
const PAYMENT_TERMS = ['Advance', 'COD', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60'];

interface VendorFormData {
  id?: string;
  vendor_code?: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  gstin: string;
  pan: string;
  address: string;
  state: string;
  pincode: string;
  default_currency: string;
  payment_terms: string;
  credit_limit: number;
  opening_balance: number;
  bank_account_no: string;
  bank_ifsc: string;
  bank_name: string;
  bank_branch: string;
  account_holder_name: string;
  re_enter_account_number: string;
  remarks: string;
  status: string;
  msme_register_type: string;
  msme_number: string;
  gst_treatment: string;
  // Document uploads (Supabase Storage URLs — UI TBD)
  pan_card_url: string;
  cheque_leaf_url: string;
  gstin_certificate_url: string;
  msme_certificate_url: string;
}

const defaultFormData: VendorFormData = {
  company_name: '',
  contact_person: '',
  email: '',
  phone: '',
  gstin: '',
  pan: '',
  address: '',
  state: '',
  pincode: '',
  default_currency: 'INR',
  payment_terms: 'Net 30',
  credit_limit: 0,
  opening_balance: 0,
  bank_account_no: '',
  bank_ifsc: '',
  bank_name: '',
  bank_branch: '',
  account_holder_name: '',
  re_enter_account_number: '',
  remarks: '',
  status: 'Active',
  msme_register_type: '',
  msme_number: '',
  gst_treatment: '',
  pan_card_url: '',
  cheque_leaf_url: '',
  gstin_certificate_url: '',
  msme_certificate_url: '',
};

// --- Draft persistence helpers ---
const getDraftKey = (orgId: string) => `vendor_draft_${orgId}`;
const saveDraft = (orgId: string, data: VendorFormData) => {
  try { localStorage.setItem(getDraftKey(orgId), JSON.stringify(data)); } catch {}
};
const loadDraft = (orgId: string): VendorFormData | null => {
  try {
    const raw = localStorage.getItem(getDraftKey(orgId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
const clearDraft = (orgId: string) => {
  try { localStorage.removeItem(getDraftKey(orgId)); } catch {}
};
const isDirty = (data: VendorFormData): boolean =>
  Object.keys(defaultFormData).some(
    (k) => (data as any)[k] !== (defaultFormData as any)[k]
  );

export const Vendors: React.FC = () => {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState(false);
  const [openLedgerDialog, setOpenLedgerDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [formData, setFormData] = useState<VendorFormData>(defaultFormData);
  const [searchTerm, setSearchTerm] = useState('');
  const [docSettings, setDocSettings] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [party360Open, setParty360Open] = useState(false);
  const [party360Data, setParty360Data] = useState<{ name: string; vendorId: string; clientId: string | null } | null>(null);
  const [addingAsClient, setAddingAsClient] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: vendors = [], isLoading } = useVendors(organisation?.id);
  const createVendor = useCreateVendor();
  const updateVendor = useUpdateVendor();

  // Check for existing draft on mount
  useEffect(() => {
    if (organisation?.id) {
      const draft = loadDraft(organisation.id);
      if (draft && isDirty(draft)) {
        setHasDraft(true);
      }
    }
  }, [organisation?.id]);

  // Auto-save draft while dialog is open (not in edit mode)
  useEffect(() => {
    if (openDialog && !editMode && organisation?.id && isDirty(formData)) {
      saveDraft(organisation.id, formData);
      setHasDraft(true);
    }
  }, [formData, openDialog, editMode, organisation?.id]);

  // Load document settings on mount
  useEffect(() => {
    if (organisation?.id) {
      supabase.from('document_settings')
        .select('*')
        .eq('organisation_id', organisation.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (!error && data) {
            setDocSettings(data);
          }
        });
    }
  }, [organisation?.id]);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Close row action menu on outside click / Escape
  useEffect(() => {
    if (!openMenuId) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openMenuId]);

  const handleAdd = () => {
    setEditMode(false);
    setErrors({});
    // Restore draft if available
    if (organisation?.id) {
      const draft = loadDraft(organisation.id);
      if (draft && isDirty(draft)) {
        setFormData(draft);
        setDraftRestored(true);
        setTimeout(() => setDraftRestored(false), 3000);
      } else {
        setFormData(defaultFormData);
      }
    } else {
      setFormData(defaultFormData);
    }
    setOpenDialog(true);
  };

  // Upload file to Supabase Storage
  const handleFileUpload = async (field: keyof VendorFormData, file: File) => {
    if (!organisation?.id) return;
    setUploadingDoc(field);
    try {
      const ext = file.name.split('.').pop();
      const path = `${organisation.id}/vendors/${Date.now()}_${field}.${ext}`;
      const { error } = await supabase.storage
        .from('vendor-documents')
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage
        .from('vendor-documents')
        .getPublicUrl(path);
      setFormData({ ...formData, [field]: urlData.publicUrl });
    } catch (err: any) {
      console.error('Upload error:', err);
      alert('Upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleEdit = (vendor: any) => {
    setEditMode(true);
    setSelectedVendor(vendor);
    setFormData({
      ...defaultFormData,
      ...vendor,
    });
    setErrors({});
    setOpenDialog(true);
  };

  const handleOpenLedger = (vendor: any) => {
    setSelectedVendor(vendor);
    setOpenLedgerDialog(true);
  };

  const handleAddAsClient = async (vendor: any) => {
    if (!organisation?.id) return;
    setAddingAsClient(vendor.id);
    try {
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .eq('organisation_id', organisation.id)
        .eq('linked_vendor_id', vendor.id)
        .single();

      if (existingClient) {
        setParty360Data({ name: vendor.company_name, vendorId: vendor.id, clientId: existingClient.id });
        setParty360Open(true);
        return;
      }

      const { data: newClient, error } = await supabase
        .from('clients')
        .insert({
          organisation_id: organisation.id,
          client_name: vendor.company_name,
          name: vendor.company_name,
          contact_person: vendor.contact_person || null,
          email: vendor.email || null,
          phone: vendor.phone || null,
          gstin: vendor.gstin || null,
          state: vendor.state || null,
          address: vendor.address || null,
          linked_vendor_id: vendor.id,
          party_type: 'both',
        })
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from('purchase_vendors')
        .update({ linked_client_id: newClient.id, party_type: 'both' })
        .eq('id', vendor.id);

      setParty360Data({ name: vendor.company_name, vendorId: vendor.id, clientId: newClient.id });
      setParty360Open(true);
    } catch (err: any) {
      console.error('Error adding vendor as client:', err);
      alert('Failed to add as client: ' + (err.message || 'Unknown error'));
    } finally {
      setAddingAsClient(null);
    }
  };

  const handleViewParty360 = (vendor: any) => {
    const linkedClientId = vendor.linked_client_id || null;
    setParty360Data({ name: vendor.company_name, vendorId: vendor.id, clientId: linkedClientId });
    setParty360Open(true);
  };

  const generateVendorCode = () => {
    const prefix = docSettings?.vendor_prefix || 'VEN';
    const startNum = docSettings?.vendor_current_number || docSettings?.vendor_start_number || 1;
    const suffix = docSettings?.vendor_suffix || '';
    const padding = docSettings?.vendor_padding || 3;
    
    const paddedNum = String(startNum).padStart(padding, '0');
    return `${prefix}${paddedNum}${suffix}`;
  };

  const validateForm = (): boolean => {
    const result = vendorValidationSchema.safeParse(formData);
    if (!result.success) {
      setErrors(formatZodErrors(result.error));
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSave = async () => {
    // Validate form
    if (!validateForm()) {
      return;
    }
    
    // Exclude transient UI-only fields from database payload
    const { re_enter_account_number, ...vendorPayload } = formData;
    
    try {
      if (editMode && selectedVendor) {
        await updateVendor.mutateAsync({
          id: selectedVendor.id,
          ...vendorPayload,
        });
      } else {
        // Generate vendor code based on settings
        let vendorCode = generateVendorCode();
        
        // Check if vendor code already exists and generate a unique one if needed
        let isUnique = false;
        let attempts = 0;
        while (!isUnique && attempts < 10) {
          const { data: existing } = await supabase
            .from('purchase_vendors')
            .select('vendor_code')
            .eq('vendor_code', vendorCode)
            .eq('organisation_id', organisation?.id)
            .single();
          
          if (!existing) {
            isUnique = true;
          } else {
            // Generate a new code by incrementing the number
            const currentNum = (docSettings?.vendor_current_number || docSettings?.vendor_start_number || 1) + attempts + 1;
            const prefix = docSettings?.vendor_prefix || 'VEN';
            const suffix = docSettings?.vendor_suffix || '';
            const padding = docSettings?.vendor_padding || 3;
            const paddedNum = String(currentNum).padStart(padding, '0');
            vendorCode = `${prefix}${paddedNum}${suffix}`;
            attempts++;
          }
        }
        
        if (!isUnique) {
          alert('Unable to generate unique vendor code. Please try again.');
          return;
        }
        
        await createVendor.mutateAsync({
          ...vendorPayload,
          vendor_code: vendorCode,
          organisation_id: organisation?.id,
        });

        // Increment the current number in settings
        if (docSettings && organisation?.id) {
          const nextNum = (docSettings.vendor_current_number || docSettings.vendor_start_number || 1) + 1;
          await supabase.from('document_settings').upsert({
            organisation_id: organisation.id,
            vendor_current_number: nextNum,
            updated_at: new Date().toISOString()
          }, { onConflict: 'organisation_id' });
          
          // Update local state
          setDocSettings(prev => ({ ...prev, vendor_current_number: nextNum }));
        }
      }
      clearDraft(organisation?.id || '');
      setHasDraft(false);
      setOpenDialog(false);
      setErrors({});
    } catch (error: any) {
      console.error('Error saving vendor:', error);
      if (error.code === '23505') {
        alert('A vendor with this code already exists. Please try again.');
      } else {
        alert('Error saving vendor: ' + error.message);
      }
    }
  };

  const filteredVendors = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return vendors.filter((vendor: any) =>
      vendor.company_name?.toLowerCase().includes(q) ||
      vendor.vendor_code?.toLowerCase().includes(q) ||
      vendor.gstin?.toLowerCase().includes(q) ||
      vendor.contact_person?.toLowerCase().includes(q) ||
      vendor.remarks?.toLowerCase().includes(q)
    );
  }, [vendors, searchTerm]);

  // Pagination (QuotationList pattern)
  const paginationData = useMemo(() => {
    const totalItems = filteredVendors.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentItems = filteredVendors.slice(startIndex, endIndex);
    return {
      totalItems,
      totalPages,
      startIndex,
      endIndex,
      currentItems,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
    };
  }, [filteredVendors, currentPage, itemsPerPage]);

  const toggleSelectAll = () => {
    if (selectedIds.size === paginationData.currentItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginationData.currentItems.map((v: any) => v.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkStatus = async (status: string) => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to mark ${selectedIds.size} vendor(s) as ${status}?`)) return;
    try {
      const { error } = await supabase
        .from('purchase_vendors')
        .update({ status })
        .in('id', Array.from(selectedIds))
        .eq('organisation_id', organisation?.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['purchase-vendors'] });
      setSelectedIds(new Set());
    } catch (err: any) {
      alert('Failed to update status: ' + err.message);
    }
  };

  // DESIGN.md — Form Field Row tokens
  const headerFieldStyle = { display: 'flex', alignItems: 'center', gap: '8px' };
  const labelColStyle = { minWidth: '90px', maxWidth: '90px', fontWeight: 600, fontSize: '11px', color: '#374151' };
  const fieldColStyle = { flex: 1 };
  const sectionHeaderStyle = {
    fontWeight: 600, fontSize: '11px', color: '#6b7280',
    textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '2px'
  };
  const inputStyle = { padding: '4px 8px', fontSize: '12px', width: '100%', border: '1px solid #d1d5db', borderRadius: '4px' };
  const renderHeaderField = (label: string, field: React.ReactNode, isLast = false) => (
    <div style={{ ...headerFieldStyle, marginBottom: isLast ? 0 : '8px' }}>
      <span style={labelColStyle}>{label}</span>
      <div style={fieldColStyle}>{field}</div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Sticky Bulk Action Header (Activates for 2+ items) */}
      <AnimatePresence>
        {selectedIds.size >= 2 && (
          <motion.div 
            initial={{ y: -64, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -64, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="sticky top-0 z-[120] w-full bg-zinc-900 text-white px-6 py-[12px] flex items-center justify-between shadow-2xl"
          >
            <div className="flex items-center gap-6">
              <button 
                onClick={() => setSelectedIds(new Set())}
                className="p-1 hover:bg-zinc-800 rounded-full transition-colors"
              >
                <XIcon className="w-5 h-5" />
              </button>
              <div className="flex flex-col">
                <span className="text-sm font-semibold">{selectedIds.size} items selected</span>
                <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold leading-none">Bulk Operations Active</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleBulkStatus('Active')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-zinc-900 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-zinc-100 transition-all active:scale-[0.98]"
              >
                Mark Active
              </button>
              <button
                onClick={() => handleBulkStatus('Inactive')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-red-700 transition-all active:scale-[0.98]"
              >
                Mark Inactive
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-medium text-zinc-900">Vendors</h1>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
            {filteredVendors.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <input
              placeholder="Search vendors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 pl-8 h-[30px] w-64 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleAdd}
            className="inline-flex items-center justify-center text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm active:scale-[0.98]"
            style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 }}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Vendor{hasDraft ? ' (draft)' : ''}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="min-w-full">
          <table className="w-full border-separate border-spacing-0">
            <thead className="z-10">
              <tr>
                <th className="sticky top-0 z-10 h-[36px] px-4 text-center align-middle w-[50px] bg-white border-b border-zinc-200">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === paginationData.currentItems.length && paginationData.currentItems.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight text-left bg-white border-b border-zinc-200 w-[120px]">Code</th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight text-left bg-white border-b border-zinc-200">Vendor Name</th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight text-left bg-white border-b border-zinc-200">Material Type</th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight text-left bg-white border-b border-zinc-200">GSTIN</th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight text-left bg-white border-b border-zinc-200 w-[110px]">Currency</th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight text-right bg-white border-b border-zinc-200 w-[130px]">Credit Limit</th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight text-left bg-white border-b border-zinc-200 w-[110px]">Status</th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 text-center align-middle text-[13px] font-semibold text-zinc-700 tracking-tight w-[70px] bg-white border-b border-zinc-200">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-5 py-16 text-center text-sm text-zinc-500">
                    Loading vendors...
                  </td>
                </tr>
              ) : paginationData.currentItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-16 text-center text-sm text-zinc-500">
                    No vendors found
                  </td>
                </tr>
              ) : (
                <AnimatePresence mode="popLayout">
                  {paginationData.currentItems.map((vendor: any, index) => (
                    <motion.tr
                      key={vendor.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                        opacity: { duration: 0.2 }
                      }}
                      className={`cursor-pointer transition-all duration-200 border-l-2 border-transparent hover:border-blue-600 hover:bg-blue-100/80 hover:shadow-sm group relative ${
                        openMenuId === vendor.id ? 'z-50' : 'z-0'
                      } ${
                        index % 2 === 0 ? 'bg-white' : 'bg-zinc-50/30'
                      } ${selectedIds.has(vendor.id) ? 'bg-indigo-50/50 border-l-blue-600' : ''}`}
                      onClick={() => {
                        if (selectedIds.size === 0) {
                          handleEdit(vendor);
                        } else {
                          toggleSelect(vendor.id);
                        }
                      }}
                    >
                      <td className="px-4 py-[26px] align-middle text-center border-t border-zinc-200/70">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(vendor.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelect(vendor.id);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-6 py-[26px] align-middle text-sm font-medium text-zinc-900 whitespace-nowrap border-t border-zinc-200/70">
                        <span className="inline-flex items-center h-5 px-2 rounded-[26px] border-[0.8px] border-solid border-[#E5E5E5] text-[12px] leading-[133.333%] font-medium text-[#0A0A0A] font-mono">
                          {vendor.vendor_code}
                        </span>
                      </td>
                      <td className="px-6 py-[26px] align-middle text-sm text-zinc-800 border-t border-zinc-200/70">
                        <div className="max-w-[280px] truncate" title={vendor.company_name || '-'}>
                          {vendor.company_name || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-[26px] align-middle text-sm text-zinc-800 border-t border-zinc-200/70">
                        <div className="max-w-[180px] truncate" title={vendor.remarks || '-'}>
                          {vendor.remarks || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-[26px] align-middle text-[12px] font-mono text-zinc-800 whitespace-nowrap border-t border-zinc-200/70">
                        {vendor.gstin || '-'}
                      </td>
                      <td className="px-6 py-[26px] align-middle whitespace-nowrap border-t border-zinc-200/70">
                        <span className="inline-flex items-center h-5 px-2 rounded-[26px] border-[0.8px] border-solid border-[#E5E5E5] text-[12px] leading-[133.333%] font-medium text-[#0A0A0A]">
                          {vendor.default_currency || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-[26px] align-middle text-sm font-medium text-zinc-900 whitespace-nowrap tabular-nums border-t border-zinc-200/70">
                        <div className="text-right">
                          {formatCurrency(vendor.credit_limit || 0)}
                        </div>
                      </td>
                      <td className="px-6 py-[26px] align-middle whitespace-nowrap border-t border-zinc-200/70">
                        <span className={cn(
                          'inline-flex items-center h-5 px-2 rounded-[26px] text-[12px] leading-[133.333%] font-medium',
                          vendor.status === 'Active'
                            ? 'bg-[#DCFCE7] text-[oklch(52.7%_0.154_150.1)]'
                            : 'bg-[oklab(57.7%_0.218_0.112/10%)] text-[oklch(57.7%_0.245_27.3)]'
                        )}>
                          {vendor.status || '-'}
                        </span>
                      </td>
                      <td className="px-0 py-[26px] align-middle border-t border-zinc-200/70">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenLedger(vendor);
                          }}
                          style={{
                            padding: '14px',
                            background: 'transparent',
                            border: 'none',
                            color: '#9ca3af',
                            borderRadius: '0',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#185FA5'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; }}
                          title="View Ledger"
                        >
                          <EyeIcon className="w-[18px] h-[18px]" />
                        </button>
                      </td>
                      <td className="px-5 pl-1 py-[26px] align-middle text-center border-t border-zinc-200/70">
                        <div className="relative inline-block" ref={openMenuId === vendor.id ? menuRef : null}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === vendor.id ? null : vendor.id);
                            }}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-zinc-100 transition-colors"
                          >
                            <MoreHorizontalIcon className="w-4 h-4 text-zinc-500" />
                          </button>
                          {openMenuId === vendor.id && (
                            <div className={`absolute right-0 z-[100] w-44 rounded-lg border border-zinc-200/60 bg-white p-1 shadow-lg shadow-black/5 ${
                              index >= paginationData.currentItems.length - 3 && index > 3 ? 'bottom-full mb-1' : 'top-full mt-1'
                            }`}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  handleOpenLedger(vendor);
                                }}
                                className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 transition-all hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98]"
                                style={{ padding: '6px' }}
                              >
                                <EyeIcon className="w-3.5 h-3.5" />
                                View Ledger
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  handleEdit(vendor);
                                }}
                                className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 transition-all hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98]"
                                style={{ padding: '6px' }}
                              >
                                Edit Vendor
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  handleAddAsClient(vendor);
                                }}
                                disabled={addingAsClient === vendor.id}
                                className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 transition-all hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98] disabled:opacity-50"
                                style={{ padding: '6px' }}
                              >
                                Add as Client
                              </button>
                              <div className="my-1 border-t border-zinc-100" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  handleViewParty360(vendor);
                                }}
                                className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 transition-all hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98]"
                                style={{ padding: '6px' }}
                              >
                                Party 360°
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 bg-zinc-50/50">
        <div className="text-sm font-medium text-zinc-600">
          Showing {paginationData.totalItems === 0 ? 0 : paginationData.startIndex + 1} to {Math.min(paginationData.endIndex, paginationData.totalItems)} of {paginationData.totalItems} vendors
        </div>
        <div className="flex items-center gap-2">
          {/* Previous Button */}
          <button
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={!paginationData.hasPrevPage}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors h-[32px] min-w-[80px] flex items-center justify-center ${
              paginationData.hasPrevPage
                ? 'text-zinc-700 hover:bg-zinc-200 bg-white border border-zinc-200 shadow-sm'
                : 'text-zinc-400 bg-zinc-50 border border-zinc-100 cursor-not-allowed'
            }`}
          >
            Previous
          </button>

          {/* Page Numbers */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: Math.max(1, Math.min(5, paginationData.totalPages)) }, (_, i) => {
              let pageNum;
              if (paginationData.totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= paginationData.totalPages - 2) {
                pageNum = paginationData.totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors h-[32px] min-w-[32px] flex items-center justify-center ${
                    currentPage === pageNum
                      ? 'bg-blue-600/10 text-blue-600 border border-blue-600/20 shadow-sm'
                      : 'text-zinc-600 hover:bg-zinc-100 bg-white border border-zinc-200'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          {/* Next Button */}
          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={!paginationData.hasNextPage}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors h-[32px] min-w-[80px] flex items-center justify-center ${
              paginationData.hasNextPage
                ? 'text-zinc-700 hover:bg-zinc-200 bg-white border border-zinc-200 shadow-sm'
                : 'text-zinc-400 bg-zinc-50 border border-zinc-100 cursor-not-allowed'
            }`}
          >
            Next
          </button>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={openDialog}
        onClose={() => setOpenDialog(false)}
        title={editMode ? "Edit Vendor Details" : "Register New Vendor"}
        size="xl"
        footer={
          <>
            <button
              onClick={() => setOpenDialog(false)}
              style={{
                padding: '7px 16px', background: '#fff', border: '1px solid #d1d5db',
                borderRadius: '8px', fontSize: '12px', fontWeight: 500, color: '#374151',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!formData.company_name}
              style={{
                padding: '7px 16px', background: '#185FA5', border: '1px solid #185FA5',
                borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#fff',
                cursor: formData.company_name ? 'pointer' : 'not-allowed',
                opacity: formData.company_name ? 1 : 0.6,
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { if (formData.company_name) { e.currentTarget.style.background = '#0C447C'; e.currentTarget.style.borderColor = '#0C447C'; } }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#185FA5'; e.currentTarget.style.borderColor = '#185FA5'; }}
            >
              {editMode ? 'Update Vendor' : 'Save Vendor'}
            </button>
          </>
        }
      >
        {/* DESIGN.md modal body — 24px padding */}
        <div style={{ padding: '24px' }}>
          {/* Draft restored banner */}
          {draftRestored && (
            <div style={{
              background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px',
              padding: '8px 12px', marginBottom: '12px', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', fontSize: '12px', color: '#1e40af',
            }}>
              <span>Draft restored from your last session.</span>
              <button
                onClick={() => {
                  setFormData(defaultFormData);
                  clearDraft(organisation?.id || '');
                  setHasDraft(false);
                  setDraftRestored(false);
                }}
                style={{
                  background: 'transparent', border: 'none', color: '#1e40af',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline',
                }}
              >
                Start fresh
              </button>
            </div>
          )}
          {/* DESIGN.md 2-column grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
            {/* Column 1: Basic Information */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={sectionHeaderStyle}>Basic Information</div>
              <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '6px' }}>
                {renderHeaderField('Company Name *',
                  <div>
                    <Input value={formData.company_name}
                      onChange={(e) => {
                        setFormData({ ...formData, company_name: e.target.value });
                        if (errors.company_name) setErrors({ ...errors, company_name: '' });
                      }}
                      error={!!errors.company_name} placeholder="e.g. Acme Supplies" style={inputStyle} />
                    {errors.company_name && <p style={{ fontSize: '10px', color: '#ef4444', marginTop: '2px' }}>{errors.company_name}</p>}
                  </div>
                )}
                {renderHeaderField('Contact Person',
                  <Input value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    placeholder="e.g. John Doe" style={inputStyle} />
                )}
                {renderHeaderField('Email',
                  <div>
                    <Input type="email" value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="vendor@example.com" style={inputStyle} error={!!errors.email} />
                    {errors.email && <p style={{ fontSize: '10px', color: '#ef4444', marginTop: '2px' }}>{errors.email}</p>}
                  </div>
                )}
                {renderHeaderField('Phone',
                  <Input value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98765 43210" style={inputStyle} />
                )}
                {renderHeaderField('GST Treatment',
                  <Select value={formData.gst_treatment} onValueChange={(val) => setFormData({ ...formData, gst_treatment: val })}>
                    <SelectTrigger style={{ padding: '4px 8px', fontSize: '12px', height: 'auto' }}>
                      <SelectValue placeholder="Select GST Treatment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Registered Business Regular">Registered Business Regular</SelectItem>
                      <SelectItem value="Registered Business Composition">Registered Business Composition</SelectItem>
                      <SelectItem value="Unregistered Business">Unregistered Business</SelectItem>
                      <SelectItem value="Consumer">Consumer</SelectItem>
                      <SelectItem value="Overseas">Overseas</SelectItem>
                      <SelectItem value="Special Economic Zone (SEZ)">Special Economic Zone (SEZ)</SelectItem>
                      <SelectItem value="Deemed Export">Deemed Export</SelectItem>
                      <SelectItem value="Tax Deductor">Tax Deductor</SelectItem>
                      <SelectItem value="SEZ Developer">SEZ Developer</SelectItem>
                      <SelectItem value="Input Service Distributor">Input Service Distributor</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {renderHeaderField('GSTIN',
                  <div>
                    <Input value={formData.gstin}
                      onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                      placeholder="27AABCU9603R1ZM" style={{ ...inputStyle, textTransform: 'uppercase', fontFamily: 'monospace' }}
                      error={!!errors.gstin} />
                    {errors.gstin ? <p style={{ fontSize: '10px', color: '#ef4444', marginTop: '2px' }}>{errors.gstin}</p> : <p style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>Format: 27AABCU9603R1ZM</p>}
                  </div>
                )}
                {renderHeaderField('PAN',
                  <div>
                    <Input value={formData.pan}
                      onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                      placeholder="ABCUP1234A" style={{ ...inputStyle, textTransform: 'uppercase', fontFamily: 'monospace' }}
                      error={!!errors.pan} />
                    {errors.pan ? <p style={{ fontSize: '10px', color: '#ef4444', marginTop: '2px' }}>{errors.pan}</p> : <p style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>Format: ABCUP1234A</p>}
                  </div>
                )}
                {renderHeaderField('MSME Type',
                  <Select value={formData.msme_register_type} onValueChange={(val) => setFormData({ ...formData, msme_register_type: val })}>
                    <SelectTrigger style={{ padding: '4px 8px', fontSize: '12px', height: 'auto' }}>
                      <SelectValue placeholder="Select MSME Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="micro">Micro Enterprise</SelectItem>
                      <SelectItem value="small">Small Enterprise</SelectItem>
                      <SelectItem value="medium">Medium Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {renderHeaderField('MSME Number',
                  <Input value={formData.msme_number}
                    onChange={(e) => setFormData({ ...formData, msme_number: e.target.value.toUpperCase() })}
                    placeholder="UDYAM/MSME Registration Number" style={{ ...inputStyle, textTransform: 'uppercase', fontFamily: 'monospace' }} />,
                  true
                )}
              </div>
            </div>

            {/* Column 2: Address & Location */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={sectionHeaderStyle}>Address & Location</div>
              <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '6px' }}>
                {renderHeaderField('Address',
                  <Textarea value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Enter office/warehouse address..."
                    style={{ ...inputStyle, minHeight: '60px' }} />
                )}
                {renderHeaderField('State',
                  <Select value={formData.state} onValueChange={(val) => setFormData({ ...formData, state: val })}>
                    <SelectTrigger style={{ padding: '4px 8px', fontSize: '12px', height: 'auto' }}>
                      <SelectValue placeholder="Select State" />
                    </SelectTrigger>
                    <SelectContent style={{ maxHeight: '200px' }}>
                      {INDIAN_STATES.map((state) => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {renderHeaderField('Pincode',
                  <div>
                    <Input value={formData.pincode}
                      onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                      placeholder="400001" maxLength={6} style={inputStyle} />
                    {errors.pincode && <p style={{ fontSize: '10px', color: '#ef4444', marginTop: '2px' }}>{errors.pincode}</p>}
                  </div>,
                  true
                )}
              </div>
            </div>
          </div>

          {/* Financial Terms & Bank Details — full width below grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', marginTop: '10px' }}>
            {/* Financial Terms */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={sectionHeaderStyle}>Financial Terms</div>
              <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '6px' }}>
                {renderHeaderField('Currency',
                  <Select value={formData.default_currency} onValueChange={(val) => setFormData({ ...formData, default_currency: val })}>
                    <SelectTrigger style={{ padding: '4px 8px', fontSize: '12px', height: 'auto' }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((curr) => (
                        <SelectItem key={curr} value={curr}>{curr}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {renderHeaderField('Payment Terms',
                  <Select value={formData.payment_terms} onValueChange={(val) => setFormData({ ...formData, payment_terms: val })}>
                    <SelectTrigger style={{ padding: '4px 8px', fontSize: '12px', height: 'auto' }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TERMS.map((term) => (
                        <SelectItem key={term} value={term}>{term}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {renderHeaderField('Credit Limit',
                  <Input type="number" value={formData.credit_limit}
                    onChange={(e) => setFormData({ ...formData, credit_limit: Number(e.target.value) })}
                    style={inputStyle} />
                )}
                {renderHeaderField('Status',
                  <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                    <SelectTrigger style={{ padding: '4px 8px', fontSize: '12px', height: 'auto' }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>,
                  true
                )}
              </div>
            </div>

            {/* Bank Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={sectionHeaderStyle}>Bank Details</div>
              <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '6px' }}>
                {renderHeaderField('Acct Holder',
                  <Input value={formData.account_holder_name}
                    onChange={(e) => setFormData({ ...formData, account_holder_name: e.target.value })}
                    placeholder="Enter account holder name" style={inputStyle} />
                )}
                {renderHeaderField('Bank Name',
                  <Input value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    placeholder="State Bank of India" style={inputStyle} />
                )}
                {renderHeaderField('Account No.',
                  <Input value={formData.bank_account_no}
                    onChange={(e) => setFormData({ ...formData, bank_account_no: e.target.value })}
                    placeholder="00000000000" style={inputStyle} />
                )}
                {renderHeaderField('Re-enter Acct',
                  <Input value={formData.re_enter_account_number}
                    onChange={(e) => setFormData({ ...formData, re_enter_account_number: e.target.value })}
                    placeholder="Re-enter account number" style={inputStyle} />
                )}
                {renderHeaderField('IFSC Code',
                  <Input value={formData.bank_ifsc}
                    onChange={(e) => setFormData({ ...formData, bank_ifsc: e.target.value.toUpperCase() })}
                    placeholder="SBIN0001234" style={{ ...inputStyle, textTransform: 'uppercase', fontFamily: 'monospace' }} />
                )}
                {renderHeaderField('Opening Bal.',
                  <Input type="number" value={formData.opening_balance}
                    onChange={(e) => setFormData({ ...formData, opening_balance: Number(e.target.value) })}
                    style={inputStyle} />,
                  true
                )}
              </div>
            </div>
          </div>

          {/* Document Uploads Section */}
          <div style={{ marginTop: '10px' }}>
            <div style={sectionHeaderStyle}>Documents</div>
            <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '6px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { field: 'pan_card_url' as const, label: 'PAN Card', accept: '.jpg,.jpeg,.png,.pdf' },
                  { field: 'cheque_leaf_url' as const, label: 'Cheque Leaf', accept: '.jpg,.jpeg,.png,.pdf' },
                  { field: 'gstin_certificate_url' as const, label: 'GST Certificate', accept: '.jpg,.jpeg,.png,.pdf' },
                  { field: 'msme_certificate_url' as const, label: 'MSME Certificate', accept: '.jpg,.jpeg,.png,.pdf' },
                ].map(({ field, label, accept }) => (
                  <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '11px', color: '#374151' }}>{label}</span>
                    {formData[field] ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: '#fff', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '11px' }}>
                        <FileText size={14} style={{ color: '#185FA5', flexShrink: 0 }} />
                        <a
                          href={formData[field]}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ flex: 1, color: '#185FA5', textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          View file
                        </a>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, [field]: '' })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9ca3af' }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={uploadingDoc === field}
                        onClick={() => fileInputRefs.current[field]?.click()}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          padding: '6px 8px', background: '#fff', border: '1px dashed #d1d5db',
                          borderRadius: '4px', fontSize: '11px', color: '#6b7280',
                          cursor: uploadingDoc === field ? 'not-allowed' : 'pointer',
                          opacity: uploadingDoc === field ? 0.6 : 1,
                          transition: 'all 0.15s',
                        }}
                      >
                        <Upload size={14} />
                        {uploadingDoc === field ? 'Uploading...' : 'Upload'}
                      </button>
                    )}
                    <input
                      ref={(el) => { fileInputRefs.current[field] = el; }}
                      type="file"
                      accept={accept}
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(field, file);
                        e.target.value = '';
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Remarks Section (Full Width) */}
          <div style={{ marginTop: '10px' }}>
            <div style={sectionHeaderStyle}>Material Type / Scope of Supply</div>
            <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '6px' }}>
              <Textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                placeholder="Describe what materials this vendor supplies (e.g., Cement, Steel, Electrical items, Plumbing materials, etc.)"
                style={{ ...inputStyle, minHeight: '60px' }}
              />
            </div>
          </div>

        </div>
      </Modal>

      <VendorLedgerDialog
        open={openLedgerDialog}
        onClose={() => setOpenLedgerDialog(false)}
        organisationName={organisation?.name || 'Organisation'}
        organisationId={organisation?.id}
        vendor={selectedVendor}
      />

      {party360Open && party360Data && (
        <Party360
          partyName={party360Data.name}
          vendorId={party360Data.vendorId}
          clientId={party360Data.clientId}
          onClose={() => setParty360Open(false)}
        />
      )}
    </div>
  );
};

export default Vendors;
