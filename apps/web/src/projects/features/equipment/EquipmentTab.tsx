import React from 'react';
import { Plus, Folder, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EquipmentTabProps {
  selectedProject: any;
  projectEquipment: any[];
  projectTcProtocols: any[];
  equipmentStats: any;
  setIsEqModalOpen: (open: boolean) => void;
  setSelectedTcCert: (cert: any) => void;
  fmtD: (val: any) => string;
}

export function EquipmentTab({
  selectedProject,
  projectEquipment,
  projectTcProtocols,
  equipmentStats,
  setIsEqModalOpen,
  setSelectedTcCert,
  fmtD,
}: EquipmentTabProps) {
  return (
    <div className="pl-card" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h3 style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>Equipment & Warranty Register</h3>
        <Button variant="default" size="default" onClick={() => setIsEqModalOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem' }}
        >
          <Plus size={14} /> Add Equipment
        </Button>
      </div>

      {/* Alerts Rollup Box */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '1rem', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Warranty</span>
          <span style={{ fontSize: '1.75rem', fontWeight: 700, color: '#065f46', marginTop: '0.25rem' }}>{equipmentStats.active}</span>
        </div>
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '1rem', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Expiring in 30 Days</span>
          <span style={{ fontSize: '1.75rem', fontWeight: 700, color: '#92400e', marginTop: '0.25rem' }}>{equipmentStats.expiring30}</span>
        </div>
        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', padding: '1rem', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Expiring in 90 Days</span>
          <span style={{ fontSize: '1.75rem', fontWeight: 700, color: '#b45309', marginTop: '0.25rem' }}>{equipmentStats.expiring90}</span>
        </div>
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', padding: '1rem', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Expired</span>
          <span style={{ fontSize: '1.75rem', fontWeight: 700, color: '#991b1b', marginTop: '0.25rem' }}>{equipmentStats.expired}</span>
        </div>
      </div>

      {projectEquipment.length === 0 ? (
        <div className="pl-empty" style={{ padding: '2.5rem' }}>
          <Folder className="pl-empty-icon" />
          <p className="pl-empty-text">No equipment registered yet</p>
        </div>
      ) : (
        <table className="pl-table">
          <thead>
            <tr>
              <th>Equipment Name</th>
              <th>Make / Model</th>
              <th>Serial Number</th>
              <th>Supplier</th>
              <th>Quantity</th>
              <th>Warranty Start</th>
              <th>Warranty End</th>
              <th>Status</th>
              <th>T&C Protocol</th>
            </tr>
          </thead>
          <tbody>
            {projectEquipment.map((eq: any) => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const endDate = eq.warranty_end_date ? new Date(eq.warranty_end_date) : null;
              let statusText = 'No Warranty';
              let badgeBg = '#f4f4f5';
              let badgeColor = '#52525b';

              if (endDate) {
                endDate.setHours(0, 0, 0, 0);
                const isExpired = endDate < today;
                const thirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
                const ninetyDays = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
                
                if (isExpired) {
                  statusText = 'Expired';
                  badgeBg = '#fee2e2';
                  badgeColor = '#991b1b';
                } else if (endDate <= thirtyDays) {
                  statusText = 'Expiring (<30d)';
                  badgeBg = '#fef3c7';
                  badgeColor = '#92400e';
                } else if (endDate <= ninetyDays) {
                  statusText = 'Expiring (<90d)';
                  badgeBg = '#fffbeb';
                  badgeColor = '#b45309';
                } else {
                  statusText = 'Active';
                  badgeBg = '#d1fae5';
                  badgeColor = '#065f46';
                }
              }

              // Find if there is a T&C certificate for this equipment
              const tcCert = projectTcProtocols.find((tc: any) => tc.equipment_id === eq.id);

              return (
                <tr key={eq.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{eq.equipment_name}</td>
                  <td>{eq.make_model || '-'}</td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>{eq.serial_number || '-'}</td>
                  <td>{eq.supplier || '-'}</td>
                  <td>{eq.quantity}</td>
                  <td>{fmtD(eq.warranty_start_date)}</td>
                  <td>{fmtD(eq.warranty_end_date)}</td>
                  <td>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0.125rem 0.5rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      background: badgeBg,
                      color: badgeColor
                    }}>
                      {statusText}
                    </span>
                  </td>
                  <td>
                    {tcCert ? (
                      <Button variant="default" size="default" onClick={() => setSelectedTcCert(tcCert)}
                        className="pl-btn"
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.25rem 0.5rem',
                          background: '#ecfdf5',
                          color: '#065f46',
                          border: '1px solid #a7f3d0',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          cursor: 'pointer'
                        }}
                      >
                        <FileText size={12} />
                        View Certificate
                      </Button>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>Pending Commissioning</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
