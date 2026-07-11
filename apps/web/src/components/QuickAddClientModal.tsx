import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { toast } from '@/lib/logger';
import { 
  Building2, 
  X, 
  User, 
  PhoneCall, 
  Mail, 
  Tags, 
  MapPin,
  Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';

interface QuickAddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (client: any) => void;
}

export function QuickAddClientModal({ isOpen, onClose, onSuccess }: QuickAddClientModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    client_name: '',
    client_type: '',
    contact_person: '',
    phone: '',
    email: '',
    city: '',
    msme_register_type: '',
    msme_number: '',
    gst_treatment: ''
  });

  const addClientMutation = useMutation({
    mutationFn: async (newClient: any) => {
      const { client_type, phone, ...rest } = newClient;
      const { data, error } = await supabase
        .from('clients')
        .insert([{
          ...rest,
          contact: phone,
          client_id: `CL-${Date.now()}`,
          created_at: new Date().toISOString()
        }])
        .select();
      if (error) throw error;
      return data[0];
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client onboarded successfully');
      setFormData({
        client_name: '',
        client_type: '',
        contact_person: '',
        phone: '',
        email: '',
        city: '',
        msme_register_type: '',
        msme_number: '',
        gst_treatment: ''
      });
      if (onSuccess) onSuccess(data);
      onClose();
    },
    onError: (error: any) => {
      toast.error(`Error adding client: ${error.message}`);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_name) return;
    addClientMutation.mutate(formData);
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
                Add New Client
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
            {/* Field: Client Name */}
            <div className="group">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                Client / Company Name <span className="text-rose-500">*</span>
              </label>
              <input
                autoFocus
                type="text"
                required
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                placeholder="Acme Industries LLC"
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
                  Type
                </label>
                <input
                  type="text"
                  value={formData.client_type}
                  onChange={(e) => setFormData({ ...formData, client_type: e.target.value })}
                  placeholder="e.g. Architect, Builder"
                  className="w-full h-[38px] bg-[#F8F9FA] border border-zinc-200 rounded-md px-3 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#185FA5] focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
            </div>
             
            <div className="group">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@company.com"
                  className="w-full h-[38px] bg-[#F8F9FA] border border-zinc-200 rounded-md px-3 text-[13px] font-mono text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#185FA5] focus:bg-white transition-all"
                />
                {formData.email.includes('@') && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500">
                    <Sparkles className="w-3.5 h-3.5 animate-in zoom-in" />
                  </div>
                )}
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
                  <option value="macro">Macro Enterprise</option>
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
              disabled={addClientMutation.isPending}
              className="px-4 py-2 rounded-md text-[12px] font-semibold text-white bg-[#185FA5] border border-[#185FA5] hover:bg-[#0C447C] hover:border-[#0C447C] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm"
              style={{ padding: '7px 16px' }}
            >
              {addClientMutation.isPending ? 'Saving...' : 'Add Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
