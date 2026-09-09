import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { getGSTInwardSupply, getGSTReturns, GSTInwardSupply, GSTReturn } from '@/gst/api';

export default function GSTR2B() {
  const { organisation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [inwardSupply, setInwardSupply] = useState<GSTInwardSupply[]>([]);
  const [returns, setReturns] = useState<GSTReturn[]>([]);
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
      
      const [supplyData, returnsData] = await Promise.all([
        getGSTInwardSupply(organisation.id),
        getGSTReturns(organisation.id, undefined, undefined)
      ]);
      
      setInwardSupply(supplyData);
      setReturns(returnsData.filter(r => r.return_type === 'GSTR2B'));
    } catch (err) {
      console.error('Error loading GSTR-2B data:', err);
      setError('Failed to load GSTR-2B data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">GSTR-2B</h1>
          <p className="text-gray-600">View and reconcile inward supplies</p>
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">GSTR-2B</h1>
          <p className="text-gray-600">View and reconcile inward supplies</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const matchedRecords = inwardSupply.filter(item => item.reconciliation_status === 'MATCHED');
  const mismatchedRecords = inwardSupply.filter(item => item.reconciliation_status === 'MISMATCH');
  const pendingRecords = inwardSupply.filter(item => item.reconciliation_status === 'PENDING');

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">GSTR-2B</h1>
        <p className="text-gray-600">View and reconcile inward supplies</p>
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
            <div className="text-2xl font-bold text-green-600">{matchedRecords.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Mismatched</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{mismatchedRecords.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingRecords.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inward Supply Records</CardTitle>
        </CardHeader>
        <CardContent>
          {inwardSupply.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No inward supply records found. Import GSTR-2B data from GST portal to begin reconciliation.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Invoice No</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Date</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Type</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Taxable Value</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">IGST</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">CGST</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">SGST</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">ITC Status</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Reconciliation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {inwardSupply.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm">{item.invoice_number}</td>
                      <td className="px-4 py-2 text-sm">{new Date(item.invoice_date).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-sm">{item.invoice_type}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{item.taxable_value.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{item.igst.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{item.cgst.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{item.sgst.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm">
                        {item.itc_eligible ? (
                          <span className="text-green-600">Eligible</span>
                        ) : (
                          <span className="text-red-600">Blocked</span>
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