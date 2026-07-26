import { Building2, Wrench, FileText, ArrowRight } from 'lucide-react';
import { colors, radii, shadows, typography } from '../../design-system';

interface ModuleCardsProps {
  onNavigate?: (path: string) => void;
}

export function ModuleCards({ onNavigate }: ModuleCardsProps) {
  return (
    <div style={{ background: 'white', borderRadius: radii.md, padding: '24px', border: `1px solid ${colors.gray[200]}`, boxShadow: shadows.card }}>
      <h2 style={{ fontSize: typography.sizes['2xl'].size, fontWeight: 700, color: colors.gray[900], margin: '0 0 8px 0' }}>MEP Project Management Suite</h2>
      <p style={{ fontSize: '14px', color: colors.gray[500], margin: '0 0 20px 0' }}>Select a module below to manage field operations, visual layouts, and administrative reviews.</p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Module 1: Site Visits */}
        <div 
          onClick={() => onNavigate?.('/site-visits')}
          style={{
            padding: '18px',
            borderRadius: radii.md,
            border: `1px solid ${colors.gray[200]}`,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            background: '#fafafa',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = colors.primary[300];
            e.currentTarget.style.background = '#f0f7ff';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = colors.gray[200];
            e.currentTarget.style.background = '#fafafa';
          }}
        >
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ background: colors.primary[100], color: colors.primary[700], padding: '10px', borderRadius: radii.DEFAULT }}>
              <Building2 size={20} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: colors.gray[900] }}>Site Visits & Field Engineering</h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: colors.gray[500] }}>
                Log check-ins, record geotags, compile checklists, and verify Joint Measurement Sheets (JMS).
              </p>
            </div>
          </div>
          <ArrowRight size={18} style={{ color: colors.gray[400] }} />
        </div>

        {/* Module 2: Project Registry */}
        <div 
          onClick={() => onNavigate?.('/projects')}
          style={{
            padding: '18px',
            borderRadius: radii.md,
            border: `1px solid ${colors.gray[200]}`,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            background: '#fafafa',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = colors.primary[300];
            e.currentTarget.style.background = '#f0f7ff';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = colors.gray[200];
            e.currentTarget.style.background = '#fafafa';
          }}
        >
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ background: '#dcfce7', color: '#15803d', padding: '10px', borderRadius: radii.DEFAULT }}>
              <Wrench size={20} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: colors.gray[900] }}>Project Drawings & Visual Snags</h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: colors.gray[500] }}>
                Overlay status pins on blueprints, audit material variances (BOQ vs Installed), and manage equipment commissionings.
              </p>
            </div>
          </div>
          <ArrowRight size={18} style={{ color: colors.gray[400] }} />
        </div>

        {/* Module 3: Approvals */}
        <div 
          onClick={() => onNavigate?.('/approvals')}
          style={{
            padding: '18px',
            borderRadius: radii.md,
            border: `1px solid ${colors.gray[200]}`,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            background: '#fafafa',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = colors.primary[300];
            e.currentTarget.style.background = '#f0f7ff';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = colors.gray[200];
            e.currentTarget.style.background = '#fafafa';
          }}
        >
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ background: '#fef3c7', color: '#b45309', padding: '10px', borderRadius: radii.DEFAULT }}>
              <FileText size={20} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: colors.gray[900] }}>Approvals & Administrative Sign-off</h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: colors.gray[500] }}>
                Review subcontractor worksheets, approve purchase orders, and audit billing documentation.
              </p>
            </div>
          </div>
          <ArrowRight size={18} style={{ color: colors.gray[400] }} />
        </div>

      </div>
    </div>
  );
}
