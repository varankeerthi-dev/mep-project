import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CubeIcon, 
  DocumentTextIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  ChartBarIcon,
  TruckIcon,
  ClipboardDocumentListIcon,
  UserIcon,
  CalendarDaysIcon,
  TagIcon,
  TableCellsIcon,
  ReceiptRefundIcon
} from '@heroicons/react/24/outline';
import ReportFilters from '../../components/reports/ReportFilters';
import PDFExportButton from '../../components/reports/PDFExportButton';
import { GeneratedReport } from '../../reports/api';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getProjectReports, 
  getProjectSummaryStats,
  getReportFilterOptions
} from '../../reports/reportsApi';

const ProjectReports = () => {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const [selectedReport, setSelectedReport] = useState('');
  const [reportData, setReportData] = useState<any>(null);
  const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for real data
  const [projects, setProjects] = useState<any[]>([]);
  const [summaryStats, setSummaryStats] = useState<any>(null);

  // Fetch organization data
  useEffect(() => {
    const fetchData = async () => {
      if (!organisation?.id) return;
      
      try {
        setLoading(true);
        setError(null);

        // Fetch project data
        const projectsData = await getProjectReports(organisation.id, {});
        setProjects(projectsData);
        
        // Fetch summary statistics
        const stats = await getProjectSummaryStats(organisation.id, {});
        setSummaryStats(stats);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organisation?.id]);

  const handleGenerateReport = (reportType: string) => {
    if (!organisation?.id) return;
    
    setSelectedReport(reportType);
    
    // Build filter parameters
    const filterParams = {
      organisationId: organisation.id
    };

    // Fetch project data
    const projectData = projects;
    
    // Fetch summary statistics
    const stats = summaryStats;

    // Create report object
    const report: GeneratedReport = {
      id: 'proj-' + Date.now(),
      template_id: 'project-reports',
      report_name: `${reportType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} Report`,
      report_type: 'project',
      parameters: filterParams,
      data: { summary: stats, data: projectData },
      status: 'completed',
      generated_by: 'user-id',
      organisation_id: organisation.id,
      generated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setReportData({ summary: stats, data: projectData });
    setGeneratedReport(report);
  };

  const reportTypes = useMemo(() => [
    {
      id: 'portfolio',
      title: 'Project Portfolio',
      description: 'Overview of all projects with status and performance metrics',
      icon: CubeIcon,
      metrics: ['Total Projects', 'Active Projects', 'Completed Projects', 'Budget Status']
    },
    {
      id: 'progress',
      title: 'Progress Reports',
      description: 'Milestone tracking, completion percentages, and Gantt charts',
      icon: ChartBarIcon,
      metrics: ['Milestones', 'Completion Rate', 'Delays', 'Critical Path']
    },
    {
      id: 'resource',
      title: 'Resource Utilization',
      description: 'Team allocation, workload distribution, and resource efficiency',
      icon: TruckIcon,
      metrics: ['Team Utilization', 'Workload Balance', 'Resource Availability', 'Efficiency Score']
    },
    {
      id: 'risk',
      title: 'Risk Assessment',
      description: 'Risk analysis, mitigation strategies, and issue tracking',
      icon: ClipboardDocumentListIcon,
      metrics: ['Risk Score', 'Open Issues', 'Mitigation Plans', 'Compliance Status']
    }
  ], []);

  return (
    <div className="p-6 bg-zinc-50 min-h-full">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">Project Reports</h1>
            <p className="text-zinc-600 mt-1">Track project performance and resource allocation</p>
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
              onClick={() => handleGenerateReport(report.id)}
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-blue-600" />
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
                <button className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
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
        {renderProjectSummary()}
      </div>
    </div>
  );
};

export default ProjectReports;
