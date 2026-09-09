import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { getGSTRCMLiability, GSTRCMLiability } from '@/gst/api';

export default function RCMManagement() {
  const { organisation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rcmLlabilities, setRcmLiabilities] = useState<GSTRCMLiability[]>([]);
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
      
      const liabilitiesData = await getGSTRCMLiability(organisation.id);
      setRcmLiabilities(liabilitiesData);
    } catch (err) {
      console.error('Error loading RCM data:', err);
      setError('Failed to load RCM data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">RCM Management</h1>
          <p className="text-gray-600">Reverse Charge Mechanism</p>
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">RCM Management</h1>
          <p className="text-gray-600">Reverse Charge Mechanism</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalLiability = rcmLiabilities.reduce((sum, item) => sum + item.total_tax, 0);
  const paidLiability = rcmLiabilities.filter(item => item.paid).reduce((sum, item) => sum + item.total_tax, 0);
  const unpaidLiability = rcmLiabilities.filter(item => !item.paid).reduce((sum, item) => sum + item.total_tax, 0);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">RCM Management</h1>
        <p className="text-gray-600">Reverse Charge Mechanism</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Liability</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalLiability.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">₹{paidLiability.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Unpaid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">₹{unpaidLiability.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rcmLlabilities.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>RCM Liabilities</CardTitle>
        </CardHeader>
        <CardContent>
          {rcmLlabilities.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No RCM liabilities found. Data will be populated from your reverse charge transactions.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Invoice No</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Date</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Taxable Value</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">IGST</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">CGST</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">SGST</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Total Tax</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Payment Status</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Payment Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rcmLlabilities.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm">{item.invoice_number}</td>
                      <td className="px-4 py-2 text-sm">{new Date(item.invoice_date).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{item.taxable_value.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{item.igst.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{item.cgst.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{item.sgst.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{item.total_tax.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm">
                        {item.paid ? (
                          <span className="text-green-600">Paid</span>
                        ) : (
                          <span className="text-red-600">Unpaid</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {item.paid_date 
                          ? new Date(item.paid_date).toLocaleDateString() 
                          : '—'}
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