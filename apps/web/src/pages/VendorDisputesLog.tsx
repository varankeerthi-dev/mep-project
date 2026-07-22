import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldAlert, AlertCircle, Plus, Calendar, FileText, CheckCircle2 } from 'lucide-react';

interface VendorDisputeLog {
  id: string;
  vendor_id: string;
  vendor_name?: string;
  equipment_name: string;
  serial_number: string;
  invoice_date: string;
  commissioning_date: string;
  warranty_expiry_date: string;
  claim_reference_no: string;
  dispute_reason_code: 'improper_storage' | 'power_surge' | 'expired_window' | 'unauthorized_installation' | 'other';
  dispute_details: string;
  status: 'under_dispute' | 'accepted_by_vendor' | 'rejected_by_vendor' | 'settled_with_discount';
  created_at: string;
}

export const VendorDisputesLog: React.FC = () => {
  const [logs, setLogs] = useState<VendorDisputeLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [equipmentName, setEquipmentName] = useState<string>('');
  const [serialNo, setSerialNo] = useState<string>('');
  const [claimRef, setClaimRef] = useState<string>('');
  const [commissioningDate, setCommissioningDate] = useState<string>('');
  const [disputeCode, setDisputeCode] = useState<VendorDisputeLog['dispute_reason_code']>('improper_storage');
  const [details, setDetails] = useState<string>('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vendor_dispute_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load vendor dispute logs');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLog = async () => {
    if (!equipmentName.trim() || !serialNo.trim()) {
      alert('Equipment Name and Serial Number are required.');
      return;
    }

    try {
      const { error } = await supabase.from('vendor_dispute_logs').insert([{
        equipment_name: equipmentName,
        serial_number: serialNo,
        claim_reference_no: claimRef,
        commissioning_date: commissioningDate || null,
        dispute_reason_code: disputeCode,
        dispute_details: details,
        status: 'under_dispute'
      }]);

      if (error) throw error;

      setShowAddModal(false);
      setEquipmentName('');
      setSerialNo('');
      setClaimRef('');
      setCommissioningDate('');
      setDetails('');
      fetchLogs();
    } catch (err: any) {
      alert(`Error recording vendor dispute: ${err.message}`);
    }
  };

  const getReasonLabel = (code: VendorDisputeLog['dispute_reason_code']) => {
    switch (code) {
      case 'improper_storage': return 'Improper Storage / Site Exposure';
      case 'power_surge': return 'Electrical Power Surge';
      case 'expired_window': return 'Invoice Date Window Expiry';
      case 'unauthorized_installation': return 'Unauthorized Installation';
      default: return 'Other Operational Dispute';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-purple-600" />
            Serialized Warranty & Vendor Dispute Tracker
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Commissioning Date snapshotting and Vendor Dispute Reason logging to prevent absorbed warranty costs.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4 mr-1.5" /> Log Vendor Dispute Claim
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading warranty dispute logs...</div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-900">No Disputed Warranty Claims</h3>
          <p className="mt-1 text-sm text-gray-500">All equipment warranties are active and unchallenged.</p>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Equipment & Serial No.</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Claim Ref</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Commissioning Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Dispute Reason Code</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="font-bold text-gray-900">{log.equipment_name}</div>
                      <div className="text-xs text-gray-500 font-mono">S/N: {log.serial_number}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                      {log.claim_reference_no || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.commissioning_date ? (
                        <span className="inline-flex items-center text-xs text-gray-700">
                          <Calendar className="w-3.5 h-3.5 mr-1 text-purple-600" />
                          {new Date(log.commissioning_date).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600">Pending Certificate</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-800">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200">
                        {getReasonLabel(log.dispute_reason_code)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        {log.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-purple-600" />
              Log Warranty Claim Dispute
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Equipment Name *</label>
                <input
                  type="text"
                  value={equipmentName}
                  onChange={(e) => setEquipmentName(e.target.value)}
                  placeholder="e.g. 50TR Chiller Unit / Water Circulation Pump"
                  className="w-full rounded-lg border border-gray-300 p-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Serial Number *</label>
                <input
                  type="text"
                  value={serialNo}
                  onChange={(e) => setSerialNo(e.target.value)}
                  placeholder="e.g. SN-2026-CH-0982"
                  className="w-full rounded-lg border border-gray-300 p-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Claim Reference Number</label>
                <input
                  type="text"
                  value={claimRef}
                  onChange={(e) => setClaimRef(e.target.value)}
                  placeholder="e.g. CLM-88412"
                  className="w-full rounded-lg border border-gray-300 p-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Commissioning Date (Overrides Dispatch Date)</label>
                <input
                  type="date"
                  value={commissioningDate}
                  onChange={(e) => setCommissioningDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Vendor Dispute Reason Code *</label>
                <select
                  value={disputeCode}
                  onChange={(e: any) => setDisputeCode(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2 text-sm"
                >
                  <option value="improper_storage">Improper Storage / Site Exposure</option>
                  <option value="power_surge">Electrical Power Surge</option>
                  <option value="expired_window">Invoice Date Window Expiry</option>
                  <option value="unauthorized_installation">Unauthorized Installation</option>
                  <option value="other">Other Operational Dispute</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Dispute Details & Remarks</label>
                <textarea
                  rows={2}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Notes on vendor rejection letter..."
                  className="w-full rounded-lg border border-gray-300 p-2 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-gray-300 text-sm rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateLog}
                className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 font-medium"
              >
                Record Vendor Dispute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
