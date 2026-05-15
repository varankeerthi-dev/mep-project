import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { 
  Settings as SettingsIcon, User, FileText, Save, Plus, Trash2, Hash, 
  FileCode, Receipt, Truck, LogOut as LogOutIcon, Users, CreditCard 
} from 'lucide-react';
import PricingPage from './PricingPage';
import { AddTeamMemberModal } from '../components/AddTeamMemberModal';
import TemplateSettings from './TemplateSettings';
import PrintSettings from './PrintSettings';
import PrintTemplateBuilder from './PrintTemplateBuilder';

export default function SettingsPage() {
  const { user, organisation, handleLogout } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  
  const [docSettings, setDocSettings] = useState({
    vendor_prefix: 'VEN', vendor_start_number: 1, vendor_suffix: '', vendor_padding: 3,
    po_prefix: 'PO', po_start_number: 1, po_suffix: '', po_padding: 4,
    dc_prefix: 'DC', dc_start_number: 1, dc_suffix: '', dc_padding: 4,
    invoice_prefix: 'INV', invoice_start_number: 1, invoice_suffix: '', invoice_padding: 4,
    quotation_prefix: 'QT', quotation_start_number: 1, quotation_suffix: '', quotation_padding: 4,
    nb_dc_prefix: 'NBDC', nb_dc_start_number: 1, nb_dc_suffix: '', nb_dc_padding: 4,
    receipt_prefix: 'REC', receipt_start_number: 1, receipt_suffix: '', receipt_padding: 4,
  });

  const [generalSettings, setGeneralSettings] = useState({
    round_off_enabled: true,
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadUsers();
    if (organisation?.id) {
      loadDocSettings();
      loadGeneralSettings();
    }
  }, [organisation?.id]);

  const loadUsers = async () => {
    if (!organisation?.id) return;
    const { data } = await supabase.from('users').select('*').eq('organisation_id', organisation.id).order('created_at', { ascending: false });
    setUsers(data || []);
  };

  const loadDocSettings = async () => {
    const { data } = await supabase.from('document_settings').select('*').eq('organisation_id', organisation.id).single();
    if (data) {
      setDocSettings({
        vendor_prefix: data.vendor_prefix || 'VEN', vendor_start_number: data.vendor_start_number || 1, vendor_suffix: data.vendor_suffix || '', vendor_padding: data.vendor_padding || 3,
        po_prefix: data.po_prefix || 'PO', po_start_number: data.po_start_number || 1, po_suffix: data.po_suffix || '', po_padding: data.po_padding || 4,
        dc_prefix: data.dc_prefix || 'DC', dc_start_number: data.dc_start_number || 1, dc_suffix: data.dc_suffix || '', dc_padding: data.dc_padding || 4,
        invoice_prefix: data.invoice_prefix || 'INV', invoice_start_number: data.invoice_start_number || 1, invoice_suffix: data.invoice_suffix || '', invoice_padding: data.invoice_padding || 4,
        quotation_prefix: data.quotation_prefix || 'QT', quotation_start_number: data.quotation_start_number || 1, quotation_suffix: data.quotation_suffix || '', quotation_padding: data.quotation_padding || 4,
        nb_dc_prefix: data.nb_dc_prefix || 'NBDC', nb_dc_start_number: data.nb_dc_start_number || 1, nb_dc_suffix: data.nb_dc_suffix || '', nb_dc_padding: data.nb_dc_padding || 4,
        receipt_prefix: data.receipt_prefix || 'REC', receipt_start_number: data.receipt_start_number || 1, receipt_suffix: data.receipt_suffix || '', receipt_padding: data.receipt_padding || 4,
      });
    }
  };

  const loadGeneralSettings = async () => {
    const { data } = await supabase.from('organisations').select('round_off_enabled').eq('id', organisation.id).single();
    if (data) {
      setGeneralSettings({ round_off_enabled: data.round_off_enabled !== false });
    }
  };

  const deleteUser = async (id: string) => { 
    if (!organisation?.id) return;
    if (confirm('Are you sure you want to delete this user?')) { 
      await supabase.from('users').delete().eq('id', id).eq('organisation_id', organisation.id); 
      loadUsers();
    }
  };

  const saveDocSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('document_settings').upsert({
        organisation_id: organisation?.id,
        ...docSettings,
        updated_at: new Date().toISOString()
      }, { onConflict: 'organisation_id' });

      if (error) throw error;
      alert('Document settings saved successfully!');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      alert('Error saving settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const saveGeneralSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('organisations').update({
        round_off_enabled: generalSettings.round_off_enabled,
        updated_at: new Date().toISOString()
      }).eq('id', organisation?.id);

      if (error) throw error;
      alert('General settings saved successfully!');
    } catch (error: any) {
      console.error('Error saving general settings:', error);
      alert('Error saving general settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const docTypes = [
    { key: 'quotation', label: 'Quotation', icon: FileText, desc: 'Sales estimate provided to client' },
    { key: 'invoice', label: 'Invoice', icon: Receipt, desc: 'Final bill sent to client' },
    { key: 'po', label: 'Purchase Order', icon: FileCode, desc: 'Order sent to your vendors' },
    { key: 'dc', label: 'Delivery Challan', icon: Truck, desc: 'Material delivery proof' },
    { key: 'nb_dc', label: 'Non-Billable DC', icon: Truck, desc: 'Internal or replacement material' },
    { key: 'receipt', label: 'Payment Receipt', icon: Receipt, desc: 'Receipt issued for client payments' },
    { key: 'vendor', label: 'Vendor', icon: User, desc: 'Vendor ID generation' },
  ];

  const getPreview = (key: string) => {
    const prefix = docSettings[`${key}_prefix` as keyof typeof docSettings] as string;
    const start = docSettings[`${key}_start_number` as keyof typeof docSettings] as number;
    const pad = docSettings[`${key}_padding` as keyof typeof docSettings] as number;
    const suffix = docSettings[`${key}_suffix` as keyof typeof docSettings] as string;
    return `${prefix}${String(start).padStart(pad, '0')}${suffix}`;
  };

  const updateSetting = (key: string, field: string, value: any) => {
    setDocSettings(prev => ({ ...prev, [`${key}_${field}`]: value }));
  };

  const navItems = [
    { id: 'general', label: 'General & Config', icon: SettingsIcon },
    { id: 'documents', label: 'Document Numbers', icon: Hash },
    { id: 'templates', label: 'Document Templates', icon: FileText },
    { id: 'print', label: 'Print Layouts', icon: Receipt },
    { id: 'builder', label: 'Dynamic Column Builder', icon: FileCode },
    { id: 'users', label: 'Team Members', icon: Users },
    { id: 'pricing', label: 'Pricing Engine', icon: CreditCard },
  ];

  const inputStyle = {
    padding: '8px 12px',
    border: '1px solid #d4d4d4',
    borderRadius: '4px',
    fontSize: '14px',
    color: '#171717',
    outline: 'none',
    transition: 'border-color 0.2s',
    width: '100%',
    fontFamily: 'monospace'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#fafafa', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 32px', background: '#fff', borderBottom: '1px solid #e5e5e5' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0, color: '#171717' }}>Organisation Settings</h1>
          <p style={{ color: '#525252', marginTop: '4px', fontSize: '13px' }}>Manage workspace preferences and team access.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%', background: '#1a1a1a', 
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', fontWeight: 600,
          }}>
            {(user?.email || '?').charAt(0).toUpperCase()}
          </div>
          <button 
            onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: '#525252', fontSize: '13px', fontWeight: 500, cursor: 'pointer', padding: '6px 12px', borderRadius: '4px' }}
            onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <LogOutIcon size={16} /> Sign out
          </button>
        </div>
      </div>

      {/* Main Layout Area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Sidebar Nav */}
        <div style={{ width: '260px', borderRight: '1px solid #e5e5e5', background: '#fff', padding: '24px 16px', overflowY: 'auto' }}>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                  padding: '10px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer',
                  textAlign: 'left', fontSize: '14px', fontWeight: 500,
                  background: activeTab === item.id ? '#f5f5f5' : 'transparent',
                  color: activeTab === item.id ? '#171717' : '#525252',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => { if(activeTab !== item.id) e.currentTarget.style.background = '#fafafa' }}
                onMouseLeave={e => { if(activeTab !== item.id) e.currentTarget.style.background = 'transparent' }}
              >
                <item.icon size={16} color={activeTab === item.id ? '#171717' : '#737373'} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Pane */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 48px', background: '#fafafa' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            
            {activeTab === 'general' && (
              <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px' }}>
                <div style={{ padding: '24px', borderBottom: '1px solid #e5e5e5' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#171717', margin: '0 0 4px 0' }}>General Configuration</h2>
                  <p style={{ fontSize: '13px', color: '#525252', margin: 0 }}>Basic preferences and defaults for your workspace.</p>
                </div>
                <div style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px', background: '#fafafa', borderRadius: '6px', border: '1px solid #f0f0f0' }}>
                    <div>
                      <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#171717', margin: '0 0 4px 0' }}>Enable Round Off</h3>
                      <p style={{ fontSize: '13px', color: '#525252', margin: 0, maxWidth: '400px' }}>
                        When enabled, the rate after discount will be rounded to the nearest integer. Useful for simpler accounting.
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={generalSettings.round_off_enabled}
                        onChange={(e) => setGeneralSettings({ ...generalSettings, round_off_enabled: e.target.checked })}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#171717' }}
                      />
                    </div>
                  </div>
                </div>
                <div style={{ padding: '16px 24px', background: '#fafafa', borderTop: '1px solid #e5e5e5', display: 'flex', justifyContent: 'flex-end', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
                  <button 
                    onClick={saveGeneralSettings} 
                    disabled={saving}
                    style={{
                      padding: '8px 16px', background: '#171717', color: '#fff', border: 'none', borderRadius: '4px',
                      fontSize: '13px', fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1
                    }}
                  >
                    <Save size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
                    {saving ? 'Saving...' : 'Save General Config'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'documents' && (
              <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px' }}>
                <div style={{ padding: '24px', borderBottom: '1px solid #e5e5e5' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#171717', margin: '0 0 4px 0' }}>Document Numbering Series</h2>
                  <p style={{ fontSize: '13px', color: '#525252', margin: 0 }}>Structure the sequential identifiers for your records.</p>
                </div>
                
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {docTypes.map(({ key, label, icon: Icon, desc }) => (
                    <div key={key} style={{ display: 'flex', gap: '24px', paddingBottom: '20px', borderBottom: '1px solid #f0f0f0' }}>
                      <div style={{ width: '220px', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <Icon size={16} color="#171717" />
                          <span style={{ fontWeight: 600, fontSize: '14px', color: '#171717' }}>{label}</span>
                        </div>
                        <p style={{ fontSize: '12px', color: '#525252', margin: 0 }}>{desc}</p>
                      </div>
                      
                      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 80px' }}>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#737373', marginBottom: '6px' }}>PREFIX</label>
                          <input 
                            value={docSettings[`${key}_prefix` as keyof typeof docSettings] as string} 
                            onChange={(e) => updateSetting(key, 'prefix', e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                        <div style={{ flex: '0 1 100px' }}>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#737373', marginBottom: '6px' }}>START #</label>
                          <input 
                            type="number"
                            value={docSettings[`${key}_start_number` as keyof typeof docSettings] as number} 
                            onChange={(e) => updateSetting(key, 'start_number', parseInt(e.target.value) || 1)}
                            style={inputStyle}
                          />
                        </div>
                        <div style={{ flex: '0 1 80px' }}>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#737373', marginBottom: '6px' }}>PAD ZEROS</label>
                          <input 
                            type="number"
                            min={1} max={10}
                            value={docSettings[`${key}_padding` as keyof typeof docSettings] as number} 
                            onChange={(e) => updateSetting(key, 'padding', parseInt(e.target.value) || 3)}
                            style={inputStyle}
                          />
                        </div>
                        <div style={{ flex: '1 1 80px' }}>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#737373', marginBottom: '6px' }}>SUFFIX</label>
                          <input 
                            value={docSettings[`${key}_suffix` as keyof typeof docSettings] as string} 
                            onChange={(e) => updateSetting(key, 'suffix', e.target.value)}
                            placeholder="-24"
                            style={inputStyle}
                          />
                        </div>
                        <div style={{ flex: '1 1 120px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', alignSelf: 'stretch', paddingLeft: '16px', borderLeft: '1px dashed #e5e5e5' }}>
                           <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#737373', marginBottom: '6px', alignSelf: 'flex-start' }}>PREVIEW</label>
                           <div style={{ 
                              background: '#f9fafb', border: '1px solid #f0f0f0', borderRadius: '4px', 
                              padding: '8px 12px', fontSize: '14px', fontWeight: 600, color: '#171717', 
                              fontFamily: 'monospace', width: '100%', textAlign: 'center' 
                            }}>
                             {getPreview(key)}
                           </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ padding: '16px 24px', background: '#fafafa', borderTop: '1px solid #e5e5e5', display: 'flex', justifyContent: 'flex-end', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
                  <button 
                    onClick={saveDocSettings} 
                    disabled={saving}
                    style={{
                      padding: '8px 16px', background: '#171717', color: '#fff', border: 'none', borderRadius: '4px',
                      fontSize: '13px', fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1
                    }}
                  >
                    <Save size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
                    {saving ? 'Saving...' : 'Save Series Config'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px' }}>
                <div style={{ padding: '24px', borderBottom: '1px solid #e5e5e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#171717', margin: '0 0 4px 0' }}>Team Members</h2>
                    <p style={{ fontSize: '13px', color: '#525252', margin: 0 }}>Invite and manage access levels for your organisation.</p>
                  </div>
                  <button 
                    onClick={() => setShowUserModal(true)}
                    style={{
                      padding: '8px 16px', background: '#171717', color: '#fff', border: 'none', borderRadius: '4px',
                      fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <Plus size={14} /> Add Member
                  </button>
                </div>
                
                <div style={{ padding: '16px 24px' }}>
                  {users.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#737373', fontSize: '14px' }}>No additional users found.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {users.map(u => (
                        <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid #f0f0f0', borderRadius: '6px', background: '#fafafa' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '40px', height: '40px', background: '#e5e5e5', color: '#171717', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 600 }}>
                              {u.emp_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: 600, color: '#171717' }}>{u.emp_name}</div>
                              <div style={{ fontSize: '13px', color: '#525252' }}>{u.email} <span style={{ color: '#d4d4d4', margin: '0 4px' }}>•</span> {u.emp_id}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 500, background: '#fff', border: '1px solid #d4d4d4', padding: '4px 10px', borderRadius: '12px', color: '#171717' }}>
                              {u.role}
                            </span>
                            <button 
                              onClick={() => deleteUser(u.id)}
                              style={{ background: 'transparent', border: 'none', padding: '6px', cursor: 'pointer', color: '#ef4444', borderRadius: '4px' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              title="Remove member"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'templates' && (
              <div style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden', height: 'calc(100vh - 160px)' }}>
                 <TemplateSettings />
              </div>
            )}

            {activeTab === 'print' && (
              <div style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden', height: 'calc(100vh - 160px)' }}>
                 <PrintSettings />
              </div>
            )}

            {activeTab === 'builder' && (
              <div style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden', height: 'calc(100vh - 160px)' }}>
                 <PrintTemplateBuilder />
              </div>
            )}

            {activeTab === 'pricing' && (
              <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px', overflow: 'hidden' }}>
                 {/* Utilizing the existing component directly inside the pane */}
                 <PricingPage />
              </div>
            )}

          </div>
        </div>
      </div>

      <AddTeamMemberModal 
        isOpen={showUserModal} 
        onClose={() => setShowUserModal(false)}
        organisationId={organisation?.id || ''}
        onSuccess={loadUsers}
      />
    </div>
  );
}