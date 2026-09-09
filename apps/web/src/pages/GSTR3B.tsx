import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { getGSTReturns, GSTReturn } from '@/gst/api';

export default function GSTR3B() {
  const { organisation } = useAuth();
  const [loading, setLoading] = useState(true);
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
      
      const returnsData = await getGSTReturns(organisation.id, undefined, undefined);
      setReturns(returnsData.filter(r => r.return_type === 'GSTR3B'));
    } catch (err) {
      console.error('Error loading GSTR-3B data:', err);
      setError('Failed to load GSTR-3B data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">GSTR-3B</h1>
          <p className="text-gray-600">File monthly GST returns</p>
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">GSTR-3B</h1>
          <p className="text-gray-600">File monthly GST returns</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentMonthReturn = returns[0];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">GSTR-3B</h1>
        <p className="text-gray-600">File monthly GST returns</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Filing Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentMonthReturn?.filing_status || 'PENDING'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Taxable Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{(currentMonthReturn?.total_taxable_value || 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Tax Liability</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{(currentMonthReturn?.total_tax || 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Due Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentMonthReturn?.due_date 
                ? new Date(currentMonthReturn.due_date).toLocaleDateString() 
                : 'Not Set'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>GSTR-3B Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {currentMonthReturn ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">Outward Supplies</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Taxable Value:</span>
                      <span className="font-medium">₹{currentMonthReturn.total_taxable_value.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Integrated Tax (IGST):</span>
                      <span className="font-medium">₹{currentMonthReturn.total_igst.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Central Tax (CGST):</span>
                      <span className="font-medium">₹{currentMonthReturn.total_cgst.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">State/UT Tax (SGST):</span>
                      <span className="font-medium">₹{currentMonthReturn.total_sgst.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">Filing Information</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Period:</span>
                      <span className="font-medium">
                        {currentMonthReturn.period_month}/{currentMonthReturn.period_year}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className={`font-medium ${
                        currentMonthReturn.filing_status === 'FILED' ? 'text-green-600' :
                        currentMonthReturn.filing_status === 'PENDING' ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {currentMonthReturn.filing_status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Filing Date:</span>
                      <span className="font-medium">
                        {currentMonthReturn.filing_date 
                          ? new Date(currentMonthReturn.filing_date).toLocaleDateString() 
                          : 'Not Filed'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Due Date:</span>
                      <span className="font-medium">
                        {currentMonthReturn.due_date 
                          ? new Date(currentMonthReturn.due_date).toLocaleDateString() 
                          : 'Not Set'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No GSTR-3B return data found for current period. Create a new return to begin filing.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}