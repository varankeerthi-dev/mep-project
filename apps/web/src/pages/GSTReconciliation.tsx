import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { getGSTReconciliation, getGSTInwardSupply, GSTReconciliation, GSTInwardSupply } from '@/gst/api';

export default function GSTReconciliation() {
  const { organisation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reconciliations, setReconciliations] = useState<GSTReconciliation[]>([]);
  const [inwardSupply, setInwardSupply] = useState<GSTInwardSupply[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (organisation?.id) {
      loadData();
    }
  }, [organisation]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [reconciliationData, supplyData] = await Promise.all([
        getGSTReconciliation(organisation.id),
        getGSTInwardSupply(organisation.id)
      ]);
      
      setReconciliations(reconciliationData);
      setInwardSupply(supplyData);
    } catch (err) {
      console.error('Error loading reconciliation data:', err);
      setError('Failed to load reconciliation data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">GST Reconciliation</h1>
          <p className="text-gray-600">Reconcile GST data between your internal records and GST portal</p>
        </div>
        <div className="text-center py-12">
          <div className="animate-pulse">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">GST Reconciliation</h1>
          <p className="text-gray-600">Reconcile GST data between your internal records and GST portal</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const latestReconciliation = reconciliations[0];
  const matchedCount = inwardSupply.filter(item => item.reconciliation_status === 'MATCHED').length;
  const mismatchedCount = inwardSupply.filter(item => item.reconciliation_status === 'MISMATCH').length;
  const pendingCount = inwardSupply.filter(item => item.reconciliation_status === 'PENDING').length;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">GST Reconciliation</h1>
        <p className="text-gray-600">Reconcile GST data between your internal records and GST portal</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inwardSupply.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Matched</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{matchedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Mismatched</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{mismatchedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Reconciliation Status</CardTitle>
        </CardHeader>
        <CardContent>
          {latestReconciliation ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">Reconciliation Details</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Type:</span>
                      <span className="font-medium">{latestReconciliation.reconciliation_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Period:</span>
                      <span className="font-medium">
                        {latestReconciliation.period_month}/{latestReconciliation.period_year}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className={`font-medium ${
                        latestReconciliation.status === 'COMPLETED' ? 'text-green-600' :
                        latestReconciliation.status === 'IN_PROGRESS' ? 'text-blue-600' :
                        latestReconciliation.status === 'FAILED' ? 'text-red-600' :
                        'text-gray-600'
                      }`}>
                        {latestReconciliation.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Last Run:</span>
                      <span className="font-medium">
                        {latestReconciliation.performed_at 
                          ? new Date(latestReconciliation.performed_at).toLocaleString() 
                          : 'Never'}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">Reconciliation Results</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Records:</span>
                      <span className="font-medium">{latestReconciliation.total_records}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Matched:</span>
                      <span className="font-medium text-green-600">{latestReconciliation.matched_records}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Mismatched:</span>
                      <span className="font-medium text-red-600">{latestReconciliation.mismatched_records}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Manual Review:</span>
                      <span className="font-medium text-yellow-600">{latestReconciliation.manual_records}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No reconciliation records found. Start a new reconciliation to match your data with GSTR-2B.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inward Supply Reconciliation Status</CardTitle>
        </CardHeader>
        <CardContent>
          {inwardSupply.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No inward supply records found. Import GSTR-2B data to begin reconciliation.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Invoice No</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Date</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Taxable Value</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Total Tax</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">ITC Eligible</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Reconciliation Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {inwardSupply.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm">{item.invoice_number}</td>
                      <td className="px-4 py-2 text-sm">{new Date(item.invoice_date).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{item.taxable_value.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{(item.igst + item.cgst + item.sgst + item.cess).toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm">
                        {item.itc_eligible ? (
                          <span className="text-green-600">Yes</span>
                        ) : (
                          <span className="text-red-600">No</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${
                          item.reconciliation_status === 'MATCHED' ? 'bg-green-100 text-green-800' :
                          item.reconciliation_status === 'MISMATCH' ? 'bg-red-100 text-red-800' :
                          item.reconciliation_status === 'MANUAL' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {item.reconciliation_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}