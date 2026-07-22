import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { toast } from '@/lib/logger';
import { Building2, X, User, PhoneCall, Mail, Tags } from 'lucide-react';
import { currentOrgId } from '../lib/supabase';

interface QuickAddVendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (vendor: any) => void;
}

export function QuickAddVendorModal({ isOpen, onClose, onSuccess }: QuickAddVendorModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    company_name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    gstin: '',
    pan: '',
    gst_treatment: '',
    msme_register_type: '',
    msme_number: ''
  });

  const addVendorMutation = useMutation({
    mutationFn: async (newVendor: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const organisationId = await currentOrgId(user.id);
      if (!organisationId) throw new Error('User not associated with any organisation');

      const { data, error } = await supabase
        .from('purchase_vendors')
        .insert([{
          ...newVendor,
          organisation_id: organisationId,
          vendor_code: `VN-${Date.now()}`,
          status: 'Active',
          created_at: new Date().toISOString()
        }])
        .select();

      if (error) throw error;
      return data[0];
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast.success('Vendor onboarded successfully');
      setFormData({
        company_name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        gstin: '',
        pan: '',
        gst_treatment: '',
        msme_register_type: '',
        msme_number: ''
      });
      if (onSuccess) onSuccess(data);
      onClose();
    },
    onError: (error: any) => {
      toast.error(`Error adding vendor: ${error.message}`);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.company_name) return;
    addVendorMutation.mutate(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center p-6 font-[Inter] animate-in fade-in duration-200" style={{ zIndex: 20000 }}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-all duration-200" 
        onClick={onClose}
      />
      
      {/* Modal Surface */}
      <div className="relative w-full max-w-[560px] bg-white rounded-lg border border-zinc-200 shadow-xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 max-h-[calc(100vh-48px)]">
        
        {/* Header Block */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 border border-blue-100 rounded-md flex items-center justify-center text-[#185FA5]">
               <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900 leading-none">
                Add New Vendor
              </h2>
            </div>
          </div>
          
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md bg-transparent flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Body & Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-auto">
          <div className="p-6 space-y-4">
            {/* Field: Company Name */}
            <div className="group">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                Vendor Company Name <span className="text-rose-500">*</span>
              </label>
              <input
                autoFocus
                type="text"
                required
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="Acme Supplies Ltd"
                className="w-full h-[38px] bg-[#F8F9FA] border border-zinc-200 rounded-md px-3 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#185FA5] focus:bg-white transition-all"
              />
            </div>

            {/* Split Grid row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="group">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Contact Person (POC)
                </label>
                <input
                  type="text"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  placeholder="Primary Contact"
                  className="w-full h-[38px] bg-[#F8F9FA] border border-zinc-200 rounded-md px-3 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#185FA5] focus:bg-white transition-all"
                />
              </div>
              <div className="group">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91..."
                  className="w-full h-[38px] bg-[#F8F9FA] border border-zinc-200 rounded-md px-3 text-[13px] font-mono text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:border-[#185FA5] focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="group">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="sales@company.com"
                className="w-full h-[38px] bg-[#F8F9FA] border border-zinc-200 rounded-md px-3 text-[13px] font-mono text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#185FA5] focus:bg-white transition-all"
              />
            </div>

            <div className="group">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                Street Address
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Industrial Area"
                className="w-full h-[38px] bg-[#F8F9FA] border border-zinc-200 rounded-md px-3 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#185FA5] focus:bg-white transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="group">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  GSTIN
                </label>
                <input
                  type="text"
                  value={formData.gstin}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                  placeholder="22AAAAA0000A1Z5"
                  className="w-full h-[38px] bg-[#F8F9FA] border border-zinc-200 rounded-md px-3 text-[13px] font-mono text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#185FA5] focus:bg-white transition-all uppercase"
                />
              </div>
              <div className="group">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  PAN
                </label>
                <input
                  type="text"
                  value={formData.pan}
                  onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                  placeholder="ABCDE1234F"
                  className="w-full h-[38px] bg-[#F8F9FA] border border-zinc-200 rounded-md px-3 text-[13px] font-mono text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#185FA5] focus:bg-white transition-all uppercase"
                />
              </div>
            </div>

            <div className="group">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                GST Treatment
              </label>
              <select
                value={formData.gst_treatment}
                onChange={(e) => setFormData({ ...formData, gst_treatment: e.target.value })}
                className="w-full h-[38px] bg-[#F8F9FA] border border-zinc-200 rounded-md px-3 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#185FA5] focus:bg-white transition-all"
              >
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

            <div className="grid grid-cols-2 gap-4">
              <div className="group">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  MSME Type
                </label>
                <select
                  value={formData.msme_register_type}
                  onChange={(e) => setFormData({ ...formData, msme_register_type: e.target.value })}
                  className="w-full h-[38px] bg-[#F8F9FA] border border-zinc-200 rounded-md px-3 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#185FA5] focus:bg-white transition-all"
                >
                  <option value="">Select Type</option>
                  <option value="micro">Micro Enterprise</option>
                  <option value="small">Small Enterprise</option>
                  <option value="medium">Medium Enterprise</option>
                </select>
              </div>
              <div className="group">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  MSME Number
                </label>
                <input
                  type="text"
                  value={formData.msme_number}
                  onChange={(e) => setFormData({ ...formData, msme_number: e.target.value.toUpperCase() })}
                  placeholder="UDYAM Number"
                  className="w-full h-[38px] bg-[#F8F9FA] border border-zinc-200 rounded-md px-3 text-[13px] font-mono text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#185FA5] focus:bg-white transition-all uppercase"
                />
              </div>
            </div>
          </div>

          {/* Footer Block */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-200 shrink-0 bg-zinc-50/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-zinc-300 rounded-md text-[12px] font-semibold text-zinc-700 bg-white hover:bg-zinc-50 transition-colors"
              style={{ padding: '7px 16px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addVendorMutation.isPending}
              className="px-4 py-2 rounded-md text-[12px] font-semibold text-white bg-[#185FA5] border border-[#185FA5] hover:bg-[#0C447C] hover:border-[#0C447C] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm"
              style={{ padding: '7px 16px' }}
            >
              {addVendorMutation.isPending ? 'Saving...' : 'Add Vendor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
