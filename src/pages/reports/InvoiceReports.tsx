import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  DocumentTextIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  CalendarDaysIcon,
  UserIcon,
  TagIcon,
  TableCellsIcon,
  ReceiptRefundIcon
} from '@heroicons/react/24/outline';
import ReportFilters from '../../components/reports/ReportFilters';
import PDFExportButton from '../../components/reports/PDFExportButton';
import { GeneratedReport } from '../../reports/api';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getInvoices, 
  getInvoiceLineItems, 
  getHSNReportData,
  getInvoiceSummaryStats,
  getHSNSummaryStats,
  getClients
} from '../../reports/invoiceApi';

interface InvoiceData {
  id: string;
  invoice_number: string;
  client_name: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  status: 'paid' | 'pending' | 'overdue';
  line_items: InvoiceLineItem[];
}

interface InvoiceLineItem {
  id: string;
  item_name: string;
  hsn_code: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  tax_rate: number;
  tax_amount: number;
}

interface HSNData {
  hsn_code: string;
  description: string;
  total_quantity: number;
  total_amount: number;
  tax_amount: number;
  unit: string;
  invoices: string[];
}

const InvoiceReports = () => {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const [activeTab, setActiveTab] = useState('list');
  const [filters, setFilters] = useState({});
  const [reportData, setReportData] = useState<any>(null);
  const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for real data
  const [invoices, setInvoices] = useState<any[]>([]);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [hsnData, setHsnData] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [summaryStats, setSummaryStats] = useState<any>(null);
  const [hsnStats, setHsnStats] = useState<any>(null);

  // Fetch organization data
  useEffect(() => {
    const fetchData = async () => {
      if (!organisation?.id) return;
      
      try {
        setLoading(true);
        setError(null);

        // Fetch clients for filter options
        const clientsData = await getClients(organisation.id);
        setClients(clientsData);

        // Build filter parameters
        const filterParams = {
          organisationId: organisation.id,
          ...filters
        };

        // Fetch data based on active tab
        if (activeTab === 'list') {
          const invoicesData = await getInvoices(organisation.id, filterParams);
          setInvoices(invoicesData);
          
          const stats = await getInvoiceSummaryStats(organisation.id, filterParams);
          setSummaryStats(stats);
        } else if (activeTab === 'breakup') {
          const lineItemsData = await getInvoiceLineItems(organisation.id, filterParams);
          setLineItems(lineItemsData);
          
          const stats = await getInvoiceSummaryStats(organisation.id, filterParams);
          setSummaryStats(stats);
        } else if (activeTab === 'hsn') {
          const hsnReportData = await getHSNReportData(organisation.id, filterParams);
          setHsnData(hsnReportData);
          
          const stats = await getHSNSummaryStats(organisation.id, filterParams);
          setHsnStats(stats);
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organisation?.id, activeTab, filters]);

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
      id: 'clients',
      title: 'Clients',
      type: 'multi-select' as const,
      options: clients.map(client => ({
        id: client.id,
        label: client.name
      })),
      placeholder: 'Select clients',
      display_order: 3
    }
  ], [clients]);

  const handleGenerateReport = () => {
    if (!organisation?.id) return;
    
    let data: any;
    let reportName: string;

    switch (activeTab) {
      case 'list':
        data = { invoices };
        reportName = 'Invoice List Report';
        break;
      case 'breakup':
        data = { invoices, lineItems, summary: summaryStats };
        reportName = 'Invoice Break-up Report';
        break;
      case 'hsn':
        data = { hsn_data: hsnData, summary: hsnStats };
        reportName = 'HSN Summary Report';
        break;
      default:
        return;
    }

    const report: GeneratedReport = {
      id: 'inv-' + Date.now(),
      template_id: 'invoice-reports',
      report_name: reportName,
      report_type: 'invoice',
      parameters: filters,
      data: data,
      status: 'completed',
      generated_by: 'user-id',
      organisation_id: organisation.id,
      generated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setReportData(data);
    setGeneratedReport(report);
  };

  const renderInvoiceList = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse flex items-center space-x-2">
            <div className="w-2 h-2 bg-[#2563EB] rounded-full"></div>
            <div className="w-2 h-2 bg-[#2563EB] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-[#2563EB] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-white rounded-[2.5rem] border border-[#DC2626]/20 shadow-sm p-6">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-12 h-12 bg-[#DC2626]/10 rounded-xl flex items-center justify-center">
              <ReceiptRefundIcon className="h-6 w-6 text-[#DC2626]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#DC2626]">Error Loading Data</h3>
              <p className="text-[#71717A] mt-1">{error}</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-[2.5rem] border border-[rgba(226,232,240,0.5)] shadow-sm">
        <div className="p-6 border-b border-[rgba(226,232,240,0.5)]">
          <h3 className="text-[clamp(1.25rem,3vw,1.5rem)] font-semibold text-[#18181B] tracking-tight">Invoice List - Date Wise Details</h3>
          <p className="text-[#71717A] mt-2 text-[clamp(0.875rem,2vw,1rem)] leading-relaxed max-w-[65ch]">Detailed view of all invoices with filtering options and status tracking</p>
        </div>
        
        {invoices.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center space-x-3">
              <DocumentTextIcon className="h-12 w-12 text-[#71717A]" />
              <div>
                <h4 className="text-lg font-medium text-[#71717A]">No invoices found</h4>
                <p className="text-[#71717A] mt-1">Try adjusting your filters or check back later</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F9FAFB] border-b border-[rgba(226,232,240,0.5)] sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-[#71717A] tracking-wider uppercase">Invoice No</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-[#71717A] tracking-wider uppercase">Client</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-[#71717A] tracking-wider uppercase">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-[#71717A] tracking-wider uppercase">Due Date</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-[#71717A] tracking-wider uppercase">Amount</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-[#71717A] tracking-wider uppercase">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-[#71717A] tracking-wider uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-[rgba(226,232,240,0.5)]">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#18181B]">
                      {invoice.invoice_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#18181B]">
                      {invoice.clients?.name || 'Unknown Client'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#18181B]">
                      {new Date(invoice.invoice_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#18181B]">
                      {new Date(invoice.due_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-[#18181B] font-mono">
                      ₹{invoice.total_amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                        invoice.status === 'paid' ? 'bg-[#059669]/10 text-[#059669]' :
                        invoice.status === 'sent' ? 'bg-[#D97706]/10 text-[#D97706]' :
                        invoice.status === 'overdue' ? 'bg-[#DC2626]/10 text-[#DC2626]' :
                        'bg-[#71717A]/10 text-[#71717A]'
                      }`}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-[#2563EB] hover:text-[#1d4ed8] transition-colors">View Details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderInvoiceBreakup = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse flex items-center space-x-2">
            <div className="w-2 h-2 bg-[#2563EB] rounded-full"></div>
            <div className="w-2 h-2 bg-[#2563EB] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-[#2563EB] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-[2.5rem] border border-[rgba(226,232,240,0.5)] shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0 w-12 h-12 bg-[#F9FAFB] rounded-xl flex items-center justify-center">
                <DocumentTextIcon className="h-6 w-6 text-[#71717A]" />
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-[#71717A]">Total Invoices</p>
                <p className="text-[clamp(1.5rem,3vw,2rem)] font-semibold text-[#18181B] tracking-tight">{summaryStats?.totalInvoices || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[2.5rem] border border-[rgba(226,232,240,0.5)] shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0 w-12 h-12 bg-[#059669]/10 rounded-xl flex items-center justify-center">
                <ReceiptRefundIcon className="h-6 w-6 text-[#059669]" />
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-[#71717A]">Total Amount</p>
                <p className="text-[clamp(1.5rem,3vw,2rem)] font-semibold text-[#18181B] tracking-tight font-mono">₹{(summaryStats?.totalAmount || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[2.5rem] border border-[rgba(226,232,240,0.5)] shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0 w-12 h-12 bg-[#2563EB]/10 rounded-xl flex items-center justify-center">
                <TagIcon className="h-6 w-6 text-[#2563EB]" />
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-[#71717A]">Paid</p>
                <p className="text-[clamp(1.5rem,3vw,2rem)] font-semibold text-[#18181B] tracking-tight">{summaryStats?.paidInvoices || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[2.5rem] border border-[rgba(226,232,240,0.5)] shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0 w-12 h-12 bg-[#D97706]/10 rounded-xl flex items-center justify-center">
                <CalendarDaysIcon className="h-6 w-6 text-[#D97706]" />
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-[#71717A]">Average Value</p>
                <p className="text-[clamp(1.5rem,3vw,2rem)] font-semibold text-[#18181B] tracking-tight font-mono">₹{Math.round(summaryStats?.averageInvoiceValue || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Invoice Breakup */}
        <div className="bg-white rounded-[2.5rem] border border-[rgba(226,232,240,0.5)] shadow-sm">
          <div className="p-6 border-b border-[rgba(226,232,240,0.5)]">
            <h3 className="text-[clamp(1.25rem,3vw,1.5rem)] font-semibold text-[#18181B] tracking-tight">Invoice Line Items Details</h3>
            <p className="text-[#71717A] mt-2 text-[clamp(0.875rem,2vw,1rem)] leading-relaxed max-w-[65ch]">Complete breakdown of all invoice line items with tax calculations</p>
          </div>
          
          {lineItems.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-flex items-center space-x-3">
                <TableCellsIcon className="h-12 w-12 text-[#71717A]" />
                <div>
                  <h4 className="text-lg font-medium text-[#71717A]">No line items found</h4>
                  <p className="text-[#71717A] mt-1">Try adjusting your filters or check back later</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F9FAFB] border-b border-[rgba(226,232,240,0.5)] sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-medium text-[#71717A] tracking-wider uppercase">Invoice</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-[#71717A] tracking-wider uppercase">Item Name</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-[#71717A] tracking-wider uppercase">HSN Code</th>
                    <th className="px-4 py-4 text-right text-xs font-medium text-[#71717A] tracking-wider uppercase">Quantity</th>
                    <th className="px-4 py-4 text-right text-xs font-medium text-[#71717A] tracking-wider uppercase">Unit Price</th>
                    <th className="px-4 py-4 text-right text-xs font-medium text-[#71717A] tracking-wider uppercase">Total</th>
                    <th className="px-4 py-4 text-right text-xs font-medium text-[#71717A] tracking-wider uppercase">Tax</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-[rgba(226,232,240,0.5)]">
                  {lineItems.map((item, index) => (
                    <tr key={`${item.invoice_number}-${item.id}`} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-[#18181B] font-medium">{item.invoice_number}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-[#18181B]">{item.items?.name || 'Unknown Item'}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-[#18181B] font-mono">{item.items?.hsn_code || 'N/A'}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-[#18181B] font-mono">{item.quantity}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-[#18181B] font-mono">₹{item.unit_price?.toLocaleString() || '0'}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-[#18181B] font-mono">₹{item.total_amount?.toLocaleString() || '0'}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-[#18181B] font-mono">₹{item.tax_amount?.toLocaleString() || '0'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderHSNReport = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse flex items-center space-x-2">
            <div className="w-2 h-2 bg-[#2563EB] rounded-full"></div>
            <div className="w-2 h-2 bg-[#2563EB] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-[#2563EB] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-white rounded-[2.5rem] border border-[#DC2626]/20 shadow-sm p-6">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-12 h-12 bg-[#DC2626]/10 rounded-xl flex items-center justify-center">
              <ReceiptRefundIcon className="h-6 w-6 text-[#DC2626]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#DC2626]">Error Loading HSN Data</h3>
              <p className="text-[#71717A] mt-1">{error}</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {/* HSN Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-[2.5rem] border border-[rgba(226,232,240,0.5)] shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0 w-12 h-12 bg-[#F9FAFB] rounded-xl flex items-center justify-center">
                <TableCellsIcon className="h-6 w-6 text-[#71717A]" />
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-[#71717A]">Total HSN Items</p>
                <p className="text-[clamp(1.5rem,3vw,2rem)] font-semibold text-[#18181B] tracking-tight">{hsnStats?.totalHSNItems || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[2.5rem] border border-[rgba(226,232,240,0.5)] shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0 w-12 h-12 bg-[#059669]/10 rounded-xl flex items-center justify-center">
                <TableCellsIcon className="h-6 w-6 text-[#059669]" />
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-[#71717A]">Total Quantity</p>
                <p className="text-[clamp(1.5rem,3vw,2rem)] font-semibold text-[#18181B] tracking-tight font-mono">{(hsnStats?.totalQuantity || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[2.5rem] border border-[rgba(226,232,240,0.5)] shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0 w-12 h-12 bg-[#2563EB]/10 rounded-xl flex items-center justify-center">
                <ReceiptRefundIcon className="h-6 w-6 text-[#2563EB]" />
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-[#71717A]">Total Amount</p>
                <p className="text-[clamp(1.5rem,3vw,2rem)] font-semibold text-[#18181B] tracking-tight font-mono">₹{(hsnStats?.totalAmount || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[2.5rem] border border-[rgba(226,232,240,0.5)] shadow-sm">
            <div className="flex items-center">
              <div className="flex-shrink-0 w-12 h-12 bg-[#DC2626]/10 rounded-xl flex items-center justify-center">
                <TagIcon className="h-6 w-6 text-[#DC2626]" />
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-[#71717A]">Total Tax</p>
                <p className="text-[clamp(1.5rem,3vw,2rem)] font-semibold text-[#18181B] tracking-tight font-mono">₹{(hsnStats?.totalTax || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* HSN Wise Details */}
        <div className="bg-white rounded-[2.5rem] border border-[rgba(226,232,240,0.5)] shadow-sm">
          <div className="p-6 border-b border-[rgba(226,232,240,0.5)]">
            <h3 className="text-[clamp(1.25rem,3vw,1.5rem)] font-semibold text-[#18181B] tracking-tight">HSN Wise Sales Report</h3>
            <p className="text-[#71717A] mt-2 text-[clamp(0.875rem,2vw,1rem)] leading-relaxed max-w-[65ch]">Sales items grouped by HSN code with date and unit grouping</p>
          </div>
          
          {hsnData.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-flex items-center space-x-3">
                <ReceiptRefundIcon className="h-12 w-12 text-[#71717A]" />
                <div>
                  <h4 className="text-lg font-medium text-[#71717A]">No HSN data found</h4>
                  <p className="text-[#71717A] mt-1">Try adjusting your filters or check back later</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F9FAFB] border-b border-[rgba(226,232,240,0.5)] sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-medium text-[#71717A] tracking-wider uppercase">HSN Code</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-[#71717A] tracking-wider uppercase">Description</th>
                    <th className="px-4 py-4 text-right text-xs font-medium text-[#71717A] tracking-wider uppercase">Total Quantity</th>
                    <th className="px-4 py-4 text-right text-xs font-medium text-[#71717A] tracking-wider uppercase">Unit</th>
                    <th className="px-4 py-4 text-right text-xs font-medium text-[#71717A] tracking-wider uppercase">Total Amount</th>
                    <th className="px-4 py-4 text-right text-xs font-medium text-[#71717A] tracking-wider uppercase">Tax Amount</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-[#71717A] tracking-wider uppercase">Invoices</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-[rgba(226,232,240,0.5)]">
                  {hsnData.map((hsn, index) => (
                    <tr key={hsn.hsn_code} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-[#18181B]">{hsn.hsn_code}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-[#18181B]">{hsn.description}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-[#18181B] font-mono">{hsn.total_quantity.toLocaleString()}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-[#18181B]">{hsn.unit}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-[#18181B] font-mono">₹{hsn.total_amount.toLocaleString()}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-[#18181B] font-mono">₹{hsn.tax_amount.toLocaleString()}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-[#18181B]">
                        <div className="space-y-1">
                          {hsn.invoices.map(inv => (
                            <span key={inv} className="inline-block px-2 py-1 text-xs bg-[#F9FAFB] text-[#18181B] rounded border border-[rgba(226,232,240,0.5)]">
                              {inv}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 bg-[#F9FAFB] min-h-full">
      {/* Header */}
      <div className="mb-8 h-[34px] border-t-[12px] border-b-[12px] border-[rgba(226,232,240,0.5)] rounded-none">
        <div className="flex items-center justify-between max-w-7xl mx-auto h-full">
          <div className="flex-1">
            <h1 className="text-[clamp(2rem,5vw,3rem)] font-semibold text-[#18181B] tracking-tight">Invoice Reports</h1>
            <p className="text-[#71717A] mt-2 text-[clamp(1rem,2.5vw,1.125rem)] leading-relaxed max-w-[65ch]">Comprehensive invoice analysis with HSN tracking and detailed breakdowns</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleGenerateReport}
              className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-none hover:bg-[#1d4ed8] transition-transform active:translate-y-[-1px] min-h-[44px] h-[34px] border-t-[12px] border-b-[12px] border-[rgba(226,232,240,0.5)]"
            >
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

      {/* Filters */}
      <div className="mb-8 max-w-7xl mx-auto h-[34px] border-t-[12px] border-b-[12px] border-[rgba(226,232,240,0.5)] rounded-none">
        <ReportFilters
          filters={filterConfig}
          onFiltersChange={setFilters}
          className="w-full h-full"
        />
      </div>

      {/* Sub-tabs */}
      <div className="mb-8 max-w-7xl mx-auto h-[34px] border-t-[12px] border-b-[12px] border-[rgba(226,232,240,0.5)] rounded-none">
        <div className="border-b border-[rgba(226,232,240,0.5)]">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'list', label: 'Invoice List', icon: DocumentTextIcon },
              { id: 'breakup', label: 'Invoice Break-up', icon: TableCellsIcon },
              { id: 'hsn', label: 'HSN Report', icon: ReceiptRefundIcon }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors h-[34px] border-t-[12px] border-b-[12px] rounded-none ${
                  activeTab === tab.id
                    ? 'border-[#2563EB] text-[#2563EB]'
                    : 'border-transparent text-[#71717A] hover:text-[#18181B] hover:border-[rgba(226,232,240,0.8)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </div>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto">
        {activeTab === 'list' && renderInvoiceList()}
        {activeTab === 'breakup' && renderInvoiceBreakup()}
        {activeTab === 'hsn' && renderHSNReport()}
      </div>
    </div>
  );
};

export default InvoiceReports;
