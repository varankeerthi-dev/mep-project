import React, { useState, useEffect } from 'react';
import { X, Clock, User, Building2, Phone, Mail, Tag, FileText, DollarSign, Calendar, MessageSquare, MapPin, Loader } from 'lucide-react';
import type { Lead } from '../../../types/leads';
import { LeadHistoryTab } from './LeadHistoryTab';
import { supabase } from '../../../supabase';

interface LeadDetailDrawerProps {
  lead: Lead;
  onClose: () => void;
  onUpdate: () => void;
}

type DetailTab = 'details' | 'history' | 'activities';

export const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({ lead, onClose, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('details');
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ ...lead });
  const [saving, setSaving] = useState(false);
  const [showSiteVisitModal, setShowSiteVisitModal] = useState(false);
  const [linkedVisits, setLinkedVisits] = useState<any[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);

  useEffect(() => {
    if (lead?.id) {
      setLoadingVisits(true);
      supabase
        .from('site_visits')
        .select('id, visit_date, purpose, status, site_address, engineer')
        .eq('lead_id', lead.id)
        .order('visit_date', { ascending: false })
        .then(({ data }) => {
          setLinkedVisits(data || []);
          setLoadingVisits(false);
        })
        .catch(() => setLoadingVisits(false));
    }
  }, [lead?.id]);

  const getStatusColor = () => {
    if (lead.lead_status?.color) return lead.lead_status.color;
    return '#6B7280';
  };

  const getStatusName = () => {
    return lead.lead_status?.name || lead.status;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { updateLead } = await import('../../../follow-up/leads-api');
      await updateLead(lead.id, editData);
      onUpdate();
      setEditing(false);
    } catch (err) {
      console.error('Failed to update lead:', err);
    } finally {
      setSaving(false);
    }
  };

  const tabs: { key: DetailTab; label: string }[] = [
    { key: 'details', label: 'Details' },
    { key: 'history', label: 'History' },
    { key: 'activities', label: 'Activities' },
  ];

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '480px',
          background: '#fff',
          borderLeft: '1px solid #e5e7eb',
          boxShadow: '-4px 0 12px rgba(0,0,0,0.08)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#18181b', margin: 0 }}>{lead.contact_name}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <span style={{
                display: 'inline-block',
                padding: '2px 8px',
                fontSize: '11px',
                fontWeight: 500,
                borderRadius: '4px',
                color: '#fff',
                background: getStatusColor(),
              }}>
                {getStatusName()}
              </span>
              {lead.estimated_value > 0 && (
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#059669' }}>
                  ₹{(lead.estimated_value / 100000).toFixed(1)}L
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ padding: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '0 16px' }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 12px',
                fontSize: '12px',
                fontWeight: activeTab === tab.key ? 600 : 500,
                color: activeTab === tab.key ? '#185FA5' : '#6B7280',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid #185FA5' : '2px solid transparent',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {activeTab === 'details' && (
            <>
              <DetailsTab
                lead={lead}
                editing={editing}
                editData={editData}
                setEditData={setEditData}
                onToggleEdit={() => setEditing(!editing)}
                onSave={handleSave}
                saving={saving}
              />
              <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '16px', paddingTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Site Visits
                  </div>
                  <button
                    onClick={() => setShowSiteVisitModal(true)}
                    style={{
                      padding: '5px 10px',
                      fontSize: '11px',
                      fontWeight: 600,
                      border: '1px solid #185FA5',
                      borderRadius: '5px',
                      background: '#185FA5',
                      color: '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    + Schedule Visit
                  </button>
                </div>
                {loadingVisits ? (
                  <div style={{ textAlign: 'center', padding: '16px' }}>
                    <Loader size={14} className="animate-spin" />
                  </div>
                ) : linkedVisits.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', padding: '16px' }}>
                    No site visits scheduled yet
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {linkedVisits.map((v: any) => (
                      <div
                        key={v.id}
                        style={{
                          padding: '10px 12px',
                          background: '#f9fafb',
                          borderRadius: '6px',
                          border: '1px solid #e5e7eb',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#18181b' }}>
                            {v.purpose || 'Site Visit'}
                          </span>
                          <StatusBadge status={v.status} />
                        </div>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                          {v.visit_date ? new Date(v.visit_date).toLocaleDateString() : ''}
                          {v.engineer ? ` · ${v.engineer}` : ''}
                        </div>
                        {v.site_address && (
                          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MapPin size={10} />
                            {v.site_address}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
          {activeTab === 'history' && <LeadHistoryTab leadId={lead.id} />}
          {activeTab === 'activities' && (
            <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
              Follow-up activities coming soon
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.3)',
          zIndex: 49,
        }}
        onClick={onClose}
      />

      {showSiteVisitModal && (
        <ScheduleSiteVisitModal
          lead={lead}
          onClose={() => setShowSiteVisitModal(false)}
          onCreated={() => {
            setShowSiteVisitModal(false);
            onUpdate();
          }}
        />
      )}
    </>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colors: Record<string, string> = {
    Scheduled: '#3B82F6',
    Completed: '#10B981',
    'In Progress': '#F59E0B',
    Cancelled: '#EF4444',
    Postponed: '#8B5CF6',
  };
  return (
    <span
      style={{
        padding: '1px 6px',
        fontSize: '10px',
        fontWeight: 600,
        borderRadius: '3px',
        color: '#fff',
        background: colors[status] || '#6B7280',
      }}
    >
      {status}
    </span>
  );
};

const ScheduleSiteVisitModal: React.FC<{
  lead: Lead;
  onClose: () => void;
  onCreated: () => void;
}> = ({ lead, onClose, onCreated }) => {
  const [visitDate, setVisitDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [purpose, setPurpose] = useState('Initial Site Survey');
  const [siteAddress, setSiteAddress] = useState('');
  const [engineer, setEngineer] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSchedule = async () => {
    if (!visitDate) { setError('Visit date is required'); return; }
    setSaving(true);
    setError('');

    try {
      const { error: insertError } = await supabase.from('site_visits').insert({
        visit_date: visitDate,
        purpose,
        site_address: siteAddress || null,
        engineer: engineer || lead.contact_name || null,
        lead_id: lead.id,
        status: 'Scheduled',
        organisation_id: (lead as any).organisation_id,
      });

      if (insertError) throw insertError;
      onCreated();
    } catch (err: any) {
      setError(err.message || 'Failed to schedule site visit');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: '#fff',
            borderRadius: '12px',
            width: '420px',
            maxHeight: '85vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#18181b', margin: 0 }}>Schedule Site Visit</h2>
            <button onClick={onClose} style={{ padding: '4px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280' }}>
              <X size={18} />
            </button>
          </div>

          <div style={{ padding: '20px' }}>
            {error && (
              <div style={{ fontSize: '12px', color: '#dc2626', marginBottom: '12px', padding: '8px 12px', background: '#fef2f2', borderRadius: '6px' }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: '12px', padding: '8px 12px', background: '#f0f7ff', borderRadius: '6px', fontSize: '12px', color: '#1e40af' }}>
              From lead: <strong>{lead.contact_name}</strong>
              {lead.company_name && <> · {lead.company_name}</>}
              {lead.project_name && <><br />Project: {lead.project_name}</>}
            </div>

            <FormField2 label="Visit Date *">
              <input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
            </FormField2>

            <FormField2 label="Purpose">
              <select value={purpose} onChange={e => setPurpose(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px' }}>
                <option>Initial Site Survey</option>
                <option>Measurement</option>
                <option>Installation</option>
                <option>Inspection</option>
                <option>Maintenance</option>
                <option>Consultation</option>
                <option>Complaint</option>
                <option>Other</option>
              </select>
            </FormField2>

            <FormField2 label="Assigned To">
              <input type="text" value={engineer} onChange={e => setEngineer(e.target.value)}
                placeholder={lead.contact_name || 'Engineer name'}
                style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
            </FormField2>

            <FormField2 label="Site Address">
              <textarea value={siteAddress} onChange={e => setSiteAddress(e.target.value)}
                placeholder="Full site address"
                style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px', minHeight: '50px', resize: 'vertical' }} />
            </FormField2>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid #e5e7eb', background: '#fafafa' }}>
            <button onClick={onClose}
              style={{ padding: '7px 16px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', color: '#374151', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={handleSchedule} disabled={saving}
              style={{ padding: '7px 16px', fontSize: '12px', fontWeight: 600, border: '1px solid #185FA5', borderRadius: '6px', background: '#185FA5', color: '#fff', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Scheduling...' : 'Schedule Visit'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

const FormField2: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ marginBottom: '12px' }}>
    <div style={{ fontSize: '11px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>{label}</div>
    {children}
  </div>
);

const FieldRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | React.ReactNode;
}> = ({ icon, label, value }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '12px' }}>
    <div style={{ color: '#9ca3af', marginTop: '2px' }}>{icon}</div>
    <div>
      <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '13px', color: '#18181b', marginTop: '2px' }}>{value}</div>
    </div>
  </div>
);

const DetailsTab: React.FC<{
  lead: Lead;
  editing: boolean;
  editData: Lead;
  setEditData: (d: Lead) => void;
  onToggleEdit: () => void;
  onSave: () => void;
  saving: boolean;
}> = ({ lead, editing, editData, setEditData, onToggleEdit, onSave, saving }) => {
  if (editing) {
    return (
      <div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <button onClick={onToggleEdit}
            style={{ padding: '6px 14px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', color: '#374151', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={onSave} disabled={saving}
            style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 600, border: '1px solid #185FA5', borderRadius: '6px', background: '#185FA5', color: '#fff', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <EditField label="Contact Name" value={editData.contact_name} onChange={v => setEditData({ ...editData, contact_name: v })} />
          <EditField label="Company" value={editData.company_name} onChange={v => setEditData({ ...editData, company_name: v })} />
          <EditField label="Phone" value={editData.contact_phone} onChange={v => setEditData({ ...editData, contact_phone: v })} />
          <EditField label="Email" value={editData.contact_email} onChange={v => setEditData({ ...editData, contact_email: v })} />
          <EditField label="Project" value={editData.project_name} onChange={v => setEditData({ ...editData, project_name: v })} />
          <EditField label="Referred By" value={editData.referred_by} onChange={v => setEditData({ ...editData, referred_by: v })} />
          <EditField label="City" value={editData.city} onChange={v => setEditData({ ...editData, city: v })} />
          <EditField label="State" value={editData.state} onChange={v => setEditData({ ...editData, state: v })} />
          <EditField label="PIN" value={editData.pin} onChange={v => setEditData({ ...editData, pin: v })} />
          <EditField label="Estimated Value" value={String(editData.estimated_value)} onChange={v => setEditData({ ...editData, estimated_value: Number(v) || 0 })} />
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Remarks</div>
            <textarea value={editData.remarks} onChange={e => setEditData({ ...editData, remarks: e.target.value })}
              style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px', minHeight: '80px', resize: 'vertical' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button onClick={onToggleEdit}
        style={{ padding: '6px 14px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', color: '#374151', cursor: 'pointer', marginBottom: '16px', float: 'right' }}>
        Edit
      </button>
      <FieldRow icon={<User size={14} />} label="Company" value={lead.company_name || '-'} />
      <FieldRow icon={<Phone size={14} />} label="Phone" value={lead.contact_phone || '-'} />
      <FieldRow icon={<Mail size={14} />} label="Email" value={lead.contact_email || '-'} />
      <FieldRow icon={<Tag size={14} />} label="Source" value={lead.source} />
      <FieldRow icon={<Building2 size={14} />} label="Industry" value={lead.industry?.name || '-'} />
      <FieldRow icon={<MessageSquare size={14} />} label="Referred By" value={lead.referred_by || '-'} />
      <FieldRow icon={<FileText size={14} />} label="Project" value={lead.project_name || '-'} />
      <FieldRow icon={<DollarSign size={14} />} label="Estimated Value" value={lead.estimated_value ? `₹${(lead.estimated_value / 100000).toFixed(1)}L` : '-'} />
      <FieldRow icon={<Calendar size={14} />} label="Expected Close" value={lead.expected_close_date ? new Date(lead.expected_close_date).toLocaleDateString() : '-'} />
      <FieldRow icon={<User size={14} />} label="Owner" value={lead.owner_name || 'Unassigned'} />
      <FieldRow icon={<MapPin size={14} />} label="Address" value={[lead.city, lead.state, lead.pin].filter(Boolean).join(', ') || '-'} />
      <FieldRow icon={<Calendar size={14} />} label="Created" value={new Date(lead.created_at).toLocaleDateString()} />
      {lead.remarks && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Remarks</div>
          <div style={{ fontSize: '13px', color: '#374151', background: '#f9fafb', padding: '8px 12px', borderRadius: '6px' }}>{lead.remarks}</div>
        </div>
      )}
    </div>
  );
};

const EditField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, value, onChange }) => (
  <div>
    <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{label}</div>
    <input type="text" value={value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px', outline: 'none' }} />
  </div>
);
