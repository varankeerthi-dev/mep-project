import React, { useState } from 'react';

interface EditToolTransactionModalProps {
  data: any;
  onClose: () => void;
  onSave: (updated: any) => void;
}

const STATUS_OPTIONS = ['ACTIVE', 'IN_TRANSIT', 'RETURNED', 'PARTIAL', 'COMPLETED'];

export default function EditToolTransactionModal({ data, onClose, onSave }: EditToolTransactionModalProps) {
  const [status, setStatus] = useState(data.status || 'ACTIVE');
  const [remarks, setRemarks] = useState(data.remarks || '');

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001,
    }}>
      <div style={{
        width: '480px', backgroundColor: '#fff', borderRadius: '6px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Edit Transaction</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', fontSize: '16px' }}>✕</button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#6B7280', display: 'block', marginBottom: '6px' }}>Reference ID</label>
            <input type="text" value={data.reference_id || ''} readOnly style={{ width: '100%', height: '38px', backgroundColor: '#F8F9FA', border: '1px solid #E5E7EB', borderRadius: '0px', padding: '0 12px', fontSize: '13px', fontFamily: 'monospace', color: '#9CA3AF' }} />
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#6B7280', display: 'block', marginBottom: '6px' }}>Tool</label>
            <input type="text" value={`${data.tool_name}${data.make ? ' — ' + data.make : ''}`} readOnly style={{ width: '100%', height: '38px', backgroundColor: '#F8F9FA', border: '1px solid #E5E7EB', borderRadius: '0px', padding: '0 12px', fontSize: '14px', color: '#9CA3AF' }} />
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#6B7280', display: 'block', marginBottom: '6px' }}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: '100%', height: '38px', backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '0px', padding: '0 12px', fontSize: '14px' }}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#6B7280', display: 'block', marginBottom: '6px' }}>Remarks</label>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} style={{ width: '100%', backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '0px', padding: '10px 12px', fontSize: '14px', resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ padding: '16px 20px', borderTop: '1px solid #E5E7EB', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', backgroundColor: 'transparent', border: '1px solid #E5E7EB', borderRadius: '0px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onSave({ ...data, status, remarks })} style={{ padding: '10px 20px', backgroundColor: '#DC2626', border: 'none', borderRadius: '0px', fontSize: '14px', fontWeight: 600, color: '#fff', cursor: 'pointer' }}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}