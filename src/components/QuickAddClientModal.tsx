import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { toast } from 'sonner';
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
    city: ''
  });

  const addClientMutation = useMutation({
    mutationFn: async (newClient: any) => {
      const { data, error } = await supabase
        .from('clients')
        .insert([{
          ...newClient,
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
        city: ''
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center isolate p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[-1] transition-all duration-300 animate-in fade-in" 
        onClick={onClose}
      />
      
      {/* Modal Surface */}
      <div className="relative w-full max-w-[540px] bg-white rounded-[24px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 ease-out">
        
        {/* Editorial Top Accent */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
        
        {/* Header Block */}
        <div className="px-8 pt-10 pb-6 flex items-start justify-between">
          <div className="flex gap-4">
            <div className="w-12 h-12 bg-[oklch(0.97_0.02_260)] border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
               <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-[22px] font-bold text-slate-900 tracking-tight leading-none mb-1.5">
                Register Client Form
              </h2>
              <p className="text-[14px] text-slate-500 font-medium">
                Rapidly onboard a new enterprise node.
              </p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Diagonal Separator element (Aesthetic Detail) */}
        <div className="px-8"><div className="w-full h-[1px] bg-gradient-to-r from-slate-200 via-slate-100 to-transparent" /></div>

        <form onSubmit={handleSubmit} className="px-8 py-8 space-y-6">
          <div className="space-y-5">
            {/* Field: Client Name */}
             <div className="group">
                <label className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-widest text-slate-500 mb-2 group-focus-within:text-indigo-600 transition-colors">
                  <Building2 className="w-3.5 h-3.5" /> Corporation Name <span className="text-rose-500">*</span>
                </label>
                <input
                  autoFocus
                  type="text"
                  required
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  placeholder="Acme Industries LLC"
                  className="w-full h-12 bg-slate-50/50 border border-slate-200 rounded-xl px-4 text-[15px] font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all hover:bg-white"
                />
             </div>

             {/* Split Grid row */}
             <div className="grid grid-cols-2 gap-5">
                <div className="group">
                  <label className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-widest text-slate-500 mb-2 group-focus-within:text-indigo-600 transition-colors">
                    <User className="w-3.5 h-3.5" /> POC
                  </label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    placeholder="Primary Agent"
                    className="w-full h-12 bg-slate-50/50 border border-slate-200 rounded-xl px-4 text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all hover:bg-white"
                  />
                </div>
                <div className="group">
                  <label className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-widest text-slate-500 mb-2 group-focus-within:text-indigo-600 transition-colors">
                    <Tags className="w-3.5 h-3.5" /> Type
                  </label>
                  <input
                    type="text"
                    value={formData.client_type}
                    onChange={(e) => setFormData({ ...formData, client_type: e.target.value })}
                    placeholder="e.g. Architect, Builder"
                    className="w-full h-12 bg-slate-50/50 border border-slate-200 rounded-xl px-4 text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all hover:bg-white"
                  />
                </div>
             </div>

             <div className="grid grid-cols-2 gap-5">
                <div className="group">
                  <label className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-widest text-slate-500 mb-2 group-focus-within:text-indigo-600 transition-colors">
                    <PhoneCall className="w-3.5 h-3.5" /> Phone Trunk
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91..."
                    className="w-full h-12 bg-slate-50/50 border border-slate-200 rounded-xl px-4 text-[14px] font-mono text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all hover:bg-white"
                  />
                </div>
                <div className="group">
                  <label className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-widest text-slate-500 mb-2 group-focus-within:text-indigo-600 transition-colors">
                    <MapPin className="w-3.5 h-3.5" /> Region Hub
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="City Node"
                    className="w-full h-12 bg-slate-50/50 border border-slate-200 rounded-xl px-4 text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all hover:bg-white"
                  />
                </div>
             </div>
             
             <div className="group">
                <label className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-widest text-slate-500 mb-2 group-focus-within:text-indigo-600 transition-colors">
                  <Mail className="w-3.5 h-3.5" /> Digital Inbox
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="domain@com"
                    className="w-full h-12 bg-slate-50/50 border border-slate-200 rounded-xl px-4 text-[14px] font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all hover:bg-white pl-4"
                  />
                  {formData.email.includes('@') && (
                     <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500">
                        <Sparkles className="w-4 h-4 animate-in zoom-in" />
                     </div>
                  )}
                </div>
             </div>
          </div>

          <div className="pt-6 mt-6 flex items-center justify-between border-t border-slate-100">
            <span className="text-[12px] font-medium text-slate-400">
              ESC to dismiss
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 h-12 rounded-xl text-[14px] font-bold text-slate-500 hover:bg-slate-100 transition-colors"
              >
                Abort
              </button>
              <button
                type="submit"
                disabled={addClientMutation.isPending}
                className="px-8 h-12 rounded-xl text-[14px] font-bold text-white bg-slate-900 shadow-xl shadow-slate-900/20 hover:bg-slate-800 focus:ring-4 focus:ring-slate-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {addClientMutation.isPending ? 'Provisioning...' : 'Inject Client'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
