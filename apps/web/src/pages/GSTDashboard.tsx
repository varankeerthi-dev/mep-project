import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, FileText, ArrowRightLeft, CreditCard, RefreshCw, FileText as DocumentIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export default function GSTDashboard() {
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">GST Dashboard</h1>
        <p className="text-gray-600">Manage your GST compliance, reconciliation, and reporting</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              GSTR-1
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">File outward supply returns</p>
            <button 
              onClick={() => navigate('/gst/gstr1')}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
            >
              Open GSTR-1
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              GSTR-2B
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">View and reconcile inward supplies</p>
            <button 
              onClick={() => navigate('/gst/gstr2b')}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
            >
              Open GSTR-2B
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              GSTR-3B
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">File monthly GST returns</p>
            <button 
              onClick={() => navigate('/gst/gstr3b')}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
            >
              Open GSTR-3B
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5" />
              Reconciliation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">Reconcile GST data between systems</p>
            <button 
              onClick={() => navigate('/gst/reconciliation')}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
            >
              Start Reconciliation
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              ITC Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">Manage Input Tax Credit</p>
            <button 
              onClick={() => navigate('/gst/itc')}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
            >
              Manage ITC
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              RCM
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">Reverse Charge Mechanism</p>
            <button 
              onClick={() => navigate('/gst/rcm')}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
            >
              Manage RCM
            </button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>GST Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button 
                onClick={() => navigate('/gst/gstr1')}
                className="flex items-center gap-3 p-4 border rounded hover:bg-gray-50 transition"
              >
                <DocumentIcon className="w-5 h-5 text-gray-600" />
                <div className="text-left">
                  <div className="font-medium">GSTR-1 Report</div>
                  <div className="text-sm text-gray-600">Outward supply summary</div>
                </div>
              </button>
              <button 
                onClick={() => navigate('/gst/gstr2b')}
                className="flex items-center gap-3 p-4 border rounded hover:bg-gray-50 transition"
              >
                <DocumentIcon className="w-5 h-5 text-gray-600" />
                <div className="text-left">
                  <div className="font-medium">GSTR-2B Report</div>
                  <div className="text-sm text-gray-600">Inward supply summary</div>
                </div>
              </button>
              <button 
                onClick={() => navigate('/gst/itc')}
                className="flex items-center gap-3 p-4 border rounded hover:bg-gray-50 transition"
              >
                <DocumentIcon className="w-5 h-5 text-gray-600" />
                <div className="text-left">
                  <div className="font-medium">ITC Report</div>
                  <div className="text-sm text-gray-600">Input tax credit details</div>
                </div>
              </button>
              <button 
                onClick={() => navigate('/gst/rcm')}
                className="flex items-center gap-3 p-4 border rounded hover:bg-gray-50 transition"
              >
                <DocumentIcon className="w-5 h-5 text-gray-600" />
                <div className="text-left">
                  <div className="font-medium">RCM Report</div>
                  <div className="text-sm text-gray-600">Reverse charge mechanism</div>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
