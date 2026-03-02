import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { formatDate, formatCurrency } from '../utils/formatters';

export default function PODetails() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const poId = searchParams.get('id');
  
  const [po, setPO] = useState(null);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (poId) {
      loadPO();
    }
  }, [poId]);

  const loadPO = async () => {
    setLoading(true);
    const { data: poData } = await supabase
      .from('client_purchase_orders')
      .select('*')
      .eq('id', poId)
      .single();
    
    if (poData) {
      setPO(poData);
      
      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('id', poData.client_id)
        .single();
      
      setClient(clientData);
    }
    setLoading(false);
  };

  const getStatusBadge = (status) => {
    const colors = {
      'Open': { bg: '#dbeafe', color: '#1d4ed8' },
      'Partially Billed': { bg: '#fef3c7', color: '#b45309' },
      'Closed': { bg: '#d1fae5', color: '#047857' }
    };
    const style = colors[status] || colors['Open'];
    return (
      <span style={{ 
        background: style.bg, 
        color: style.color, 
        padding: '6px 14px', 
        borderRadius: '16px',
        fontSize: '13px',
        fontWeight: 600
      }}>
        {status}
      </span>
    );
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  }

  if (!po) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>PO not found</p>
        <button className="btn btn-secondary" onClick={() => navigate('/client-po')}>
          Back to List
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <button 
            onClick={() => navigate('/client-po')} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '13px', marginBottom: '8px', padding: 0 }}
          >
            ← Back to List
          </button>
          <h1 className="page-title">PO Details: {po.po_number}</h1>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={() => navigate(`/client-po/create?id=${po.id}`)}>
            Edit PO
          </button>
        </div>
      </div>

      {/* Top Summary Card */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '20px', marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Client</div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>{client?.client_name || '-'}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>PO Number</div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>{po.po_number}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>PO Date</div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>{formatDate(po.po_date)}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Expiry Date</div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>{formatDate(po.po_expiry_date)}</div>
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '20px' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>PO Total Value</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937' }}>₹{formatCurrency(po.po_total_value)}</div>
        </div>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '20px' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Utilized Value</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#b45309' }}>₹{formatCurrency(po.po_utilized_value)}</div>
        </div>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '20px' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Available Balance</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: po.po_available_value > 0 ? '#047857' : '#dc2626' }}>
            ₹{formatCurrency(po.po_available_value)}
          </div>
          <div style={{ marginTop: '8px' }}>{getStatusBadge(po.status)}</div>
        </div>
      </div>

      {/* Additional Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Attachment & Remarks */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>Attachment</h3>
          {po.attachment_url ? (
            <a 
              href={po.attachment_url} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: '#f3f4f6', borderRadius: '8px', textDecoration: 'none', color: '#1d4ed8' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              {po.attachment_name || 'View Attachment'}
            </a>
          ) : (
            <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>No attachment</div>
          )}

          <h3 style={{ fontSize: '14px', fontWeight: 600, marginTop: '20px', marginBottom: '16px' }}>Remarks</h3>
          <div style={{ color: '#4b5563', whiteSpace: 'pre-wrap' }}>
            {po.remarks || 'No remarks'}
          </div>
        </div>

        {/* Client Details */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>Client Details</h3>
          {client ? (
            <div style={{ display: 'grid', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>Client Name</div>
                <div style={{ fontWeight: 500 }}>{client.client_name}</div>
              </div>
              {client.address1 && (
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>Address</div>
                  <div style={{ fontWeight: 500 }}>
                    {[client.address1, client.address2, client.city, client.state, client.pincode].filter(Boolean).join(', ')}
                  </div>
                </div>
              )}
              {client.gstin && (
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>GSTIN</div>
                  <div style={{ fontWeight: 500 }}>{client.gstin}</div>
                </div>
              )}
              {client.contact && (
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>Contact</div>
                  <div style={{ fontWeight: 500 }}>{client.contact}</div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>Client details not available</div>
          )}
        </div>
      </div>

      {/* Future: Linked Invoices Section */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '20px', marginTop: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>Linked Invoices</h3>
        <div style={{ color: '#9ca3af', fontStyle: 'italic', padding: '20px', textAlign: 'center', background: '#f9fafb', borderRadius: '8px' }}>
          Invoice linking will be available in a future update
        </div>
      </div>
    </div>
  );
}
