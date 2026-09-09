import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { getGSTReturns, getGSTInwardSupply, getGSTOutwardSupply, getGSTRCMLiability, getGSTITCLedger, GSTReturn, GSTInwardSupply, GSTOutwardSupply, GSTRCMLiability, GSTITCLedger } from '@/gst/api';

export default function GSTReports() {
  const { organisation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [returns, setReturns] = useState<GSTReturn[]>([]);
  const [inwardSupply, setInwardSupply] = useState<GSTInwardSupply[]>([]);
  const [outwardSupply, setOutwardSupply] = useState<GSTOutwardSupply[]>([]);
  const [rcmLlabilities, setRcmLiabilities] = useState<GSTRCMLiability[]>([]);
  const [itcLedger, setItcLedger] = useState<GSTITCLedger[]>([]);
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
      
      const [returnsData, inwardData, outwardData, rcmData, itcData] = await Promise.all([
        getGSTReturns(organisation.id),
        getGSTInwardSupply(organisation.id),
        getGSTOutwardSupply(organisation.id),
        getGSTRCMLiability(organisation.id),
        getGSTITCLedger(organisation.id)
      ]);
      
      setReturns(returnsData);
      setInwardSupply(inwardData);
      setOutwardSupply(outwardData);
      setRcmLiabilities(rcmData);
      setItcLedger(itcData);
    } catch (err) {
      console.error('Error loading GST reports data:', err);
      setError('Failed to load GST reports data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">GST Reports</h1>
          <p className="text-gray-600">Generate and export GST compliance reports</p>
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">GST Reports</h1>
          <p className="text-gray-600">Generate and export GST compliance reports</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalOutwardTax = outwardSupply.reduce((sum, item) => sum + (item.igst + item.cgst + item.sgst + item.cess), 0);
  const totalInwardTax = inwardSupply.reduce((sum, item) => sum + (item.igst + item.cgst + item.sgst + item.cess), 0);
  const totalRCM = rcmLiabilities.reduce((sum, item) => sum + item.total_tax, 0);
  const totalITC = itcLedger.reduce((sum, item) => sum + item.credit_available, 0);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">GST Reports</h1>
        <p className="text-gray-600">Generate and export GST compliance reports</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Outward Tax</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalOutwardTax.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">GSTR-1</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Inward Tax</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalInwardTax.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">GSTR-2B</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">RCM Liability</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalRCM.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">Reverse Charge</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Available ITC</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalITC.toLocaleString()}</div>
            <p className="text-xs text-gray-500 mt-1">Input Tax Credit</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>GSTR-1 Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Records:</span>
                <span className="font-medium">{outwardSupply.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Taxable Value:</span>
                <span className="font-medium">₹{outwardSupply.reduce((sum, item) => sum + item.taxable_value, 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Tax:</span>
                <span className="font-medium">₹{totalOutwardTax.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">IGST:</span>
                <span className="font-medium">₹{outwardSupply.reduce((sum, item) => sum + item.igst, 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">CGST + SGST:</span>
                <span className="font-medium">₹{(outwardSupply.reduce((sum, item) => sum + item.cgst, 0) + outwardSupply.reduce((sum, item) => sum + item.sgst, 0)).toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>GSTR-2B Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Records:</span>
                <span className="font-medium">{inwardSupply.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Taxable Value:</span>
                <span className="font-medium">₹{inwardSupply.reduce((sum, item) => sum + item.taxable_value, 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Tax:</span>
                <span className="font-medium">₹{totalInwardTax.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">ITC Eligible:</span>
                <span className="font-medium text-green-600">{inwardSupply.filter(item => item.itc_eligible).length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">ITC Blocked:</span>
                <span className="font-medium text-red-600">{inwardSupply.filter(item => item.itc_blocked).length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ITC Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Available ITC:</span>
                <span className="font-medium text-green-600">₹{totalITC.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Utilized ITC:</span>
                <span className="font-medium">₹{itcLedger.reduce((sum, item) => sum + item.credit_utilized, 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Blocked ITC:</span>
                <span className="font-medium text-red-600">₹{itcLedger.reduce((sum, item) => sum + item.credit_blocked, 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Closing Balance:</span>
                <span className="font-medium">₹{itcLedger.reduce((sum, item) => sum + item.closing_balance, 0).toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>RCM Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total RCM Liability:</span>
                <span className="font-medium">₹{totalRCM.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Paid RCM:</span>
                <span className="font-medium text-green-600">₹{rcmLlabilities.filter(item => item.paid).reduce((sum, item) => sum + item.total_tax, 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Unpaid RCM:</span>
                <span className="font-medium text-red-600">₹{rcmLlabilities.filter(item => !item.paid).reduce((sum, item) => sum + item.total_tax, 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Records:</span>
                <span className="font-medium">{rcmLlabilities.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Filing Status Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {returns.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No filing records found. GST returns will be tracked here once filed.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Return Type</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Period</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Status</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Total Tax</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Filing Date</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {returns.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm">{item.return_type}</td>
                      <td className="px-4 py-2 text-sm">{item.period_month}/{item.period_year}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${
                          item.filing_status === 'FILED' ? 'bg-green-100 text-green-800' :
                          item.filing_status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                          item.filing_status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {item.filing_status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-right">₹{item.total_tax.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm">
                        {item.filing_date 
                          ? new Date(item.filing_date).toLocaleDateString() 
                          : '—'}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {item.due_date 
                          ? new Date(item.due_date).toLocaleDateString() 
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