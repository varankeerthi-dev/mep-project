import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CurrencyDollarIcon, 
  DocumentTextIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  ChartBarIcon,
  BanknotesIcon,
  ReceiptRefundIcon,
  ArrowTrendingUpIcon
} from '@heroicons/react/24/outline';
import PDFExportButton from '../../components/reports/PDFExportButton';
import { GeneratedReport } from '../../reports/api';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getFinancialReports, 
  getFinancialSummaryStats,
  getReportFilterOptions
} from '../../reports/reportsApi';

const FinancialReports = () => {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const [selectedReport, setSelectedReport] = useState('');
  const [reportData, setReportData] = useState<any>(null);
  const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for real data
  const [financialData, setFinancialData] = useState<any[]>([]);
  const [summaryStats, setSummaryStats] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);

  // Fetch organization data
  useEffect(() => {
    const fetchData = async () => {
      if (!organisation?.id) return;
      
      try {
        setLoading(true);
        setError(null);

        // Fetch projects for filter options
        const projectsData = await getFinancialReports(organisation.id, {});
        setProjects(projectsData);

        // Build filter parameters
        const filterParams = {
          organisationId: organisation.id,
          ...filters
        };

        // Fetch financial data
        const financialData = await getFinancialReports(organisation.id, filterParams);
        setFinancialData(financialData);
        
        // Fetch summary statistics
        const stats = await getFinancialSummaryStats(organisation.id, filterParams);
        setSummaryStats(stats);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organisation?.id, filters]);

  const handleGenerateReport = (reportType: string) => {
    if (!organisation?.id) return;
    
    setSelectedReport(reportType);
    
    // Build filter parameters
    const filterParams = {
      organisationId: organisation.id,
      ...filters
    };

    // Fetch financial data
    const financialData = getFinancialReports(organisation.id, filterParams);
    setFinancialData(financialData);
    
    // Fetch summary statistics
    const stats = getFinancialSummaryStats(organisation.id, filterParams);
    setSummaryStats(stats);

    // Create report object
    const report: GeneratedReport = {
      id: 'fin-' + Date.now(),
      template_id: 'financial-cost-analysis',
      report_name: `${reportType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} Report`,
      report_type: 'financial',
      parameters: filterParams,
      data: { summary: stats, data: financialData },
      status: 'completed',
      generated_by: 'user-id',
      organisation_id: organisation.id,
      generated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setReportData({ summary: stats, data: financialData });
    setGeneratedReport(report);
  };

  const reportTypes = useMemo(() => [
    {
      id: 'cost-analysis',
      title: 'Project Cost Analysis',
      description: 'Budget vs Actual costs by project and category',
      icon: ChartBarIcon,
      metrics: ['Total Budget', 'Actual Spend', 'Variance', 'Forecast']
    },
    {
      id: 'invoice-summary',
      title: 'Invoice Summary',
      description: 'Aging report, payment status, and revenue recognition',
      icon: ReceiptRefundIcon,
      metrics: ['Total Invoiced', 'Outstanding', 'Overdue', 'Paid']
    },
    {
      id: 'expense-tracking',
      title: 'Expense Tracking',
      description: 'Categorized expenses with trend analysis',
      icon: BanknotesIcon,
      metrics: ['Total Expenses', 'By Category', 'Trends', 'Approvals']
    },
    {
      id: 'profitability',
      title: 'Profitability Analysis',
      description: 'Project margins and resource cost analysis',
      icon: ArrowTrendingUpIcon,
      metrics: ['Gross Margin', 'Net Profit', 'ROI', 'Break-even']
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
      id: 'month',
      title: 'Month',
      type: 'single-select' as const,
      options: [
        { id: '1', label: 'January' },
        { id: '2', label: 'February' },
        { id: '3', label: 'March' },
        { id: '4', label: 'April' },
        { id: '5', label: 'May' },
        { id: '6', label: 'June' },
        { id: '7', label: 'July' },
        { id: '8', label: 'August' },
        { id: '9', label: 'September' },
        { id: '10', label: 'October' },
        { id: '11', label: 'November' },
        { id: '12', label: 'December' }
      ],
      placeholder: 'Select month',
      display_order: 2
    },
    {
      id: 'projects',
      title: 'Projects',
      type: 'multi-select' as const,
      options: projects.map(project => ({
        id: project.id,
        label: project.name
      })),
      placeholder: 'Select projects',
      display_order: 3
    }
  ], [projects]);

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Financial Reports</h1>
            <p className="text-gray-600 mt-1">Analyze financial performance and metrics</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors h-12 border-radial-none">
              <FunnelIcon className="w-4 h-4" />
              Filters
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors h-12 border-radial-none">
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
              className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all cursor-pointer h-12 border-radial-none"
              onClick={() => setSelectedReport(report.id)}
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-emerald-600" />
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
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => handleGenerateReport(report.id)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                  >
                    <DocumentTextIcon className="w-4 h-4" />
                    Generate Report
                  </button>
                  {generatedReport && selectedReport === report.id && (
                    <PDFExportButton
                      reportData={generatedReport}
                      reportContent={reportData}
                      reportType="financial"
                      size="sm"
                      variant="secondary"
                    />
                  )}
                </div>
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
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">$2,456,789</p>
              <p className="text-sm text-green-600 mt-2">+12.5% from last month</p>
            </div>
            <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center">
              <CurrencyDollarIcon className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Expenses</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">$1,345,678</p>
              <p className="text-sm text-red-600 mt-2">+8.3% from last month</p>
            </div>
            <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center">
              <BanknotesIcon className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Outstanding Invoices</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">$234,567</p>
              <p className="text-sm text-yellow-600 mt-2">15 invoices pending</p>
            </div>
            <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center">
              <ReceiptRefundIcon className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Profit Margin</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">45.2%</p>
              <p className="text-sm text-green-600 mt-2">+2.1% improvement</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <ArrowTrendingUpIcon className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {renderFinancialSummary()}
    </div>
  );
};

export default FinancialReports;
