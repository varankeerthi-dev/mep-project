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
import { EnhancedDataTable } from '../components/ui/table/index';
import { AppTable } from '../components/ui/AppTable';
import { cn } from '../lib/utils';
import type { ColumnDef } from '@tanstack/react-table';

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
        className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-[13px] font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        form="subcontractor-form"
        disabled={saveSubcontractorMutation.isPending || !formData.company_name.trim()}
        className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
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
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            <Building2 size={14} />
            Company Information
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Sub Number - Read Only */}
            {formData.sub_number && (
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-zinc-700">Sub Number</label>
                <input
                  type="text"
                  value={formData.sub_number}
                  disabled
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-[13px] text-zinc-700 outline-none cursor-not-allowed"
                />
              </div>
            )}

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-[12px] font-medium text-zinc-700">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                placeholder="Enter company name"
                className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-[13px] text-zinc-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 placeholder:text-zinc-400"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-zinc-700">Contact Person</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                  placeholder="Contact person name"
                  className="w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-4 py-2.5 text-[13px] text-zinc-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 placeholder:text-zinc-400"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-zinc-700">Phone</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="Phone number"
                  className="w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-4 py-2.5 text-[13px] text-zinc-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 placeholder:text-zinc-400"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-zinc-700">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="email@company.com"
                  className="w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-4 py-2.5 text-[13px] text-zinc-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 placeholder:text-zinc-400"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-zinc-700">GSTIN</label>
              <input
                type="text"
                value={formData.gstin}
                onChange={(e) => setFormData({...formData, gstin: e.target.value.toUpperCase()})}
                placeholder="15 character GSTIN"
                maxLength={15}
                className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-[13px] text-zinc-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 placeholder:text-zinc-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-zinc-700">State</label>
              <select
                value={formData.state}
                onChange={(e) => setFormData({...formData, state: e.target.value})}
                className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-[13px] text-zinc-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5"
              >
                <option value="">Select State</option>
                {indianStates.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-zinc-700">PIN Code</label>
              <input
                type="text"
                value={formData.pincode}
                onChange={(e) => setFormData({...formData, pincode: e.target.value})}
                placeholder="6 digit PIN code"
                maxLength={6}
                className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-[13px] text-zinc-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 placeholder:text-zinc-400"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-zinc-700">Address</label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-3 text-zinc-400" />
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                placeholder="Full address"
                rows={2}
                className="w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-4 py-2.5 text-[13px] text-zinc-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 placeholder:text-zinc-400 resize-none"
              />
            </div>
          </div>

          {/* PAN & Bank Details */}
          <div className="space-y-4 pt-4 border-t border-zinc-100">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              <FileText size={14} />
              PAN & Bank Details
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-zinc-700">PAN Card</label>
                <input
                  type="text"
                  value={formData.pan_card}
                  onChange={(e) => setFormData({...formData, pan_card: e.target.value.toUpperCase()})}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-[13px] text-zinc-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 placeholder:text-zinc-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-zinc-700">Bank Name</label>
                <input
                  type="text"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
                  placeholder="e.g., State Bank of India"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-[13px] text-zinc-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 placeholder:text-zinc-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-zinc-700">Account Number</label>
                <input
                  type="text"
                  value={formData.bank_account_number}
                  onChange={(e) => setFormData({...formData, bank_account_number: e.target.value})}
                  placeholder="Bank account number"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-[13px] text-zinc-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 placeholder:text-zinc-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-zinc-700">IFSC Code</label>
                <input
                  type="text"
                  value={formData.bank_ifsc_code}
                  onChange={(e) => setFormData({...formData, bank_ifsc_code: e.target.value.toUpperCase()})}
                  placeholder="SBIN0001234"
                  maxLength={11}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-[13px] text-zinc-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 placeholder:text-zinc-400"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-[12px] font-medium text-zinc-700">Account Type</label>
                <select
                  value={formData.bank_account_type}
                  onChange={(e) => setFormData({...formData, bank_account_type: e.target.value})}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-[13px] text-zinc-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5"
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
        <div className="space-y-4 pt-4 border-t border-zinc-100">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            <Briefcase size={14} />
            Work Details
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-zinc-700">Nature of Work</label>
              <input
                type="text"
                value={formData.nature_of_work}
                onChange={(e) => setFormData({...formData, nature_of_work: e.target.value})}
                placeholder="e.g., Electrical, Plumbing, HVAC"
                className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-[13px] text-zinc-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 placeholder:text-zinc-400"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-zinc-700">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
                className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-[13px] text-zinc-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-[12px] font-medium text-zinc-700">Previous Projects</label>
              <textarea
                value={formData.previous_projects}
                onChange={(e) => setFormData({...formData, previous_projects: e.target.value})}
                placeholder="List previous projects completed by this subcontractor..."
                rows={3}
                className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-[13px] text-zinc-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 placeholder:text-zinc-400 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Documents & Agreements */}
        <div className="space-y-4 pt-4 border-t border-zinc-100">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            <FileText size={14} />
            Documents & Agreements
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-medium text-zinc-700">NDA Signed</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, nda_signed: !formData.nda_signed})}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      formData.nda_signed ? 'bg-emerald-500' : 'bg-zinc-200'
                    )}
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      formData.nda_signed ? 'translate-x-6' : 'translate-x-1'
                    )} />
                  </button>
                  <span className="text-[12px] text-zinc-600 font-medium w-8">
                    {formData.nda_signed ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
              {formData.nda_signed && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="text-[12px] font-medium text-zinc-700">NDA Date</label>
                  <input
                    type="date"
                    value={formData.nda_date}
                    onChange={(e) => setFormData({...formData, nda_date: e.target.value})}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-[13px] text-zinc-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5"
                  />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-medium text-zinc-700">Contract Signed</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, contract_signed: !formData.contract_signed})}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      formData.contract_signed ? 'bg-emerald-500' : 'bg-zinc-200'
                    )}
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      formData.contract_signed ? 'translate-x-6' : 'translate-x-1'
                    )} />
                  </button>
                  <span className="text-[12px] text-zinc-600 font-medium w-8">
                    {formData.contract_signed ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
              {formData.contract_signed && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="text-[12px] font-medium text-zinc-700">Contract Date</label>
                  <input
                    type="date"
                    value={formData.contract_date}
                    onChange={(e) => setFormData({...formData, contract_date: e.target.value})}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-[13px] text-zinc-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Internal Remarks */}
        <div className="space-y-4 pt-4 border-t border-zinc-100">
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-zinc-700">Internal Remarks</label>
            <textarea
              value={formData.internal_remarks}
              onChange={(e) => setFormData({...formData, internal_remarks: e.target.value})}
              placeholder="Any internal notes or remarks..."
              rows={3}
              className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-[13px] text-zinc-900 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 placeholder:text-zinc-400 resize-none"
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

  const columns: ColumnDef<any>[] = useMemo(() => [
    {
      id: 'sub_number',
      header: 'Sub ID',
      accessorKey: 'sub_number',
      cell: (info) => (
        <span className="font-black tracking-tight text-blue-600 uppercase text-[11px] pl-5">{info.getValue() || '-'}</span>
      )
    },
    {
      id: 'company_name',
      header: 'Company & Contact',
      accessorKey: 'company_name',
      cell: (info) => (
        <div className="flex flex-col">
          <span className="font-bold text-zinc-900">{info.getValue()}</span>
          <span className="text-xs text-zinc-400 font-medium">{info.row.original.contact_person || 'No contact person'}</span>
        </div>
      )
    },
    {
      id: 'phone',
      header: 'Contact Info',
      accessorKey: 'phone',
      cell: (info) => (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600">
            <Phone size={10} className="text-zinc-300" />
            {info.getValue() || '-'}
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
            <Mail size={10} className="text-zinc-300" />
            {info.row.original.email || '-'}
          </div>
        </div>
      )
    },
    {
      id: 'nature_of_work',
      header: 'Nature of Work',
      accessorKey: 'nature_of_work',
      cell: (info) => (
        <div className="flex items-center gap-1.5">
          <Briefcase size={12} className="text-zinc-300" />
          <span className="truncate max-w-[150px] font-medium text-zinc-600">{info.getValue() || '-'}</span>
        </div>
      )
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      cell: (info) => (
        <div className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest",
          info.getValue() === 'Active' ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"
        )}>
          <div className={cn("h-1.5 w-1.5 rounded-full", info.getValue() === 'Active' ? "bg-emerald-500" : "bg-zinc-400")} />
          {info.getValue()}
        </div>
      )
    },
    {
      id: 'compliance',
      header: 'Compliance',
      accessorKey: 'id',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.nda_signed ? (
            <div title="NDA Signed" className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-500">
              <ShieldCheck size={14} />
            </div>
          ) : (
            <div title="NDA Missing" className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-50 text-zinc-300">
              <ShieldCheck size={14} />
            </div>
          )}
          {row.original.contract_signed ? (
            <div title="Contract Signed" className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500">
              <FileSignature size={14} />
            </div>
          ) : (
            <div title="Contract Missing" className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-50 text-zinc-300">
              <FileSignature size={14} />
            </div>
          )}
        </div>
      )
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex justify-end">
          <button
            onClick={() => { window.subToView = row.original; onNavigate('/subcontractors/view?id=' + row.original.id) }}
            className="flex h-8 w-12 items-center justify-center rounded-xl border border-zinc-100 bg-white text-zinc-400 shadow-sm transition-all hover:border-blue-200 hover:text-blue-600 hover:shadow-md active:scale-95"
          >
            <Eye size={16} />
          </button>
        </div>
      )
    }
  ], [onNavigate]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '24px',
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 style={{
                fontSize: '24px',
                fontWeight: 600,
                color: '#171717',
                margin: 0,
              }}>
                Sub-Contractors
              </h1>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#eff6ff',
                padding: '4px 12px',
                borderRadius: '9999px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#2563eb',
                textTransform: 'uppercase',
              }}>
                <Users size={12} />
                {subcontractors.length} Registered
              </div>
            </div>
            <p style={{
              fontSize: '14px',
              color: '#737373',
              margin: '4px 0 0 0',
            }}>
              Manage workforce partners, compliance, and performance tracking
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => onNavigate('/subcontractors/attendance')}
              style={{
                padding: '10px 20px',
                border: '1px solid #e5e5e5',
                borderRadius: '4px',
                background: '#fff',
                color: '#525252',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
            >
              Attendance
            </button>
            <button
              onClick={() => onNavigate('/subcontractors/new')}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '4px',
                background: '#171717',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#262626'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#171717'}
            >
              <Plus size={16} />
              Add Sub-Contractor
            </button>
          </div>
        </div>

        {/* Main Container */}
        <div style={{
          background: '#fff',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
        }}>
          {/* Filter & Search Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #e5e5e5',
            gap: '16px',
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{
                display: 'flex',
                background: '#fff',
                border: '1px solid #e5e5e5',
                borderRadius: '4px',
                padding: '4px',
              }}>
                <button
                  onClick={() => setFilter('all')}
                  style={{
                    padding: '6px 16px',
                    border: 'none',
                    borderRadius: '4px',
                    background: filter === 'all' ? '#171717' : 'transparent',
                    color: filter === 'all' ? '#fff' : '#737373',
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => filter !== 'all' && (e.currentTarget.style.background = '#f5f5f5')}
                  onMouseLeave={(e) => filter !== 'all' && (e.currentTarget.style.background = 'transparent')}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter('active')}
                  style={{
                    padding: '6px 16px',
                    border: 'none',
                    borderRadius: '4px',
                    background: filter === 'active' ? '#059669' : 'transparent',
                    color: filter === 'active' ? '#fff' : '#737373',
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => filter !== 'active' && (e.currentTarget.style.background = '#f5f5f5')}
                  onMouseLeave={(e) => filter !== 'active' && (e.currentTarget.style.background = 'transparent')}
                >
                  Active
                </button>
                <button
                  onClick={() => setFilter('inactive')}
                  style={{
                    padding: '6px 16px',
                    border: 'none',
                    borderRadius: '4px',
                    background: filter === 'inactive' ? '#9ca3af' : 'transparent',
                    color: filter === 'inactive' ? '#fff' : '#737373',
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => filter !== 'inactive' && (e.currentTarget.style.background = '#f5f5f5')}
                  onMouseLeave={(e) => filter !== 'inactive' && (e.currentTarget.style.background = 'transparent')}
                >
                  Inactive
                </button>
              </div>

              <div style={{ position: 'relative', minWidth: '300px' }}>
                <Search style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#a3a3a3',
                }} size={16} />
                <input
                  type="text"
                  placeholder="Search by company, person or trade..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 40px',
                    border: '1px solid #d4d4d4',
                    borderRadius: '4px',
                    fontSize: '14px',
                    color: '#171717',
                  }}
                />
              </div>
            </div>

            <button
              onClick={() => refetch()}
              disabled={isFetching}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                border: '1px solid #e5e5e5',
                borderRadius: '4px',
                background: '#fff',
                color: '#525252',
                cursor: isFetching ? 'not-allowed' : 'pointer',
                opacity: isFetching ? 0.6 : 1,
              }}
              onMouseEnter={(e) => !isFetching && (e.currentTarget.style.background = '#f5f5f5')}
              onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
            >
              <RefreshCcw size={18} style={isFetching ? { animation: 'spin 1s linear infinite' } : {}} />
            </button>
          </div>

          {/* Table Area */}
          <div style={{ padding: '8px' }}>
            <EnhancedDataTable
              data={filtered}
              columns={columns}
              enableSearch={false}
              enableSorting={true}
              enablePagination={true}
              defaultPageSize={10}
              emptyMessage="No sub-contractors found matching your search"
              loading={isLoading}
              onRowClick={(row) => { window.subToView = row; onNavigate('/subcontractors/view?id=' + row.id) }}
            />
          </div>
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
  const [error, setError] = useState('')
  const [documents, setDocuments] = useState({
    pan_card_doc: null as File | null,
    bank_passbook_doc: null as File | null,
    aadhar_card_doc: null as File | null,
  })
  const [teamMembers, setTeamMembers] = useState([
    { name: '', mobile: '', aadhar_number: '' }
  ])

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
    setError('');
    saveSubcontractorMutation.mutate(formData);
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '24px',
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}>
          <div>
            <h1 style={{
              fontSize: '24px',
              fontWeight: 600,
              color: '#171717',
              margin: 0,
            }}>
              {editMode ? 'Edit' : 'Register'} Sub-Contractor
            </h1>
            <p style={{
              fontSize: '14px',
              color: '#737373',
              margin: '4px 0 0 0',
            }}>
              {editMode ? 'Update existing partner profile' : 'Onboard a new workforce partner to your network'}
            </p>
          </div>
          <button
            onClick={onCancel}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px',
              border: '1px solid #e5e5e5',
              borderRadius: '4px',
              background: '#fff',
              color: '#525252',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {error && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '4px',
              border: '1px solid #fecaca',
              background: '#fef2f2',
              fontSize: '14px',
              color: '#dc2626',
              fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          <div style={{
            background: '#fff',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Basic Info Section */}
              <section>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #e5e5e5',
                }}>
                  <Building2 size={14} style={{ color: '#737373' }} />
                  <span style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#059669',
                    letterSpacing: '0.05em',
                  }}>
                    Partnership Details
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#525252',
                    }}>
                      Company Name *
                    </label>
                    <input
                      required
                      type="text"
                      value={formData.company_name}
                      onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                      placeholder="e.g. Acme Construction Services"
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#525252',
                    }}>
                      Contact Person
                    </label>
                    <input
                      type="text"
                      value={formData.contact_person}
                      onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                      placeholder="Primary point of contact"
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#525252',
                    }}>
                      Primary Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="+91 XXXXX XXXXX"
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#525252',
                    }}>
                      Corporate Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="office@partner.com"
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#525252',
                    }}>
                      Work Specialty
                    </label>
                    <input
                      type="text"
                      value={formData.nature_of_work}
                      onChange={(e) => setFormData({...formData, nature_of_work: e.target.value})}
                      placeholder="e.g. Electrical, Plumbing, HVAC"
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                      }}
                    />
                  </div>
                </div>
              </section>

              {/* Compliance Section */}
              <section>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #e5e5e5',
                }}>
                  <ShieldCheck size={14} style={{ color: '#737373' }} />
                  <span style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#059669',
                    letterSpacing: '0.05em',
                  }}>
                    Legal & Compliance
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#525252',
                    }}>
                      GSTIN
                    </label>
                    <input
                      maxLength={15}
                      type="text"
                      value={formData.gstin}
                      onChange={(e) => setFormData({...formData, gstin: e.target.value.toUpperCase()})}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#525252',
                    }}>
                      Operating State
                    </label>
                    <select
                      value={formData.state}
                      onChange={(e) => setFormData({...formData, state: e.target.value})}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                        background: '#fff',
                      }}
                    >
                      <option value="">Select State</option>
                      {indianStates.map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                  </div>

                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '4px',
                    border: '1px solid #e5e5e5',
                    background: '#fafafa',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div>
                      <div style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        color: '#737373',
                        letterSpacing: '0.05em',
                      }}>
                        NDA Status
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#171717' }}>
                        {formData.nda_signed ? 'Executed' : 'Not Signed'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, nda_signed: !formData.nda_signed})}
                      style={{
                        position: 'relative',
                        display: 'inline-flex',
                        width: '44px',
                        height: '24px',
                        borderRadius: '9999px',
                        background: formData.nda_signed ? '#2563eb' : '#d4d4d4',
                        cursor: 'pointer',
                        border: 'none',
                        padding: 0,
                      }}
                    >
                      <span style={{
                        display: 'inline-block',
                        width: '16px',
                        height: '16px',
                        borderRadius: '9999px',
                        background: '#fff',
                        transform: formData.nda_signed ? 'translateX(20px)' : 'translateX(4px)',
                        transition: 'transform 0.2s',
                      }} />
                    </button>
                  </div>

                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '4px',
                    border: '1px solid #e5e5e5',
                    background: '#fafafa',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div>
                      <div style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        color: '#737373',
                        letterSpacing: '0.05em',
                      }}>
                        Status
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#171717' }}>
                        {formData.status}
                      </div>
                    </div>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      style={{
                        background: 'transparent',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#2563eb',
                        border: 'none',
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* PAN Card Section */}
              <section>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #e5e5e5',
                }}>
                  <FileText size={14} style={{ color: '#737373' }} />
                  <span style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#059669',
                    letterSpacing: '0.05em',
                  }}>
                    PAN Card Details
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#525252',
                    }}>
                      PAN Number
                    </label>
                    <input
                      type="text"
                      value={formData.pan_card}
                      onChange={(e) => setFormData({...formData, pan_card: e.target.value.toUpperCase()})}
                      placeholder="ABCDE1234F"
                      maxLength={10}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                      }}
                    />
                  </div>
                </div>
              </section>

              {/* Bank Details Section */}
              <section>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #e5e5e5',
                }}>
                  <Building2 size={14} style={{ color: '#737373' }} />
                  <span style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#059669',
                    letterSpacing: '0.05em',
                  }}>
                    Bank Details
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#525252',
                    }}>
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={formData.bank_name}
                      onChange={(e) => setFormData({...formData, bank_name: e.target.value})}
                      placeholder="e.g. State Bank of India"
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#525252',
                    }}>
                      Account Number
                    </label>
                    <input
                      type="text"
                      value={formData.bank_account_number}
                      onChange={(e) => setFormData({...formData, bank_account_number: e.target.value})}
                      placeholder="Bank account number"
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#525252',
                    }}>
                      IFSC Code
                    </label>
                    <input
                      type="text"
                      value={formData.bank_ifsc_code}
                      onChange={(e) => setFormData({...formData, bank_ifsc_code: e.target.value.toUpperCase()})}
                      placeholder="SBIN0001234"
                      maxLength={11}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#525252',
                    }}>
                      Account Type
                    </label>
                    <select
                      value={formData.bank_account_type}
                      onChange={(e) => setFormData({...formData, bank_account_type: e.target.value})}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                        background: '#fff',
                      }}
                    >
                      <option value="">Select Account Type</option>
                      <option value="Savings">Savings</option>
                      <option value="Current">Current</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Upload Documents Section */}
              <section>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #e5e5e5',
                }}>
                  <FileText size={14} style={{ color: '#737373' }} />
                  <span style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#059669',
                    letterSpacing: '0.05em',
                  }}>
                    Upload Documents
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#525252',
                    }}>
                      PAN Card
                    </label>
                    <input
                      type="file"
                      id="pan_card_doc"
                      accept="image/*,.pdf"
                      onChange={(e) => setDocuments({...documents, pan_card_doc: e.target.files?.[0] || null})}
                      style={{ display: 'none' }}
                    />
                    <label
                      htmlFor="pan_card_doc"
                      style={{
                        display: 'block',
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#171717',
                        background: '#fff',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = '#2563eb'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                    >
                      {documents.pan_card_doc ? (
                        <span style={{ color: '#059669', fontWeight: 500 }}>
                          {documents.pan_card_doc.name}
                        </span>
                      ) : (
                        <span style={{
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          textShadow: '0 2px 4px rgba(102, 126, 234, 0.3)',
                          fontWeight: 500,
                        }}>
                          No file chosen
                        </span>
                      )}
                    </label>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#525252',
                    }}>
                      Bank Passbook
                    </label>
                    <input
                      type="file"
                      id="bank_passbook_doc"
                      accept="image/*,.pdf"
                      onChange={(e) => setDocuments({...documents, bank_passbook_doc: e.target.files?.[0] || null})}
                      style={{ display: 'none' }}
                    />
                    <label
                      htmlFor="bank_passbook_doc"
                      style={{
                        display: 'block',
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#171717',
                        background: '#fff',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = '#2563eb'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                    >
                      {documents.bank_passbook_doc ? (
                        <span style={{ color: '#059669', fontWeight: 500 }}>
                          {documents.bank_passbook_doc.name}
                        </span>
                      ) : (
                        <span style={{
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          textShadow: '0 2px 4px rgba(102, 126, 234, 0.3)',
                          fontWeight: 500,
                        }}>
                          No file chosen
                        </span>
                      )}
                    </label>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#525252',
                    }}>
                      Aadhar Card
                    </label>
                    <input
                      type="file"
                      id="aadhar_card_doc"
                      accept="image/*,.pdf"
                      onChange={(e) => setDocuments({...documents, aadhar_card_doc: e.target.files?.[0] || null})}
                      style={{ display: 'none' }}
                    />
                    <label
                      htmlFor="aadhar_card_doc"
                      style={{
                        display: 'block',
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#171717',
                        background: '#fff',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = '#2563eb'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = '#d4d4d4'}
                    >
                      {documents.aadhar_card_doc ? (
                        <span style={{ color: '#059669', fontWeight: 500 }}>
                          {documents.aadhar_card_doc.name}
                        </span>
                      ) : (
                        <span style={{
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          textShadow: '0 2px 4px rgba(102, 126, 234, 0.3)',
                          fontWeight: 500,
                        }}>
                          No file chosen
                        </span>
                      )}
                    </label>
                  </div>
                </div>
              </section>

              {/* Team Members Section */}
              <section>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #e5e5e5',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={14} style={{ color: '#737373' }} />
                    <span style={{
                      fontSize: '22px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: '#059669',
                      letterSpacing: '0.05em',
                    }}>
                      Team Members
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTeamMembers([...teamMembers, { name: '', mobile: '', aadhar_number: '' }])}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid #d4d4d4',
                      borderRadius: '4px',
                      background: '#fff',
                      color: '#171717',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                  >
                    + Add Member
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {teamMembers.map((member, index) => (
                    <div key={index} style={{
                      padding: '12px 16px',
                      borderRadius: '4px',
                      border: '1px solid #e5e5e5',
                      background: '#fafafa',
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#525252',
                          }}>
                            Name
                          </label>
                          <input
                            type="text"
                            value={member.name}
                            onChange={(e) => {
                              const updated = [...teamMembers]
                              updated[index].name = e.target.value
                              setTeamMembers(updated)
                            }}
                            placeholder="Full name"
                            style={{
                              padding: '8px 12px',
                              border: '1px solid #d4d4d4',
                              borderRadius: '4px',
                              fontSize: '14px',
                              color: '#171717',
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#525252',
                          }}>
                            Mobile
                          </label>
                          <input
                            type="tel"
                            value={member.mobile}
                            onChange={(e) => {
                              const updated = [...teamMembers]
                              updated[index].mobile = e.target.value
                              setTeamMembers(updated)
                            }}
                            placeholder="+91 XXXXX XXXXX"
                            style={{
                              padding: '8px 12px',
                              border: '1px solid #d4d4d4',
                              borderRadius: '4px',
                              fontSize: '14px',
                              color: '#171717',
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#525252',
                          }}>
                            Aadhar Number
                          </label>
                          <input
                            type="text"
                            value={member.aadhar_number}
                            onChange={(e) => {
                              const updated = [...teamMembers]
                              updated[index].aadhar_number = e.target.value
                              setTeamMembers(updated)
                            }}
                            placeholder="12-digit Aadhar"
                            maxLength={12}
                            style={{
                              padding: '8px 12px',
                              border: '1px solid #d4d4d4',
                              borderRadius: '4px',
                              fontSize: '14px',
                              color: '#171717',
                            }}
                          />
                        </div>

                        {teamMembers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = teamMembers.filter((_, i) => i !== index)
                              setTeamMembers(updated)
                            }}
                            style={{
                              padding: '8px',
                              border: '1px solid #fecaca',
                              borderRadius: '4px',
                              background: '#fff',
                              color: '#dc2626',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Remarks */}
              <section>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #e5e5e5',
                }}>
                  <FileText size={14} style={{ color: '#737373' }} />
                  <span style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#059669',
                    letterSpacing: '0.05em',
                  }}>
                    Additional Information
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={formData.internal_remarks}
                  onChange={(e) => setFormData({...formData, internal_remarks: e.target.value})}
                  placeholder="Any internal notes, performance remarks or site-specific constraints..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d4d4d4',
                    borderRadius: '4px',
                    fontSize: '14px',
                    color: '#171717',
                    resize: 'none',
                  }}
                />
              </section>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '10px 20px',
                border: '1px solid #e5e5e5',
                borderRadius: '4px',
                background: '#fff',
                color: '#525252',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
            >
              Discard Changes
            </button>
            <button
              type="submit"
              disabled={saveSubcontractorMutation.isPending}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '4px',
                background: '#171717',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 500,
                cursor: saveSubcontractorMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: saveSubcontractorMutation.isPending ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
              onMouseEnter={(e) => !saveSubcontractorMutation.isPending && (e.currentTarget.style.background = '#262626')}
              onMouseLeave={(e) => e.currentTarget.style.background = '#171717'}
            >
              {saveSubcontractorMutation.isPending ? (
                <RefreshCcw size={16} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <Save size={16} />
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
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#f8fafc',
    }}>
      <RefreshCcw size={40} style={{ color: '#2563eb', animation: 'spin 1s linear infinite' }} />
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
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '24px',
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Profile Header */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          marginBottom: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '96px',
              height: '96px',
              borderRadius: '8px',
              background: '#fff',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            }}>
              <Building2 size={40} style={{ color: '#2563eb' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h1 style={{
                  fontSize: '24px',
                  fontWeight: 600,
                  color: '#171717',
                  margin: 0,
                }}>
                  {sub.company_name}
                </h1>
                <div style={{
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  fontSize: '10px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  background: sub.status === 'Active' ? '#ecfdf5' : '#f3f4f6',
                  color: sub.status === 'Active' ? '#059669' : '#6b7280',
                  border: sub.status === 'Active' ? '1px solid #a7f3d0' : '1px solid #e5e7eb',
                }}>
                  {sub.status}
                </div>
              </div>
              <div style={{
                marginTop: '8px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '16px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#9ca3af',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '16px', borderRight: '1px solid #e5e7eb' }}>
                  <User size={14} style={{ color: '#d1d5db' }} />
                  {sub.contact_person || 'No Contact'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '16px', borderRight: '1px solid #e5e7eb' }}>
                  <Briefcase size={14} style={{ color: '#d1d5db' }} />
                  {sub.nature_of_work || 'General Works'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={14} style={{ color: '#d1d5db' }} />
                  {sub.state || 'Unknown Territory'}
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => onNavigate('/subcontractors')}
              style={{
                padding: '10px 20px',
                border: '1px solid #e5e5e5',
                borderRadius: '4px',
                background: '#fff',
                color: '#525252',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
            >
              Partner List
            </button>
            <button
              onClick={() => { window.subToEdit = sub; onNavigate('/subcontractors/edit?id=' + sub.id) }}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '4px',
                background: '#171717',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#262626'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#171717'}
            >
              Edit Profile
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '24px',
          padding: '8px',
          borderRadius: '8px',
          border: '1px solid #e5e5e5',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '4px',
                border: 'none',
                background: activeTab === tab.id ? '#171717' : 'transparent',
                color: activeTab === tab.id ? '#fff' : '#9ca3af',
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => activeTab !== tab.id && (e.currentTarget.style.background = '#f5f5f5')}
              onMouseLeave={(e) => activeTab !== tab.id && (e.currentTarget.style.background = 'transparent')}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Area */}
        <div>
          {activeTab === 'details' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
              {/* Contact Card */}
              <div style={{
                background: '#fff',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                padding: '20px',
              }}>
                <h3 style={{
                  marginBottom: '16px',
                  fontSize: '22px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#059669',
                  letterSpacing: '0.05em',
                }}>
                  Communication
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      color: '#2563eb',
                      opacity: 0.6,
                    }}>
                      Corporate Email
                    </div>
                    <div style={{ marginTop: '4px', fontWeight: 600, color: '#171717' }}>
                      {sub.email || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      color: '#2563eb',
                      opacity: 0.6,
                    }}>
                      Primary Phone
                    </div>
                    <div style={{ marginTop: '4px', fontWeight: 600, color: '#171717' }}>
                      {sub.phone || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      color: '#2563eb',
                      opacity: 0.6,
                    }}>
                      GST Identification
                    </div>
                    <div style={{ marginTop: '4px', fontWeight: 600, color: '#171717', letterSpacing: '0.05em' }}>
                      {sub.gstin || 'No GST Details'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Compliance Card */}
              <div style={{
                background: '#fff',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                padding: '20px',
              }}>
                <h3 style={{
                  marginBottom: '16px',
                  fontSize: '22px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#059669',
                  letterSpacing: '0.05em',
                }}>
                  Compliance Status
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '4px',
                    background: '#eff6ff',
                    border: '1px solid #dbeafe',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <ShieldCheck size={32} style={{ color: sub.nda_signed ? '#2563eb' : '#d1d5db' }} />
                      <div>
                        <div style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          color: '#2563eb',
                        }}>
                          NDA Status
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#171717' }}>
                          {sub.nda_signed ? 'Executed' : 'Pending'}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '4px',
                    background: '#eef2ff',
                    border: '1px solid #e0e7ff',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <FileSignature size={32} style={{ color: sub.contract_signed ? '#4f46e5' : '#d1d5db' }} />
                      <div>
                        <div style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          color: '#4f46e5',
                        }}>
                          Master Contract
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#171717' }}>
                          {sub.contract_signed ? 'Active' : 'Missing'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Address / Misc */}
              <div style={{
                background: '#fff',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                padding: '20px',
              }}>
                <h3 style={{
                  marginBottom: '16px',
                  fontSize: '22px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#059669',
                  letterSpacing: '0.05em',
                }}>
                  Headquarters
                </h3>
                <div style={{ fontSize: '14px', fontWeight: 500, lineHeight: '1.6', color: '#6b7280' }}>
                  {sub.address || 'Direct address not specified'}
                  <br />
                  <span style={{ marginTop: '8px', display: 'block', fontWeight: 600, color: '#171717' }}>
                    {sub.state} {sub.pincode ? `, ${sub.pincode}` : ''}
                  </span>
                </div>
                <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e5e5e5' }}>
                  <h3 style={{
                    marginBottom: '8px',
                    fontSize: '22px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#059669',
                    letterSpacing: '0.05em',
                  }}>
                    Internal Remarks
                  </h3>
                  <div style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#4b5563',
                    background: '#f9fafb',
                    padding: '12px 16px',
                    borderRadius: '4px',
                    lineHeight: '1.6',
                    fontStyle: 'italic',
                    border: '1px solid #e5e7eb',
                  }}>
                    {sub.internal_remarks || 'No notes on this partner.'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'workorders' && (
            <div style={{
              background: '#fff',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              padding: '8px',
            }}>
              <AppTable
                data={workOrders}
                columns={[
                  { header: 'Order #', accessorKey: 'work_order_no', cell: (i:any)=><span className="font-black text-blue-600">{i.getValue()}</span> },
                  { header: 'Description', accessorKey: 'work_description', cell:(i:any)=><span className="font-bold text-zinc-900 line-clamp-1">{i.getValue()}</span> },
                  { header: 'Timeline', accessorKey: 'start_date', cell: ({row}:any) => <span className="text-xs font-bold text-zinc-400">{row.original.start_date} → {row.original.end_date}</span> },
                  { header: 'Value', accessorKey: 'contract_value', cell: (i:any)=><span className="font-black text-zinc-900">₹{i.getValue()}</span> },
                  { header: 'Status', accessorKey: 'status', cell: (i:any)=><span className="text-[10px] font-black uppercase tracking-widest text-blue-500 bg-blue-50 px-2.5 py-1 rounded-full">{i.getValue()}</span> }
                ]}
                emptyMessage="No work orders issued yet."
              />
            </div>
          )}

          {activeTab === 'attendance' && (
            <div style={{
              background: '#fff',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              padding: '8px',
            }}>
              <AppTable
                data={attendance}
                columns={[
                  { header: 'Date', accessorKey: 'attendance_date', cell:(i:any)=><span className="font-black text-zinc-900">{i.getValue()}</span> },
                  { header: 'Workers', accessorKey: 'workers_count', cell:(i:any)=><div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 font-bold text-white text-[11px]">{i.getValue()}</div> },
                  { header: 'Supervisor', accessorKey: 'supervisor_name', cell:(i:any)=><span className="font-bold text-zinc-600">{i.getValue() || '-'}</span> },
                  { header: 'Remarks', accessorKey: 'remarks', cell:(i:any)=><span className="text-xs font-bold text-zinc-400 line-clamp-1 italic">{i.getValue() || '-'}</span> }
                ]}
                emptyMessage="No daily records found."
              />
            </div>
          )}

          {activeTab === 'dailylogs' && (
            <div style={{
              background: '#fff',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              padding: '8px',
            }}>
              <AppTable
                data={dailyLogs}
                columns={[
                  { header: 'Log Date', accessorKey: 'log_date', cell:(i:any)=><span className="font-black text-zinc-900">{i.getValue()}</span> },
                  { header: 'Work Progress', accessorKey: 'work_done', cell:(i:any)=><span className="font-bold text-zinc-700">{i.getValue()}</span> },
                  { header: 'Safety/Issues', accessorKey: 'safety_incidents', cell:({row}:any)=><div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-zinc-400">{row.original.delays || 'No Delays'}</span>
                    <span className="mx-2 text-zinc-200">|</span>
                    <span className={cn("text-xs font-bold", row.original.safety_incidents ? "text-red-500":"text-emerald-500")}>{row.original.safety_incidents || 'No Incidents'}</span>
                  </div> }
                ]}
                emptyMessage="No progress logs recorded."
              />
            </div>
          )}

          {activeTab === 'payments' && (
            <div style={{
              background: '#fff',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              padding: '8px',
            }}>
              <AppTable
                data={payments}
                columns={[
                  { header: 'Payment Date', accessorKey: 'payment_date', cell:(i:any)=><span className="font-black text-zinc-900">{i.getValue()}</span> },
                  { header: 'Amount', accessorKey: 'amount', cell:(i:any)=><span className="text-lg font-black text-emerald-600">₹{i.getValue()}</span> },
                  { header: 'Method', accessorKey: 'payment_mode', cell:(i:any)=><span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-50 px-2.5 py-1 rounded-full border border-zinc-100">{i.getValue()}</span> },
                  { header: 'Ref No', accessorKey: 'reference_no', cell:(i:any)=><span className="font-mono text-xs font-bold text-blue-500 bg-blue-50/50 px-2 py-1 rounded-lg">{i.getValue()}</span> }
                ]}
                emptyMessage="No payment history available."
              />
            </div>
          )}

          {activeTab === 'ledger' && sub && (
            <div style={{
              background: '#fff',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
            }}>
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
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      padding: '24px',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}>
          <div>
            <h1 style={{
              fontSize: '24px',
              fontWeight: 600,
              color: '#171717',
              margin: 0,
            }}>
              Daily Workforce Count
            </h1>
            <p style={{
              fontSize: '14px',
              color: '#737373',
              margin: '4px 0 0 0',
            }}>
              Log and monitor sub-contractor headcounts across sites
            </p>
          </div>
          <button
            onClick={() => onNavigate('/subcontractors')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px',
              border: '1px solid #e5e5e5',
              borderRadius: '4px',
              background: '#fff',
              color: '#525252',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
          {/* Form Card */}
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e5e5e5',
            }}>
              <h3 style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#171717',
                margin: 0,
              }}>
                Logging Form
              </h3>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#525252',
                  }}>
                    Partner *
                  </label>
                  <select
                    value={subId}
                    onChange={e => setSubId(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d4d4d4',
                      borderRadius: '4px',
                      fontSize: '14px',
                      color: '#171717',
                      background: '#fff',
                    }}
                  >
                    <option value="">Select Partner</option>
                    {subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#525252',
                  }}>
                    Date *
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d4d4d4',
                      borderRadius: '4px',
                      fontSize: '14px',
                      color: '#171717',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#525252',
                    }}>
                      Workers *
                    </label>
                    <input
                      type="number"
                      value={workers}
                      onChange={e => setWorkers(parseInt(e.target.value) || 0)}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#525252',
                    }}>
                      Supervisor
                    </label>
                    <input
                      type="text"
                      value={supervisor}
                      onChange={e => setSupervisor(e.target.value)}
                      placeholder="Supervisor name"
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #d4d4d4',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#171717',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#525252',
                  }}>
                    Remarks
                  </label>
                  <textarea
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    placeholder="Additional notes..."
                    rows={3}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d4d4d4',
                      borderRadius: '4px',
                      fontSize: '14px',
                      color: '#171717',
                      resize: 'none',
                    }}
                  />
                </div>

                <button
                  onClick={saveAttendance}
                  disabled={saving || !subId}
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    borderRadius: '4px',
                    background: '#171717',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: saving || !subId ? 'not-allowed' : 'pointer',
                    opacity: saving || !subId ? 0.6 : 1,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => !saving && subId && (e.currentTarget.style.background = '#262626')}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#171717'}
                >
                  {saving ? 'Saving...' : 'Capture Log'}
                </button>
              </div>
            </div>
          </div>

          {/* Records Card */}
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e5e5e5',
            }}>
              <h3 style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#171717',
                margin: 0,
              }}>
                Attendance Records
              </h3>
            </div>

            <div style={{ padding: '0' }}>
              <AppTable
                data={records}
                columns={[
                  { header: 'Date', accessorKey: 'attendance_date', cell:(i:any)=><span className="font-black text-zinc-900">{i.getValue()}</span> },
                  { header: 'Workers', accessorKey: 'workers_count', cell:(i:any)=><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 font-black text-blue-600 text-[10px] uppercase border border-blue-100">{i.getValue()}</div> },
                  { header: 'Supervisor', accessorKey: 'supervisor_name', cell:(i:any)=><span className="text-xs font-bold text-zinc-600">{i.getValue() || '-'}</span> },
                  { header: 'Remarks', accessorKey: 'remarks', cell:(i:any)=><span className="text-[11px] font-medium text-zinc-400 italic line-clamp-1">{i.getValue() || '-'}</span> }
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
            <h1 className="text-3xl font-black tracking-tight text-zinc-900">Work Orders</h1>
            <p className="font-medium text-zinc-400">Issue and track task-specific contracts for partners</p>
          </div>
          <button onClick={() => onNavigate('/subcontractors')} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-zinc-200 text-zinc-400">
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-10 lg:grid-cols-4">
          <div className="lg:col-span-1">
             <div className="rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-xl shadow-zinc-200/50 space-y-4">
               <h3 className="mb-4 text-[11px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100 pb-3">New Contract</h3>
               <div className="space-y-3">
                 <select className="h-11 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-xs font-bold text-zinc-900" value={subId} onChange={e => setSubId(e.target.value)}>
                    <option value="">Select Partner</option>
                    {subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                 </select>
                 <input placeholder="Contract # / WO #" className="h-11 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-xs font-bold text-zinc-900 outline-none" value={woNo} onChange={e => setWoNo(e.target.value)} />
                 <textarea placeholder="Job Description" className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-bold text-zinc-900 outline-none resize-none" rows={3} value={desc} onChange={e => setDesc(e.target.value)} />
                 <input type="number" placeholder="Contract Value" className="h-11 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-xs font-bold text-zinc-900 outline-none" value={value} onChange={e => setValue(e.target.value)} />
                 <button onClick={saveWO} disabled={saving || !subId} className="w-full h-11 flex items-center justify-center gap-2 rounded-2xl bg-zinc-900 text-[11px] font-black uppercase tracking-widest text-white shadow-lg active:scale-95 disabled:opacity-50">
                    {saving ? <RefreshCcw className="animate-spin h-3.3 w-3.5" /> : <Plus size={14} />}
                    Issue Order
                 </button>
               </div>
             </div>
          </div>
          <div className="lg:col-span-3">
            <div className="rounded-[2rem] border border-zinc-200 bg-white overflow-hidden shadow-xl shadow-zinc-200/50">
               <AppTable
                 data={workOrders}
                 columns={[
                   { header: 'Order ID', accessorKey: 'work_order_no', cell:(i:any)=><b className="text-blue-600 font-black tracking-tight uppercase text-[11px]">{i.getValue()}</b> },
                   { header: 'Job Details', accessorKey: 'work_description', cell:(i:any)=><span className="text-xs font-bold text-zinc-900">{i.getValue()}</span> },
                   { header: 'Value', accessorKey: 'contract_value', cell:(i:any)=><span className="font-black text-zinc-900 italic">₹{i.getValue()}</span> },
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

export function SubcontractorPayments({ onNavigate }: WithNavigate) {
  const { organisation } = useAuth();
  const [activeTab, setActiveTab] = useState<'payments' | 'ledger'>('payments');
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [subcontractors, setSubcontractors] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [subcontractorFilter, setSubcontractorFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('all');

  const [formData, setFormData] = useState({
    subcontractor_id: '',
    work_order_id: '',
    amount: '',
    gross_amount: '',
    tds_percentage: '',
    tds_amount: '',
    net_amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'Bank Transfer',
    reference_no: '',
    description: ''
  });

  const [invoiceFormData, setInvoiceFormData] = useState({
    subcontractor_id: '',
    work_order_id: '',
    invoice_no: '',
    invoice_date: new Date().toISOString().split('T')[0],
    amount: '',
    description: '',
    status: 'Pending'
  });

  useEffect(() => {
    if (organisation?.id) {
      setIsLoading(true);
      Promise.all([
        supabase
          .from('subcontractor_payments')
          .select('*')
          .order('payment_date', { ascending: false }),
        supabase
          .from('subcontractor_invoices')
          .select('*')
          .order('invoice_date', { ascending: false }),
        supabase
          .from('subcontractors')
          .select('*')
          .eq('organisation_id', organisation.id)
          .eq('status', 'Active'),
        supabase
          .from('subcontractor_work_orders')
          .select('*')
          .eq('organisation_id', organisation.id)
      ]).then(([paymentsRes, invoicesRes, subsRes, woRes]) => {
        console.log('Payments raw:', paymentsRes.data);
        console.log('Invoices raw:', invoicesRes.data);
        console.log('Subcontractors:', subsRes.data);
        console.log('Work Orders:', woRes.data);
        
        // Filter payments by organisation_id after fetching
        const filteredPayments = (paymentsRes.data || []).filter(p => 
          !p.organisation_id || p.organisation_id === organisation.id
        );
        
        // Filter invoices by organisation_id after fetching
        const filteredInvoices = (invoicesRes.data || []).filter(i => 
          !i.organisation_id || i.organisation_id === organisation.id
        );
        
        // Enrich payments with subcontractor and work order data
        const enrichedPayments = filteredPayments.map(p => ({
          ...p,
          subcontractors: subsRes.data?.find(s => s.id === p.subcontractor_id),
          work_orders: woRes.data?.find(wo => wo.id === p.work_order_id)
        }));
        
        // Enrich invoices with subcontractor and work order data
        const enrichedInvoices = filteredInvoices.map(i => ({
          ...i,
          subcontractors: subsRes.data?.find(s => s.id === i.subcontractor_id),
          work_orders: woRes.data?.find(wo => wo.id === i.work_order_id)
        }));
        
        setPayments(enrichedPayments);
        setInvoices(enrichedInvoices);
        setSubcontractors(subsRes.data || []);
        setWorkOrders(woRes.data || []);
        setIsLoading(false);
      });
    }
  }, [organisation?.id]);

  const filteredPayments = payments.filter((p) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matches = 
        p.subcontractors?.company_name?.toLowerCase().includes(query) ||
        p.reference_no?.toLowerCase().includes(query) ||
        p.payment_mode?.toLowerCase().includes(query);
      if (!matches) return false;
    }
    if (subcontractorFilter !== 'all' && p.subcontractor_id !== subcontractorFilter) return false;
    if (dateFrom && p.payment_date < dateFrom) return false;
    if (dateTo && p.payment_date > dateTo) return false;
    return true;
  });

  const filteredInvoices = invoices.filter((i) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matches = 
        i.subcontractors?.company_name?.toLowerCase().includes(query) ||
        i.invoice_no?.toLowerCase().includes(query);
      if (!matches) return false;
    }
    if (subcontractorFilter !== 'all' && i.subcontractor_id !== subcontractorFilter) return false;
    if (dateFrom && i.invoice_date < dateFrom) return false;
    if (dateTo && i.invoice_date > dateTo) return false;
    return true;
  });

  // Build ledger entries from payments and invoices
  const ledgerEntries = [
    ...filteredInvoices.map(i => ({
      id: i.id,
      date: i.invoice_date,
      type: 'credit',
      category: 'Invoice',
      description: i.invoice_no,
      subcontractor: i.subcontractors?.company_name || '-',
      workOrder: i.work_orders?.work_order_no || '-',
      amount: parseFloat(i.amount || 0),
      tdsAmount: 0,
      netAmount: parseFloat(i.amount || 0),
      reference: i.invoice_no,
      status: i.status
    })),
    ...filteredPayments.map(p => ({
      id: p.id,
      date: p.payment_date,
      type: 'debit',
      category: 'Payment',
      description: p.description || p.payment_mode,
      subcontractor: p.subcontractors?.company_name || '-',
      workOrder: p.work_orders?.work_order_no || '-',
      amount: parseFloat(p.gross_amount || p.amount || 0),
      tdsAmount: parseFloat(p.tds_amount || 0),
      netAmount: parseFloat(p.net_amount || p.amount || 0),
      reference: p.reference_no || '-',
      status: 'Paid'
    }))
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate running balance
  let runningBalance = 0;
  const ledgerWithBalance = ledgerEntries.map(entry => {
    if (entry.type === 'credit') {
      runningBalance += entry.amount;
    } else {
      runningBalance -= entry.netAmount;
    }
    return { ...entry, balance: runningBalance };
  });

  const filteredLedger = transactionTypeFilter === 'all' 
    ? ledgerWithBalance 
    : ledgerWithBalance.filter(e => e.type === transactionTypeFilter);

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organisation?.id) return;

    const grossAmount = parseFloat(formData.gross_amount) || parseFloat(formData.amount) || 0;
    const tdsPercent = parseFloat(formData.tds_percentage) || 0;
    const tdsAmount = (grossAmount * tdsPercent) / 100;
    const netAmount = grossAmount - tdsAmount;

    const paymentData = {
      organisation_id: organisation.id,
      subcontractor_id: formData.subcontractor_id,
      work_order_id: formData.work_order_id || null,
      gross_amount: grossAmount,
      tds_percentage: tdsPercent,
      tds_amount: tdsAmount,
      net_amount: netAmount,
      amount: netAmount,
      payment_date: formData.payment_date,
      payment_mode: formData.payment_mode,
      reference_no: formData.reference_no,
      description: formData.description
    };

    if (editingPayment) {
      await supabase.from('subcontractor_payments').update(paymentData).eq('id', editingPayment.id);
    } else {
      await supabase.from('subcontractor_payments').insert(paymentData);
    }

    // Refresh data
    const { data: paymentsData } = await supabase.from('subcontractor_payments').select('*').order('payment_date', { ascending: false });
    const { data: invoicesData } = await supabase.from('subcontractor_invoices').select('*').order('invoice_date', { ascending: false });
    
    const filteredPayments = (paymentsData || []).filter(p => !p.organisation_id || p.organisation_id === organisation.id);
    const filteredInvoices = (invoicesData || []).filter(i => !i.organisation_id || i.organisation_id === organisation.id);
    
    const enrichedPayments = filteredPayments.map(p => ({
      ...p,
      subcontractors: subcontractors.find(s => s.id === p.subcontractor_id),
      work_orders: workOrders.find(wo => wo.id === p.work_order_id)
    }));
    
    const enrichedInvoices = filteredInvoices.map(i => ({
      ...i,
      subcontractors: subcontractors.find(s => s.id === i.subcontractor_id),
      work_orders: workOrders.find(wo => wo.id === i.work_order_id)
    }));
    
    setPayments(enrichedPayments);
    setInvoices(enrichedInvoices);
    
    setShowModal(false);
    setEditingPayment(null);
    resetForm();
  };

  const handleDeletePayment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payment?')) return;
    await supabase.from('subcontractor_payments').delete().eq('id', id);
    setPayments(payments.filter(p => p.id !== id));
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organisation?.id) return;

    const invoiceData = {
      organisation_id: organisation.id,
      subcontractor_id: invoiceFormData.subcontractor_id,
      work_order_id: invoiceFormData.work_order_id || null,
      invoice_no: invoiceFormData.invoice_no,
      invoice_date: invoiceFormData.invoice_date,
      amount: parseFloat(invoiceFormData.amount),
      description: invoiceFormData.description,
      status: invoiceFormData.status
    };

    if (editingInvoice) {
      await supabase.from('subcontractor_invoices').update(invoiceData).eq('id', editingInvoice.id);
    } else {
      await supabase.from('subcontractor_invoices').insert(invoiceData);
    }

    // Refresh data
    const { data: invoicesData } = await supabase.from('subcontractor_invoices').select('*').order('invoice_date', { ascending: false });
    const filteredInvoices = (invoicesData || []).filter(i => !i.organisation_id || i.organisation_id === organisation.id);
    const enrichedInvoices = filteredInvoices.map(i => ({
      ...i,
      subcontractors: subcontractors.find(s => s.id === i.subcontractor_id),
      work_orders: workOrders.find(wo => wo.id === i.work_order_id)
    }));
    setInvoices(enrichedInvoices);
    
    setShowInvoiceModal(false);
    setEditingInvoice(null);
    resetInvoiceForm();
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;
    await supabase.from('subcontractor_invoices').delete().eq('id', id);
    setInvoices(invoices.filter(i => i.id !== id));
  };

  const resetInvoiceForm = () => {
    setInvoiceFormData({
      subcontractor_id: '',
      work_order_id: '',
      invoice_no: '',
      invoice_date: new Date().toISOString().split('T')[0],
      amount: '',
      description: '',
      status: 'Pending'
    });
  };

  const openEditInvoiceModal = (invoice: any) => {
    setEditingInvoice(invoice);
    setInvoiceFormData({
      subcontractor_id: invoice.subcontractor_id,
      work_order_id: invoice.work_order_id || '',
      invoice_no: invoice.invoice_no,
      invoice_date: invoice.invoice_date,
      amount: invoice.amount?.toString() || '',
      description: invoice.description || '',
      status: invoice.status || 'Pending'
    });
    setShowInvoiceModal(true);
  };

  const exportLedgerToCSV = () => {
    const headers = ['Date', 'Type', 'Category', 'Subcontractor', 'Work Order', 'Description', 'Reference', 'Amount (₹)', 'TDS (₹)', 'Net Amount (₹)', 'Balance (₹)', 'Status'];
    const rows = filteredLedger.map(entry => [
      entry.date,
      entry.type.toUpperCase(),
      entry.category,
      entry.subcontractor,
      entry.workOrder,
      entry.description,
      entry.reference,
      entry.amount.toFixed(2),
      entry.tdsAmount.toFixed(2),
      entry.netAmount.toFixed(2),
      entry.balance.toFixed(2),
      entry.status
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `subcontractor_ledger_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportLedgerToPDF = async () => {
    try {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF();
      
      doc.setFontSize(16);
      doc.text('Subcontractor Ledger', 14, 20);
      
      doc.setFontSize(10);
      doc.text(`Exported: ${new Date().toLocaleDateString()}`, 14, 28);
      
      const tableData = filteredLedger.length > 0 
        ? filteredLedger.map(entry => [
            entry.date,
            entry.type.toUpperCase(),
            entry.category,
            entry.subcontractor,
            entry.workOrder,
            entry.description,
            entry.reference,
            `₹${entry.amount.toFixed(2)}`,
            entry.tdsAmount > 0 ? `₹${entry.tdsAmount.toFixed(2)}` : '-',
            `₹${entry.netAmount.toFixed(2)}`,
            `₹${entry.balance.toFixed(2)}`,
            entry.status
          ])
        : [['No data available for the selected filters']];
      
      autoTable(doc, {
        startY: 35,
        head: [['Date', 'Type', 'Category', 'Subcontractor', 'Work Order', 'Description', 'Reference', 'Amount', 'TDS', 'Net', 'Balance', 'Status']],
        body: tableData,
        styles: {
          fontSize: 8,
          cellPadding: 3
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 20 },
          2: { cellWidth: 20 },
          3: { cellWidth: 35 },
          4: { cellWidth: 25 },
          5: { cellWidth: 30 },
          6: { cellWidth: 25 },
          7: { cellWidth: 20, halign: 'right' },
          8: { cellWidth: 15, halign: 'right' },
          9: { cellWidth: 20, halign: 'right' },
          10: { cellWidth: 20, halign: 'right' },
          11: { cellWidth: 20 }
        }
      });
      
      doc.save(`subcontractor_ledger_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('PDF export error:', error);
      alert('Failed to export PDF. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      subcontractor_id: '',
      work_order_id: '',
      amount: '',
      gross_amount: '',
      tds_percentage: '',
      tds_amount: '',
      net_amount: '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_mode: 'Bank Transfer',
      reference_no: '',
      description: ''
    });
  };

  const openEditModal = (payment: any) => {
    setEditingPayment(payment);
    setFormData({
      subcontractor_id: payment.subcontractor_id,
      work_order_id: payment.work_order_id || '',
      amount: payment.amount?.toString() || '',
      gross_amount: payment.gross_amount?.toString() || '',
      tds_percentage: payment.tds_percentage?.toString() || '',
      tds_amount: payment.tds_amount?.toString() || '',
      net_amount: payment.net_amount?.toString() || '',
      payment_date: payment.payment_date,
      payment_mode: payment.payment_mode || 'Bank Transfer',
      reference_no: payment.reference_no || '',
      description: payment.description || ''
    });
    setShowModal(true);
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ fontFamily: 'Courier New, monospace' }}>Loading payments...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Courier New, monospace' }}>
      {/* Header */}
      <div style={{ padding: '24px 24px 0', background: '#f8fafc' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '-0.5px', color: '#0f172a', margin: 0 }}>
                Subcontractor Payments
              </h1>
              <p style={{ fontSize: '14px', color: '#64748b', marginTop: '4px', margin: '4px 0 0 0' }}>
                Manage subcontractor payments, invoices, and track TDS
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              {activeTab === 'payments' && (
                <button
                  onClick={() => { resetForm(); setEditingPayment(null); setShowModal(true); }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderRadius: '8px',
                    background: '#0f172a',
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#1e293b'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#0f172a'}
                >
                  <span style={{ fontSize: '16px' }}>+</span> New Payment
                </button>
              )}
              {activeTab === 'ledger' && (
                <>
                  <button
                    onClick={() => { resetInvoiceForm(); setEditingInvoice(null); setShowInvoiceModal(true); }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      borderRadius: '8px',
                      background: '#0f172a',
                      padding: '10px 20px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#1e293b'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#0f172a'}
                  >
                    <span style={{ fontSize: '16px' }}>+</span> New Invoice
                  </button>
                  <button
                    onClick={exportLedgerToCSV}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      borderRadius: '8px',
                      background: '#fff',
                      padding: '10px 20px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#0f172a',
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={exportLedgerToPDF}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      borderRadius: '8px',
                      background: '#fff',
                      padding: '10px 20px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#0f172a',
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
                  >
                    Export PDF
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Sub-tabs */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid #e2e8f0' }}>
            <button
              onClick={() => setActiveTab('payments')}
              style={{
                padding: '12px 20px',
                fontSize: '14px',
                fontWeight: '600',
                color: activeTab === 'payments' ? '#0f172a' : '#64748b',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'payments' ? '2px solid #0f172a' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Payments
            </button>
            <button
              onClick={() => setActiveTab('ledger')}
              style={{
                padding: '12px 20px',
                fontSize: '14px',
                fontWeight: '600',
                color: activeTab === 'ledger' ? '#0f172a' : '#64748b',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'ledger' ? '2px solid #0f172a' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Ledger
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div style={{
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            background: '#fff',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
            marginBottom: '16px'
          }}>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                {/* Search */}
                <div style={{ flex: '1', minWidth: '280px' }}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by subcontractor, reference, or mode..."
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      background: '#fff',
                      padding: '10px 12px 10px 40px',
                      fontSize: '14px',
                      color: '#0f172a',
                      outline: 'none'
                    }}
                  />
                  <span style={{ position: 'absolute', left: '32px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>🔍</span>
                </div>

                {/* Subcontractor Filter */}
                <div style={{ minWidth: '200px' }}>
                  <select
                    value={subcontractorFilter}
                    onChange={(e) => setSubcontractorFilter(e.target.value)}
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      background: '#fff',
                      padding: '10px 12px',
                      fontSize: '14px',
                      color: '#0f172a',
                      outline: 'none'
                    }}
                  >
                    <option value="all">All Subcontractors</option>
                    {subcontractors.map((sub) => (
                      <option key={sub.id} value={sub.id}>{sub.company_name}</option>
                    ))}
                  </select>
                </div>

                {/* Date From */}
                <div style={{ minWidth: '150px' }}>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      background: '#fff',
                      padding: '10px 12px',
                      fontSize: '14px',
                      color: '#0f172a',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Date To */}
                <div style={{ minWidth: '150px' }}>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      background: '#fff',
                      padding: '10px 12px',
                      fontSize: '14px',
                      color: '#0f172a',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Transaction Type Filter (Ledger only) */}
                {activeTab === 'ledger' && (
                  <div style={{ minWidth: '150px' }}>
                    <select
                      value={transactionTypeFilter}
                      onChange={(e) => setTransactionTypeFilter(e.target.value)}
                      style={{
                        width: '100%',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        background: '#fff',
                        padding: '10px 12px',
                        fontSize: '14px',
                        color: '#0f172a',
                        outline: 'none'
                      }}
                    >
                      <option value="all">All Transactions</option>
                      <option value="credit">Credits (Invoices)</option>
                      <option value="debit">Debits (Payments)</option>
                    </select>
                  </div>
                )}

                {/* Clear Filters */}
                {(searchQuery || subcontractorFilter !== 'all' || dateFrom || dateTo || transactionTypeFilter !== 'all') && (
                  <button
                    onClick={() => { setSearchQuery(''); setSubcontractorFilter('all'); setDateFrom(''); setDateTo(''); setTransactionTypeFilter('all'); }}
                    style={{
                      borderRadius: '8px',
                      padding: '10px 16px',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#64748b',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div style={{
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            background: '#fff',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
            overflow: 'hidden'
          }}>
            {activeTab === 'payments' ? (
              <>
                {filteredPayments.length === 0 ? (
                  <div style={{ padding: '64px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>💳</div>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
                      No payments found
                    </h3>
                    <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
                      Create your first payment to get started
                    </p>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                        {['Payment Date', 'Subcontractor', 'Work Order', 'Gross Amount', 'TDS %', 'TDS Amount', 'Net Amount', 'Mode', 'Reference', 'Actions'].map((header) => (
                          <th key={header} style={{
                            padding: '12px 16px',
                            textAlign: 'left',
                            fontSize: '12px',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            color: '#64748b'
                          }}>
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPayments.map((payment) => (
                        <tr key={payment.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '16px', fontSize: '14px', color: '#0f172a' }}>
                            {payment.payment_date}
                          </td>
                          <td style={{ padding: '16px', fontSize: '14px', color: '#334155', fontWeight: '500' }}>
                            {payment.subcontractors?.company_name || '-'}
                          </td>
                          <td style={{ padding: '16px', fontSize: '14px', color: '#64748b' }}>
                            {payment.work_orders?.work_order_no || '-'}
                          </td>
                          <td style={{ padding: '16px', fontSize: '14px', color: '#0f172a', fontWeight: '600' }}>
                            ₹{parseFloat(payment.gross_amount || payment.amount || 0).toFixed(2)}
                          </td>
                          <td style={{ padding: '16px', fontSize: '14px', color: '#64748b' }}>
                            {payment.tds_percentage ? `${payment.tds_percentage}%` : '-'}
                          </td>
                          <td style={{ padding: '16px', fontSize: '14px', color: '#dc2626', fontWeight: '500' }}>
                            {payment.tds_amount ? `₹${parseFloat(payment.tds_amount).toFixed(2)}` : '-'}
                          </td>
                          <td style={{ padding: '16px', fontSize: '14px', color: '#16a34a', fontWeight: '600' }}>
                            ₹{parseFloat(payment.net_amount || payment.amount || 0).toFixed(2)}
                          </td>
                          <td style={{ padding: '16px', fontSize: '12px', color: '#64748b', textTransform: 'uppercase' }}>
                            {payment.payment_mode}
                          </td>
                          <td style={{ padding: '16px', fontSize: '13px', color: '#0f172a', fontFamily: 'monospace' }}>
                            {payment.reference_no || '-'}
                          </td>
                          <td style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => openEditModal(payment)}
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  borderRadius: '6px',
                                  background: '#f1f5f9',
                                  color: '#475569',
                                  border: 'none',
                                  cursor: 'pointer'
                                }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeletePayment(payment.id)}
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  borderRadius: '6px',
                                  background: '#fef2f2',
                                  color: '#dc2626',
                                  border: 'none',
                                  cursor: 'pointer'
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            ) : (
              <>
                {filteredLedger.length === 0 ? (
                  <div style={{ padding: '64px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
                      No ledger entries found
                    </h3>
                    <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
                      Add invoices or payments to see the ledger
                    </p>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                        {['Date', 'Type', 'Category', 'Subcontractor', 'Work Order', 'Description', 'Reference', 'Amount (₹)', 'TDS (₹)', 'Net (₹)', 'Balance (₹)', 'Status'].map((header) => (
                          <th key={header} style={{
                            padding: '12px 16px',
                            textAlign: 'left',
                            fontSize: '12px',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            color: '#64748b'
                          }}>
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLedger.map((entry) => (
                        <tr key={entry.id} style={{ borderBottom: '1px solid #f1f5f9', background: entry.type === 'credit' ? '#f0fdf4' : 'transparent' }}>
                          <td style={{ padding: '16px', fontSize: '14px', color: '#0f172a' }}>
                            {entry.date}
                          </td>
                          <td style={{ padding: '16px' }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '600',
                              textTransform: 'uppercase',
                              background: entry.type === 'credit' ? '#dcfce7' : '#fee2e2',
                              color: entry.type === 'credit' ? '#166534' : '#991b1b'
                            }}>
                              {entry.type}
                            </span>
                          </td>
                          <td style={{ padding: '16px', fontSize: '14px', color: '#64748b' }}>
                            {entry.category}
                          </td>
                          <td style={{ padding: '16px', fontSize: '14px', color: '#334155', fontWeight: '500' }}>
                            {entry.subcontractor}
                          </td>
                          <td style={{ padding: '16px', fontSize: '14px', color: '#64748b' }}>
                            {entry.workOrder}
                          </td>
                          <td style={{ padding: '16px', fontSize: '14px', color: '#0f172a' }}>
                            {entry.description}
                          </td>
                          <td style={{ padding: '16px', fontSize: '13px', color: '#0f172a', fontFamily: 'monospace' }}>
                            {entry.reference}
                          </td>
                          <td style={{ padding: '16px', fontSize: '14px', color: '#0f172a', fontWeight: '600' }}>
                            ₹{entry.amount.toFixed(2)}
                          </td>
                          <td style={{ padding: '16px', fontSize: '14px', color: entry.tdsAmount > 0 ? '#dc2626' : '#64748b', fontWeight: '500' }}>
                            {entry.tdsAmount > 0 ? `₹${entry.tdsAmount.toFixed(2)}` : '-'}
                          </td>
                          <td style={{ padding: '16px', fontSize: '14px', color: entry.type === 'credit' ? '#16a34a' : '#dc2626', fontWeight: '600' }}>
                            ₹{entry.netAmount.toFixed(2)}
                          </td>
                          <td style={{ padding: '16px', fontSize: '14px', color: entry.balance >= 0 ? '#0f172a' : '#dc2626', fontWeight: '700' }}>
                            ₹{entry.balance.toFixed(2)}
                          </td>
                          <td style={{ padding: '16px' }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '600',
                              textTransform: 'uppercase',
                              background: entry.status === 'Paid' ? '#dbeafe' : '#fef3c7',
                              color: entry.status === 'Paid' ? '#1e40af' : '#92400e'
                            }}>
                              {entry.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Modal */}
      {showInvoiceModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid #e5e5e5'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>
                {editingInvoice ? 'Edit Invoice' : 'New Invoice'}
              </h3>
              <button
                onClick={() => { setShowInvoiceModal(false); setEditingInvoice(null); resetInvoiceForm(); }}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gap: '16px' }}>
                {/* Subcontractor */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Subcontractor *
                  </label>
                  <select
                    value={invoiceFormData.subcontractor_id}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, subcontractor_id: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  >
                    <option value="">Select subcontractor</option>
                    {subcontractors.map((sub) => (
                      <option key={sub.id} value={sub.id}>{sub.company_name}</option>
                    ))}
                  </select>
                </div>

                {/* Work Order */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Work Order (Optional)
                  </label>
                  <select
                    value={invoiceFormData.work_order_id}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, work_order_id: e.target.value })}
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  >
                    <option value="">Select work order</option>
                    {workOrders.filter(wo => wo.subcontractor_id === invoiceFormData.subcontractor_id).map((wo) => (
                      <option key={wo.id} value={wo.id}>{wo.work_order_no}</option>
                    ))}
                  </select>
                </div>

                {/* Invoice No */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Invoice No *
                  </label>
                  <input
                    type="text"
                    value={invoiceFormData.invoice_no}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, invoice_no: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Invoice Date */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Invoice Date *
                  </label>
                  <input
                    type="date"
                    value={invoiceFormData.invoice_date}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, invoice_date: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Amount */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    value={invoiceFormData.amount}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, amount: e.target.value })}
                    required
                    step="0.01"
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Status */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Status
                  </label>
                  <select
                    value={invoiceFormData.status}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, status: e.target.value })}
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Description
                  </label>
                  <textarea
                    value={invoiceFormData.description}
                    onChange={(e) => setInvoiceFormData({ ...invoiceFormData, description: e.target.value })}
                    rows={3}
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setShowInvoiceModal(false); setEditingInvoice(null); resetInvoiceForm(); }}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    background: '#0f172a',
                    color: '#fff',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  {editingInvoice ? 'Update Invoice' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid #e5e5e5'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>
                {editingPayment ? 'Edit Payment' : 'New Payment'}
              </h3>
              <button
                onClick={() => { setShowModal(false); setEditingPayment(null); resetForm(); }}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreatePayment} style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gap: '16px' }}>
                {/* Subcontractor */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Subcontractor *
                  </label>
                  <select
                    value={formData.subcontractor_id}
                    onChange={(e) => setFormData({ ...formData, subcontractor_id: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  >
                    <option value="">Select subcontractor</option>
                    {subcontractors.map((sub) => (
                      <option key={sub.id} value={sub.id}>{sub.company_name}</option>
                    ))}
                  </select>
                </div>

                {/* Work Order */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Work Order (Optional)
                  </label>
                  <select
                    value={formData.work_order_id}
                    onChange={(e) => setFormData({ ...formData, work_order_id: e.target.value })}
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  >
                    <option value="">Select work order</option>
                    {workOrders.filter(wo => wo.subcontractor_id === formData.subcontractor_id).map((wo) => (
                      <option key={wo.id} value={wo.id}>{wo.work_order_no}</option>
                    ))}
                  </select>
                </div>

                {/* Gross Amount */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Gross Amount *
                  </label>
                  <input
                    type="number"
                    value={formData.gross_amount}
                    onChange={(e) => {
                      const gross = parseFloat(e.target.value) || 0;
                      const tdsPercent = parseFloat(formData.tds_percentage) || 0;
                      const tdsAmount = (gross * tdsPercent) / 100;
                      const netAmount = gross - tdsAmount;
                      setFormData({ ...formData, gross_amount: e.target.value, tds_amount: tdsAmount.toString(), net_amount: netAmount.toString() });
                    }}
                    required
                    step="0.01"
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* TDS Percentage */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    TDS Percentage %
                  </label>
                  <input
                    type="number"
                    value={formData.tds_percentage}
                    onChange={(e) => {
                      const tdsPercent = parseFloat(e.target.value) || 0;
                      const gross = parseFloat(formData.gross_amount) || 0;
                      const tdsAmount = (gross * tdsPercent) / 100;
                      const netAmount = gross - tdsAmount;
                      setFormData({ ...formData, tds_percentage: e.target.value, tds_amount: tdsAmount.toString(), net_amount: netAmount.toString() });
                    }}
                    step="0.01"
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* TDS Amount (Read-only) */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    TDS Amount
                  </label>
                  <input
                    type="number"
                    value={formData.tds_amount}
                    readOnly
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      background: '#f8fafc',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Net Amount (Read-only) */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Net Amount
                  </label>
                  <input
                    type="number"
                    value={formData.net_amount}
                    readOnly
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      background: '#f8fafc',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Payment Date */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Payment Mode */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Payment Mode *
                  </label>
                  <select
                    value={formData.payment_mode}
                    onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="UPI">UPI</option>
                    <option value="RTGS/NEFT">RTGS/NEFT</option>
                  </select>
                </div>

                {/* Reference No */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Reference No
                  </label>
                  <input
                    type="text"
                    value={formData.reference_no}
                    onChange={(e) => setFormData({ ...formData, reference_no: e.target.value })}
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Description */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#64748b' }}>
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      fontSize: '14px',
                      outline: 'none',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingPayment(null); resetForm(); }}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    background: '#0f172a',
                    color: '#fff',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  {editingPayment ? 'Update Payment' : 'Create Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function SubcontractorInvoices({ onNavigate }: WithNavigate) {
  const { organisation } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (organisation?.id) {
      setIsLoading(true);
      supabase
        .from('subcontractor_invoices')
        .select('*, subcontractors(company_name)')
        .eq('organisation_id', organisation.id)
        .order('invoice_date', { ascending: false })
        .then(({ data }) => {
          setInvoices(data || []);
          setIsLoading(false);
        });
    }
  }, [organisation?.id]);

  if (isLoading) {
    return <div className="p-6">Loading invoices...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Subcontractor Invoices</h1>
      <AppTable
        data={invoices}
        columns={[
          { header: 'Invoice Date', accessorKey: 'invoice_date' },
          { header: 'Subcontractor', accessorKey: 'subcontractors.company_name' },
          { header: 'Invoice No', accessorKey: 'invoice_no' },
          { header: 'Amount', accessorKey: 'amount' },
          { header: 'Status', accessorKey: 'status' }
        ]}
      />
    </div>
  );
}

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
            <h1 className="text-3xl font-black tracking-tight text-zinc-900">Document Vault</h1>
            <button onClick={() => onNavigate('/subcontractors')} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-zinc-200 text-zinc-400">
              <X size={20} />
            </button>
        </div>

        <div className="rounded-[2.5rem] border border-zinc-200 bg-white p-10 shadow-xl shadow-zinc-200/50">
          <div className="mb-10 flex flex-wrap items-center gap-6">
            <div className="flex-1 min-w-[300px]">
              <label className="text-[11px] font-black uppercase tracking-widest text-zinc-400 ml-1 mb-2 block">Partner Selection</label>
              <select className="h-14 w-full rounded-2xl border border-zinc-100 bg-zinc-50 px-6 text-sm font-bold text-zinc-900 outline-none focus:bg-white focus:border-blue-500 transition-all shadow-inner" value={subId} onChange={e => setSubId(e.target.value)}>
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
            <div className="flex h-[300px] flex-col items-center justify-center gap-4 text-zinc-300">
              <ShieldCheck size={48} className="opacity-20" />
              <p className="text-sm font-bold uppercase tracking-[0.2em] opacity-50">Select Partner to Unlock Vault</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
               {documents.map(doc => (
                 <div key={doc.id} className="group relative rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-blue-100 hover:shadow-xl hover:shadow-blue-500/5">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-500 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                      <FileText size={20} />
                    </div>
                    <div className="line-clamp-2 text-[13px] font-black text-zinc-900 leading-tight mb-4">{doc.document_name}</div>
                    <a href={doc.document_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800">
                      View Asset <ChevronRight size={14} />
                    </a>
                 </div>
               ))}
               {documents.length === 0 && (
                 <div className="col-span-full py-20 text-center">
                    <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">No documents archived yet.</p>
                 </div>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


