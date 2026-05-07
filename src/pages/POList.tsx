import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatCurrency, formatDateTable } from '../utils/formatters';
import { ensureValidSession } from '../queryClient';
import { useAuth } from '../contexts/AuthContext';
import { 
  Plus, 
  Search, 
  Filter, 
  FileText, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  XCircle, 
  ChevronRight, 
  ChevronLeft,
  Edit2, 
  Trash2,
  Calendar,
  Layers,
  FileCheck,
  RefreshCcw,
  X,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

export default function POList() {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Proforma creation modal state
  const [showProformaModal, setShowProformaModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [poLineItems, setPOLineItems] = useState<any[]>([]);
  
  // Action menu state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    loadPOs();
  }, [statusFilter, dateFrom, dateTo, organisation?.id]);

  // NOTE: Tab visibility re-fetch is handled globally in App.tsx (5-min threshold)
  // A duplicate visibilitychange handler here caused a DB query on every tab switch

  useEffect(() => {
    // Reset to page 1 on filter or search changes
    setCurrentPage(1);
  }, [searchTerm, statusFilter, dateFrom, dateTo]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId && !(event.target as Element).closest('.action-dropdown')) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  const loadPOs = async () => {
    // Guard: wait for organisation to be available before querying
    if (!organisation?.id) {
      console.log('No organisation ID available');
      setLoading(false);
      return;
    }

    console.log('Loading POs for organisation:', organisation.id);
    setLoading(true);
    try {
      const sessionValid = await ensureValidSession();
      if (!sessionValid) {
        console.error('Session expired - please refresh');
        setLoading(false);
        return;
      }

      let query = supabase
        .from('client_purchase_orders')
        .select(`*, clients!inner(client_name)`)
        .eq('organisation_id', organisation.id)
        .order('created_at', { ascending: false });

      if (statusFilter) query = query.eq('status', statusFilter);
      if (dateFrom)     query = query.gte('po_date', dateFrom);
      if (dateTo)       query = query.lte('po_date', dateTo);

      // 30-second timeout guard
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout after 30s')), 30000)
      );
      const { data, error } = await Promise.race([query, timeout]) as any;

      if (error) console.error('Error loading POs:', error);
      setPos(data || []);
    } catch (err) {
      console.error('loadPOs error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredPOs = pos.filter(po => {
    const searchLower = searchTerm.toLowerCase();
    return (
      po.po_number?.toLowerCase().includes(searchLower) ||
      po.clients?.client_name?.toLowerCase().includes(searchLower)
    );
  });

  const totalPages = Math.ceil(filteredPOs.length / pageSize);
  const paginatedPOs = filteredPOs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
      'Open':              { bg: '#dbeafe', color: '#1d4ed8' },
      'Partially Billed':  { bg: '#fef3c7', color: '#b45309' },
      'Closed':            { bg: '#d1fae5', color: '#047857' },
    };

  const getStatusColor = (status?: string) =>
    STATUS_COLORS[status ?? ''] ?? STATUS_COLORS['Open'];

  const getStatusBadge = (status: string) => {
    return (
      <span
        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-full border"
        style={{
          backgroundColor: getStatusColor(status).bg,
          color: getStatusColor(status).color,
          borderColor: getStatusColor(status).color + '20',
        }}
      >
        {status}
      </span>
    );
  };

  const deletePO = async (id: string) => {
    if (!confirm('Are you sure you want to delete this PO?')) return;
    
    const { error } = await supabase
      .from('client_purchase_orders')
      .delete()
      .eq('id', id);
    
    if (error) {
      alert('Error deleting PO: ' + error.message);
    } else {
      loadPOs();
    }
  };

  const handleCreateProforma = async (po: any) => {
    setSelectedPO(po);
    setShowProformaModal(true);
    
    // Load PO line items
    try {
      const { data, error } = await supabase
        .from('po_line_items')
        .select('*')
        .eq('po_id', po.id)
        .order('line_order', { ascending: true });
      
      if (error) throw error;
      
      setPOLineItems(data || []);
    } catch (err: any) {
      console.error('Error loading PO line items:', err);
      alert('Error loading PO line items');
    }
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    const updated = [...poLineItems];
    updated[index] = { ...updated[index], [field]: value };
    setPOLineItems(updated);
  };

  const handleCreateProformaFromPO = () => {
    // Convert PO line items to proforma format
    const proformaItems = poLineItems.map(item => ({
      description: item.description,
      hsn_code: null,
      qty: item.quantity,
      rate: item.rate_per_unit,
      amount: item.amount || (item.quantity * item.rate_per_unit * (1 + (item.gst_percentage || 18) / 100)),
      discount_percent: 0,
      discount_amount: 0,
      tax_percent: item.gst_percentage || 18
    }));

    // Navigate to proforma creation with items pre-filled
    // We'll pass the items as query params (simplified approach)
    navigate(`/proforma-invoices/create?clientId=${selectedPO.client_id}&poId=${selectedPO.id}`);
    setShowProformaModal(false);
  };

  return (
    <div className="min-h-screen bg-zinc-50 p-4 font-inter">
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-zinc-500" />
          <h1 className="text-sm font-semibold text-zinc-800">Purchase Orders</h1>
        </div>
        <button 
          className="inline-flex h-7 items-center gap-1.5 bg-blue-600 px-3 text-xs font-semibold text-white rounded-md hover:bg-blue-700 transition-colors"
          onClick={() => navigate('/client-po/create')}
        >
          <Plus size={14} />
          New
        </button>
      </div>

      {/* Compact Metrics Strip */}
      <div className="flex items-center gap-6 mb-4 text-xs">
        <div className="flex items-center gap-1.5">
          <FileText className="h-3 w-3 text-blue-500" />
          <span className="text-zinc-400">Total:</span>
          <span className="font-semibold text-zinc-700">{filteredPOs.length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-amber-500" />
          <span className="text-zinc-400">Active:</span>
          <span className="font-semibold text-zinc-700">{filteredPOs.filter(p => p.status === 'Open').length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3 text-emerald-500" />
          <span className="text-zinc-400">Value:</span>
          <span className="font-semibold text-emerald-700">₹{formatCurrency(filteredPOs.reduce((sum, p) => sum + (p.po_total_value || 0), 0))}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Layers className="h-3 w-3 text-rose-500" />
          <span className="text-zinc-400">Balance:</span>
          <span className="font-semibold text-rose-700">₹{formatCurrency(filteredPOs.reduce((sum, p) => sum + (p.po_available_value || 0), 0))}</span>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="border border-zinc-200 bg-white rounded-lg shadow-sm overflow-hidden font-inter">
        {/* Compact Filter Bar */}
        <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2 bg-white">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
              <input
                type="text"
                placeholder="Search..."
                className="h-7 w-48 pl-7 text-xs border border-zinc-200 bg-white rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <select
                className="h-7 text-xs border border-zinc-200 bg-white px-2 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="Open">Open</option>
                <option value="Partially Billed">Partially Billed</option>
                <option value="Closed">Closed</option>
              </select>

              <div className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-1 py-0.5">
                <input
                  type="date"
                  className="h-6 text-xs border-none bg-transparent px-1 focus:outline-none"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
                <span className="text-zinc-300">→</span>
                <input
                  type="date"
                  className="h-6 text-xs border-none bg-transparent px-1 focus:outline-none"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={loadPOs}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-400 hover:bg-zinc-50 transition-colors"
              title="Refresh Data"
            >
              <RefreshCcw size={12} className={cn(loading && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div>
          {loading ? (
            <div className="flex h-48 items-center justify-center text-zinc-300">
              <RefreshCcw size={20} className="animate-spin" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto overflow-y-visible">
                <table className="w-full border-separate border-spacing-0 table-fixed">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-blue-100/80 border-b border-blue-200">
                      <th className="h-[36px] px-5 pl-1 text-left align-middle text-[13px] font-semibold text-slate-700 tracking-tight w-[120px] border-r border-slate-200">
                        Date
                      </th>
                      <th className="h-[36px] px-5 pl-1 text-left align-middle text-[13px] font-semibold text-slate-700 tracking-tight w-[160px] border-r border-slate-200">
                        Client
                      </th>
                      <th className="h-[36px] px-5 pl-1 text-left align-middle text-[13px] font-semibold text-slate-700 tracking-tight w-[140px] border-r border-slate-200">
                        PO Number
                      </th>
                      <th className="h-[36px] px-5 pl-1 text-left align-middle text-[13px] font-semibold text-slate-700 tracking-tight w-[140px] border-r border-slate-200">
                        Amount
                      </th>
                      <th className="h-[36px] px-5 pl-1 text-left align-middle text-[13px] font-semibold text-slate-700 tracking-tight w-[140px] border-r border-slate-200">
                        Utilised
                      </th>
                      <th className="h-[36px] px-5 pl-1 text-left align-middle text-[13px] font-semibold text-slate-700 tracking-tight w-[140px] border-r border-slate-200">
                        Balance
                      </th>
                      <th className="h-[36px] px-5 pl-1 text-left align-middle text-[13px] font-semibold text-slate-700 tracking-tight w-[120px] border-r border-slate-200">
                        Status
                      </th>
                      <th className="h-[36px] px-5 pl-1 text-center align-middle text-[13px] font-semibold text-slate-700 tracking-tight w-[80px]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {paginatedPOs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-5 py-16 text-center text-sm text-slate-500">
                          No matching purchase orders found
                        </td>
                      </tr>
                    ) : (
                      paginatedPOs.map((po, index) => (
                        <tr
                          key={po.id}
                          className={`hover:bg-slate-50 cursor-pointer transition-all duration-150 ${
                            index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                          }`}
                        >
                          <td className="px-4 py-6 align-middle text-sm font-semibold text-slate-900 whitespace-nowrap border-r border-slate-100 border-t border-slate-200/70">
                            {formatDateTable(po.po_date)}
                          </td>
                          <td className="px-4 py-6 align-middle text-sm text-slate-800 border-t border-slate-200/70">
                            <div className="max-w-[350px] truncate" title={po.clients?.client_name || '-'}>
                              {po.clients?.client_name || '-'}
                            </div>
                          </td>
                          <td className="px-4 py-6 align-middle text-sm font-semibold text-slate-900 whitespace-nowrap border-r border-slate-100 border-t border-slate-200/70">
                            {po.po_number}
                          </td>
                          <td className="px-4 py-6 align-middle text-sm font-semibold text-slate-900 whitespace-nowrap tabular-nums border-r border-slate-100 border-t border-slate-200/70">
                            {formatCurrency(po.po_total_value)}
                          </td>
                          <td className="px-4 py-6 align-middle text-sm font-semibold text-slate-900 whitespace-nowrap tabular-nums border-r border-slate-100 border-t border-slate-200/70">
                            {formatCurrency(po.po_utilized_value)}
                          </td>
                          <td className="px-4 py-6 align-middle text-sm font-semibold whitespace-nowrap tabular-nums border-r border-slate-100 border-t border-slate-200/70">
                            <span className={cn(
                              (po.po_available_value || 0) > 0 ? "text-emerald-600" : "text-rose-600"
                            )}>
                              {formatCurrency(po.po_available_value || 0)}
                            </span>
                          </td>
                          <td className="px-4 py-6 align-middle whitespace-nowrap border-r border-slate-100 border-t border-slate-200/70">
                            {getStatusBadge(po.status)}
                          </td>
                          <td className="px-4 py-6 align-middle text-center border-t border-slate-200/70">
                            <div className="relative inline-block action-dropdown">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(openMenuId === po.id ? null : po.id);
                                }}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-slate-100 transition-colors"
                              >
                                <MoreHorizontal className="w-4 h-4 text-slate-500" />
                              </button>
                              {openMenuId === po.id && (
                                <div className="fixed bg-white border border-zinc-200 rounded-lg shadow-lg py-1 min-w-[160px]" 
                                     style={{
                                       top: 'auto',
                                       right: 'auto',
                                       position: 'fixed',
                                       zIndex: 9999
                                     }}
                                     ref={(el) => {
                                       if (el) {
                                         const rect = el.parentElement?.getBoundingClientRect();
                                         if (rect) {
                                           el.style.top = `${rect.bottom + window.scrollY + 4}px`;
                                           el.style.left = `${rect.right - 160 + window.scrollX}px`;
                                         }
                                       }
                                     }}>
                                  {/* Section 1: Read actions */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/client-po/details?id=${po.id}`);
                                      setOpenMenuId(null);
                                    }}
                                    className="block w-full text-left px-3 py-2 text-sm transition-colors text-zinc-700 hover:bg-zinc-50"
                                  >
                                    View Details
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCreateProforma(po);
                                      setOpenMenuId(null);
                                    }}
                                    className="block w-full text-left px-3 py-2 text-sm transition-colors text-zinc-700 hover:bg-zinc-50"
                                  >
                                    Create Proforma
                                  </button>

                                  <div className="border-t border-zinc-100 my-1" />

                                  {/* Section 2: Modify actions */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/client-po/create?id=${po.id}`);
                                      setOpenMenuId(null);
                                    }}
                                    className="block w-full text-left px-3 py-2 text-sm transition-colors text-zinc-700 hover:bg-zinc-50"
                                  >
                                    Edit
                                  </button>

                                  <div className="border-t border-zinc-100 my-1" />

                                  {/* Section 3: Destructive */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deletePO(po.id);
                                      setOpenMenuId(null);
                                    }}
                                    className="block w-full text-left px-3 py-2 text-sm transition-colors text-red-600 hover:bg-red-50"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 bg-zinc-50">
                  <span className="text-sm text-zinc-500">
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredPOs.length)} of {filteredPOs.length} results
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="flex h-8 items-center justify-center gap-1 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft size={16} />
                      Previous
                    </button>
                    <span className="text-sm font-medium text-zinc-700 px-2">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="flex h-8 items-center justify-center gap-1 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Proforma Creation Modal */}
      {showProformaModal && selectedPO && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '1200px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e5e5e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, marginBottom: '4px' }}>
                  Create Proforma from PO
                </h2>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                  PO: {selectedPO.po_number} | Total: ₹{formatCurrency(selectedPO.po_total_value)}
                </p>
              </div>
              <button
                onClick={() => setShowProformaModal(false)}
                style={{
                  padding: '8px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {poLineItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                  No line items found in this PO
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Header Row */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '3fr 1fr 1fr 1fr 1fr auto',
                    gap: '8px',
                    padding: '8px 12px',
                    background: '#f9fafb',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    color: '#6b7280'
                  }}>
                    <div>Description</div>
                    <div>Qty</div>
                    <div>Unit</div>
                    <div>Rate</div>
                    <div>GST %</div>
                    <div>Amount</div>
                  </div>
                  
                  {/* Line Items */}
                  {poLineItems.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '3fr 1fr 1fr 1fr 1fr auto',
                        gap: '8px',
                        padding: '8px 12px',
                        background: 'white',
                        border: '1px solid #e5e5e5',
                        borderRadius: '6px',
                        alignItems: 'center'
                      }}
                    >
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                        style={{
                          padding: '6px 10px',
                          border: '1px solid #d4d4d4',
                          borderRadius: '4px',
                          fontSize: '13px',
                          width: '100%'
                        }}
                      />
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        style={{
                          padding: '6px 10px',
                          border: '1px solid #d4d4d4',
                          borderRadius: '4px',
                          fontSize: '13px',
                          width: '100%'
                        }}
                      />
                      <input
                        type="text"
                        value={item.unit || ''}
                        onChange={(e) => updateLineItem(index, 'unit', e.target.value)}
                        placeholder="-"
                        style={{
                          padding: '6px 10px',
                          border: '1px solid #d4d4d4',
                          borderRadius: '4px',
                          fontSize: '13px',
                          width: '100%'
                        }}
                      />
                      <input
                        type="number"
                        value={item.rate_per_unit}
                        onChange={(e) => updateLineItem(index, 'rate_per_unit', parseFloat(e.target.value) || 0)}
                        style={{
                          padding: '6px 10px',
                          border: '1px solid #d4d4d4',
                          borderRadius: '4px',
                          fontSize: '13px',
                          width: '100%'
                        }}
                      />
                      <input
                        type="number"
                        value={item.gst_percentage || 18}
                        onChange={(e) => updateLineItem(index, 'gst_percentage', parseFloat(e.target.value) || 0)}
                        style={{
                          padding: '6px 10px',
                          border: '1px solid #d4d4d4',
                          borderRadius: '4px',
                          fontSize: '13px',
                          width: '100%'
                        }}
                      />
                      <div style={{
                        padding: '6px 10px',
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '4px',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#166534',
                        textAlign: 'right',
                        minWidth: '100px'
                      }}>
                        ₹{formatCurrency(item.amount || (item.quantity * item.rate_per_unit * (1 + (item.gst_percentage || 18) / 100)))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '20px 24px',
              borderTop: '1px solid #e5e5e5',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={() => setShowProformaModal(false)}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #d4d4d4',
                  borderRadius: '8px',
                  background: 'white',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProformaFromPO}
                disabled={poLineItems.length === 0}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  background: '#059669',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: poLineItems.length > 0 ? 'pointer' : 'not-allowed',
                  opacity: poLineItems.length > 0 ? 1 : 0.5,
                  transition: 'all 0.15s'
                }}
              >
                Create Proforma
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
