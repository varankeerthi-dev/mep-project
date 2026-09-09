import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { getGSTOutwardSupply, getGSTReturns, GSTOutwardSupply, GSTReturn } from '@/gst/api';

export default function GSTR1() {
  const { organisation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [outwardSupply, setOutwardSupply] = useState<GSTOutwardSupply[]>([]);
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
        getGSTOutwardSupply(organisation.id),
        getGSTReturns(organisation.id, undefined, undefined)
      ]);
      
      setOutwardSupply(supplyData);
      setReturns(returnsData.filter(r => r.return_type === 'GSTR1'));
    } catch (err) {
      console.error('Error loading GSTR-1 data:', err);
      setError('Failed to load GSTR-1 data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">GSTR-1</h1>
          <p className="text-gray-600">File outward supply returns</p>
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">GSTR-1</h1>
          <p className="text-gray-600">File outward supply returns</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">GSTR-1</h1>
        <p className="text-gray-600">File outward supply returns</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{outwardSupply.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Taxable Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{outwardSupply.reduce((sum, item) => sum + (item.taxable_value || 0), 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Tax</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{outwardSupply.reduce((sum, item) => sum + (item.igst + item.cgst + item.sgst + item.cess), 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Filing Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {returns.length > 0 ? returns[0].filing_status : 'PENDING'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Outward Supply Records</CardTitle>
        </CardHeader>
        <CardContent>
          {outwardSupply.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No outward supply records found. Data will be populated from your invoices and sales records.
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
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">CESS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {outwardSupply.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm">{item.invoice_number}</td>
                      <td className="px-4 py-2 text-sm">{new Date(item.invoice_date).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-sm">{item.invoice_type}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{item.taxable_value.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{item.igst.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{item.cgst.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{item.sgst.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{item.cess.toLocaleString()}</td>
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