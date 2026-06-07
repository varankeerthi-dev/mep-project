import { ArrowLeft, Users, Calendar, FileText, ClipboardCheck, Search, Edit3, Trash2, AlertCircle } from 'lucide-react';

interface HelpPageProps {
  onNavigate?: (path: string) => void;
}

const steps = [
  {
    icon: Users,
    title: '1. Select a Subcontractor',
    description: 'From the Sub-Contractor sidebar menu, click on "Attendance" to open the attendance entry page. Select the subcontractor whose workers you want to mark attendance for.',
  },
  {
    icon: Calendar,
    title: '2. Pick the Date & Work Unit',
    description: 'Choose the attendance date. Select the work unit type (Project, Alteration, AMC, Work Order, or General/Non-Project) and pick the specific work unit the workers were assigned to.',
  },
  {
    icon: FileText,
    title: '3. Add Attendance Entries',
    description: 'Click the "+" button to add rows for each labour category. For each entry, select the labour category, enter the number of workers and hours worked. Modifiers like OT, Double OT, Night Shift, or Holiday can be applied per entry.',
  },
  {
    icon: ClipboardCheck,
    title: '4. Review & Save',
    description: 'The system will auto-calculate amounts based on rate cards and applied modifiers. Review all entries, add a supervisor name and remarks if needed, then click "Save Attendance".',
  },
  {
    icon: Search,
    title: '5. View & Manage Records',
    description: 'Go to the Attendance List page to view all recorded attendance. Use the filters (date range, subcontractor, status) to narrow down entries. You can edit, delete, or approve attendance records from this view.',
  },
];

const tips = [
  {
    icon: Edit3,
    title: 'Editing Entries',
    description: 'Click the edit icon on any attendance record to update worker count, hours, supervisor name, or remarks.',
  },
  {
    icon: Trash2,
    title: 'Deleting Entries',
    description: 'Use the delete icon to remove incorrect attendance entries. Deleted records cannot be recovered.',
  },
  {
    icon: AlertCircle,
    title: 'Source Tracking',
    description: 'Attendance can be entered directly or auto-created from Site Reports. The "Source" column on the list page shows whether an entry was entered manually ("Direct") or came from a site report ("Site Report").',
  },
];

const statuses = [
  { label: 'Pending', color: '#f59e0b', desc: 'Draft — not yet finalised' },
  { label: 'Approved', color: '#10b981', desc: 'Verified and approved' },
  { label: 'Rejected', color: '#ef4444', desc: 'Rejected with remarks' },
];

export default function HelpPage({ onNavigate }: HelpPageProps) {
  return (
    <div className="help-page">
      <div className="help-header">
        <button className="help-back-btn" onClick={() => onNavigate?.('/subcontractors/attendance')}>
          <ArrowLeft size={16} />
          Back to Attendance
        </button>
        <h1 className="help-title">How to Enter Subcontractor Attendance</h1>
        <p className="help-subtitle">Step-by-step guide for recording and managing manpower attendance</p>
      </div>

      <div className="help-section">
        <h2 className="help-section-title">Quick Steps</h2>
        <div className="help-steps">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="help-step-card">
                <div className="help-step-icon"><Icon size={20} /></div>
                <div>
                  <h3 className="help-step-title">{step.title}</h3>
                  <p className="help-step-desc">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="help-section">
        <h2 className="help-section-title">Pro Tips</h2>
        <div className="help-tips-grid">
          {tips.map((tip) => {
            const Icon = tip.icon;
            return (
              <div key={tip.title} className="help-tip-card">
                <div className="help-tip-icon"><Icon size={18} /></div>
                <h3 className="help-tip-title">{tip.title}</h3>
                <p className="help-tip-desc">{tip.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="help-section">
        <h2 className="help-section-title">Attendance Statuses</h2>
        <div className="help-statuses">
          {statuses.map((s) => (
            <div key={s.label} className="help-status-item">
              <span className="help-status-dot" style={{ backgroundColor: s.color }} />
              <div>
                <strong>{s.label}</strong>
                <p>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="help-section help-section-last">
        <h2 className="help-section-title">Need More Help?</h2>
        <p>
          Contact your organisation administrator or refer to the settings documentation for rate cards, labour categories, and modifier configuration.
        </p>
      </div>

      <style>{`
        .help-page {
          max-width: 800px;
          margin: 0 auto;
          padding: 40px 24px 60px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #1e293b;
        }
        .help-header { margin-bottom: 40px; }
        .help-back-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 14px; border-radius: 6px; border: 1px solid #e2e8f0;
          background: #fff; color: #475569; font-size: 13px; cursor: pointer;
          margin-bottom: 16px;
        }
        .help-back-btn:hover { background: #f8fafc; }
        .help-title { font-size: 28px; font-weight: 700; margin: 0 0 8px; color: #0f172a; }
        .help-subtitle { font-size: 15px; color: #64748b; margin: 0; }
        .help-section { margin-bottom: 40px; }
        .help-section-last { margin-bottom: 0; }
        .help-section-title {
          font-size: 18px; font-weight: 600; margin: 0 0 16px; color: #0f172a;
          padding-bottom: 8px; border-bottom: 2px solid #e2e8f0;
        }
        .help-steps { display: flex; flex-direction: column; gap: 12px; }
        .help-step-card {
          display: flex; gap: 16px; padding: 16px 20px;
          background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;
        }
        .help-step-icon {
          flex-shrink: 0; width: 40px; height: 40px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          background: #e0f2fe; color: #0284c7;
        }
        .help-step-title { font-size: 15px; font-weight: 600; margin: 0 0 4px; color: #0f172a; }
        .help-step-desc { font-size: 14px; color: #475569; margin: 0; line-height: 1.5; }
        .help-tips-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (max-width: 640px) { .help-tips-grid { grid-template-columns: 1fr; } }
        .help-tip-card {
          padding: 18px; background: #f0fdf4; border: 1px solid #dcfce7; border-radius: 10px;
        }
        .help-tip-icon {
          width: 32px; height: 32px; border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          background: #dcfce7; color: #16a34a; margin-bottom: 10px;
        }
        .help-tip-title { font-size: 14px; font-weight: 600; margin: 0 0 4px; color: #0f172a; }
        .help-tip-desc { font-size: 13px; color: #475569; margin: 0; line-height: 1.5; }
        .help-statuses { display: flex; flex-direction: column; gap: 8px; }
        .help-status-item {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;
          font-size: 14px;
        }
        .help-status-item p { margin: 2px 0 0; color: #64748b; font-size: 13px; }
        .help-status-dot {
          flex-shrink: 0; width: 10px; height: 10px; border-radius: 50%;
        }
      `}</style>
    </div>
  );
}
