import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatCurrency } from '../utils/formatters';
import { useAuth } from '../App';
import { getPrintSettings } from '../utils/printSettings';
import { timedSupabaseQuery } from '../utils/queryTimeout';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Description as DescriptionIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';

const QUOTATION_STATUSES = ['All', 'Draft', 'Sent', 'Under Negotiation', 'Approved', 'Rejected', 'Converted', 'Cancelled', 'Expired'];

const ITEM_HEIGHT = 68;
const VISIBLE     = 10;
const BUFFER      = 3; // FIX: was 5 used as %, now used as plain item count

// ─── Helpers ──────────────────────────────────────────────────────────────────

function numberToWords(num: number): string {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ',
    'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n: number): string => {
    const s = n.toString();
    if (s.length > 9) return 'overflow';
    const nArr = ('000000000' + s).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!nArr) return '';
    let str = '';
    str += +nArr[1] ? (a[+nArr[1]] || b[+nArr[1][0]] + ' ' + a[+nArr[1][1]]) + 'Crore '    : '';
    str += +nArr[2] ? (a[+nArr[2]] || b[+nArr[2][0]] + ' ' + a[+nArr[2][1]]) + 'Lakh '     : '';
    str += +nArr[3] ? (a[+nArr[3]] || b[+nArr[3][0]] + ' ' + a[+nArr[3][1]]) + 'Thousand ' : '';
    str += +nArr[4] ? (a[+nArr[4]] || b[+nArr[4][0]] + ' ' + a[+nArr[4][1]]) + 'Hundred '  : '';
    str += +nArr[5] ? ((str ? 'and ' : '') + (a[+nArr[5]] || b[+nArr[5][0]] + ' ' + a[+nArr[5][1]])) : '';
    return str.trim() + ' Only';
  };

  return inWords(Math.round(num));
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Draft:              { bg: '#f3f4f6', color: '#6b7280' },
  Sent:               { bg: '#dbeafe', color: '#1d4ed8' },
  'Under Negotiation':{ bg: '#fef3c7', color: '#b45309' },
  Approved:           { bg: '#d1fae5', color: '#047857' },
  Rejected:           { bg: '#fee2e2', color: '#dc2626' },
  Converted:          { bg: '#d1fae5', color: '#065f46' },
  Cancelled:          { bg: '#fee2e2', color: '#991b1b' },
  Expired:            { bg: '#f3f4f6', color: '#9ca3af' },
  INVOICED:           { bg: '#d1fae5', color: '#065f46' },
};

const getStatusColor = (status?: string) =>
  STATUS_COLORS[status ?? ''] ?? STATUS_COLORS['Draft'];

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuotationList() {
  const navigate        = useNavigate();
  const { organisation } = useAuth();
  const queryClient     = useQueryClient();

  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);
  const [activeTab,   setActiveTab]   = useState('details');
  const [searchTerm,  setSearchTerm]  = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [startIndex,  setStartIndex]  = useState(0);

  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const userClearedRef   = useRef(false);

  // ── Queries ─────────────────────────────────────────────────────────────────

  const quotationsQuery = useQuery({
    queryKey: ['quotations', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('quotation_header')
        .select(`*, client:clients(id, client_name, gstin, state), project:projects(id, project_name)`)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'All') query = query.eq('status', statusFilter);

      const data = await timedSupabaseQuery(query, 'Quotation list');
      const today = new Date().toISOString().split('T')[0];

      return (data || []).map((q: any) =>
        q.status === 'Draft' && q.valid_till && q.valid_till < today
          ? { ...q, status: 'Expired' }
          : q
      );
    },
    staleTime: 3 * 60 * 1000, // FIX: was missing — caused full refetch every tab switch
  });

  const printSettingsQuery = useQuery({
    queryKey: ['printSettings', 'Quotation'],
    queryFn: () => getPrintSettings('Quotation'),
    staleTime: 10 * 60 * 1000,
  });

  const quotationDetailsQuery = useQuery({
    queryKey: ['quotation', selectedQuotationId],
    queryFn: async ({ queryKey }) => {
      const [, quotationId] = queryKey;

      const cachedHeader = queryClient
        .getQueryData<any[]>(['quotations', statusFilter])
        ?.find(q => q.id === quotationId);

      if (cachedHeader?.items?.length > 0) return cachedHeader;

      const data = await timedSupabaseQuery(
        supabase
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
          .single(),
        'Quotation details',
      );
      return data;
    },
    enabled: !!selectedQuotationId,
    staleTime: 3 * 60 * 1000,
  });

  const quotations      = quotationsQuery.data || [];
  const loading         = quotationsQuery.isPending && !quotationsQuery.data;
  const previewLoading  = quotationDetailsQuery.isFetching && !quotationDetailsQuery.data;
  const selectedQuotation = quotationDetailsQuery.data || null;

  // FIX: extract primitives instead of JSON.stringify(printSettings)
  const printSettings   = printSettingsQuery.data?.style_settings;
  const printMargins    = printSettings?.margins;
  const printColors     = printSettings?.colors;

  const quotationsError = quotationsQuery.error instanceof Error ? quotationsQuery.error.message : '';
  const previewError    = quotationDetailsQuery.error instanceof Error ? quotationDetailsQuery.error.message : '';

  // ── Auto-select first quotation ─────────────────────────────────────────────
  // FIX: removed selectedQuotationId from deps — used functional setState instead
  useEffect(() => {
    if (quotations.length === 0) {
      setSelectedQuotationId(null);
      userClearedRef.current = false;
      return;
    }
    setSelectedQuotationId(prev => {
      if (!prev) {
        if (userClearedRef.current) return prev;
        return quotations[0].id;
      }
      if (!quotations.some((q: any) => q.id === prev)) return quotations[0].id;
      return prev; // no change → no re-render
    });
  }, [quotations]); // ← only quotations, not selectedQuotationId

  useEffect(() => {
    userClearedRef.current = false;
  }, [statusFilter]);

  // ── Virtual scroll ──────────────────────────────────────────────────────────

  const onSidebarScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = (e.target as HTMLDivElement).scrollTop;
    // FIX: BUFFER is now a plain item count, not a percentage
    const newStartIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER);
    setStartIndex(newStartIndex);
  };

  const filteredQuotations = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return quotations.filter((qt: any) =>
      qt.quotation_no?.toLowerCase().includes(q) ||
      qt.client?.client_name?.toLowerCase().includes(q)
    );
  }, [quotations, searchTerm]);

  const totalHeight = filteredQuotations.length * ITEM_HEIGHT;

  const virtualItems = useMemo(() => {
    // FIX: BUFFER * 2 so items don't pop in/out abruptly
    const end   = Math.min(startIndex + VISIBLE + BUFFER * 2, filteredQuotations.length);
    const slice = filteredQuotations.slice(startIndex, end);
    return slice.map((q: any, idx: number) => ({
      ...q,
      offset: (startIndex + idx) * ITEM_HEIGHT,
    }));
  }, [filteredQuotations, startIndex]);

  useEffect(() => {
    setStartIndex(0);
    sidebarScrollRef.current?.scrollTo?.({ top: 0 });
  }, [searchTerm, statusFilter]);

  // ── Quotation preview ───────────────────────────────────────────────────────
  // FIX: replaced JSON.stringify(printSettings) with primitive deps
  const quotationPreview = useMemo(() => {
    if (!selectedQuotation) return null;

    const margins = printMargins  || { top: 15, right: 15, bottom: 15, left: 15 };
    const colors  = printColors   || { text: '#1f2937' };
    const stampStatus = selectedQuotation.status === 'Converted' ? 'INVOICED' : selectedQuotation.status;

    return (
      <div
        className="pdf-container shadow-lg"
        style={{
          width: '210mm',
          minHeight: '297mm',
          background: '#fff',
          padding: `${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm`,
          position: 'relative',
          border: '1px solid #000',
          margin: '0 auto',
          fontFamily: "'Inter', sans-serif",
          color: colors.text,
        }}
      >
        {/* Inner border */}
        <div style={{
          position: 'absolute', top: '1mm', left: '1mm', right: '1mm', bottom: '1mm',
          border: '0.2mm solid #000', pointerEvents: 'none',
        }} />

        {/* Watermark */}
        <div style={{
          position: 'absolute', top: '60mm', left: '20mm',
          transform: 'rotate(-45deg)',
          border: `3px solid ${getStatusColor(stampStatus).color}`,
          color: getStatusColor(stampStatus).color,
          padding: '8px 20px', fontSize: '24px', fontWeight: 900,
          borderRadius: '8px', opacity: 0.15, zIndex: 10,
        }}>
          {stampStatus.toUpperCase()}
        </div>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #3b82f6', paddingBottom: '20px', marginBottom: '20px' }}>
          <div style={{ width: '65%' }}>
            {organisation?.logo_url && (
              <img src={organisation.logo_url} alt="Logo" width={150} height={50} fetchPriority="high" style={{ height: '50px', marginBottom: '12px', objectFit: 'contain' }} />
            )}
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase' }}>
              {organisation?.name || 'ARUN PIPES & FITTINGS'}
            </h1>
            <p style={{ fontSize: '11px', color: '#4b5563', margin: '4px 0', whiteSpace: 'pre-line', lineHeight: '1.4' }}>
              {organisation?.address || '69, Babu Naidu garden, Perumalagaram, Thiruverkadu, Chennai, Tamil Nadu-600077, India'}
            </p>
            <p style={{ fontSize: '12px', fontWeight: 700, marginTop: '8px', textTransform: 'uppercase' }}>
              GSTIN: {organisation?.gstin || '33AGZPA3632P1ZY'}
            </p>
          </div>
          <div style={{ textAlign: 'right', width: '35%' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 900, color: '#d1d5db', margin: '0 0 15px 0', textTransform: 'uppercase', letterSpacing: '-0.05em' }}>
              Quotation
            </h2>
            <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <p><span style={{ fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', fontSize: '10px' }}>Quote No:</span> <span style={{ fontWeight: 700 }}>{selectedQuotation.quotation_no}</span></p>
              <p><span style={{ fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', fontSize: '10px' }}>Quote Date:</span> <span style={{ fontWeight: 700 }}>{formatDate(selectedQuotation.date)}</span></p>
              {selectedQuotation.valid_till && (
                <p><span style={{ fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', fontSize: '10px' }}>Valid Till:</span> <span style={{ fontWeight: 700 }}>{formatDate(selectedQuotation.valid_till)}</span></p>
              )}
            </div>
          </div>
        </div>

        {/* Remarks */}
        {selectedQuotation.remarks && (
          <div style={{ marginBottom: '20px', padding: '10px 15px', background: '#f9fafb', borderLeft: '4px solid #3b82f6', fontSize: '12px' }}>
            <span style={{ fontWeight: 700, fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Remarks / Reference:</span>
            {selectedQuotation.remarks}
          </div>
        )}

        {/* Bill To / Ship To */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
          {[
            { title: 'Bill To (Buyer)',   address: selectedQuotation.billing_address,  extra: `GSTIN: ${selectedQuotation.gstin || '-'}` },
            { title: 'Ship To (Receiver)', address: selectedQuotation.billing_address, extra: `Contact: ${selectedQuotation.client?.contact || '-'}` },
          ].map(({ title, address, extra }) => (
            <div key={title} style={{ padding: '12px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '10px', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>{title}</h3>
              <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
                <p style={{ fontWeight: 800, fontSize: '14px', marginBottom: '4px' }}>{selectedQuotation.client?.client_name}</p>
                <p style={{ color: '#4b5563', whiteSpace: 'pre-line' }}>{address}</p>
                <p style={{ fontWeight: 700, marginTop: '8px' }}>{extra}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Items table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '25px' }}>
          <thead>
            <tr style={{ background: '#3b82f6', color: '#fff' }}>
              {['S.No', 'Item & Description', 'HSN', 'Qty', 'Rate/Unit', 'GST%', 'Amount'].map(h => (
                <th key={h} style={{ padding: '10px 8px', fontSize: '11px', border: '1px solid #3b82f6', textAlign: h === 'Item & Description' ? 'left' : h === 'Amount' || h === 'Rate/Unit' ? 'right' : 'center' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {selectedQuotation.items?.map((item: any, idx: number) => (
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
                <td style={{ padding: '8px', textAlign: 'right', fontSize: '11px', border: '1px solid #e5e7eb' }}>₹{(item.rate || 0).toFixed(2)}</td>
                <td style={{ padding: '8px', textAlign: 'center', fontSize: '11px', border: '1px solid #e5e7eb' }}>{item.tax_percent}%</td>
                <td style={{ padding: '8px', textAlign: 'right', fontSize: '12px', fontWeight: 700, border: '1px solid #e5e7eb' }}>₹{(item.line_total || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals + Bank */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ width: '55%' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px' }}>Amount in Words:</p>
            <p style={{ fontSize: '12px', fontWeight: 600, fontStyle: 'italic', textDecoration: 'underline', textDecorationColor: 'rgba(59,130,246,0.3)' }}>
              {numberToWords(selectedQuotation.grand_total)} Only
            </p>
            <div style={{ marginTop: '30px', padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px dashed #d1d5db' }}>
              <h4 style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#3b82f6', marginBottom: '8px' }}>Bank Account Details</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '4px', fontSize: '11px' }}>
                <span style={{ color: '#6b7280', textTransform: 'uppercase' }}>Bank:</span>    <span style={{ fontWeight: 700 }}>{organisation?.bank_name || '-'}</span>
                <span style={{ color: '#6b7280', textTransform: 'uppercase' }}>A/c No:</span>  <span style={{ fontWeight: 700, fontSize: '12px' }}>{organisation?.bank_account_no || '-'}</span>
                <span style={{ color: '#6b7280', textTransform: 'uppercase' }}>IFSC:</span>    <span style={{ fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase' }}>{organisation?.bank_ifsc || '-'}</span>
                <span style={{ color: '#6b7280', textTransform: 'uppercase' }}>Branch:</span>  <span>{organisation?.bank_branch || '-'}</span>
              </div>
            </div>
          </div>

          <div style={{ width: '40%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280' }}>Basic Amount:</span>
                <span style={{ fontWeight: 600 }}>₹{(selectedQuotation.subtotal || 0).toFixed(2)}</span>
              </div>
              {selectedQuotation.total_item_discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280' }}>
                  <span>Total Discount:</span>
                  <span>- ₹{(selectedQuotation.total_item_discount || 0).toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280' }}>
                <span style={{ textTransform: 'uppercase' }}>Total Tax (GST):</span>
                <span>₹{(selectedQuotation.total_tax || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280' }}>
                <span>Round off:</span>
                <span>₹{(selectedQuotation.round_off || 0).toFixed(2)}</span>
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                paddingTop: '10px', marginTop: '5px',
                borderTop: '2px solid #3b82f6',
                fontSize: '18px', fontWeight: 800, color: '#3b82f6',
              }}>
                <span>Net Value:</span>
                <span>{formatCurrency(selectedQuotation.grand_total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '60px' }}>
          <div style={{ fontSize: '10px', color: '#9ca3af' }}>
            <p>This is a computer generated quotation.</p>
          </div>
          <div style={{ width: '240px', textAlign: 'center' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '50px', color: '#4b5563' }}>
              For {organisation?.name || 'ARUN PIPES & FITTINGS'}
            </p>
            <div style={{ borderTop: '1px solid #9ca3af', paddingTop: '8px' }}>
              <p style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>Authorized Signatory</p>
            </div>
          </div>
        </div>
      </div>
    );
  // FIX: primitive deps instead of JSON.stringify(printSettings)
  }, [selectedQuotation?.id, printMargins, printColors, organisation?.id]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', margin: '-24px', background: '#fff' }}>

      {/* ── Left Sidebar ── */}
      <div style={{ width: '350px', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
        {/* Material-UI Header */}
        <Paper elevation={0} sx={{ p: 2, borderRadius: 0, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DescriptionIcon color="primary" sx={{ fontSize: 20 }} />
              <Typography variant="h6" fontFamily="Inter" fontWeight={600} fontSize="14px">
                Quotations
              </Typography>
              <Chip
                label={filteredQuotations.length}
                size="small"
                sx={{ fontSize: '11px', height: '20px', bgcolor: 'grey.100' }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="More options">
                <IconButton size="small" sx={{ color: 'text.secondary' }}>
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => navigate('/quotation/create')}
                sx={{ fontSize: '12px', textTransform: 'none' }}
              >
                Create Quotation
              </Button>
            </Box>
          </Box>

          {/* Status Filter Buttons */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            {QUOTATION_STATUSES.slice(0, 6).map((status) => (
              <Button
                key={status}
                size="small"
                variant={statusFilter === status ? 'contained' : 'text'}
                onClick={() => setStatusFilter(status)}
                sx={{
                  fontSize: '11px',
                  textTransform: 'none',
                  minWidth: 'auto',
                  px: 1.5,
                  py: 0.5,
                  bgcolor: statusFilter === status ? 'primary.main' : 'transparent',
                  color: statusFilter === status ? 'primary.contrastText' : 'text.secondary',
                  '&:hover': {
                    bgcolor: statusFilter === status ? 'primary.dark' : 'action.hover',
                  },
                }}
              >
                {status}
              </Button>
            ))}
          </Box>

          {/* Search Field */}
          <TextField
            fullWidth
            size="small"
            placeholder="Search by quote number or client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{
              '& .MuiInputBase-input': { fontSize: '12px' },
            }}
          />
        </Paper>

        <div style={{ flex: 1, overflowY: 'auto' }} ref={sidebarScrollRef} onScroll={onSidebarScroll}>
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>
          ) : quotationsQuery.isError ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#b91c1c' }}>
              <div style={{ marginBottom: '12px' }}>{quotationsError || 'Unable to load quotations.'}</div>
              <button type="button" className="btn btn-primary" onClick={() => quotationsQuery.refetch()}>Retry</button>
            </div>
          ) : filteredQuotations.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>No quotations found.</div>
          ) : (
            <div style={{ height: totalHeight, position: 'relative' }}>
              {virtualItems.map((q: any) => (
                <div
                  key={q.id}
                  onClick={() => setSelectedQuotationId(q.id)}
                  style={{
                    position: 'absolute',
                    top: q.offset,
                    left: 0, right: 0,
                    height: ITEM_HEIGHT,
                    padding: '12px 16px',
                    cursor: 'pointer',
                    background: selectedQuotationId === q.id ? '#f0f7ff' : '#fff',
                    borderLeft: selectedQuotationId === q.id ? '3px solid #2563eb' : '3px solid transparent',
                    borderBottom: '1px solid #f3f4f6',
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: '#111827', fontSize: '13px' }}>{q.client?.client_name}</span>
                    <span style={{ fontWeight: 600, color: '#111827', fontSize: '13px' }}>{formatCurrency(q.grand_total)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: '#6b7280', fontSize: '11px' }}>{q.quotation_no} • {formatDate(q.date)}</div>
                    <span style={{
                      fontSize: '9px', fontWeight: 700,
                      color: getStatusColor(q.status === 'Converted' ? 'INVOICED' : q.status).color,
                      textTransform: 'uppercase',
                    }}>
                      {q.status === 'Converted' ? 'INVOICED' : q.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right Preview ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f9fafb' }}>
        {selectedQuotation ? (
          <>
            {/* Toolbar */}
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
                  >×</button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', marginTop: '12px', alignItems: 'center' }}>
                {[
                  { icon: '✎', label: 'Edit',        onClick: () => navigate(`/quotation/edit?id=${selectedQuotation.id}`) },
                  { icon: '📋', label: 'Duplicate',   onClick: () => navigate(`/quotation/create?duplicateId=${selectedQuotation.id}`) },
                ].map(({ icon, label, onClick }) => (
                  <button key={label} onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563' }}>
                    {icon} {label}
                  </button>
                ))}
                {['✉ Mails ▼', '🔗 Share', '🖨 PDF/Print ▼', '🔄 Convert to Invoice'].map(label => (
                  <button key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563' }}>{label}</button>
                ))}
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4b5563' }}>...</button>
              </div>
            </div>

            {/* Approval bar */}
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
              {[
                { key: 'details',  label: 'Quote Details' },
                { key: 'invoices', label: 'Invoices' },
                { key: 'activity', label: 'Activity Logs' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  style={{
                    padding: '12px 0',
                    borderBottom: activeTab === key ? '2px solid #2563eb' : '2px solid transparent',
                    background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                    fontSize: '13px',
                    fontWeight: activeTab === key ? 600 : 500,
                    color: activeTab === key ? '#2563eb' : '#6b7280',
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Preview frame */}
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '100%', maxWidth: '850px', display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                <div style={{ display: 'flex', background: '#fff', borderRadius: '4px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                  <button style={{ padding: '4px 12px', fontSize: '11px', border: 'none', background: '#f3f4f6', borderRight: '1px solid #e5e7eb' }}>Details</button>
                  <button style={{ padding: '4px 12px', fontSize: '11px', border: 'none', background: '#fff' }}>PDF</button>
                </div>
              </div>

              {previewLoading ? (
                <div style={{ padding: '40px' }}>Loading...</div>
              ) : quotationDetailsQuery.isError ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#b91c1c' }}>
                  <div style={{ marginBottom: '12px' }}>{previewError || 'Unable to load quotation details.'}</div>
                  <button type="button" className="btn btn-primary" onClick={() => quotationDetailsQuery.refetch()}>Retry</button>
                </div>
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
