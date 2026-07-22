import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { PackageCheck, AlertTriangle, CheckCircle, Clock, ShieldCheck, Warehouse } from 'lucide-react';

interface MaterialReturnHandshake {
  id: string;
  project_id: string;
  material_name: string;
  uom: string;
  requested_qty: number;
  received_good_qty: number;
  received_scrap_qty: number;
  claimed_condition: 'good' | 'scrap' | 'mixed';
  status: 'in_transit' | 'verified_good' | 'verified_scrap' | 'rejected_by_storekeeper';
  site_engineer_name: string;
  submitted_at: string;
}

export const MaterialReturnVerification: React.FC = () => {
  const { user } = useAuth();
  const [returns, setReturns] = useState<MaterialReturnHandshake[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedReturn, setSelectedReturn] = useState<MaterialReturnHandshake | null>(null);
  const [goodQty, setGoodQty] = useState<number>(0);
  const [scrapQty, setScrapQty] = useState<number>(0);
  const [scrapReason, setScrapReason] = useState<string>('damaged_on_site');

  useEffect(() => {
    fetchReturns();
  }, []);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('material_return_handshakes')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setReturns(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load material return requests');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenVerifyModal = (item: MaterialReturnHandshake) => {
    setSelectedReturn(item);
    setGoodQty(item.claimed_condition === 'good' ? item.requested_qty : 0);
    setScrapQty(item.claimed_condition === 'scrap' ? item.requested_qty : 0);
  };

  const handleConfirmVerification = async () => {
    if (!selectedReturn) return;

    try {
      const isScrap = scrapQty > 0 && goodQty === 0;
      const status = isScrap ? 'verified_scrap' : 'verified_good';

      const { error } = await supabase
        .from('material_return_handshakes')
        .update({
          received_good_qty: goodQty,
          received_scrap_qty: scrapQty,
          verified_condition: isScrap ? 'scrap' : 'good',
          scrap_reason_code: scrapQty > 0 ? scrapReason : null,
          status: status,
          storekeeper_id: user?.id,
          storekeeper_name: user?.email || 'Storekeeper',
          verified_at: new Date().toISOString()
        })
        .eq('id', selectedReturn.id);

      if (error) throw error;

      setSelectedReturn(null);
      fetchReturns();
    } catch (err: any) {
      alert(`Error conducting verification handshake: ${err.message}`);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Warehouse className="w-6 h-6 text-emerald-600" />
            Warehouse 2-Step Material Return Handshake
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Physical stock increments ONLY after Storekeeper verification and acceptance of In-Transit site returns.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading material return queue...</div>
      ) : returns.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-900">Return Queue Clear</h3>
          <p className="mt-1 text-sm text-gray-500">No pending In-Transit returns requiring warehouse verification.</p>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Engineer</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Material Description</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Claimed Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Claimed Condition</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {returns.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="font-medium">{new Date(item.submitted_at).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-500">{item.site_engineer_name || 'Site Eng'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      {item.material_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.requested_qty} {item.uom}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        item.claimed_condition === 'good' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {item.claimed_condition.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {item.status === 'in_transit' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          <Clock className="w-3.5 h-3.5 mr-1" /> In-Transit (Pending Receipt)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          <CheckCircle className="w-3.5 h-3.5 mr-1" /> Verified & Stocked
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {item.status === 'in_transit' && (
                        <button
                          onClick={() => handleOpenVerifyModal(item)}
                          className="inline-flex items-center px-3 py-1.5 border border-emerald-300 text-xs font-medium rounded-md text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                        >
                          <PackageCheck className="w-3.5 h-3.5 mr-1" /> Conduct Handshake
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Handshake Modal */}
      {selectedReturn && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-emerald-600" />
              Physical Storekeeper Inspection Handshake
            </h3>
            <p className="text-xs text-gray-500">
              Material: <strong className="text-gray-900">{selectedReturn.material_name}</strong> ({selectedReturn.requested_qty} {selectedReturn.uom})
            </p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Good Condition Qty (Physical Stock Increment)</label>
                <input
                  type="number"
                  value={goodQty}
                  onChange={(e) => setGoodQty(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 p-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Scrap / Damaged Qty (Write-off)</label>
                <input
                  type="number"
                  value={scrapQty}
                  onChange={(e) => setScrapQty(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 p-2 text-sm"
                />
              </div>

              {scrapQty > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Scrap Reason Code</label>
                  <select
                    value={scrapReason}
                    onChange={(e) => setScrapReason(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2 text-sm"
                  >
                    <option value="damaged_on_site">Damaged during installation</option>
                    <option value="cut_piece_scrap">Off-cut / Unusable piece</option>
                    <option value="transit_damage">Transit Damage</option>
                    <option value="rust_degraded">Corrosion / Rust</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button
                onClick={() => setSelectedReturn(null)}
                className="px-4 py-2 border border-gray-300 text-sm rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmVerification}
                className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 font-medium"
              >
                Confirm Verification & Update Stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
