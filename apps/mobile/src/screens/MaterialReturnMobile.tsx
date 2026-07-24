import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Package, ArrowLeft, Send, CheckCircle2 } from 'lucide-react';

interface MaterialReturnMobileProps {
  onBack: () => void;
}

export function MaterialReturnMobile({ onBack }: MaterialReturnMobileProps) {
  const [materialName, setMaterialName] = useState('');
  const [uom, setUom] = useState('NOS');
  const [requestedQty, setRequestedQty] = useState('');
  const [condition, setCondition] = useState<'good' | 'scrap'>('good');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialName || !requestedQty) {
      alert('Material Name and Quantity are required.');
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('material_return_handshakes').insert([
        {
          site_engineer_id: user?.id || null,
          site_engineer_name: user?.user_metadata?.full_name || 'Site Engineer',
          material_name: materialName,
          uom: uom,
          requested_qty: parseFloat(requestedQty) || 0,
          claimed_condition: condition,
          status: 'in_transit'
        }
      ]);

      if (error) throw error;
      setSubmitted(true);
    } catch (err: any) {
      alert(`Failed to log return request: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 pb-24 font-sans">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center text-slate-400 hover:text-slate-200 text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </button>
        <span className="text-xs font-semibold uppercase tracking-wider text-teal-400 bg-teal-950/80 border border-teal-800/60 px-2.5 py-1 rounded-full">
          2-Step Handshake
        </span>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-50 flex items-center gap-2">
          <Package className="w-5 h-5 text-teal-400" />
          Site Material Return Request
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Return surplus or scrap materials to warehouse. Stock increments ONLY after storekeeper inspection.
        </p>
      </div>

      {submitted ? (
        <div className="bg-slate-900/90 border border-teal-500/30 rounded-xl p-6 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-teal-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-100">Return Dispatched</h3>
          <p className="text-xs text-slate-400">
            Material marked <strong className="text-amber-400">In-Transit</strong>. Awaiting warehouse storekeeper receipt handshake.
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setMaterialName('');
              setRequestedQty('');
            }}
            className="mt-4 px-4 py-2 bg-teal-500 text-slate-950 text-xs font-bold rounded-lg"
          >
            Log Another Return
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Material Name / Description *</label>
            <input
              type="text"
              required
              value={materialName}
              onChange={(e) => setMaterialName(e.target.value)}
              placeholder="e.g. Copper Pipe 1/2 inch / Butterfly Valve 80mm"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Quantity *</label>
              <input
                type="number"
                required
                value={requestedQty}
                onChange={(e) => setRequestedQty(e.target.value)}
                placeholder="10"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">UOM</label>
              <select
                value={uom}
                onChange={(e) => setUom(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:border-teal-500"
              >
                <option value="NOS">NOS</option>
                <option value="METERS">METERS</option>
                <option value="KG">KG</option>
                <option value="SETS">SETS</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Claimed Condition</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCondition('good')}
                className={`py-2 text-xs font-bold rounded-lg border ${
                  condition === 'good'
                    ? 'bg-teal-950 border-teal-500 text-teal-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                GOOD (Reusable)
              </button>
              <button
                type="button"
                onClick={() => setCondition('scrap')}
                className={`py-2 text-xs font-bold rounded-lg border ${
                  condition === 'scrap'
                    ? 'bg-rose-950 border-rose-500 text-rose-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                SCRAP (Damaged)
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {loading ? 'Dispatching...' : 'Dispatch Return to Warehouse'}
          </button>
        </form>
      )}
    </div>
  );
}
