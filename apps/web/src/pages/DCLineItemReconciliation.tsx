import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FileCheck, AlertCircle, CheckCircle, Search, Layers } from 'lucide-react';

interface DCLineAllocation {
  id: string;
  dc_number: string;
  material_name: string;
  delivered_qty: number;
  allocated_qty: number;
  unit_rate: number;
  status: 'pending' | 'allocated' | 'reconciled';
  created_at: string;
}

export const DCLineItemReconciliation: React.FC = () => {
  const [allocations, setAllocations] = useState<DCLineAllocation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    fetchAllocations();
  }, []);

  const fetchAllocations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('dc_line_allocations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllocations(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load Delivery Challan line item allocations');
    } finally {
      setLoading(false);
    }
  };

  const filtered = allocations.filter(
    (item) =>
      item.dc_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.material_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-indigo-600" />
            Delivery Challan Line-Item Reconciliation
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Line-item quantity cap matching to prevent over-billing or un-billed material items during DC-to-Quotation conversion.
          </p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
        <Search className="w-4 h-4 text-gray-400 ml-1" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter by DC Number or Material Description..."
          className="w-full text-sm border-none focus:outline-none focus:ring-0"
        />
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading DC line allocations...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileCheck className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-900">All Delivery Challan Items Reconciled</h3>
          <p className="mt-1 text-sm text-gray-500">No unallocated or mismatched line items across delivery challans.</p>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">DC Number</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Material Description</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Delivered Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Allocated Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Remaining Un-invoiced</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filtered.map((row) => {
                  const remaining = row.delivered_qty - row.allocated_qty;
                  return (
                    <tr key={row.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-900">
                        {row.dc_number || 'DC-2026-001'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                        {row.material_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {row.delivered_qty}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-700 font-semibold">
                        {row.allocated_qty}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                        <span className={remaining > 0 ? 'text-amber-600' : 'text-gray-500'}>
                          {remaining}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {remaining === 0 ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Reconciled
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            Partially Allocated
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
