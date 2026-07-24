import { Building2, User, Briefcase, MapPin, ShieldCheck, FileSignature } from 'lucide-react';

interface OverviewTabProps {
  subcontractor: any;
}

export function OverviewTab({ subcontractor: sub }: OverviewTabProps) {
  if (!sub) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
      {/* Contact Card */}
      <div style={{
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        padding: '20px',
      }}>
        <h3 style={{
          marginBottom: '16px',
          fontSize: '22px',
          fontWeight: 700,
          textTransform: 'uppercase',
          color: '#059669',
          letterSpacing: '0.05em',
        }}>
          Communication
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <div style={{
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'uppercase',
              color: '#2563eb',
              opacity: 0.6,
            }}>
              Corporate Email
            </div>
            <div style={{ marginTop: '4px', fontWeight: 600, color: '#171717' }}>
              {sub.email || 'N/A'}
            </div>
          </div>
          <div>
            <div style={{
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'uppercase',
              color: '#2563eb',
              opacity: 0.6,
            }}>
              Primary Phone
            </div>
            <div style={{ marginTop: '4px', fontWeight: 600, color: '#171717' }}>
              {sub.phone || 'N/A'}
            </div>
          </div>
          <div>
            <div style={{
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'uppercase',
              color: '#2563eb',
              opacity: 0.6,
            }}>
              GST Identification
            </div>
            <div style={{ marginTop: '4px', fontWeight: 600, color: '#171717', letterSpacing: '0.05em' }}>
              {sub.gstin || 'No GST Details'}
            </div>
          </div>
        </div>
      </div>

      {/* Compliance Card */}
      <div style={{
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        padding: '20px',
      }}>
        <h3 style={{
          marginBottom: '16px',
          fontSize: '22px',
          fontWeight: 700,
          textTransform: 'uppercase',
          color: '#059669',
          letterSpacing: '0.05em',
        }}>
          Compliance Status
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderRadius: '4px',
            background: '#eff6ff',
            border: '1px solid #dbeafe',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ShieldCheck size={32} style={{ color: sub.nda_signed ? '#2563eb' : '#d1d5db' }} />
              <div>
                <div style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: '#2563eb',
                }}>
                  NDA Status
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#171717' }}>
                  {sub.nda_signed ? 'Executed' : 'Pending'}
                </div>
              </div>
            </div>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderRadius: '4px',
            background: '#eef2ff',
            border: '1px solid #e0e7ff',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <FileSignature size={32} style={{ color: sub.contract_signed ? '#4f46e5' : '#d1d5db' }} />
              <div>
                <div style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: '#4f46e5',
                }}>
                  Master Contract
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#171717' }}>
                  {sub.contract_signed ? 'Active' : 'Missing'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Address / Misc */}
      <div style={{
        background: '#fff',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        padding: '20px',
      }}>
        <h3 style={{
          marginBottom: '16px',
          fontSize: '22px',
          fontWeight: 700,
          textTransform: 'uppercase',
          color: '#059669',
          letterSpacing: '0.05em',
        }}>
          Headquarters
        </h3>
        <div style={{ fontSize: '14px', fontWeight: 500, lineHeight: '1.6', color: '#6b7280' }}>
          {sub.address || 'Direct address not specified'}
          <br />
          <span style={{ marginTop: '8px', display: 'block', fontWeight: 600, color: '#171717' }}>
            {sub.state} {sub.pincode ? `, ${sub.pincode}` : ''}
          </span>
        </div>
        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e5e5e5' }}>
          <h3 style={{
            marginBottom: '8px',
            fontSize: '22px',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: '#059669',
            letterSpacing: '0.05em',
          }}>
            Internal Remarks
          </h3>
          <div style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#4b5563',
            background: '#f9fafb',
            padding: '12px 16px',
            borderRadius: '4px',
            lineHeight: '1.6',
            fontStyle: 'italic',
            border: '1px solid #e5e7eb',
          }}>
            {sub.internal_remarks || 'No notes on this partner.'}
          </div>
        </div>
      </div>
    </div>
  );
}
