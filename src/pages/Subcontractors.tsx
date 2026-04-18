import { useState, useEffect, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../components/ui/Modal';
import { SubcontractorLedger } from '../components/SubcontractorLedger';
import { 
  Building2, 
  X, 
  Save, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  Briefcase, 
  CheckCircle,
  Plus,
  Search,
  RefreshCcw,
  Eye,
  Filter,
  Users,
  MoreVertical,
  ChevronRight,
  ShieldCheck,
  FileSignature
} from 'lucide-react';
import { AppTable } from '../components/ui/AppTable';
import { cn } from '../lib/utils';

// Query Keys for Subcontractor Module
export const SUBCONTRACTOR_QUERY_KEYS = {
  all: () => ['subcontractors'] as const,
  list: (orgId: string | null, filter: string) => ['subcontractors', 'list', orgId, filter] as const,
  detail: (id: string | null) => ['subcontractors', 'detail', id] as const,
  workOrders: (subId: string | null) => ['subcontractors', 'workOrders', subId] as const,
  attendance: (subId: string | null) => ['subcontractors', 'attendance', subId] as const,
  dailyLogs: (subId: string | null) => ['subcontractors', 'dailyLogs', subId] as const,
  payments: (subId: string | null) => ['subcontractors', 'payments', subId] as const,
  invoices: (subId: string | null) => ['subcontractors', 'invoices', subId] as const,
} as const;

// StaleTime configuration (2 minutes)
const STALE_TIME = 2 * 60 * 1000;

const getCurrentQueryParams = () => new URLSearchParams(window.location.search);

type NavigateFn = (path: string) => void
type WithNavigate = { onNavigate: NavigateFn }
type CreateSubcontractorProps = {
  onSuccess: () => void
  onCancel: () => void
  editMode?: boolean
  subData?: any
}

// New Modal-based Create Subcontractor Component
export function CreateSubcontractorModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  editMode = false, 
  subData 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: () => void;
  editMode?: boolean;
  subData?: any;
}) {
  const { organisation } = useAuth();
  const [formData, setFormData] = useState({
    sub_number: '',
    company_name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    state: '',
    gstin: '',
    pincode: '',
    pan_card: '',
    bank_name: '',
    bank_account_number: '',
    bank_ifsc_code: '',
    bank_account_type: '',
    previous_projects: '',
    nature_of_work: '',
    internal_remarks: '',
    nda_signed: false,
    contract_signed: false,
    nda_date: '',
    contract_date: '',
    status: 'Active'
  });
  const [error, setError] = useState('');

  const indianStates = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry'];

  useEffect(() => {
    if (isOpen && editMode && subData) {
      setFormData({
        sub_number: subData.sub_number || '',
        company_name: subData.company_name || '',
        contact_person: subData.contact_person || '',
        phone: subData.phone || '',
        email: subData.email || '',
        address: subData.address || '',
        state: subData.state || '',
        gstin: subData.gstin || '',
        pincode: subData.pincode || '',
        pan_card: subData.pan_card || '',
        bank_name: subData.bank_name || '',
        bank_account_number: subData.bank_account_number || '',
        bank_ifsc_code: subData.bank_ifsc_code || '',
        bank_account_type: subData.bank_account_type || '',
        previous_projects: subData.previous_projects || '',
        nature_of_work: subData.nature_of_work || '',
        internal_remarks: subData.internal_remarks || '',
        nda_signed: subData.nda_signed || false,
        contract_signed: subData.contract_signed || false,
        nda_date: subData.nda_date || '',
        contract_date: subData.contract_date || '',
        status: subData.status || 'Active'
      });
    } else if (isOpen && !editMode) {
      setFormData({
        sub_number: '',
        company_name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        state: '',
        gstin: '',
        pincode: '',
        pan_card: '',
        bank_name: '',
        bank_account_number: '',
        bank_ifsc_code: '',
        bank_account_type: '',
        previous_projects: '',
        nature_of_work: '',
        internal_remarks: '',
        nda_signed: false,
        contract_signed: false,
        nda_date: '',
        contract_date: '',
        status: 'Active'
      });
    }
  }, [isOpen, editMode, subData]);

  // useMutation for saving subcontractor
  const saveSubcontractorMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!organisation?.id) {
        throw new Error('No organization selected');
      }

      const payload = {
        ...data,
        organisation_id: organisation.id,
        // Convert empty strings to null for date fields
        nda_date: data.nda_signed ? (data.nda_date || null) : null,
        contract_date: data.contract_signed ? (data.contract_date || null) : null,
      };

      if (editMode && subData?.id) {
        const { error: updateError } = await supabase
          .from('subcontractors')
          .update(payload)
          .eq('id', subData.id);
        
        if (updateError) throw new Error(updateError.message);
      } else {
        const { error: insertError } = await supabase
          .from('subcontractors')
          .insert([payload]);
        
        if (insertError) throw new Error(insertError.message);
      }
    },
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setError(err?.message || 'Failed to save subcontractor. Please try again.');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!organisation?.id) {
      setError('No organization selected. Please select an organization first.');
      return;
    }

    if (!formData.company_name.trim()) {
      setError('Company name is required');
      return;
    }

    saveSubcontractorMutation.mutate(formData);
  };

  const footer = (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onClose}
        disabled={saveSubcontractorMutation.isPending}
        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        form="subcontractor-form"
        disabled={saveSubcontractorMutation.isPending || !formData.company_name.trim()}
        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saveSubcontractorMutation.isPending ? (
          <>
            <RefreshCcw className="h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save size={16} />
            {editMode ? 'Update' : 'Save'}
          </>
        )}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editMode ? 'Edit Sub-Contractor' : 'Add Sub-Contractor'}
      size="lg"
      footer={footer}
    >
      <form id="subcontractor-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            {error}
          </div>
        )}

        {/* Company Information */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <Building2 size={14} />
            Company Information
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Sub Number - Read Only */}
            {formData.sub_number && (
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-slate-700">Sub Number</label>
                <input
                  type="text"
                  value={formData.sub_number}
                  disabled
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px] text-slate-700 outline-none cursor-not-allowed"
                />
              </div>
            )}

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-[12px] font-medium text-slate-700">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                placeholder="Enter company name"
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 placeholder:text-slate-400"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-slate-700">Contact Person</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                  placeholder="Contact person name"
                  className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-[13px] text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-slate-700">Phone</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="Phone number"
                  className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-[13px] text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-slate-700">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="email@company.com"
                  className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-[13px] text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-slate-700">GSTIN</label>
              <input
                type="text"
                value={formData.gstin}
                onChange={(e) => setFormData({...formData, gstin: e.target.value.toUpperCase()})}
                placeholder="15 character GSTIN"
                maxLength={15}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-slate-700">State</label>
              <select
                value={formData.state}
                onChange={(e) => setFormData({...formData, state: e.target.value})}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5"
              >
                <option value="">Select State</option>
                {indianStates.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-slate-700">PIN Code</label>
              <input
                type="text"
                value={formData.pincode}
                onChange={(e) => setFormData({...formData, pincode: e.target.value})}
                placeholder="6 digit PIN code"
                maxLength={6}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-slate-700">Address</label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-3 text-slate-400" />
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                placeholder="Full address"
                rows={2}
                className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-[13px] text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 placeholder:text-slate-400 resize-none"
              />
            </div>
          </div>

          {/* PAN & Bank Details */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <FileText size={14} />
              PAN & Bank Details
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-slate-700">PAN Card</label>
                <input
                  type="text"
                  value={formData.pan_card}
                  onChange={(e) => setFormData({...formData, pan_card: e.target.value.toUpperCase()})}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-slate-700">Bank Name</label>
                <input
                  type="text"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
                  placeholder="e.g., State Bank of India"
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-slate-700">Account Number</label>
                <input
                  type="text"
                  value={formData.bank_account_number}
                  onChange={(e) => setFormData({...formData, bank_account_number: e.target.value})}
                  placeholder="Bank account number"
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-slate-700">IFSC Code</label>
                <input
                  type="text"
                  value={formData.bank_ifsc_code}
                  onChange={(e) => setFormData({...formData, bank_ifsc_code: e.target.value.toUpperCase()})}
                  placeholder="SBIN0001234"
                  maxLength={11}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[12px] font-medium text-slate-700">Account Type</label>
                <select
                  value={formData.bank_account_type}
                  onChange={(e) => setFormData({...formData, bank_account_type: e.target.value})}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5"
                >
                  <option value="">Select Account Type</option>
                  <option value="Savings">Savings</option>
                  <option value="Current">Current</option>
                  <option value="Fixed Deposit">Fixed Deposit</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Work Details */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <Briefcase size={14} />
            Work Details
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-slate-700">Nature of Work</label>
              <input
                type="text"
                value={formData.nature_of_work}
                onChange={(e) => setFormData({...formData, nature_of_work: e.target.value})}
                placeholder="e.g., Electrical, Plumbing, HVAC"
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-slate-700">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-[12px] font-medium text-slate-700">Previous Projects</label>
              <textarea
                value={formData.previous_projects}
                onChange={(e) => setFormData({...formData, previous_projects: e.target.value})}
                placeholder="List previous projects completed by this subcontractor..."
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 placeholder:text-slate-400 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Documents & Agreements */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <FileText size={14} />
            Documents & Agreements
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-medium text-slate-700">NDA Signed</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, nda_signed: !formData.nda_signed})}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      formData.nda_signed ? 'bg-emerald-500' : 'bg-slate-200'
                    )}
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      formData.nda_signed ? 'translate-x-6' : 'translate-x-1'
                    )} />
                  </button>
                  <span className="text-[12px] text-slate-600 font-medium w-8">
                    {formData.nda_signed ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
              {formData.nda_signed && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="text-[12px] font-medium text-slate-700">NDA Date</label>
                  <input
                    type="date"
                    value={formData.nda_date}
                    onChange={(e) => setFormData({...formData, nda_date: e.target.value})}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5"
                  />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-medium text-slate-700">Contract Signed</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, contract_signed: !formData.contract_signed})}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      formData.contract_signed ? 'bg-emerald-500' : 'bg-slate-200'
                    )}
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      formData.contract_signed ? 'translate-x-6' : 'translate-x-1'
                    )} />
                  </button>
                  <span className="text-[12px] text-slate-600 font-medium w-8">
                    {formData.contract_signed ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
              {formData.contract_signed && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="text-[12px] font-medium text-slate-700">Contract Date</label>
                  <input
                    type="date"
                    value={formData.contract_date}
                    onChange={(e) => setFormData({...formData, contract_date: e.target.value})}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Internal Remarks */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-slate-700">Internal Remarks</label>
            <textarea
              value={formData.internal_remarks}
              onChange={(e) => setFormData({...formData, internal_remarks: e.target.value})}
              placeholder="Any internal notes or remarks..."
              rows={3}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[13px] text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 placeholder:text-slate-400 resize-none"
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}

export function SubcontractorDashboard({ onNavigate }: WithNavigate) {
  const { organisation } = useAuth();
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const queryClient = useQueryClient();

  // useQuery for fetching subcontractors with TanStack Query
  const { 
    data: subcontractors = [], 
    isLoading, 
    isFetching,
    refetch 
  } = useQuery({
    queryKey: SUBCONTRACTOR_QUERY_KEYS.list(organisation?.id || null, filter),
    queryFn: async () => {
      if (!organisation?.id) return [];
      
      let query = supabase
        .from('subcontractors')
        .select('*')
        .eq('organisation_id', organisation.id)
        .order('created_at', { ascending: false });
      
      if (filter === 'active') query = query.eq('status', 'Active');
      else if (filter === 'inactive') query = query.eq('status', 'Inactive');
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching subcontractors:', error);
        throw new Error(error.message);
      }
      
      return data || [];
    },
    staleTime: STALE_TIME,
    enabled: !!organisation?.id,
  });

  const filtered = subcontractors.filter(s => 
    s.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.nature_of_work?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const columns = useMemo(() => [
    {
      header: 'Sub ID',
      accessorKey: 'sub_number',
      cell: (info: any) => (
        <span className="font-black tracking-tight text-blue-600 uppercase text-[11px]">{info.getValue() || '-'}</span>
      )
    },
    {
      header: 'Company & Contact',
      accessorKey: 'company_name',
      cell: (info: any) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900">{info.getValue()}</span>
          <span className="text-xs text-slate-400 font-medium">{info.row.original.contact_person || 'No contact person'}</span>
        </div>
      )
    },
    {
      header: 'Contact Info',
      accessorKey: 'phone',
      cell: (info: any) => (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <Phone size={10} className="text-slate-300" />
            {info.getValue() || '-'}
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <Mail size={10} className="text-slate-300" />
            {info.row.original.email || '-'}
          </div>
        </div>
      )
    },
    {
      header: 'Nature of Work',
      accessorKey: 'nature_of_work',
      cell: (info: any) => (
        <div className="flex items-center gap-1.5">
          <Briefcase size={12} className="text-slate-300" />
          <span className="truncate max-w-[150px] font-medium text-slate-600">{info.getValue() || '-'}</span>
        </div>
      )
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (info: any) => (
        <div className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest",
          info.getValue() === 'Active' ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
        )}>
          <div className={cn("h-1.5 w-1.5 rounded-full", info.getValue() === 'Active' ? "bg-emerald-500" : "bg-slate-400")} />
          {info.getValue()}
        </div>
      )
    },
    {
      header: 'Compliance',
      accessorKey: 'id',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          {row.original.nda_signed ? (
            <div title="NDA Signed" className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-500">
              <ShieldCheck size={14} />
            </div>
          ) : (
            <div title="NDA Missing" className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-50 text-slate-300">
              <ShieldCheck size={14} />
            </div>
          )}
          {row.original.contract_signed ? (
            <div title="Contract Signed" className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500">
              <FileSignature size={14} />
            </div>
          ) : (
            <div title="Contract Missing" className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-50 text-slate-300">
              <FileSignature size={14} />
            </div>
          )}
        </div>
      )
    },
    {
      header: '',
      id: 'actions',
      cell: ({ row }: any) => (
        <div className="flex justify-end">
          <button
            onClick={() => { window.subToView = row.original; onNavigate('/subcontractors/view?id=' + row.original.id) }}
            className="flex h-8 w-12 items-center justify-center rounded-xl border border-slate-100 bg-white text-slate-400 shadow-sm transition-all hover:border-blue-200 hover:text-blue-600 hover:shadow-md active:scale-95"
          >
            <Eye size={16} />
          </button>
        </div>
      )
    }
  ], [onNavigate]);

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10">
      {/* Header */}
      <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between animate-in fade-in slide-in-from-top-4 duration-700">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Sub-Contractors</h1>
            <div className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-blue-600">
              <Users size={12} />
              {subcontractors.length} Registered
            </div>
          </div>
          <p className="mt-1 text-sm font-medium text-slate-500">Manage workforce partners, compliance, and performance tracking</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onNavigate('/subcontractors/attendance')}
            className="inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 text-[13px] font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95"
          >
            Attendance
          </button>
          <button 
            className="inline-flex h-12 items-center gap-2 rounded-2xl bg-slate-900 px-6 text-[13px] font-black uppercase tracking-widest text-white shadow-xl shadow-slate-900/20 transition-all hover:bg-slate-800 active:scale-95"
            onClick={() => onNavigate('/subcontractors/new')}
          >
            <Plus size={18} />
            Add Sub-Contractor
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-2xl shadow-slate-200/60 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-6 border-b border-slate-100 bg-slate-50/30 p-8">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex rounded-2xl border border-slate-100 bg-white p-1 shadow-sm">
              <button
                onClick={() => setFilter('all')}
                className={cn(
                  "px-6 py-2.5 text-[12px] font-black uppercase tracking-widest rounded-xl transition-all",
                  filter === 'all' ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20" : "text-slate-400 hover:text-slate-600"
                )}
              >
                All
              </button>
              <button
                onClick={() => setFilter('active')}
                className={cn(
                  "px-6 py-2.5 text-[12px] font-black uppercase tracking-widest rounded-xl transition-all",
                  filter === 'active' ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Active
              </button>
              <button
                onClick={() => setFilter('inactive')}
                className={cn(
                  "px-6 py-2.5 text-[12px] font-black uppercase tracking-widest rounded-xl transition-all",
                  filter === 'inactive' ? "bg-slate-400 text-white shadow-lg shadow-slate-400/20" : "text-slate-400 hover:text-slate-600"
                )}
              >
                Inactive
              </button>
            </div>

            <div className="relative group min-w-[320px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500" size={16} />
              <input
                type="text"
                placeholder="Search by company, person or trade..."
                className="h-12 w-full rounded-2xl border border-slate-100 bg-white pl-12 pr-4 text-[13px] font-medium shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500/20 focus:ring-4 focus:ring-blue-500/5"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <button 
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-100 bg-white text-slate-400 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-600 active:scale-95 disabled:opacity-50"
          >
            <RefreshCcw size={18} className={cn(isFetching && "animate-spin")} />
          </button>
        </div>

        {/* Table Area */}
        <div className="p-2">
          {isLoading ? (
            <div className="flex h-[400px] flex-col items-center justify-center gap-4 text-slate-300">
              <RefreshCcw size={40} className="animate-spin opacity-20" />
              <div className="text-sm font-bold uppercase tracking-widest opacity-50">Loading Sub-Contractors...</div>
            </div>
          ) : (
            <AppTable
              data={filtered}
              columns={columns}
              enableSorting={true}
              enablePagination={true}
              defaultPageSize={10}
              emptyMessage="No sub-contractors found matching your search"
            />
          )}
        </div>
      </div>
    </div>
  )
}

export function CreateSubcontractor({ onSuccess, onCancel, editMode, subData }: CreateSubcontractorProps) {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(subData || {
    sub_number: '', company_name: '', contact_person: '', phone: '', email: '', address: '', state: '', gstin: '',
    pincode: '', pan_card: '', bank_name: '', bank_account_number: '', bank_ifsc_code: '', bank_account_type: '',
    previous_projects: '', nature_of_work: '', internal_remarks: '', nda_signed: false, contract_signed: false,
    nda_date: '', contract_date: '', status: 'Active'
  })

  const indianStates = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry']

  // useMutation for creating/updating subcontractor
  const saveSubcontractorMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!organisation?.id) {
        throw new Error('No organization selected');
      }

      const payload = {
        ...data,
        organisation_id: organisation.id,
        // Convert empty strings to null for date fields
        nda_date: data.nda_signed ? (data.nda_date || null) : null,
        contract_date: data.contract_signed ? (data.contract_date || null) : null,
      };

      if (editMode && subData?.id) {
        const { error } = await supabase
          .from('subcontractors')
          .update(payload)
          .eq('id', subData.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('subcontractors')
          .insert(payload);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      // Invalidate and refetch subcontractors list
      queryClient.invalidateQueries({ 
        queryKey: SUBCONTRACTOR_QUERY_KEYS.all() 
      });
      onSuccess();
    },
    onError: (error: any) => {
      console.error('Error saving subcontractor:', error);
      alert('Error saving subcontractor: ' + (error?.message || 'Unknown error'));
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    saveSubcontractorMutation.mutate(formData);
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-700">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">
              {editMode ? 'Edit' : 'Register'} Sub-Contractor
            </h1>
            <p className="text-sm font-medium text-slate-500">
              {editMode ? 'Update existing partner profile' : 'Onboard a new workforce partner to your network'}
            </p>
          </div>
          <button 
            onClick={onCancel}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition-all hover:bg-slate-50 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
          {error && (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-600">
              {error}
            </div>
          )}

          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
            <div className="space-y-8">
              {/* Basic Info Section */}
              <section>
                <div className="mb-6 flex items-center gap-2 border-b border-slate-100 pb-4 text-[11px] font-black uppercase tracking-widest text-slate-400">
                  <Building2 size={14} />
                  Partnership Details
                </div>
                
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-500">Company Name *</label>
                    <input
                      required
                      type="text"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-5 text-[13px] font-bold text-slate-900 outline-none transition-all placeholder:font-medium placeholder:text-slate-300 focus:border-blue-500/30 focus:bg-white focus:ring-4 focus:ring-blue-500/5"
                      value={formData.company_name}
                      onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                      placeholder="e.g. Acme Construction Services"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-500">Contact Person</label>
                    <input
                      type="text"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-5 text-[13px] font-bold text-slate-900 outline-none transition-all placeholder:font-medium placeholder:text-slate-300 focus:border-blue-500/30 focus:bg-white focus:ring-4 focus:ring-blue-500/5"
                      value={formData.contact_person}
                      onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                      placeholder="Primary point of contact"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-500">Primary Phone</label>
                    <input
                      type="tel"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-5 text-[13px] font-bold text-slate-900 outline-none transition-all placeholder:font-medium placeholder:text-slate-300 focus:border-blue-500/30 focus:bg-white focus:ring-4 focus:ring-blue-500/5"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="+91 XXXXX XXXXX"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-500">Corporate Email</label>
                    <input
                      type="email"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-5 text-[13px] font-bold text-slate-900 outline-none transition-all placeholder:font-medium placeholder:text-slate-300 focus:border-blue-500/30 focus:bg-white focus:ring-4 focus:ring-blue-500/5"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="office@partner.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-500">Work Specialty</label>
                    <input
                      type="text"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-5 text-[13px] font-bold text-slate-900 outline-none transition-all placeholder:font-medium placeholder:text-slate-300 focus:border-blue-500/30 focus:bg-white focus:ring-4 focus:ring-blue-500/5"
                      value={formData.nature_of_work}
                      onChange={(e) => setFormData({...formData, nature_of_work: e.target.value})}
                      placeholder="e.g. Electrical, Plumbing, HVAC"
                    />
                  </div>
                </div>
              </section>

              {/* Compliance Section */}
              <section>
                <div className="mb-6 flex items-center gap-2 border-b border-slate-100 pb-4 text-[11px] font-black uppercase tracking-widest text-slate-400">
                  <ShieldCheck size={14} />
                  Legal & Compliance
                </div>
                
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-500">GSTIN</label>
                    <input
                      maxLength={15}
                      type="text"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-5 text-[13px] font-bold text-slate-900 outline-none transition-all placeholder:font-medium placeholder:text-slate-300 focus:border-blue-500/30 focus:bg-white focus:ring-4 focus:ring-blue-500/5"
                      value={formData.gstin}
                      onChange={(e) => setFormData({...formData, gstin: e.target.value.toUpperCase()})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-500">Operating State</label>
                    <select
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-5 text-[13px] font-bold text-slate-900 outline-none transition-all focus:border-blue-500/30 focus:bg-white focus:ring-4 focus:ring-blue-500/5"
                      value={formData.state}
                      onChange={(e) => setFormData({...formData, state: e.target.value})}
                    >
                      <option value="">Select State</option>
                      {indianStates.map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                  </div>

                  <div className="p-4 rounded-3xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">NDA Status</div>
                      <div className="text-sm font-bold text-slate-900">{formData.nda_signed ? 'Executed' : 'Not Signed'}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, nda_signed: !formData.nda_signed})}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        formData.nda_signed ? 'bg-blue-600' : 'bg-slate-200'
                      )}
                    >
                      <span className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        formData.nda_signed ? 'translate-x-6' : 'translate-x-1'
                      )} />
                    </button>
                  </div>

                  <div className="p-4 rounded-3xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">Status</div>
                      <div className="text-sm font-bold text-slate-900">{formData.status}</div>
                    </div>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="bg-transparent font-bold text-xs text-blue-600 outline-none"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Remarks */}
              <section>
                <div className="mb-6 flex items-center gap-2 border-b border-slate-100 pb-4 text-[11px] font-black uppercase tracking-widest text-slate-400">
                  <FileText size={14} />
                  Additional Information
                </div>
                <textarea
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-5 text-[13px] font-bold text-slate-900 outline-none transition-all placeholder:font-medium placeholder:text-slate-300 focus:border-blue-500/30 focus:bg-white focus:ring-4 focus:ring-blue-500/5 resize-none"
                  rows={4}
                  value={formData.internal_remarks}
                  onChange={(e) => setFormData({...formData, internal_remarks: e.target.value})}
                  placeholder="Any internal notes, performance remarks or site-specific constraints..."
                ></textarea>
              </section>
            </div>
          </div>

          <div className="flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={onCancel}
              className="h-12 rounded-2xl px-8 text-sm font-bold text-slate-500 transition-colors hover:text-slate-900"
            >
              Discard Changes
            </button>
            <button
              type="submit"
              disabled={saveSubcontractorMutation.isPending}
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-slate-900 px-10 text-[13px] font-black uppercase tracking-widest text-white shadow-xl shadow-slate-900/20 transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-50"
            >
              {saveSubcontractorMutation.isPending ? (
                <RefreshCcw className="h-4 w-4 animate-spin" />
              ) : (
                <Save size={18} />
              )}
              {editMode ? 'Update Partner' : 'Confirm Registration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function SubcontractorView({ onNavigate }: WithNavigate) {
  const { organisation } = useAuth();
  const [sub, setSub] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('details')
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [dailyLogs, setDailyLogs] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])

  useEffect(() => {
    const id = getCurrentQueryParams().get('id')
    if (id && organisation?.id) {
      supabase.from('subcontractors').select('*').eq('id', id).eq('organisation_id', organisation.id).single().then(({ data }) => setSub(data))
      supabase.from('subcontractor_work_orders').select('*').eq('subcontractor_id', id).eq('organisation_id', organisation.id).then(({ data }) => setWorkOrders(data || []))
      supabase.from('subcontractor_attendance').select('*').eq('subcontractor_id', id).eq('organisation_id', organisation.id).order('attendance_date', { ascending: false }).then(({ data }) => setAttendance(data || []))
      supabase.from('subcontractor_daily_logs').select('*').eq('subcontractor_id', id).eq('organisation_id', organisation.id).order('log_date', { ascending: false }).then(({ data }) => setDailyLogs(data || []))
      supabase.from('subcontractor_payments').select('*').eq('subcontractor_id', id).eq('organisation_id', organisation.id).order('payment_date', { ascending: false }).then(({ data }) => setPayments(data || []))
      supabase.from('subcontractor_invoices').select('*').eq('subcontractor_id', id).eq('organisation_id', organisation.id).order('invoice_date', { ascending: false }).then(({ data }) => setInvoices(data || []))
    }
  }, [organisation?.id])

  if (!sub) return (
    <div className="flex h-screen items-center justify-center bg-[#f8fafc]">
      <RefreshCcw className="animate-spin text-blue-500" size={40} />
    </div>
  )

  const tabs = [
    { id: 'details', label: 'Partner Profile', icon: Building2 },
    { id: 'workorders', label: `Work Orders (${workOrders.length})`, icon: Briefcase },
    { id: 'attendance', label: `Force Count (${attendance.length})`, icon: Users },
    { id: 'ledger', label: 'Financial Ledger', icon: FileText },
    { id: 'dailylogs', label: 'Daily Reports', icon: FileSignature },
    { id: 'payments', label: 'Payout History', icon: CheckCircle },
  ]

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10">
      <div className="mx-auto max-w-7xl">
        {/* Profile Header */}
        <div className="mb-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="flex items-start gap-6">
            <div className="flex h-24 w-24 items-center justify-center rounded-[2rem] bg-white shadow-2xl shadow-slate-200/60 transition-transform hover:scale-105">
              <Building2 size={40} className="text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-black tracking-tight text-slate-900">{sub.company_name}</h1>
                <div className={cn(
                  "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest",
                  sub.status === 'Active' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-slate-100 text-slate-500 border border-slate-200"
                )}>
                  {sub.status}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-sm font-bold text-slate-400">
                <div className="flex items-center gap-1.5 border-r border-slate-200 pr-4">
                  <User size={14} className="text-slate-300" />
                  {sub.contact_person || 'No Contact'}
                </div>
                <div className="flex items-center gap-1.5 border-r border-slate-200 pr-4">
                  <Briefcase size={14} className="text-slate-300" />
                  {sub.nature_of_work || 'General Works'}
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin size={14} className="text-slate-300" />
                  {sub.state || 'Unknown Territory'}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => onNavigate('/subcontractors')}
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 text-[13px] font-bold text-slate-600 transition-all hover:bg-slate-50 active:scale-95"
            >
              Partner List
            </button>
            <button 
              onClick={() => { window.subToEdit = sub; onNavigate('/subcontractors/edit?id=' + sub.id) }}
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-slate-900 px-6 text-[13px] font-black uppercase tracking-widest text-white shadow-xl shadow-slate-900/20 transition-all hover:bg-slate-800 active:scale-95"
            >
              Edit Profile
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8 flex flex-wrap gap-2 rounded-[2rem] border border-slate-200 bg-white p-2 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-700 delay-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 rounded-[1.5rem] px-6 py-3 text-[12px] font-black uppercase tracking-widest transition-all",
                activeTab === tab.id 
                  ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20" 
                  : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              )}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Area */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          {activeTab === 'details' && (
            <div className="grid gap-8 lg:grid-cols-3">
              {/* Contact Card */}
              <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40">
                <h3 className="mb-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Communication</h3>
                <div className="space-y-6">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-widest text-blue-600 opacity-60">Corporate Email</div>
                    <div className="mt-1 flex items-center gap-3 font-black text-slate-900">{sub.email || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-widest text-blue-600 opacity-60">Primary Phone</div>
                    <div className="mt-1 flex items-center gap-3 font-black text-slate-900">{sub.phone || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-widest text-blue-600 opacity-60">GST Identification</div>
                    <div className="mt-1 font-black text-slate-900 tracking-wider transition-all hover:text-blue-600 cursor-default">{sub.gstin || 'No GST Details'}</div>
                  </div>
                </div>
              </div>

              {/* Compliance Card */}
              <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40">
                <h3 className="mb-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Compliance Status</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-2xl bg-blue-50/50 p-4 border border-blue-100/50">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className={cn("h-8 w-8", sub.nda_signed ? "text-blue-600" : "text-slate-300")} />
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-blue-600">NDA Status</div>
                        <div className="text-sm font-black text-slate-900">{sub.nda_signed ? 'Executed' : 'Pending'}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-indigo-50/50 p-4 border border-indigo-100/50">
                    <div className="flex items-center gap-3">
                      <FileSignature className={cn("h-8 w-8", sub.contract_signed ? "text-indigo-600" : "text-slate-300")} />
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Master Contract</div>
                        <div className="text-sm font-black text-slate-900">{sub.contract_signed ? 'Active' : 'Missing'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Address / Misc */}
              <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40 lg:col-span-1">
                <h3 className="mb-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Headquarters</h3>
                <div className="text-sm font-medium leading-relaxed text-slate-500">
                  {sub.address || 'Direct address not specified'}
                  <br />
                  <span className="mt-2 block font-black text-slate-900">{sub.state} {sub.pincode ? `, ${sub.pincode}` : ''}</span>
                </div>
                <div className="mt-8 pt-6 border-t border-slate-100">
                  <h3 className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-400">Internal Remarks</h3>
                  <div className="text-[13px] font-bold text-slate-600 bg-slate-50 p-4 rounded-2xl leading-relaxed italic border border-slate-100">
                    {sub.internal_remarks || 'No notes on this partner.'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'workorders' && (
            <div className="rounded-[2.5rem] border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/40">
              <AppTable
                data={workOrders}
                columns={[
                  { header: 'Order #', accessorKey: 'work_order_no', cell: (i:any)=><span className="font-black text-blue-600">{i.getValue()}</span> },
                  { header: 'Description', accessorKey: 'work_description', cell:(i:any)=><span className="font-bold text-slate-900 line-clamp-1">{i.getValue()}</span> },
                  { header: 'Timeline', accessorKey: 'start_date', cell: ({row}:any) => <span className="text-xs font-bold text-slate-400">{row.original.start_date} → {row.original.end_date}</span> },
                  { header: 'Value', accessorKey: 'contract_value', cell: (i:any)=><span className="font-black text-slate-900">₹{i.getValue()}</span> },
                  { header: 'Status', accessorKey: 'status', cell: (i:any)=><span className="text-[10px] font-black uppercase tracking-widest text-blue-500 bg-blue-50 px-2.5 py-1 rounded-full">{i.getValue()}</span> }
                ]}
                emptyMessage="No work orders issued yet."
              />
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="rounded-[2.5rem] border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/40">
              <AppTable
                data={attendance}
                columns={[
                  { header: 'Date', accessorKey: 'attendance_date', cell:(i:any)=><span className="font-black text-slate-900">{i.getValue()}</span> },
                  { header: 'Workers', accessorKey: 'workers_count', cell:(i:any)=><div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 font-bold text-white text-[11px]">{i.getValue()}</div> },
                  { header: 'Supervisor', accessorKey: 'supervisor_name', cell:(i:any)=><span className="font-bold text-slate-600">{i.getValue() || '-'}</span> },
                  { header: 'Remarks', accessorKey: 'remarks', cell:(i:any)=><span className="text-xs font-bold text-slate-400 line-clamp-1 italic">{i.getValue() || '-'}</span> }
                ]}
                emptyMessage="No daily records found."
              />
            </div>
          )}

          {activeTab === 'dailylogs' && (
            <div className="rounded-[2.5rem] border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/40">
              <AppTable
                data={dailyLogs}
                columns={[
                  { header: 'Log Date', accessorKey: 'log_date', cell:(i:any)=><span className="font-black text-slate-900">{i.getValue()}</span> },
                  { header: 'Work Progress', accessorKey: 'work_done', cell:(i:any)=><span className="font-bold text-slate-700">{i.getValue()}</span> },
                  { header: 'Safety/Issues', cell:({row}:any)=><div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">{row.original.delays || 'No Delays'}</span>
                    <span className="mx-2 text-slate-200">|</span>
                    <span className={cn("text-xs font-bold", row.original.safety_incidents ? "text-red-500":"text-emerald-500")}>{row.original.safety_incidents || 'No Incidents'}</span>
                  </div> }
                ]}
                emptyMessage="No progress logs recorded."
              />
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="rounded-[2.5rem] border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/40">
              <AppTable
                data={payments}
                columns={[
                  { header: 'Payment Date', accessorKey: 'payment_date', cell:(i:any)=><span className="font-black text-slate-900">{i.getValue()}</span> },
                  { header: 'Amount', accessorKey: 'amount', cell:(i:any)=><span className="text-lg font-black text-emerald-600">₹{i.getValue()}</span> },
                  { header: 'Method', accessorKey: 'payment_mode', cell:(i:any)=><span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">{i.getValue()}</span> },
                  { header: 'Ref No', accessorKey: 'reference_no', cell:(i:any)=><span className="font-mono text-xs font-bold text-blue-500 bg-blue-50/50 px-2 py-1 rounded-lg">{i.getValue()}</span> }
                ]}
                emptyMessage="No payment history available."
              />
            </div>
          )}

          {activeTab === 'ledger' && sub && (
            <div className="rounded-[2.5rem] border border-slate-200 bg-white overflow-hidden shadow-xl shadow-slate-200/40">
              <SubcontractorLedger
                subcontractorId={sub.id}
                subcontractorName={sub.company_name}
                onBack={() => setActiveTab('details')}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function SubcontractorEdit({ onNavigate }: WithNavigate) {
  const { organisation } = useAuth();
  const [sub, setSub] = useState(null)
  useEffect(() => {
    const id = getCurrentQueryParams().get('id')
    if (id && organisation?.id) supabase.from('subcontractors').select('*').eq('id', id).eq('organisation_id', organisation.id).single().then(({ data }) => setSub(data))
  }, [organisation?.id])
  if (!sub) return <div className="flex h-screen items-center justify-center"><RefreshCcw className="animate-spin text-blue-500" /></div>
  return <CreateSubcontractor onSuccess={() => onNavigate('/subcontractors')} onCancel={() => onNavigate('/subcontractors')} editMode={true} subData={sub} />
}

export function SubcontractorAttendance({ onNavigate }: WithNavigate) {
  const { organisation } = useAuth();
  const [subcontractors, setSubcontractors] = useState<any[]>([])
  const [subId, setSubId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [workers, setWorkers] = useState(1)
  const [supervisor, setSupervisor] = useState('')
  const [remarks, setRemarks] = useState('')
  const [records, setRecords] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { 
    if (organisation?.id) {
      supabase.from('subcontractors').select('*').eq('organisation_id', organisation.id).order('company_name').then(({ data }) => setSubcontractors(data || [])) 
    }
  }, [organisation?.id])

  const loadRecords = async () => {
    if (subId && organisation?.id) {
      const { data } = await supabase.from('subcontractor_attendance').select('*').eq('subcontractor_id', subId).eq('organisation_id', organisation.id).order('attendance_date', { ascending: false })
      setRecords(data || [])
    }
  }

  useEffect(() => { if (subId) loadRecords() }, [subId])

  const saveAttendance = async () => {
    if (!subId || !organisation?.id) return
    setSaving(true)
    await supabase.from('subcontractor_attendance').insert({ organisation_id: organisation.id, subcontractor_id: subId, attendance_date: date, workers_count: workers, supervisor_name: supervisor, remarks })
    setSaving(false)
    loadRecords()
    setRemarks('')
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 tracking-tight">Daily Workforce Count</h1>
            <p className="font-medium text-slate-400">Log and monitor sub-contractor headcounts across sites</p>
          </div>
          <button onClick={() => onNavigate('/subcontractors')} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
              <h3 className="mb-6 text-[11px] font-black uppercase tracking-widest text-slate-400 pb-4 border-b border-slate-100">Logging Form</h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Partner</label>
                  <select className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-500" value={subId} onChange={e => setSubId(e.target.value)}>
                    <option value="">Select Partner</option>
                    {subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Date</label>
                  <input type="date" className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs font-bold text-slate-900 outline-none focus:bg-white" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Workers</label>
                    <input type="number" className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs font-bold text-slate-900 outline-none focus:bg-white" value={workers} onChange={e => setWorkers(parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Supervisor</label>
                    <input type="text" className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs font-bold text-slate-900 outline-none focus:bg-white" value={supervisor} onChange={e => setSupervisor(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Remarks</label>
                  <textarea className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:bg-white resize-none" rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Notes..." />
                </div>
                <button 
                  onClick={saveAttendance} 
                  disabled={saving || !subId}
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-2xl bg-slate-900 text-[11px] font-black uppercase tracking-widest text-white hover:bg-slate-800 transition-all disabled:opacity-50"
                >
                  {saving ? <RefreshCcw className="animate-spin h-3.3 w-3.5" /> : <Save size={14} />}
                  Capture Log
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-[2rem] border border-slate-200 bg-white overflow-hidden shadow-xl shadow-slate-200/50">
              <AppTable
                data={records}
                columns={[
                  { header: 'Date', accessorKey: 'attendance_date', cell:(i:any)=><span className="font-black text-slate-900">{i.getValue()}</span> },
                  { header: 'Workers', accessorKey: 'workers_count', cell:(i:any)=><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 font-black text-blue-600 text-[10px] uppercase border border-blue-100">{i.getValue()}</div> },
                  { header: 'Supervisor', accessorKey: 'supervisor_name', cell:(i:any)=><span className="text-xs font-bold text-slate-600">{i.getValue() || '-'}</span> },
                  { header: 'Remarks', accessorKey: 'remarks', cell:(i:any)=><span className="text-[11px] font-medium text-slate-400 italic line-clamp-1">{i.getValue() || '-'}</span> }
                ]}
                emptyMessage="Select a partner to view attendance cycles."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function SubcontractorWorkOrders({ onNavigate }: WithNavigate) {
  const { organisation } = useAuth();
  const [subcontractors, setSubcontractors] = useState<any[]>([])
  const [subId, setSubId] = useState('')
  const [woNo, setWoNo] = useState('')
  const [desc, setDesc] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [value, setValue] = useState('')
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { 
    if (organisation?.id) {
      supabase.from('subcontractors').select('*').eq('organisation_id', organisation.id).order('company_name').then(({ data }) => setSubcontractors(data || [])) 
    }
  }, [organisation?.id])

  const loadWOs = async () => {
    if (subId && organisation?.id) {
      const { data } = await supabase.from('subcontractor_work_orders').select('*').eq('subcontractor_id', subId).eq('organisation_id', organisation.id).order('created_at', { ascending: false })
      setWorkOrders(data || [])
    }
  }

  useEffect(() => { if (subId) loadWOs() }, [subId])

  const saveWO = async () => {
    if (!subId || !woNo || !organisation?.id) return
    setSaving(true)
    await supabase.from('subcontractor_work_orders').insert({ organisation_id: organisation.id, subcontractor_id: subId, work_order_no: woNo, work_description: desc, start_date: startDate, end_date: endDate, contract_value: value, status: 'Pending' })
    setSaving(false)
    loadWOs()
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Work Orders</h1>
            <p className="font-medium text-slate-400">Issue and track task-specific contracts for partners</p>
          </div>
          <button onClick={() => onNavigate('/subcontractors')} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-10 lg:grid-cols-4">
          <div className="lg:col-span-1">
             <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50 space-y-4">
               <h3 className="mb-4 text-[11px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-3">New Contract</h3>
               <div className="space-y-3">
                 <select className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs font-bold text-slate-900" value={subId} onChange={e => setSubId(e.target.value)}>
                    <option value="">Select Partner</option>
                    {subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                 </select>
                 <input placeholder="Contract # / WO #" className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs font-bold text-slate-900 outline-none" value={woNo} onChange={e => setWoNo(e.target.value)} />
                 <textarea placeholder="Job Description" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-900 outline-none resize-none" rows={3} value={desc} onChange={e => setDesc(e.target.value)} />
                 <input type="number" placeholder="Contract Value" className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs font-bold text-slate-900 outline-none" value={value} onChange={e => setValue(e.target.value)} />
                 <button onClick={saveWO} disabled={saving || !subId} className="w-full h-11 flex items-center justify-center gap-2 rounded-2xl bg-slate-900 text-[11px] font-black uppercase tracking-widest text-white shadow-lg active:scale-95 disabled:opacity-50">
                    {saving ? <RefreshCcw className="animate-spin h-3.3 w-3.5" /> : <Plus size={14} />}
                    Issue Order
                 </button>
               </div>
             </div>
          </div>
          <div className="lg:col-span-3">
            <div className="rounded-[2rem] border border-slate-200 bg-white overflow-hidden shadow-xl shadow-slate-200/50">
               <AppTable
                 data={workOrders}
                 columns={[
                   { header: 'Order ID', accessorKey: 'work_order_no', cell:(i:any)=><b className="text-blue-600 font-black tracking-tight uppercase text-[11px]">{i.getValue()}</b> },
                   { header: 'Job Details', accessorKey: 'work_description', cell:(i:any)=><span className="text-xs font-bold text-slate-900">{i.getValue()}</span> },
                   { header: 'Value', accessorKey: 'contract_value', cell:(i:any)=><span className="font-black text-slate-900 italic">₹{i.getValue()}</span> },
                   { header: 'Status', accessorKey: 'status', cell:(i:any)=><span className="text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 px-3 py-1 rounded-full">{i.getValue()}</span> }
                 ]}
                 emptyMessage="Select a partner to view assigned work packages."
               />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function SubcontractorDailyLogs({ onNavigate }: WithNavigate) { return <SubcontractorAttendance onNavigate={onNavigate} /> }
export function SubcontractorPayments({ onNavigate }: WithNavigate) { return <SubcontractorWorkOrders onNavigate={onNavigate} /> }
export function SubcontractorInvoices({ onNavigate }: WithNavigate) { return <SubcontractorWorkOrders onNavigate={onNavigate} /> }

export function SubcontractorDocuments({ onNavigate }: WithNavigate) {
  const { organisation } = useAuth();
  const [subcontractors, setSubcontractors] = useState<any[]>([])
  const [subId, setSubId] = useState('')
  const [documents, setDocuments] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => { 
    if (organisation?.id) {
      supabase.from('subcontractors').select('*').eq('organisation_id', organisation.id).order('company_name').then(({ data }) => setSubcontractors(data || [])) 
    }
  }, [organisation?.id])

  const loadDocuments = async () => {
    if (subId && organisation?.id) {
      const { data } = await supabase.from('subcontractor_documents').select('*').eq('subcontractor_id', subId).eq('organisation_id', organisation.id).order('created_at', { ascending: false })
      setDocuments(data || [])
    }
  }

  useEffect(() => { if (subId) loadDocuments() }, [subId])

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[]
    if (!subId || !organisation?.id) return
    setUploading(true)
    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const fileName = `sub_${Date.now()}_${file.name.replace(/\s+/g, '_')}`
        const { data, error } = await supabase.storage.from('subcontractor-documents').upload(fileName, new Uint8Array(arrayBuffer), { contentType: file.type })
        if (!error && data) {
          const { data: urlData } = supabase.storage.from('subcontractor-documents').getPublicUrl(fileName)
          await supabase.from('subcontractor_documents').insert({ organisation_id: organisation.id, subcontractor_id: subId, document_name: file.name, document_url: urlData.publicUrl, document_type: file.type })
        }
      } catch (err) {}
    }
    setUploading(false)
    loadDocuments()
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex items-center justify-between">
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Document Vault</h1>
            <button onClick={() => onNavigate('/subcontractors')} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400">
              <X size={20} />
            </button>
        </div>

        <div className="rounded-[2.5rem] border border-slate-200 bg-white p-10 shadow-xl shadow-slate-200/50">
          <div className="mb-10 flex flex-wrap items-center gap-6">
            <div className="flex-1 min-w-[300px]">
              <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1 mb-2 block">Partner Selection</label>
              <select className="h-14 w-full rounded-2xl border border-slate-100 bg-slate-50 px-6 text-sm font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-500 transition-all shadow-inner" value={subId} onChange={e => setSubId(e.target.value)}>
                <option value="">Select a partner to access vault...</option>
                {subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
              </select>
            </div>
            {subId && (
              <div className="flex-none pt-6">
                <label className="relative flex h-14 cursor-pointer items-center gap-3 rounded-2xl bg-blue-600 px-8 text-[13px] font-black uppercase tracking-widest text-white shadow-xl shadow-blue-500/30 transition-all hover:bg-blue-700 active:scale-95">
                  <Plus size={18} />
                  {uploading ? 'Archiving...' : 'Add Documents'}
                  <input type="file" className="hidden" multiple onChange={handleUpload} disabled={uploading} />
                </label>
              </div>
            )}
          </div>

          {!subId ? (
            <div className="flex h-[300px] flex-col items-center justify-center gap-4 text-slate-300">
              <ShieldCheck size={48} className="opacity-20" />
              <p className="text-sm font-bold uppercase tracking-[0.2em] opacity-50">Select Partner to Unlock Vault</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
               {documents.map(doc => (
                 <div key={doc.id} className="group relative rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-blue-100 hover:shadow-xl hover:shadow-blue-500/5">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-500 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                      <FileText size={20} />
                    </div>
                    <div className="line-clamp-2 text-[13px] font-black text-slate-900 leading-tight mb-4">{doc.document_name}</div>
                    <a href={doc.document_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800">
                      View Asset <ChevronRight size={14} />
                    </a>
                 </div>
               ))}
               {documents.length === 0 && (
                 <div className="col-span-full py-20 text-center">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No documents archived yet.</p>
                 </div>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


