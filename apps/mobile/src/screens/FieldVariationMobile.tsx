import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldAlert, CheckCircle, Send, ArrowLeft, Camera } from 'lucide-react';

interface FieldVariationMobileProps {
  onBack: () => void;
}

export function FieldVariationMobile({ onBack }: FieldVariationMobileProps) {
  const [clientRepName, setClientRepName] = useState('');
  const [clientRepPhone, setClientRepPhone] = useState('');
  const [scopeDescription, setScopeDescription] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientRepName || !scopeDescription) {
      alert('Client Representative Name and Scope Description are required.');
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('field_variation_intents').insert([
        {
          site_engineer_id: user?.id || null,
          site_engineer_name: user?.user_metadata?.full_name || 'Site Engineer',
          client_rep_name: clientRepName,
          client_rep_phone: clientRepPhone,
          scope_description: scopeDescription,
          estimated_cost: parseFloat(estimatedCost) || 0,
          status: 'pending_acknowledgment'
        }
      ]);

      if (error) throw error;
      setSubmitted(true);
    } catch (err: any) {
      alert(`Failed to record variation intent: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 pb-24 font-sans">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center text-slate-400 hover:text-slate-200 text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </button>
        <span className="text-xs font-semibold uppercase tracking-wider text-teal-400 bg-teal-950/80 border border-teal-800/60 px-2.5 py-1 rounded-full">
          Governance Protocol
        </span>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-50 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-teal-400" />
          Field Variation Intent Lock
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Capture site variations before work begins to prevent unapproved "Ghost Work".
        </p>
      </div>

      {submitted ? (
        <div className="bg-slate-900/90 border border-teal-500/30 rounded-xl p-6 text-center space-y-3">
          <CheckCircle className="w-12 h-12 text-teal-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-100">Variation Intent Locked</h3>
          <p className="text-xs text-slate-400">
            Digital intent link sent for Client Representative acknowledgment. Status set to <strong className="text-amber-400">Pending Acknowledgment</strong>.
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setClientRepName('');
              setClientRepPhone('');
              setScopeDescription('');
              setEstimatedCost('');
            }}
            className="mt-4 px-4 py-2 bg-teal-500 text-slate-950 text-xs font-bold rounded-lg"
          >
            Log Another Intent
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Client Rep Name *</label>
            <input
              type="text"
              required
              value={clientRepName}
              onChange={(e) => setClientRepName(e.target.value)}
              placeholder="e.g. Mr. Rajesh (Client Site Manager)"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Client Rep Phone</label>
            <input
              type="tel"
              value={clientRepPhone}
              onChange={(e) => setClientRepPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Scope Description & Reason *</label>
            <textarea
              rows={3}
              required
              value={scopeDescription}
              onChange={(e) => setScopeDescription(e.target.value)}
              placeholder="Describe scope change requested on site (e.g. Rerouting 400mm ducting around beam)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Est. Material & Labor Impact (₹)</label>
            <input
              type="number"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
              placeholder="e.g. 15000"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div className="border border-dashed border-slate-800 rounded-lg p-3 text-center">
            <Camera className="w-5 h-5 text-slate-500 mx-auto mb-1" />
            <span className="text-xs text-slate-400">Photo Attachments (Optional)</span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {loading ? 'Locking Intent...' : 'Submit Field Intent'}
          </button>
        </form>
      )}
    </div>
  );
}
