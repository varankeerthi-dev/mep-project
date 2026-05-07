import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheckIcon, 
  DocumentTextIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  DocumentMagnifyingGlassIcon
} from '@heroicons/react/24/outline';

const ComplianceReports = () => {
  const navigate = useNavigate();
  const [selectedReport, setSelectedReport] = useState('');

  const reportTypes = useMemo(() => [
    {
      id: 'audit-trail',
      title: 'Audit Trail',
      description: 'System activity logs, change history, and access records',
      icon: DocumentMagnifyingGlassIcon,
      metrics: ['User Activity', 'Change Logs', 'Access Records', 'System Events']
    },
    {
      id: 'safety-reports',
      title: 'Safety Reports',
      description: 'Incident tracking, safety metrics, and compliance scores',
      icon: ShieldCheckIcon,
      metrics: ['Incidents', 'Safety Score', 'Compliance Rate', 'Training Status']
    },
    {
      id: 'regulatory-compliance',
      title: 'Regulatory Compliance',
      description: 'Industry-specific requirements and certification status',
      icon: ClipboardDocumentCheckIcon,
      metrics: ['Compliance Score', 'Certifications', 'Requirements', 'Audits']
    },
    {
      id: 'quality-assurance',
      title: 'Quality Assurance',
      description: 'Defect tracking, quality metrics, and improvement trends',
      icon: ChartBarIcon,
      metrics: ['Defect Rate', 'Quality Score', 'Improvement', 'Inspections']
    }
  ], []);

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Compliance Reports</h1>
            <p className="text-gray-600 mt-1">Ensure regulatory compliance and safety standards</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors">
              <FunnelIcon className="w-4 h-4" />
              Filters
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <ArrowDownTrayIcon className="w-4 h-4" />
              Export PDF
            </button>
          </div>
        </div>
      </div>

      {/* Report Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {reportTypes.map((report) => {
          const Icon = report.icon;
          return (
            <div
              key={report.id}
              className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all cursor-pointer"
              onClick={() => setSelectedReport(report.id)}
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{report.title}</h3>
                    <p className="text-sm text-gray-600 mb-4">{report.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {report.metrics.map((metric, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                        >
                          {metric}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-xl">
                <button className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors">
                  <DocumentTextIcon className="w-4 h-4" />
                  Generate Report
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Compliance Score</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">94.5%</p>
              <p className="text-sm text-green-600 mt-2">+2.3% improvement</p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
              <ShieldCheckIcon className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Open Audits</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">3</p>
              <p className="text-sm text-yellow-600 mt-2">2 due this month</p>
            </div>
            <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center">
              <DocumentMagnifyingGlassIcon className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Safety Incidents</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">1</p>
              <p className="text-sm text-green-600 mt-2">-67% from last month</p>
            </div>
            <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Certifications</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">12</p>
              <p className="text-sm text-blue-600 mt-2">All current</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <ClipboardDocumentCheckIcon className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComplianceReports;
