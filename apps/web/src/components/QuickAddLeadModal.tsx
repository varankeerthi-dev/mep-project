import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { toast } from '@/lib/logger';
import { Building2, X, User, PhoneCall, Mail, Tags } from 'lucide-react';
import { currentOrgId } from '../lib/supabase';

interface QuickAddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (lead: any) => void;
}

export function QuickAddLeadModal({ isOpen, onClose, onSuccess }: QuickAddLeadModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    contact_name: '',
    company_name: '',
    contact_phone: '',
    contact_email: '',
    city: '',
    state: '',
    source: 'Referral'
  });

  const addLeadMutation = useMutation({
    mutationFn: async (newLead: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const organisationId = await currentOrgId(user.id);
      if (!organisationId) throw new Error('User not associated with any organisation');

      // Fetch the 'New' lead status ID dynamically
      const { data: statusRows } = await supabase
        .from('lead_statuses')
        .select('id')
        .eq('name', 'New')
        .limit(1);
      
      const leadStatusId = statusRows && statusRows.length > 0 ? statusRows[0].id : null;

      const { data, error } = await supabase
        .from('leads')
        .insert([{
          ...newLead,
          organisation_id: organisationId,
          status: 'New',
          lead_status_id: leadStatusId,
          owner_user_id: user.id,
          created_by: user.id,
          created_at: new Date().toISOString()
        }])
        .select();

      if (error) throw error;
      return data[0];
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead onboarded successfully');
      setFormData({
        contact_name: '',
        company_name: '',
        contact_phone: '',
        contact_email: '',
        city: '',
        state: '',
        source: 'Referral'
      });
      if (onSuccess) onSuccess(data);
      onClose();
    },
    onError: (error: any) => {
      toast.error(`Error adding lead: ${error.message}`);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contact_name) return;
    addLeadMutation.mutate(formData);
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
               <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900 leading-none">
                Add New Lead
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
            {/* Field: Lead / Contact Name */}
            <div className="group">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                Lead / Contact Name <span className="text-rose-500">*</span>
              </label>
              <input
                autoFocus
                type="text"
                required
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                placeholder="John Doe"
                className="w-full h-[38px] bg-[#F8F9FA] border border-zinc-200 rounded-md px-3 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#185FA5] focus:bg-white transition-all"
              />
            </div>

            {/* Field: Company Name */}
            <div className="group">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                Company Name
              </label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="Acme Corp"
                className="w-full h-[38px] bg-[#F8F9FA] border border-zinc-200 rounded-md px-3 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#185FA5] focus:bg-white transition-all"
              />
            </div>

            {/* Split Grid row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="group">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  placeholder="+91..."
                  className="w-full h-[38px] bg-[#F8F9FA] border border-zinc-200 rounded-md px-3 text-[13px] font-mono text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:border-[#185FA5] focus:bg-white transition-all"
                />
              </div>
              <div className="group">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  placeholder="john@company.com"
                  className="w-full h-[38px] bg-[#F8F9FA] border border-zinc-200 rounded-md px-3 text-[13px] font-mono text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#185FA5] focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="group">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  City
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="City"
                  className="w-full h-[38px] bg-[#F8F9FA] border border-zinc-200 rounded-md px-3 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#185FA5] focus:bg-white transition-all"
                />
              </div>
              <div className="group">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  State
                </label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="State"
                  className="w-full h-[38px] bg-[#F8F9FA] border border-zinc-200 rounded-md px-3 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#185FA5] focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="group">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                Lead Source
              </label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                className="w-full h-[38px] bg-[#F8F9FA] border border-zinc-200 rounded-md px-3 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#185FA5] focus:bg-white transition-all"
              >
                <option value="Referral">Referral</option>
                <option value="Cold Call">Cold Call</option>
                <option value="Website">Website</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="Trade Show">Trade Show</option>
                <option value="Advertisement">Advertisement</option>
              </select>
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
              disabled={addLeadMutation.isPending}
              className="px-4 py-2 rounded-md text-[12px] font-semibold text-white bg-[#185FA5] border border-[#185FA5] hover:bg-[#0C447C] hover:border-[#0C447C] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm"
              style={{ padding: '7px 16px' }}
            >
              {addLeadMutation.isPending ? 'Saving...' : 'Add Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
