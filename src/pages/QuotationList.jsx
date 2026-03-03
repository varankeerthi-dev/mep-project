import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatCurrency } from '../utils/formatters';
import { useAuth } from '../App';

const QUOTATION_STATUSES = ['All', 'Draft', 'Sent', 'Under Negotiation', 'Approved', 'Rejected', 'Converted', 'Cancelled', 'Expired'];

export default function QuotationList() {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [openMenu, setOpenMenu] = useState(false);

  useEffect(() => {
    loadQuotations();
  }, [statusFilter]);

  const loadQuotations = async () => {
    setLoading(true);
    try {
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
      const updatedData = (data || []).map((q) => {
        if (q.status === 'Draft' && q.valid_till && q.valid_till < today) {
          return { ...q, status: 'Expired' };
        }
        return q;
      });

      setQuotations(updatedData);
      if (updatedData.length > 0 && !selectedQuotation) {
        handleSelectQuotation(updatedData[0]);
      }
    } catch (err) {
      console.error('Error loading quotations:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadQuotationDetails = async (quotationId) => {
    setPreviewLoading(true);
    try {
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
      setSelectedQuotation(data);
    } catch (err) {
      console.error('Error loading quotation details:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSelectQuotation = (quotation) => {
    loadQuotationDetails(quotation.id);
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

  const filteredQuotations = quotations.filter(q => 
    q.quotation_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.client?.client_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>
          ) : filteredQuotations.map(q => (
            <div 
              key={q.id}
              onClick={() => handleSelectQuotation(q)}
              style={{ 
                padding: '12px 16px', 
                borderBottom: '1px solid #f3f4f6', 
                cursor: 'pointer',
                background: selectedQuotation?.id === q.id ? '#f0f7ff' : '#fff',
                borderLeft: selectedQuotation?.id === q.id ? '3px solid #2563eb' : '3px solid transparent'
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
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setSelectedQuotation(null)}>×</button>
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
              ) : (
                <div className="pdf-container" style={{ 
                  width: '100%', 
                  maxWidth: '800px', 
                  background: '#fff', 
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  minHeight: '1000px',
                  padding: '40px',
                  position: 'relative',
                  border: '1px solid #e5e7eb'
                }}>
                  {/* Watermark/Status Stamp */}
                  <div style={{ 
                    position: 'absolute', 
                    top: '40px', 
                    left: '20px', 
                    transform: 'rotate(-45deg)',
                    border: `2px solid ${getStatusColor(selectedQuotation.status === 'Converted' ? 'INVOICED' : selectedQuotation.status).color}`,
                    color: getStatusColor(selectedQuotation.status === 'Converted' ? 'INVOICED' : selectedQuotation.status).color,
                    padding: '4px 12px',
                    fontSize: '14px',
                    fontWeight: 800,
                    borderRadius: '4px',
                    opacity: 0.8
                  }}>
                    {selectedQuotation.status === 'Converted' ? 'INVOICED' : selectedQuotation.status.toUpperCase()}
                  </div>

                  {/* PDF Content Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #3b82f6', paddingBottom: '20px', marginBottom: '20px' }}>
                    <div style={{ width: '60%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <div style={{ width: '40px', height: '40px', background: '#3b82f6', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800 }}>A</div>
                        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#1e3a8a' }}>{organisation?.name || 'ARUN PIPES & FITTINGS'}</h1>
                      </div>
                      <p style={{ fontSize: '10px', color: '#4b5563', margin: '0 0 4px 0', whiteSpace: 'pre-line' }}>{organisation?.address || '69, Babu Naidu garden, Perumalagaram, Thiruverkadu, Chennai, Tamil Nadu-600077, India'}</p>
                      <p style={{ fontSize: '10px', fontWeight: 700 }}>GSTIN: {organisation?.gstin || '33AGZPA3632P1ZY'}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#9ca3af', margin: 0 }}>Quotation</h2>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #e5e7eb', marginBottom: '20px' }}>
                    <div style={{ padding: '8px', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', fontSize: '11px' }}>
                      <strong>Quote No:</strong> {selectedQuotation.quotation_no}
                    </div>
                    <div style={{ padding: '8px', borderBottom: '1px solid #e5e7eb', fontSize: '11px' }}>
                      <strong>Quote Date:</strong> {formatDate(selectedQuotation.date)}
                    </div>
                    <div style={{ padding: '8px', borderRight: '1px solid #e5e7eb', fontSize: '11px' }}>
                      <div style={{ fontWeight: 700, borderBottom: '1px solid #eee', marginBottom: '4px', paddingBottom: '2px' }}>Bill To</div>
                      <div style={{ color: '#2563eb', fontWeight: 700 }}>{selectedQuotation.client?.client_name}</div>
                      <div style={{ color: '#4b5563', marginTop: '4px' }}>{selectedQuotation.billing_address}</div>
                      <div style={{ marginTop: '4px' }}>GSTIN: {selectedQuotation.gstin}</div>
                    </div>
                    <div style={{ padding: '8px', fontSize: '11px' }}>
                      <div style={{ fontWeight: 700, borderBottom: '1px solid #eee', marginBottom: '4px', paddingBottom: '2px' }}>Ship To</div>
                      <div style={{ fontWeight: 700 }}>{selectedQuotation.client?.client_name}</div>
                      <div style={{ color: '#4b5563', marginTop: '4px' }}>{selectedQuotation.billing_address}</div>
                      <div style={{ marginTop: '4px' }}>GSTIN: {selectedQuotation.gstin}</div>
                    </div>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ padding: '8px', textAlign: 'left', width: '40px' }}>S.No</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Item & Description</th>
                        <th style={{ padding: '8px', textAlign: 'left', width: '60px' }}>HSN</th>
                        <th style={{ padding: '8px', textAlign: 'right', width: '60px' }}>Qty</th>
                        <th style={{ padding: '8px', textAlign: 'right', width: '80px' }}>Rate</th>
                        <th style={{ padding: '8px', textAlign: 'right', width: '100px' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedQuotation.items?.map((item, idx) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '8px' }}>{idx + 1}</td>
                          <td style={{ padding: '8px' }}>
                            <div style={{ fontWeight: 600 }}>{item.description}</div>
                          </td>
                          <td style={{ padding: '8px' }}>{item.hsn_code || '3917'}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>{item.qty}<br/><span style={{ fontSize: '8px', color: '#6b7280' }}>{item.uom}</span></td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>{item.rate.toFixed(2)}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>{item.line_total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                    <div style={{ width: '250px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '11px' }}>
                        <span>Sub Total</span>
                        <span>{selectedQuotation.subtotal.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '11px', color: '#6b7280' }}>
                        <span>Total Item Discount</span>
                        <span>- {selectedQuotation.total_item_discount.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '11px' }}>
                        <span>Tax</span>
                        <span>{selectedQuotation.total_tax.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #e5e7eb', fontSize: '13px', fontWeight: 700 }}>
                        <span>Total</span>
                        <span>{formatCurrency(selectedQuotation.grand_total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
