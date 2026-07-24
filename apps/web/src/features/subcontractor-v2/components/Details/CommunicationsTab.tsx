import { MessageSquare, Phone, Smartphone, Mail, Users } from 'lucide-react';

interface CommunicationsTabProps {
  communications: any[];
}

export function CommunicationsTab({ communications }: CommunicationsTabProps) {
  if (communications.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 24px', background: '#fff', borderRadius: '8px' }}>
        <MessageSquare size={48} style={{ margin: '0 auto 16px', color: '#d1d5db' }} />
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a', marginBottom: '8px' }}>No Communications</h3>
        <p style={{ fontSize: '13px', color: '#64748b' }}>No communication logs found for this subcontractor.</p>
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)', padding: '16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {communications.map((comm) => {
          const CATEGORY_MAP: Record<string, { icon: React.ElementType; bg: string; text: string }> = {
            incoming: { icon: Phone, bg: '#ecfdf5', text: '#059669' },
            outgoing: { icon: Phone, bg: '#eff6ff', text: '#2563eb' },
            Incoming: { icon: Phone, bg: '#ecfdf5', text: '#059669' },
            Outgoing: { icon: Phone, bg: '#eff6ff', text: '#2563eb' },
            whatsapp: { icon: Smartphone, bg: '#f0fdf4', text: '#16a34a' },
            email: { icon: Mail, bg: '#fef3c7', text: '#d97706' },
            meeting: { icon: Users, bg: '#f3e8ff', text: '#7c3aed' },
          };
          const cat = CATEGORY_MAP[comm.call_category] || { icon: MessageSquare, bg: '#f5f5f5', text: '#737373' };
          const CatIcon = cat.icon;
          return (
            <div key={comm.id} style={{ display: 'flex', gap: '12px', padding: '10px 12px', background: '#fafafa', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: cat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cat.text, flexShrink: 0 }}>
                <CatIcon size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#171717' }}>{comm.call_brief || 'No brief'}</span>
                  <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: (comm.status === 'Open' || comm.status === 'open') ? '#fef3c7' : (comm.status === 'Resolved' || comm.status === 'resolved') ? '#ecfdf5' : '#f3f4f6', color: (comm.status === 'Open' || comm.status === 'open') ? '#d97706' : (comm.status === 'Resolved' || comm.status === 'resolved') ? '#059669' : '#6b7280' }}>{comm.status}</span>
                </div>
                {comm.next_action && (
                  <div style={{ fontSize: '11px', color: '#737373', marginBottom: '4px' }}>Next: {comm.next_action}</div>
                )}
                <div style={{ fontSize: '11px', color: '#a3a3a3' }}>{new Date(comm.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} {new Date(comm.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default CommunicationsTab;
