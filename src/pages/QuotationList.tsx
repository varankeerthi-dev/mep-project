import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatCurrency } from '../utils/formatters';
import { useAuth } from '../App';
import { getPrintSettings } from '../utils/printSettings';

const QUOTATION_STATUSES = ['All', 'Draft', 'Sent', 'Under Negotiation', 'Approved', 'Rejected', 'Converted', 'Cancelled', 'Expired'];

// Helper to convert number to words for INR
function numberToWords(num) {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n) => {
    if ((n = n.toString()).length > 9) return 'overflow';
    let nArr = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!nArr) return '';
    let str = '';
    str += nArr[1] != 0 ? (a[Number(nArr[1])] || b[nArr[1][0]] + ' ' + a[nArr[1][1]]) + 'Crore ' : '';
    str += nArr[2] != 0 ? (a[Number(nArr[2])] || b[nArr[2][0]] + ' ' + a[nArr[2][1]]) + 'Lakh ' : '';
    str += nArr[3] != 0 ? (a[Number(nArr[3])] || b[nArr[3][0]] + ' ' + a[nArr[3][1]]) + 'Thousand ' : '';
    str += nArr[4] != 0 ? (a[Number(nArr[4])] || b[nArr[4][0]] + ' ' + a[nArr[4][1]]) + 'Hundred ' : '';
    str += nArr[5] != 0 ? ((str != '') ? 'and ' : '') + (a[Number(nArr[5])] || b[nArr[5][0]] + ' ' + a[nArr[5][1]]) : '';
    return str.trim() + ' Only';
  };
  
  return inWords(Math.round(num));
}

export default function QuotationList() {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const [selectedQuotationId, setSelectedQuotationId] = useState(null);
  const [activeTab, setActiveTab] = useState('details');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [openMenu, setOpenMenu] = useState(false);
  const userClearedRef = useRef(false);

  const queryClient = useQueryClient();

  const quotationsQuery = useQuery({
    queryKey: ['quotations', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('quotation_header')
        .select(`
          *,
          client:clients(id, client_name, gstin, state),
          project:projects(id, project_name)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'All') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      const today = new Date().toISOString().split('T')[0];
      return (data || []).map((q) => {
        if (q.status === 'Draft' && q.valid_till && q.valid_till < today) {
          return { ...q, status: 'Expired' };
        }
        return q;
      });
    }
  });

  const printSettingsQuery = useQuery({
    queryKey: ['printSettings', 'Quotation'],
    queryFn: () => getPrintSettings('Quotation'),
    staleTime: 10 * 60 * 1000
  });

  const quotationDetailsQuery = useQuery({
    queryKey: ['quotation', selectedQuotationId],
    queryFn: async ({ queryKey }) => {
      const [, quotationId] = queryKey;

      const cachedHeader = queryClient.getQueryData(['quotations', statusFilter])?.find(q => q.id === quotationId);

      if (cachedHeader && cachedHeader.items && cachedHeader.items.length > 0) {
        return cachedHeader;
      }

      const { data, error } = await supabase
        .from('quotation_header')
        .select(`
          *,
          client:clients(*),
          project:projects(id, project_name, project_code),
          items:quotation_items(
            *,
            item:materials(id, item_code, display_name, name, hsn_code)
          )
        `)
        .eq('id', quotationId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedQuotationId
  });

  const quotations = quotationsQuery.data || [];
  const loading = quotationsQuery.isLoading;
  const previewLoading = quotationDetailsQuery.isFetching;
  const selectedQuotation = quotationDetailsQuery.data || null;
  const printSettings = printSettingsQuery.data?.style_settings;

  useEffect(() => {
    if (quotations.length === 0) {
      setSelectedQuotationId(null);
      userClearedRef.current = false;
      return;
    }
    if (!selectedQuotationId) {
      if (userClearedRef.current) return;
      setSelectedQuotationId(quotations[0].id);
      return;
    }
    if (!quotations.some((q) => q.id === selectedQuotationId)) {
      setSelectedQuotationId(quotations[0].id);
    }
  }, [quotations, selectedQuotationId]);

  useEffect(() => {
    userClearedRef.current = false;
  }, [statusFilter]);

  const handleSelectQuotation = (quotation) => {
    setSelectedQuotationId(quotation.id);
  };

  const getStatusColor = (status) => {
    const colors = {
      Draft: { bg: '#f3f4f6', color: '#6b7280' },
      Sent: { bg: '#dbeafe', color: '#1d4ed8' },
      'Under Negotiation': { bg: '#fef3c7', color: '#b45309' },
      Approved: { bg: '#d1fae5', color: '#047857' },
      Rejected: { bg: '#fee2e2', color: '#dc2626' },
      Converted: { bg: '#d1fae5', color: '#065f46' },
      Cancelled: { bg: '#fee2e2', color: '#991b1b' },
      Expired: { bg: '#f3f4f6', color: '#9ca3af' },
      INVOICED: { bg: '#d1fae5', color: '#065f46' }
    };
    return colors[status] || colors.Draft;
  };

  const ITEM_HEIGHT = 68;
  const VISIBLE = 10;
  const BUFFER = 5;
  const sidebarScrollRef = useRef(null);
  const [startIndex, setStartIndex] = useState(0);

  const onSidebarScroll = (e) => {
    const container = e.target;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const totalHeight = container.scrollHeight;
    const visibleItems = Math.floor(containerHeight / ITEM_HEIGHT);
    const bufferItems = Math.floor(visibleItems * BUFFER / 100);
    const newStartIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - bufferItems);
    setStartIndex(newStartIndex);
  };

  const totalHeight = useMemo(() => {
    const visibleItems = Math.floor(VISIBLE + BUFFER);
    return visibleItems * ITEM_HEIGHT;
  }, []);

  const virtualItems = useMemo(() => {
    const visibleItems = Math.floor(VISIBLE + BUFFER);
    const start = Math.max(0, startIndex);
    const end = Math.min(start + visibleItems, quotations.length);
    const items = quotations.slice(start, end);
    const offset = start * ITEM_HEIGHT;
    return items.map((q, idx) => ({
      ...q,
      offset: offset + idx * ITEM_HEIGHT
    }));
  }, [quotations, startIndex]);

  const filteredQuotations = quotations.filter(q => 
    q.quotation_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.client?.client_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const quotationPreview = useMemo(() => {
    if (!selectedQuotation) return null;
    return (
      <div className="pdf-container shadow-lg" style={{ 
        width: '210mm', 
        minHeight: '297mm', 
        background: '#fff', 
        padding: `${printSettings?.margins?.top || 15}mm ${printSettings?.margins?.right || 15}mm ${printSettings?.margins?.bottom || 15}mm ${printSettings?.margins?.left || 15}mm`,
        position: 'relative',
        border: '1px solid #000',
        margin: '0 auto',
        fontFamily: "'Inter', sans-serif",
        color: printSettings?.colors?.text || '#1f2937'
      }}>
        {/* Double line border effect matching template */}
        <div style={{
          position: 'absolute',
          top: '1mm',
          left: '1mm',
          right: '1mm',
          bottom: '1mm',
          border: '0.2mm solid #000',
          pointerEvents: 'none'
        }}></div>

        {/* Watermark/Status Stamp */}
        <div style={{ 
          position: 'absolute', 
          top: '60mm', 
          left: '20mm', 
          transform: 'rotate(-45deg)',
          border: `3px solid ${getStatusColor(selectedQuotation.status === 'Converted' ? 'INVOICED' : selectedQuotation.status).color}`,
          color: getStatusColor(selectedQuotation.status === 'Converted' ? 'INVOICED' : selectedQuotation.status).color,
          padding: '8px 20px',
          fontSize: '24px',
          fontWeight: 900,
          borderRadius: '8px',
          opacity: 0.15,
          zIndex: 10
        }}>
          {selectedQuotation.status === 'Converted' ? 'INVOICED' : selectedQuotation.status.toUpperCase()}
        </div>

        {/* PDF Content Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `2px solid #3b82f6`, paddingBottom: '20px', marginBottom: '20px' }}>
          <div style={{ width: '65%' }}>
            {organisation?.logo_url && (
              <img src={organisation.logo_url} alt="Logo" style={{ height: '50px', marginBottom: '12px', objectFit: 'contain' }} />
            )}
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase' }}>{organisation?.name || 'ARUN PIPES & FITTINGS'}</h1>
            <p style={{ fontSize: '11px', color: '#4b5563', margin: '4px 0', whiteSpace: 'pre-line', lineHeight: '1.4' }}>{organisation?.address || '69, Babu Naidu garden, Perumalagaram, Thiruverkadu, Chennai, Tamil Nadu-600077, India'}</p>
            <p style={{ fontSize: '12px', fontWeight: 700, marginTop: '8px', textTransform: 'uppercase' }}>GSTIN: {organisation?.gstin || '33AGZPA3632P1ZY'}</p>
          </div>
          <div style={{ textAlign: 'right', width: '35%' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 900, color: '#d1d5db', margin: '0 0 15px 0', textTransform: 'uppercase', letterSpacing: '-0.05em' }}>Quotation</h2>
            <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <p><span style={{ fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', fontSize: '10px' }}>Quote No:</span> <span style={{ fontWeight: 700 }}>{selectedQuotation.quotation_no}</span></p>
              <p><span style={{ fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', fontSize: '10px' }}>Quote Date:</span> <span style={{ fontWeight: 700 }}>{formatDate(selectedQuotation.date)}</span></p>
              {selectedQuotation.valid_till && (
                <p><span style={{ fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', fontSize: '10px' }}>Valid Till:</span> <span style={{ fontWeight: 700 }}>{formatDate(selectedQuotation.valid_till)}</span></p>
              )}
            </div>
          </div>
        </div>

        {/* Remarks area if any */}
        {selectedQuotation.remarks && (
          <div style={{ marginBottom: '20px', padding: '10px 15px', background: '#f9fafb', borderLeft: '4px solid #3b82f6', fontSize: '12px' }}>
            <span style={{ fontWeight: 700, fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Remarks / Reference:</span>
            {selectedQuotation.remarks}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
          <div style={{ padding: '12px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
            <h3 style={{ fontSize: '10px', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>Bill To (Buyer)</h3>
            <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
              <p style={{ fontWeight: 800, fontSize: '14px', marginBottom: '4px' }}>{selectedQuotation.client?.client_name}</p>
              <p style={{ color: '#4b5563', whiteSpace: 'pre-line' }}>{selectedQuotation.billing_address}</p>
              <p style={{ fontWeight: 700, marginTop: '8px' }}>GSTIN: <span style={{ textTransform: 'uppercase' }}>{selectedQuotation.gstin || '-'}</span></p>
            </div>
          </div>
          <div style={{ padding: '12px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
            <h3 style={{ fontSize: '10px', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>Ship To (Receiver)</h3>
            <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
              <p style={{ fontWeight: 800, fontSize: '14px', marginBottom: '4px' }}>{selectedQuotation.client?.client_name}</p>
              <p style={{ color: '#4b5563', whiteSpace: 'pre-line' }}>{selectedQuotation.billing_address}</p>
              <p style={{ fontWeight: 700, marginTop: '8px' }}>Contact: {selectedQuotation.client?.contact || '-'}</p>
            </div>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '25px' }}>
          <thead>
            <tr style={{ background: '#3b82f6', color: '#fff' }}>
              <th style={{ padding: '10px 8px', textAlign: 'center', width: '40px', fontSize: '11px', border: '1px solid #3b82f6' }}>S.No</th>
              <th style={{ padding: '10px 8px', textAlign: 'left', fontSize: '11px', border: '1px solid #3b82f6' }}>Item & Description</th>
              <th style={{ padding: '10px 8px', textAlign: 'center', width: '70px', fontSize: '11px', border: '1px solid #3b82f6' }}>HSN</th>
              <th style={{ padding: '10px 8px', textAlign: 'center', width: '60px', fontSize: '11px', border: '1px solid #3b82f6' }}>Qty</th>
              <th style={{ padding: '10px 8px', textAlign: 'right', width: '90px', fontSize: '11px', border: '1px solid #3b82f6' }}>Rate/Unit</th>
              <th style={{ padding: '10px 8px', textAlign: 'center', width: '60px', fontSize: '11px', border: '1px solid #3b82f6' }}>GST%</th>
              <th style={{ padding: '10px 8px', textAlign: 'right', width: '110px', fontSize: '11px', border: '1px solid #3b82f6' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {selectedQuotation.items?.map((item, idx) => (
              <tr key={item.id}>
                <td style={{ padding: '8px', textAlign: 'center', fontSize: '11px', border: '1px solid #e5e7eb' }}>{idx + 1}</td>
                <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '2px' }}>{item.description}</div>
                  {item.make && <div style={{ fontSize: '10px', color: '#6b7280' }}>Make: {item.make}</div>}
                </td>
                <td style={{ padding: '8px', textAlign: 'center', fontSize: '11px', border: '1px solid #e5e7eb' }}>{item.hsn_code || '3917'}</td>
                <td style={{ padding: '8px', textAlign: 'center', fontSize: '11px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontWeight: 600 }}>{item.qty}</div>
                  <div style={{ fontSize: '9px', color: '#6b7280' }}>{item.uom}</div>
                </td>
                <td style={{ padding: '8px', textAlign: 'right', fontSize: '11px', border: '1px solid #e5e7eb' }}>₹{item.rate.toFixed(2)}</td>
                <td style={{ padding: '8px', textAlign: 'center', fontSize: '11px', border: '1px solid #e5e7eb' }}>{item.tax_percent}%</td>
                <td style={{ padding: '8px', textAlign: 'right', fontSize: '12px', fontWeight: 700, border: '1px solid #e5e7eb' }}>₹{item.line_total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ width: '55%' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Amount in Words:</p>
            <p style={{ fontSize: '12px', fontWeight: 600, fontStyle: 'italic', textDecoration: 'underline', textDecorationColor: 'rgba(59, 130, 246, 0.3)' }}>{numberToWords(selectedQuotation.grand_total)} Only</p>
            
            <div style={{ marginTop: '30px', padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px dashed #d1d5db' }}>
              <h4 style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#3b82f6', marginBottom: '8px' }}>Bank Account Details</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '4px', fontSize: '11px' }}>
                <span style={{ color: '#6b7280', textTransform: 'uppercase' }}>Bank:</span> <span style={{ fontWeight: 700 }}>{organisation?.bank_name || '-'}</span>
                <span style={{ color: '#6b7280', textTransform: 'uppercase' }}>A/c No:</span> <span style={{ fontWeight: 700, fontSize: '12px' }}>{organisation?.bank_account_no || '-'}</span>
                <span style={{ color: '#6b7280', textTransform: 'uppercase' }}>IFSC:</span> <span style={{ fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase' }}>{organisation?.bank_ifsc || '-'}</span>
                <span style={{ color: '#6b7280', textTransform: 'uppercase' }}>Branch:</span> <span>{organisation?.bank_branch || '-'}</span>
              </div>
            </div>
          </div>
          
          <div style={{ width: '40%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280' }}>Basic Amount:</span>
                <span style={{ fontWeight: 600 }}>₹{selectedQuotation.subtotal.toFixed(2)}</span>
              </div>
              {selectedQuotation.total_item_discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280' }}>
                  <span>Total Discount:</span>
                  <span>- ₹{selectedQuotation.total_item_discount.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280' }}>
                <span style={{ textTransform: 'uppercase' }}>Total Tax (GST):</span>
                <span>₹{selectedQuotation.total_tax.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280' }}>
                <span>Round off:</span>
                <span>₹{selectedQuotation.round_off.toFixed(2)}</span>
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                paddingTop: '10px', 
                marginTop: '5px', 
                borderTop: `2px solid #3b82f6`, 
                fontSize: '18px', 
                fontWeight: 800, 
                color: '#3b82f6' 
              }}>
                <span>Net Value:</span>
                <span>{formatCurrency(selectedQuotation.grand_total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER / CLOSING */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '60px' }}>
          <div style={{ fontSize: '10px', color: '#9ca3af' }}>
            <p>This is a computer generated quotation.</p>
          </div>
          <div style={{ width: '240px', textAlign: 'center' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '50px', color: '#4b5563' }}>For {organisation?.name || 'ARUN PIPES & FITTINGS'}</p>
            <div style={{ borderTop: '1px solid #9ca3af', paddingTop: '8px' }}>
              <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>Authorized Signatory</p>
            </div>
          </div>
        </div>
      </div>
    );
  }, [selectedQuotation?.id, JSON.stringify(printSettings), organisation?.id]);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', margin: '-24px', background: '#fff' }}>
      {/* Left Sidebar - List */}
      <div style={{ width: '350px', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setOpenMenu(!openMenu)}
                style={{ background: 'none', border: 'none', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
              >
                All Quotes <span style={{ fontSize: '10px' }}>▼</span>
              </button>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn btn-primary" 
                style={{ padding: '4px 10px', borderRadius: '4px' }}
                onClick={() => navigate('/quotation/create')}
              >
                +
              </button>
              <button style={{ background: 'none', border: '1px solid #e5e7eb', padding: '4px 8px', borderRadius: '4px' }}>...</button>
            </div>
          </div>
          <input 
            type="text" 
            placeholder="Search quotes..." 
            className="form-input"
            style={{ height: '32px', fontSize: '13px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }} ref={sidebarScrollRef} onScroll={onSidebarScroll}>
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>
          ) : (
            <>
              <div style={{ height: totalHeight, position: 'relative' }}>
                {virtualItems.map(q => (
                  <div
                    key={q.id}
                    onClick={() => handleSelectQuotation(q)}
                    style={{
                      position: 'absolute',
                      top: q.offset,
                      left: 0,
                      right: 0,
                      height: ITEM_HEIGHT,
                      padding: '12px 16px',
                      cursor: 'pointer',
                      background: selectedQuotationId === q.id ? '#f0f7ff' : '#fff',
                      borderLeft: selectedQuotationId === q.id ? '3px solid #2563eb' : '3px solid transparent',
                      borderBottom: '1px solid #f3f4f6',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: '#111827', fontSize: '13px' }}>{q.client?.client_name}</span>
                      <span style={{ fontWeight: 600, color: '#111827', fontSize: '13px' }}>{formatCurrency(q.grand_total)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ color: '#6b7280', fontSize: '11px' }}>
                        {q.quotation_no} • {formatDate(q.date)}
                      </div>
                      <span style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        color: getStatusColor(q.status === 'Converted' ? 'INVOICED' : q.status).color,
                        textTransform: 'uppercase'
                      }}>
                        {q.status === 'Converted' ? 'INVOICED' : q.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Area - Preview */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f9fafb' }}>
        {selectedQuotation ? (
          <>
            {/* Header Toolbar */}
            <div style={{ padding: '12px 24px', background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Branch: Head Office</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{selectedQuotation.quotation_no}</h2>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer' }}>📎</button>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer' }}>📄</button>
                  <button
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => {
                      userClearedRef.current = true;
                      setSelectedQuotationId(null);
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '16px', marginTop: '12px', alignItems: 'center' }}>
                <button 
                  className="btn-toolbar" 
                  onClick={() => navigate(`/quotation/edit?id=${selectedQuotation.id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563' }}
                >
                  ✎ Edit
                </button>
                <div style={{ height: '16px', width: '1px', background: '#e5e7eb' }}></div>
                <button 
                  className="btn-toolbar" 
                  onClick={() => navigate(`/quotation/create?duplicateId=${selectedQuotation.id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563' }}
                >
                  📋 Duplicate
                </button>
                <div style={{ height: '16px', width: '1px', background: '#e5e7eb' }}></div>
                <button style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563' }}>✉ Mails ▼</button>
                <button style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563' }}>🔗 Share</button>
                <button style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563' }}>🖨 PDF/Print ▼</button>
                <button style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563' }}>🔄 Convert to Invoice</button>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563' }}>...</button>
              </div>
            </div>

            {/* Approval Bar */}
            <div style={{ padding: '8px 24px', background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#6b7280' }}>
              <span>Approved by:</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#111827', fontWeight: 500 }}>
                <div style={{ width: '20px', height: '20px', background: '#d1fae5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#047857' }}>K</div>
                Karthik
              </span>
              <span style={{ color: '#2563eb', cursor: 'pointer', marginLeft: '8px' }}>View Approval Details</span>
            </div>

            {/* Tabs */}
            <div style={{ padding: '0 24px', background: '#fff', display: 'flex', gap: '24px', borderBottom: '1px solid #e5e7eb' }}>
              <button 
                onClick={() => setActiveTab('details')}
                style={{ 
                  padding: '12px 0', 
                  borderBottom: activeTab === 'details' ? '2px solid #2563eb' : '2px solid transparent',
                  background: 'none',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  fontSize: '13px',
                  fontWeight: activeTab === 'details' ? 600 : 500,
                  color: activeTab === 'details' ? '#2563eb' : '#6b7280',
                  cursor: 'pointer'
                }}
              >
                Quote Details
              </button>
              <button 
                onClick={() => setActiveTab('invoices')}
                style={{ padding: '12px 0', border: 'none', background: 'none', fontSize: '13px', color: '#6b7280', cursor: 'pointer' }}
              >
                Invoices
              </button>
              <button 
                onClick={() => setActiveTab('activity')}
                style={{ padding: '12px 0', border: 'none', background: 'none', fontSize: '13px', color: '#6b7280', cursor: 'pointer' }}
              >
                Activity Logs
              </button>
            </div>

            {/* Preview Frame */}
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '100%', maxWidth: '850px', display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                <div style={{ display: 'flex', background: '#fff', borderRadius: '4px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                  <button style={{ padding: '4px 12px', fontSize: '11px', border: 'none', background: '#f3f4f6', borderRight: '1px solid #e5e7eb' }}>Details</button>
                  <button style={{ padding: '4px 12px', fontSize: '11px', border: 'none', background: '#fff' }}>PDF</button>
                </div>
              </div>

              {previewLoading ? (
                <div style={{ padding: '40px' }}>Loading...</div>
              ) : quotationPreview}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af' }}>
            Select a quotation to view details
          </div>
        )}
      </div>
    </div>
  );
}

