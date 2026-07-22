import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, CheckCircle, Clock, ShieldAlert, Plus, UserCheck, FileText } from 'lucide-react';

interface FieldVariationIntent {
  id: string;
  project_id: string;
  site_engineer_name: string;
  client_rep_name: string;
  client_rep_phone: string;
  scope_description: string;
  estimated_cost: number;
  photo_urls: string[];
  status: 'pending_acknowledgment' | 'acknowledged' | 'pm_overridden' | 'rejected';
  acknowledged_at?: string;
  pm_override_reason?: string;
  created_at: string;
}

export const FieldVariationsList: React.FC = () => {
  const { user } = useAuth();
  const [intents, setIntents] = useState<FieldVariationIntent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showOverrideModal, setShowOverrideModal] = useState<boolean>(false);
  const [selectedIntentId, setSelectedIntentId] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState<string>('');

  useEffect(() => {
    fetchIntents();
  }, []);

  const fetchIntents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('field_variation_intents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIntents(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch field variation intents');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (id: string) => {
    try {
      const { error } = await supabase
        .from('field_variation_intents')
        .update({
          status: 'acknowledged',
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      fetchIntents();
    } catch (err: any) {
      alert(`Error acknowledging intent: ${err.message}`);
    }
  };

  const handlePMOverrideSubmit = async () => {
    if (!selectedIntentId || !overrideReason.trim()) {
      alert('Please enter a valid override reason.');
      return;
    }

    try {
      const { error } = await supabase
        .from('field_variation_intents')
        .update({
          status: 'pm_overridden',
          pm_override_reason: overrideReason,
          pm_override_by: user?.id,
          pm_overridden_at: new Date().toISOString()
        })
        .eq('id', selectedIntentId);

      if (error) throw error;
      setShowOverrideModal(false);
      setSelectedIntentId(null);
      setOverrideReason('');
      fetchIntents();
    } catch (err: any) {
      alert(`Error applying PM override: ${err.message}`);
    }
  };

  const getStatusBadge = (status: FieldVariationIntent['status']) => {
    switch (status) {
      case 'acknowledged':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Acknowledged by Client
          </span>
        );
      case 'pm_overridden':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            <ShieldAlert className="w-3.5 h-3.5 mr-1" /> Emergency PM Overridden
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
            <AlertCircle className="w-3.5 h-3.5 mr-1" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Clock className="w-3.5 h-3.5 mr-1" /> Pending Client Acknowledgment
          </span>
        );
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            Field Variation Intent Lock
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Prevent unapproved site work ("Ghost Work"). Site variation scope must be digitally acknowledged before execution.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading field variation intents...</div>
      ) : intents.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-900">No Pending Field Variations</h3>
          <p className="mt-1 text-sm text-gray-500">All site variations are fully authorized and locked.</p>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Engineer</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Client Representative</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Scope Description</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Est. Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {intents.map((intent) => (
                  <tr key={intent.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="font-medium">{new Date(intent.created_at).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-500">{intent.site_engineer_name || 'Site Eng'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="font-medium">{intent.client_rep_name}</div>
                      <div className="text-xs text-gray-500">{intent.client_rep_phone || 'No phone'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">
                      {intent.scope_description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      ₹{intent.estimated_cost?.toLocaleString('en-IN') || '0'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {getStatusBadge(intent.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      {intent.status === 'pending_acknowledgment' && (
                        <>
                          <button
                            onClick={() => handleAcknowledge(intent.id)}
                            className="inline-flex items-center px-3 py-1.5 border border-emerald-300 text-xs font-medium rounded-md text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                          >
                            <UserCheck className="w-3.5 h-3.5 mr-1" /> Acknowledge
                          </button>
                          <button
                            onClick={() => {
                              setSelectedIntentId(intent.id);
                              setShowOverrideModal(true);
                            }}
                            className="inline-flex items-center px-3 py-1.5 border border-amber-300 text-xs font-medium rounded-md text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                          >
                            <ShieldAlert className="w-3.5 h-3.5 mr-1" /> PM Override
                          </button>
                        </>
                      )}
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Emergency PM Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              Emergency PM Override Authorization
            </h3>
            <p className="text-xs text-gray-500">
              Site work is allowed to proceed immediately before client signature. Mandatory audit reason required.
            </p>
            <textarea
              rows={3}
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Enter operational reason (e.g. Urgent safety fix approved verbally by Client Lead)"
              className="w-full rounded-lg border-gray-300 shadow-sm text-sm p-3 border focus:ring-amber-500 focus:border-amber-500"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowOverrideModal(false);
                  setOverrideReason('');
                }}
                className="px-4 py-2 border border-gray-300 text-sm rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePMOverrideSubmit}
                className="px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 font-medium"
              >
                Authorize Emergency Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
