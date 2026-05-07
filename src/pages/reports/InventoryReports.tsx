import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CubeIcon, 
  DocumentTextIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  ChartBarIcon,
  TruckIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline';
import ReportFilters from '../../components/reports/ReportFilters';
import PDFExportButton from '../../components/reports/PDFExportButton';
import { GeneratedReport } from '../../reports/api';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getInventoryReports, 
  getInventorySummaryStats,
  getReportFilterOptions
} from '../../reports/reportsApi';

const InventoryReports = () => {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const [selectedReport, setSelectedReport] = useState('');
  const [reportData, setReportData] = useState<any>(null);
  const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for real data
  const [inventory, setInventory] = useState<any[]>([]);
  const [summaryStats, setSummaryStats] = useState<any>(null);

  // Fetch organization data
  useEffect(() => {
    const fetchData = async () => {
      if (!organisation?.id) return;
      
      try {
        setLoading(true);
        setError(null);

        // Fetch inventory data
        const inventoryData = await getInventoryReports(organisation.id, {});
        setInventory(inventoryData);
        
        // Fetch summary statistics
        const stats = await getInventorySummaryStats(organisation.id, {});
        setSummaryStats(stats);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organisation?.id]);

  const reportTypes = useMemo(() => [
    {
      id: 'stock-movement',
      title: 'Stock Movement',
      description: 'In/out tracking, location analysis, and turnover rates',
      icon: TruckIcon,
      metrics: ['Total Movement', 'By Location', 'Turnover Rate', 'Transfers']
    },
    {
      id: 'material-consumption',
      title: 'Material Consumption',
      description: 'Usage by project, waste analysis, and cost optimization',
      icon: CubeIcon,
      metrics: ['Usage by Project', 'Waste Analysis', 'Cost per Unit', 'Efficiency']
    },
    {
      id: 'supplier-performance',
      title: 'Supplier Performance',
      description: 'Delivery times, quality metrics, and cost comparison',
      icon: ClipboardDocumentListIcon,
      metrics: ['On-Time Delivery', 'Quality Score', 'Cost Analysis', 'Lead Time']
    },
    {
      id: 'procurement-analysis',
      title: 'Procurement Analysis',
      description: 'PO tracking, spend analysis, and contract compliance',
      icon: ChartBarIcon,
      metrics: ['PO Tracking', 'Spend Analysis', 'Contract Compliance', 'Savings']
    }
  ], []);

  return (
    <div className="p-6 bg-[#F9FAFB] min-h-full">
      {/* Header */}
      <div className="mb-8 h-[34px] border-t-[12px] border-b-[12px] border-[rgba(226,232,240,0.5)] rounded-none">
        <div className="flex items-center justify-between h-full">
          <div>
            <h1 className="text-[clamp(2rem,5vw,3rem)] font-semibold text-[#18181B] tracking-tight">Inventory Reports</h1>
            <p className="text-[#71717A] mt-2 text-[clamp(1rem,2.5vw,1.125rem)] leading-relaxed max-w-[65ch]">Material and stock analysis with location tracking</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-none hover:bg-[#1d4ed8] transition-colors h-[34px] border-t-[12px] border-b-[12px] border-[rgba(226,232,240,0.5)]">
              <DocumentTextIcon className="w-4 h-4" />
              Generate Report
            </button>
            {generatedReport && (
              <PDFExportButton
                reportData={generatedReport}
                reportContent={reportData}
                size="sm"
                variant="secondary"
              />
            )}
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
              className="bg-white rounded-none border border-[rgba(226,232,240,0.5)] hover:border-[rgba(226,232,240,0.8)] hover:shadow-lg transition-all cursor-pointer"
              onClick={() => setSelectedReport(report.id)}
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#2563EB]/10 rounded-none flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-[#2563EB]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-[#18181B] mb-2">{report.title}</h3>
                    <p className="text-sm text-[#71717A] mb-4">{report.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {report.metrics.map((metric, index) => (
                        <span key={index} className="inline-flex px-2 py-1 bg-[#F9FAFB] text-[#18181B] text-xs rounded-full border border-[rgba(226,232,240,0.5)]">
                          {metric}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-none h-34px">
                <button className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors" onClick={() => handleGenerateReport(report.id)}>
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
              <p className="text-sm text-gray-600">Total Items</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">1,247</p>
              <p className="text-sm text-green-600 mt-2">+23 new items</p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
              <CubeIcon className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Stock Value</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">$845,678</p>
              <p className="text-sm text-green-600 mt-2">+5.2% from last month</p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
              <CubeIcon className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Low Stock Items</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">12</p>
              <p className="text-sm text-yellow-600 mt-2">Requires reorder</p>
            </div>
            <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center">
              <TruckIcon className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Suppliers</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">89</p>
              <p className="text-sm text-blue-600 mt-2">3 new this month</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <ClipboardDocumentListIcon className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryReports;
