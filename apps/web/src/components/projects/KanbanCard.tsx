export function KanbanCard({ insight, onMove, teamMembers, onEdit, userRole }: { insight: any; onMove: (status: string) => void; teamMembers: any[]; onEdit: () => void; userRole: string }) {
  const assigneeName = teamMembers.find(m => m.user_id === insight.assigned_to)?.full_name || 'Unassigned';
  const isPrivileged = userRole === 'Project Manager' || userRole === 'Admin';

  return (
    <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.625rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{insight.category === 'Improvement Opportunity' ? 'Opportunity' : insight.category === 'Cost Saving Idea' ? 'Cost Saving' : insight.category}</span>
        {insight.is_repeat_issue && (
          <span style={{ fontSize: '0.625rem', color: '#b91c1c', fontWeight: 600 }}>Repeat ({insight.repeat_issue_count}x)</span>
        )}
      </div>
      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{insight.title}</span>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.375rem', borderTop: '1px dashed #f1f5f9', paddingTop: '0.25rem', fontSize: '0.6875rem', color: '#64748b' }}>
        <span>Owner: <strong>{assigneeName}</strong></span>
        {insight.target_date && (
          <span>Due: <strong>{insight.target_date}</strong></span>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.25rem', marginTop: '0.375rem' }}>
        {isPrivileged ? (
          <button
            type="button"
            onClick={onEdit}
            style={{ border: 'none', background: 'none', color: 'var(--primary-color, #2563eb)', fontSize: '0.6875rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
          >
            Edit
          </button>
        ) : <div />}
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {isPrivileged && (
            <>
              {insight.status !== 'Open' && (
                <button onClick={() => onMove('Open')} style={{ border: 'none', background: '#f1f5f9', color: '#475569', fontSize: '0.625rem', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}>To Open</button>
              )}
              {insight.status !== 'In Progress' && (
                <button onClick={() => onMove('In Progress')} style={{ border: 'none', background: '#fef3c7', color: '#92400e', fontSize: '0.625rem', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}>Start</button>
              )}
              {insight.status !== 'Closed' && (
                <button onClick={() => onMove('Closed')} style={{ border: 'none', background: '#d1fae5', color: '#065f46', fontSize: '0.625rem', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}>Resolve</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
