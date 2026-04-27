import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatCurrency } from '../utils/formatters';
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
  X
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

  useEffect(() => {
    loadPOs();
  }, [statusFilter, dateFrom, dateTo, organisation?.id]);

  // NOTE: Tab visibility re-fetch is handled globally in App.tsx (5-min threshold)
  // A duplicate visibilitychange handler here caused a DB query on every tab switch

  useEffect(() => {
    // Reset to page 1 on filter or search changes
    setCurrentPage(1);
  }, [searchTerm, statusFilter, dateFrom, dateTo]);

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

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string, text: string, icon: any }> = {
      'Open': { bg: 'bg-blue-50', text: 'text-blue-700', icon: CheckCircle },
      'Partially Billed': { bg: 'bg-amber-50', text: 'text-amber-700', icon: Clock },
      'Closed': { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: FileCheck }
    };
    const cfg = config[status] || config['Open'];
    const Icon = cfg.icon;
    
    return (
      <div className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider", cfg.bg, cfg.text)}>
        <Icon size={12} />
        {status}
      </div>
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>PO Number</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Utilised</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPOs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center text-zinc-500">
                          No matching purchase orders found
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedPOs.map((po) => (
                        <TableRow key={po.id}>
                          <TableCell className="font-medium text-zinc-700 whitespace-nowrap">
                            {po.clients?.client_name || '-'}
                          </TableCell>
                          <TableCell className="font-semibold text-blue-600 whitespace-nowrap">
                            {po.po_number}
                          </TableCell>
                          <TableCell className="text-zinc-500 whitespace-nowrap">
                            {formatDate(po.po_date)}
                          </TableCell>
                          <TableCell className="text-right font-medium text-zinc-700 tabular-nums whitespace-nowrap">
                            ₹{formatCurrency(po.po_total_value)}
                          </TableCell>
                          <TableCell className="text-right text-zinc-500 tabular-nums whitespace-nowrap">
                            ₹{formatCurrency(po.po_utilized_value)}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-medium tabular-nums whitespace-nowrap",
                            (po.po_available_value || 0) > 0 ? "text-emerald-600" : "text-rose-600"
                          )}>
                            ₹{formatCurrency(po.po_available_value || 0)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {getStatusBadge(po.status)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                onClick={() => handleCreateProforma(po)}
                                title="Create Proforma"
                              >
                                <FileCheck size={14} />
                              </button>
                              <button
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                onClick={() => navigate(`/client-po/create?id=${po.id}`)}
                                title="Edit"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                onClick={() => deletePO(po.id)}
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                              <button
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                onClick={() => navigate(`/client-po/details?id=${po.id}`)}
                                title="View"
                              >
                                <ChevronRight size={14} />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
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
