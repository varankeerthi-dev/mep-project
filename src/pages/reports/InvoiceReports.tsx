import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DocumentTextIcon,
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

const INK = '#111111';
const STEEL = '#787774';
const WHISPER = '#EAEAEA';
const CANVAS = '#FBFBFA';

const SERIF = "'Newsreader','Playfair Display',Georgia,'Times New Roman',serif";
const MONO = "'Geist Mono','JetBrains Mono',ui-monospace,monospace";

const STATUS_BADGE: Record<string, string> = {
  paid: 'bg-[#EDF3EC] text-[#346538]',
  sent: 'bg-[#E1F3FE] text-[#1F6C9F]',
  pending: 'bg-[#FBF3DB] text-[#956400]',
  overdue: 'bg-[#FDEBEC] text-[#9F2F2D]',
  draft: 'bg-[#F2F2F0] text-[#787774]',
  cancelled: 'bg-[#F2F2F0] text-[#787774]'
};

const formatINR = (value: number) =>
  '₹' + Math.round(value || 0).toLocaleString('en-IN');

const Reveal = ({
  children,
  delay = 0,
  className = ''
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.06 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-[opacity,transform] duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
        shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      } ${className}`}
    >
      {children}
    </div>
  );
};

const LoadingDots = () => (
  <div className="flex h-48 items-center justify-center">
    <div className="flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#787774]" />
      <span
        className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#787774]"
        style={{ animationDelay: '0.15s' }}
      />
      <span
        className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#787774]"
        style={{ animationDelay: '0.3s' }}
      />
    </div>
  </div>
);

const ErrorPanel = ({ message }: { message: string }) => (
  <div className="rounded-xl border border-[#EAEAEA] bg-white p-8">
    <div className="flex items-center gap-4">
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-[#FDEBEC]">
        <ReceiptRefundIcon className="h-6 w-6 text-[#9F2F2D]" />
      </div>
      <div>
        <h3 className="text-lg font-medium text-[#9F2F2D]">Error loading data</h3>
        <p className="mt-1 text-sm text-[#787774]">{message}</p>
      </div>
    </div>
  </div>
);

const EmptyState = ({ icon: Icon, title }: { icon: any; title: string }) => (
  <div className="flex flex-col items-center justify-center gap-4 px-12 py-16 text-center">
    <Icon className="h-10 w-10 text-[#B5B2AC]" />
    <div>
      <h4 className="text-base font-medium text-[#111111]">{title}</h4>
      <p className="mt-1 text-sm text-[#787774]">Adjust your filters or check back later.</p>
    </div>
  </div>
);

const SectionHeading = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div className="border-b border-[#EAEAEA] px-8 py-7">
    <h3
      className="text-[clamp(1.25rem,3vw,1.5rem)] font-medium tracking-[-0.02em] text-[#111111]"
      style={{ fontFamily: SERIF }}
    >
      {title}
    </h3>
    <p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-[#787774]">{subtitle}</p>
  </div>
);

const StatCard = ({
  icon: Icon,
  label,
  value,
  tile,
  iconColor
}: {
  icon: any;
  label: string;
  value: string;
  tile: string;
  iconColor: string;
}) => (
  <div className="rounded-xl border border-[#EAEAEA] bg-white p-7 transition-shadow duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
    <div className="flex items-center gap-4">
      <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg ${tile}`}>
        <Icon className={`h-6 w-6 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#787774]">{label}</p>
        <p
          className="mt-1 text-[clamp(1.5rem,3vw,2rem)] font-medium tracking-[-0.02em] text-[#111111]"
          style={{ fontFamily: MONO }}
        >
          {value}
        </p>
      </div>
    </div>
  </div>
);

const InvoiceReports = () => {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const [activeTab, setActiveTab] = useState('list');
  const [filters, setFilters] = useState({});
  const [reportData, setReportData] = useState<any>(null);
  const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [invoices, setInvoices] = useState<any[]>([]);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [hsnData, setHsnData] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [summaryStats, setSummaryStats] = useState<any>(null);
  const [hsnStats, setHsnStats] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!organisation?.id) return;

      try {
        setLoading(true);
        setError(null);

        const clientsData = await getClients(organisation.id);
        setClients(clientsData);

        const filterParams = { ...filters };

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
      options: clients.map((client) => ({
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

  const cols = 'px-6 py-3.5 text-xs font-medium uppercase tracking-[0.06em] text-[#787774]';
  const cell = 'px-6 py-4 text-sm text-[#111111]';

  const renderInvoiceList = () => {
    if (loading) return <LoadingDots />;
    if (error) return <ErrorPanel message={error} />;

    return (
      <Reveal>
        <div className="overflow-hidden rounded-xl border border-[#EAEAEA] bg-white">
          <SectionHeading
            title="Invoice List — Date Wise Details"
            subtitle="Detailed view of all invoices with filtering options and status tracking."
          />

          {invoices.length === 0 ? (
            <EmptyState icon={DocumentTextIcon} title="No invoices found" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-[#EAEAEA] bg-[#FBFBFA]">
                  <tr>
                    <th className={`${cols} text-left`}>Invoice No</th>
                    <th className={`${cols} text-left`}>Client</th>
                    <th className={`${cols} text-left`}>Date</th>
                    <th className={`${cols} text-left`}>Due Date</th>
                    <th className={`${cols} text-right`}>Amount</th>
                    <th className={`${cols} text-left`}>Status</th>
                    <th className={`${cols} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEAEA] bg-white">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="transition-colors hover:bg-[#FBFBFA]">
                      <td className={`${cell} whitespace-nowrap font-medium`}>{invoice.invoice_number}</td>
                      <td className={`${cell} whitespace-nowrap`}>{invoice.clients?.name || 'Unknown Client'}</td>
                      <td className={`${cell} whitespace-nowrap`}>
                        {new Date(invoice.invoice_date).toLocaleDateString('en-IN')}
                      </td>
                      <td className={`${cell} whitespace-nowrap`}>
                        {new Date(invoice.due_date).toLocaleDateString('en-IN')}
                      </td>
                      <td
                        className={`${cell} whitespace-nowrap text-right`}
                        style={{ fontFamily: MONO }}
                      >
                        {formatINR(invoice.total_amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.05em] ${
                            STATUS_BADGE[invoice.status] || STATUS_BADGE.draft
                          }`}
                        >
                          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button className="text-[#1F6C9F] transition-colors hover:text-[#111111]">
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Reveal>
    );
  };

  const renderInvoiceBreakup = () => {
    if (loading) return <LoadingDots />;

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: DocumentTextIcon, label: 'Total Invoices', value: String(summaryStats?.totalInvoices || 0), tile: 'bg-[#F2F2F0]', color: 'text-[#787774]' },
            { icon: ReceiptRefundIcon, label: 'Total Amount', value: formatINR(summaryStats?.totalAmount || 0), tile: 'bg-[#EDF3EC]', color: 'text-[#346538]' },
            { icon: TagIcon, label: 'Paid', value: String(summaryStats?.paidInvoices || 0), tile: 'bg-[#E1F3FE]', color: 'text-[#1F6C9F]' },
            { icon: CalendarDaysIcon, label: 'Average Value', value: formatINR(summaryStats?.averageInvoiceValue || 0), tile: 'bg-[#FBF3DB]', color: 'text-[#956400]' }
          ].map((stat, i) => (
            <Reveal key={stat.label} delay={i * 80}>
              <StatCard icon={stat.icon} label={stat.label} value={stat.value} tile={stat.tile} iconColor={stat.color} />
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="overflow-hidden rounded-xl border border-[#EAEAEA] bg-white">
            <SectionHeading
              title="Invoice Line Items Details"
              subtitle="Complete breakdown of all invoice line items with tax calculations."
            />

            {lineItems.length === 0 ? (
              <EmptyState icon={TableCellsIcon} title="No line items found" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-[#EAEAEA] bg-[#FBFBFA]">
                    <tr>
                      <th className={`${cols} text-left`}>Invoice</th>
                      <th className={`${cols} text-left`}>Item Name</th>
                      <th className={`${cols} text-left`}>HSN Code</th>
                      <th className={`${cols} text-right`}>Quantity</th>
                      <th className={`${cols} text-right`}>Unit Price</th>
                      <th className={`${cols} text-right`}>Total</th>
                      <th className={`${cols} text-right`}>Tax</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAEAEA] bg-white">
                    {lineItems.map((item) => (
                      <tr key={`${item.invoice_number}-${item.id}`} className="transition-colors hover:bg-[#FBFBFA]">
                        <td className={`${cell} whitespace-nowrap font-medium`}>{item.invoice_number}</td>
                        <td className={`${cell} whitespace-nowrap`}>{item.items?.name || 'Unknown Item'}</td>
                        <td className={`${cell} whitespace-nowrap`} style={{ fontFamily: MONO }}>{item.items?.hsn_code || 'N/A'}</td>
                        <td className={`${cell} whitespace-nowrap text-right`} style={{ fontFamily: MONO }}>{item.quantity}</td>
                        <td className={`${cell} whitespace-nowrap text-right`} style={{ fontFamily: MONO }}>{formatINR(item.unit_price)}</td>
                        <td className={`${cell} whitespace-nowrap text-right`} style={{ fontFamily: MONO }}>{formatINR(item.total_amount)}</td>
                        <td className={`${cell} whitespace-nowrap text-right`} style={{ fontFamily: MONO }}>{formatINR(item.tax_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Reveal>
      </div>
    );
  };

  const renderHSNReport = () => {
    if (loading) return <LoadingDots />;
    if (error) return <ErrorPanel message={error} />;

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: TableCellsIcon, label: 'Total HSN Items', value: String(hsnStats?.totalHSNItems || 0), tile: 'bg-[#F2F2F0]', color: 'text-[#787774]' },
            { icon: TableCellsIcon, label: 'Total Quantity', value: (hsnStats?.totalQuantity || 0).toLocaleString('en-IN'), tile: 'bg-[#EDF3EC]', color: 'text-[#346538]' },
            { icon: ReceiptRefundIcon, label: 'Total Amount', value: formatINR(hsnStats?.totalAmount || 0), tile: 'bg-[#E1F3FE]', color: 'text-[#1F6C9F]' },
            { icon: TagIcon, label: 'Total Tax', value: formatINR(hsnStats?.totalTax || 0), tile: 'bg-[#FDEBEC]', color: 'text-[#9F2F2D]' }
          ].map((stat, i) => (
            <Reveal key={stat.label} delay={i * 80}>
              <StatCard icon={stat.icon} label={stat.label} value={stat.value} tile={stat.tile} iconColor={stat.color} />
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="overflow-hidden rounded-xl border border-[#EAEAEA] bg-white">
            <SectionHeading
              title="HSN Wise Sales Report"
              subtitle="Sales items grouped by HSN code with date and unit grouping."
            />

            {hsnData.length === 0 ? (
              <EmptyState icon={ReceiptRefundIcon} title="No HSN data found" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-[#EAEAEA] bg-[#FBFBFA]">
                    <tr>
                      <th className={`${cols} text-left`}>HSN Code</th>
                      <th className={`${cols} text-left`}>Description</th>
                      <th className={`${cols} text-right`}>Total Quantity</th>
                      <th className={`${cols} text-right`}>Unit</th>
                      <th className={`${cols} text-right`}>Total Amount</th>
                      <th className={`${cols} text-right`}>Tax Amount</th>
                      <th className={`${cols} text-left`}>Invoices</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAEAEA] bg-white">
                    {hsnData.map((hsn) => (
                      <tr key={hsn.hsn_code} className="transition-colors hover:bg-[#FBFBFA]">
                        <td className={`${cell} whitespace-nowrap font-medium`} style={{ fontFamily: MONO }}>{hsn.hsn_code}</td>
                        <td className={`${cell} whitespace-nowrap`}>{hsn.description}</td>
                        <td className={`${cell} whitespace-nowrap text-right`} style={{ fontFamily: MONO }}>{hsn.total_quantity.toLocaleString('en-IN')}</td>
                        <td className={`${cell} whitespace-nowrap`}>{hsn.unit}</td>
                        <td className={`${cell} whitespace-nowrap text-right`} style={{ fontFamily: MONO }}>{formatINR(hsn.total_amount)}</td>
                        <td className={`${cell} whitespace-nowrap text-right`} style={{ fontFamily: MONO }}>{formatINR(hsn.tax_amount)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-wrap gap-1.5">
                            {hsn.invoices.map((inv: string) => (
                              <span
                                key={inv}
                                className="inline-block rounded border border-[#EAEAEA] bg-[#FBFBFA] px-2 py-1 text-xs text-[#111111]"
                              >
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
        </Reveal>
      </div>
    );
  };

  const tabs = [
    { id: 'list', label: 'Invoice List', icon: DocumentTextIcon },
    { id: 'breakup', label: 'Invoice Break-up', icon: TableCellsIcon },
    { id: 'hsn', label: 'HSN Report', icon: ReceiptRefundIcon }
  ];

  return (
    <div className="min-h-full bg-[#FBFBFA]" style={{ fontFamily: "'Geist Variable','Inter',system-ui,sans-serif" }}>
      {/* Header */}
      <header className="mx-auto max-w-5xl px-6 pb-10 pt-20">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-3 text-xs uppercase tracking-[0.18em] text-[#787774]">Reports / Invoices</p>
            <h1
              className="text-[clamp(2.25rem,5vw,3.25rem)] font-medium leading-[1.05] tracking-[-0.03em] text-[#111111]"
              style={{ fontFamily: SERIF }}
            >
              Invoice Reports
            </h1>
            <p className="mt-4 max-w-2xl text-[#787774] leading-relaxed">
              Comprehensive invoice analysis with HSN tracking and itemised breakdowns.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerateReport}
              className="inline-flex items-center gap-2 rounded-md bg-[#111111] px-4 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-[#333333] active:scale-[0.98]"
            >
              <DocumentTextIcon className="h-4 w-4" />
              Generate Report
            </button>
            {generatedReport && (
              <PDFExportButton reportData={generatedReport} reportContent={reportData} size="sm" variant="secondary" />
            )}
          </div>
        </div>
      </header>

      {/* Filters */}
      <section className="mx-auto max-w-5xl px-6 pb-10">
        <Reveal>
          <ReportFilters filters={filterConfig} onFiltersChange={setFilters} className="w-full" />
        </Reveal>
      </section>

      {/* Sub-tabs */}
      <section className="mx-auto max-w-5xl px-6">
        <div className="border-b border-[#EAEAEA]">
          <nav className="-mb-px flex gap-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 border-b-2 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-[#111111] text-[#111111]'
                    : 'border-transparent text-[#787774] hover:text-[#111111]'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </section>

      {/* Tab Content */}
      <main className="mx-auto max-w-5xl px-6 py-10">
        {activeTab === 'list' && renderInvoiceList()}
        {activeTab === 'breakup' && renderInvoiceBreakup()}
        {activeTab === 'hsn' && renderHSNReport()}
      </main>
    </div>
  );
};

export default InvoiceReports;
