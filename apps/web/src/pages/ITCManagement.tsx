import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { getGSTITCLedger, getGSTInwardSupply, GSTITCLedger, GSTInwardSupply } from '@/gst/api';

export default function ITCManagement() {
  const { organisation } = useAuth();
  const [loading, setLoading] = useState(true);
  const [itcLedger, setItcLedger] = useState<GSTITCLedger[]>([]);
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
      
      const [ledgerData, supplyData] = await Promise.all([
        getGSTITCLedger(organisation.id),
        getGSTInwardSupply(organisation.id)
      ]);
      
      setItcLedger(ledgerData);
      setInwardSupply(supplyData);
    } catch (err) {
      console.error('Error loading ITC data:', err);
      setError('Failed to load ITC data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">ITC Management</h1>
          <p className="text-gray-600">Manage Input Tax Credit</p>
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">ITC Management</h1>
          <p className="text-gray-600">Manage Input Tax Credit</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalAvailable = itcLedger.reduce((sum, item) => sum + item.credit_available, 0);
  const totalUtilized = itcLedger.reduce((sum, item) => sum + item.credit_utilized, 0);
  const totalBlocked = itcLedger.reduce((sum, item) => sum + item.credit_blocked, 0);
  const eligibleITC = inwardSupply.filter(item => item.itc_eligible && !item.itc_blocked);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">ITC Management</h1>
        <p className="text-gray-600">Manage Input Tax Credit</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Available ITC</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">₹{totalAvailable.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Utilized ITC</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">₹{totalUtilized.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Blocked ITC</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">₹{totalBlocked.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Eligible Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{eligibleITC.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>ITC Ledger Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {itcLedger.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No ITC ledger records found. Data will be populated from your inward supplies.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Period</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">ITC Type</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Opening Balance</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Credit Available</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Credit Utilized</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Credit Blocked</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Closing Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {itcLedger.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm">{item.period_month}/{item.period_year}</td>
                      <td className="px-4 py-2 text-sm">{item.itc_type}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{item.opening_balance.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{item.credit_available.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{item.credit_utilized.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{item.credit_blocked.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{item.closing_balance.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ITC Eligible Inward Supplies</CardTitle>
        </CardHeader>
        <CardContent>
          {eligibleITC.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No ITC-eligible inward supplies found.
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
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">CESS</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {eligibleITC.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm">{item.invoice_number}</td>
                      <td className="px-4 py-2 text-sm">{new Date(item.invoice_date).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{item.taxable_value.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{item.igst.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{item.cgst.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{item.sgst.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-right">₹{item.cess.toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className="text-green-600">Eligible</span>
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