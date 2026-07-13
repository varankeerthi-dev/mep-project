import { useState, useMemo, useEffect } from 'react';
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
import ReportFilters from '../../components/reports/ReportFilters';
import PDFExportButton from '../../components/reports/PDFExportButton';
import { GeneratedReport } from '../../reports/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  getComplianceReports,
  getComplianceSummaryStats,
  getReportFilterOptions
} from '../../reports/reportsApi';

const ComplianceReports = () => {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const [selectedReport, setSelectedReport] = useState('');
  const [reportData, setReportData] = useState<any>(null);
  const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<any>({});

  // State for real data
  const [complianceData, setComplianceData] = useState<any[]>([]);
  const [summaryStats, setSummaryStats] = useState<any>(null);

  // Fetch organization data
  useEffect(() => {
    const fetchData = async () => {
      if (!organisation?.id) return;

      try {
        setLoading(true);
        setError(null);

        const filterParams = {
          organisationId: organisation.id,
          ...filters
        };

        const data = await getComplianceReports(organisation.id, filterParams);
        setComplianceData(data);

        const stats = await getComplianceSummaryStats(organisation.id, filterParams);
        setSummaryStats(stats);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organisation?.id, filters]);

  const handleGenerateReport = async (reportType: string) => {
    if (!organisation?.id) return;

    setSelectedReport(reportType);

    try {
      const filterParams = {
        organisationId: organisation.id,
        ...filters
      };

      const data = await getComplianceReports(organisation.id, filterParams);
      const stats = await getComplianceSummaryStats(organisation.id, filterParams);

      setReportData({ summary: stats, data });

      const report: GeneratedReport = {
        id: 'comp-' + Date.now(),
        template_id: 'compliance-reports',
        report_name: `${reportType.replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} Report`,
        report_type: 'compliance',
        parameters: filterParams,
        data: { summary: stats, data },
        status: 'completed',
        generated_by: 'user-id',
        organisation_id: organisation.id,
        generated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setGeneratedReport(report);
    } catch (err) {
      console.error('Failed to generate compliance report:', err);
    }
  };

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

  const filterConfig = useMemo(() => [
    {
      id: 'date_range',
      title: 'Date Range',
      type: 'date-range' as const,
      parameter_config: { preset_ranges: ['this-month', 'last-month', 'this-quarter'] },
      is_required: true,
      display_order: 1
    },
    {
      id: 'severity',
      title: 'Severity',
      type: 'multi-select' as const,
      options: [
        { id: 'low', label: 'Low' },
        { id: 'medium', label: 'Medium' },
        { id: 'high', label: 'High' },
        { id: 'critical', label: 'Critical' }
      ],
      placeholder: 'Select severity',
      display_order: 2
    },
    {
      id: 'status',
      title: 'Status',
      type: 'multi-select' as const,
      options: [
        { id: 'open', label: 'Open' },
        { id: 'in_progress', label: 'In Progress' },
        { id: 'resolved', label: 'Resolved' },
        { id: 'closed', label: 'Closed' }
      ],
      placeholder: 'Select status',
      display_order: 3
    }
  ], []);

  const renderComplianceSummary = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-600 rounded-full"></div>
            <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-white rounded-xl border border-red-200 shadow-sm p-6">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-red-600">Error Loading Data</h3>
              <p className="text-zinc-600 mt-1">{error}</p>
            </div>
          </div>
        </div>
      );
    }

    if (!summaryStats) return null;

    const cards = [
      { label: 'Compliance Score', value: '94.5%', sub: '+2.3% improvement', color: 'text-green-600' },
      { label: 'Open Audits', value: summaryStats.openAudits ?? 0, sub: '2 due this month', color: 'text-yellow-600' },
      { label: 'Safety Incidents', value: summaryStats.criticalAudits ?? 0, sub: '-67% from last month', color: 'text-red-600' },
      { label: 'Certifications', value: 12, sub: 'All current', color: 'text-blue-600' },
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white p-6 rounded-xl border border-zinc-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-600">{card.label}</p>
                <p className="text-2xl font-bold text-zinc-900 mt-1">{card.value}</p>
                <p className={`text-sm mt-2 ${card.color}`}>{card.sub}</p>
              </div>
              <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center">
                <ShieldCheckIcon className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 bg-zinc-50 min-h-full">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">Compliance Reports</h1>
            <p className="text-zinc-600 mt-1">Ensure regulatory compliance and safety standards</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 border border-zinc-300 rounded-lg bg-white hover:bg-zinc-50 transition-colors">
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
              className="bg-white rounded-xl border border-zinc-200 hover:border-zinc-300 hover:shadow-lg transition-all cursor-pointer"
              onClick={() => setSelectedReport(report.id)}
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-zinc-900 mb-2">{report.title}</h3>
                    <p className="text-sm text-zinc-600 mb-4">{report.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {report.metrics.map((metric, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-zinc-100 text-zinc-700 text-xs rounded-full"
                        >
                          {metric}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-200 rounded-b-xl">
                <button
                  onClick={() => handleGenerateReport(report.id)}
                  className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
                >
                  <DocumentTextIcon className="w-4 h-4" />
                  Generate Report
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Stats */}
      {renderComplianceSummary()}
    </div>
  );
};

export default ComplianceReports;
