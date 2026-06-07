import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Plus,
  Download,
  Search,
  Filter,
  ChevronDown,
  ArrowUpDown,
  Calendar,
  Building2,
  IndianRupee,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Status dot component - Grey style
function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    'Draft': 'bg-zinc-400',
    'Pending Approval': 'bg-amber-400',
    'PENDING_APPROVAL': 'bg-amber-400',
    'Issued': 'bg-zinc-500',
    'In Progress': 'bg-zinc-600',
    'Completed': 'bg-zinc-700',
    'Cancelled': 'bg-red-500',
  };
  return <span className={`w-2 h-2 rounded-full ${colors[status] || 'bg-zinc-400'}`} />;
}

// Status pill component - Grey style
function StatusPill({ status }: { status: string }) {
  const displayStatus = status === 'PENDING_APPROVAL' ? 'Pending Approval' : status;
  return (
    <div className="flex items-center gap-2">
      <StatusDot status={status} />
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
        {displayStatus}
      </span>
    </div>
  );
}

// List View Component - Capy Style Table with Filters
export function WorkOrderList({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const { organisation } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const actionParam = searchParams.get('action');

  // Handle action=create from URL
  useEffect(() => {
    if (actionParam === 'create') {
      onNavigate?.('/subcontractors/workorders/create');
      
      // Clear action param so it doesn't re-trigger
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      setSearchParams(newParams, { replace: true });
    }
  }, [actionParam]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [subcontractorFilter, setSubcontractorFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [showFilters, setShowFilters] = useState(false);

  const { data: workOrders = [], isLoading, refetch } = useQuery({
    queryKey: ['subcontractor_work_orders', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('subcontractor_work_orders')
        .select(`
          *,
          subcontractors(id, company_name, sub_number),
          clients(id, name),
          projects(id, name)
        `)
        .eq('organisation_id', organisation.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  // Get unique subcontractors for filter
  const subcontractors = useMemo(() => {
    const unique = new Map();
    workOrders.forEach((wo: any) => {
      if (wo.subcontractors?.id) {
        unique.set(wo.subcontractors.id, wo.subcontractors);
      }
    });
    return Array.from(unique.values());
  }, [workOrders]);

  // Filter work orders
  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter((wo: any) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          wo.work_order_no?.toLowerCase().includes(query) ||
          wo.subcontractors?.company_name?.toLowerCase().includes(query) ||
          wo.clients?.name?.toLowerCase().includes(query) ||
          wo.projects?.name?.toLowerCase().includes(query) ||
          wo.work_description?.toLowerCase().includes(query) ||
          wo.site_location?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && wo.status !== statusFilter) return false;

      // Subcontractor filter
      if (subcontractorFilter !== 'all' && wo.subcontractor_id !== subcontractorFilter) return false;

      // Date range filter
      if (dateRange.from && wo.issue_date < dateRange.from) return false;
      if (dateRange.to && wo.issue_date > dateRange.to) return false;

      return true;
    });
  }, [workOrders, searchQuery, statusFilter, subcontractorFilter, dateRange]);

  const handleDownloadPDF = async (wo: any) => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text('WORK ORDER', 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`WO No: ${wo.work_order_no}`, 20, 35);
    doc.text(`Date: ${wo.issue_date}`, 20, 42);
    doc.text(`Sub-contractor: ${wo.subcontractors?.company_name || '-'}`, 20, 49);
    doc.text(`Client: ${wo.clients?.name || '-'}`, 20, 56);
    doc.text(`Project: ${wo.projects?.name || '-'}`, 20, 63);

    const lineItems = wo.line_items || [];
    const tableData = lineItems.map((item: any, idx: number) => [
      idx + 1,
      item.description,
      item.quantity,
      item.unit,
      item.rate?.toFixed(2),
      item.amount?.toFixed(2),
    ]);

    autoTable(doc, {
      startY: 72,
      head: [['S.No', 'Description', 'Qty', 'Unit', 'Rate', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [41, 64, 86] },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 120;
    doc.setFontSize(10);
    doc.text(`Subtotal: ₹${wo.subtotal?.toFixed(2)}`, 150, finalY + 10);
    
    if (wo.tax_type === 'GST') {
      doc.text(`CGST (${wo.cgst_percent}%): ₹${wo.cgst_amount?.toFixed(2)}`, 150, finalY + 17);
      doc.text(`SGST (${wo.sgst_percent}%): ₹${wo.sgst_amount?.toFixed(2)}`, 150, finalY + 24);
    } else if (wo.tax_type === 'TDS') {
      doc.text(`TDS Note (${wo.tds_percent}%): ₹${wo.tds_amount?.toFixed(2)}`, 150, finalY + 17);
    }
    
    doc.text(`Total: ₹${wo.total_amount?.toFixed(2)}`, 150, finalY + 31);

    doc.save(`Work_Order_${wo.work_order_no}.pdf`);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setSubcontractorFilter('all');
    setDateRange({ from: '', to: '' });
  };

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || subcontractorFilter !== 'all' || dateRange.from || dateRange.to;

  return (
    <div className="min-h-screen bg-[#f8fafc]" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header Section */}
      <div className="px-6 py-6">
        <div className="mx-auto max-w-[1400px]">
          {/* Title Row */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-zinc-900">
                Work Orders
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Manage subcontractor work orders and track progress
              </p>
            </div>
            <button
              onClick={() => {
                onNavigate?.('/subcontractors/workorders/create');
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              <Plus size={16} />
              New Work Order
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
            <div className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="flex-1 min-w-[280px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by WO number, subcontractor, client, project or description..."
                      className="w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20 transition-all"
                    />
                  </div>
                </div>

                {/* Filter Toggle */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                    showFilters
                      ? 'bg-zinc-900 text-white'
                      : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  <Filter size={16} />
                  Filters
                  {hasActiveFilters && (
                    <span className="ml-1 rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-900">
                      Active
                    </span>
                  )}
                </button>

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="rounded-lg px-4 py-2.5 text-sm font-medium text-zinc-500 transition hover:text-zinc-700 hover:bg-zinc-100"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Expanded Filters */}
              {showFilters && (
                <div className="mt-4 grid gap-4 border-t border-zinc-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Status Filter */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Status
                    </label>
                    <div className="relative">
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full appearance-none rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20"
                      >
                        <option value="all">All Status</option>
                        <option value="Draft">Draft</option>
                        <option value="PENDING_APPROVAL">Pending Approval</option>
                        <option value="Issued">Issued</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                    </div>
                  </div>

                  {/* Subcontractor Filter */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Subcontractor
                    </label>
                    <div className="relative">
                      <select
                        value={subcontractorFilter}
                        onChange={(e) => setSubcontractorFilter(e.target.value)}
                        className="w-full appearance-none rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20"
                      >
                        <option value="all">All Subcontractors</option>
                        {subcontractors.map((sub: any) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.company_name}
                          </option>
                        ))}
                      </select>
                      <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                    </div>
                  </div>

                  {/* Date From */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      From Date
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={dateRange.from}
                        onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20"
                      />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                    </div>
                  </div>

                  {/* Date To */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      To Date
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={dateRange.to}
                        onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20"
                      />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between px-1">
            <p className="text-sm text-zinc-500">
              Showing <span className="font-semibold text-zinc-900">{filteredWorkOrders.length}</span> of{' '}
              <span className="font-semibold text-zinc-900">{workOrders.length}</span> work orders
            </p>
          </div>

          {/* Table */}
          <div className="mt-4 rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-pulse text-zinc-400">Loading work orders...</div>
              </div>
            ) : filteredWorkOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <div className="rounded-full bg-zinc-100 p-4 mb-4">
                  <FileText className="text-zinc-400" size={32} />
                </div>
                <h3 className="text-sm font-bold text-zinc-800 tracking-tight">
                  {hasActiveFilters ? 'No matching work orders' : 'No work orders yet'}
                </h3>
                <p className="mt-1 text-sm text-zinc-500 text-center max-w-sm">
                  {hasActiveFilters
                    ? 'Try adjusting your filters to see more results'
                    : 'Create your first work order to get started with subcontractor management'}
                </p>
                {!hasActiveFilters && (
                  <button
                    onClick={() => {
                      onNavigate?.('/subcontractors/workorders/create');
                    }}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-200"
                  >
                    <Plus size={16} />
                    Create Work Order
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50/50">
                      <th className="px-4 py-3 text-left">
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Work Order
                        </span>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Subcontractor
                        </span>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Client / Project
                        </span>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Status
                        </span>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Issue Date
                        </span>
                      </th>
                      <th className="px-4 py-3 text-right">
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Total Amount
                        </span>
                      </th>
                      <th className="px-4 py-3 text-center">
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Actions
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWorkOrders.map((wo: any) => (
                      <tr
                        key={wo.id}
                        onClick={() => onNavigate?.(`/subcontractors/workorders/${wo.id}`)}
                        className="border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-zinc-900">
                              {wo.work_order_no}
                            </span>
                            <span className="text-xs text-zinc-500 mt-0.5 truncate max-w-[200px]">
                              {wo.work_description?.substring(0, 60)}
                              {wo.work_description?.length > 60 ? '...' : ''}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-zinc-700 font-medium">
                            {wo.subcontractors?.company_name || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm text-zinc-800 font-semibold">{wo.clients?.name || '-'}</span>
                            <span className="text-xs text-zinc-500">{wo.projects?.name || '-'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <StatusPill status={wo.status} />
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-zinc-600">
                            {wo.issue_date ? new Date(wo.issue_date).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            }) : '-'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-1 text-sm font-semibold text-zinc-900">
                            <IndianRupee size={14} className="text-zinc-500" />
                            {parseFloat(wo.total_amount || 0).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigate?.(`/subcontractors/workorders/${wo.id}`);
                              }}
                              className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
                              title="View Details"
                            >
                              <FileText size={16} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigate?.(`/subcontractors/workorders/create?id=${wo.id}`);
                              }}
                              className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
                              title="Edit"
                            >
                              <ArrowUpDown size={16} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadPDF(wo);
                              }}
                              className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
                              title="Download PDF"
                            >
                              <Download size={16} />
                            </button>
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
      </div>
    </div>
  );
}
