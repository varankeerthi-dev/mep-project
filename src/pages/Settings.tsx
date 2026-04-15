import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { Settings as SettingsIcon, User, FileText, LogOut, Save, Plus, Trash2, Hash, FileCode, Receipt, Truck } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

export default function SettingsPage() {
  const { user, organisation, handleLogout } = useAuth();
  const [users, setUsers] = useState([]);
  const [showUserForm, setShowUserForm] = useState(false);
  const [formData, setFormData] = useState({ emp_name: '', email: '', role: 'Assistant' });
  
  const [docSettings, setDocSettings] = useState({
    vendor_prefix: 'VEN',
    vendor_start_number: 1,
    vendor_suffix: '',
    vendor_padding: 3,
    po_prefix: 'PO',
    po_start_number: 1,
    po_suffix: '',
    po_padding: 4,
    dc_prefix: 'DC',
    dc_start_number: 1,
    dc_suffix: '',
    dc_padding: 4,
    invoice_prefix: 'INV',
    invoice_start_number: 1,
    invoice_suffix: '',
    invoice_padding: 4,
    quotation_prefix: 'QT',
    quotation_start_number: 1,
    quotation_suffix: '',
    quotation_padding: 4,
    nb_dc_prefix: 'NBDC',
    nb_dc_start_number: 1,
    nb_dc_suffix: '',
    nb_dc_padding: 4,
  });
  
  const [saving, setSaving] = useState(false);

  useEffect(() => { 
    loadUsers();
    if (organisation?.id) {
      loadDocSettings();
    }
  }, [organisation?.id]);

  const loadUsers = async () => {
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    setUsers(data || []);
  };

  const loadDocSettings = async () => {
    const { data } = await supabase.from('document_settings').select('*').eq('organisation_id', organisation.id).single();
    if (data) {
      setDocSettings({
        vendor_prefix: data.vendor_prefix || 'VEN',
        vendor_start_number: data.vendor_start_number || 1,
        vendor_suffix: data.vendor_suffix || '',
        vendor_padding: data.vendor_padding || 3,
        po_prefix: data.po_prefix || 'PO',
        po_start_number: data.po_start_number || 1,
        po_suffix: data.po_suffix || '',
        po_padding: data.po_padding || 4,
        dc_prefix: data.dc_prefix || 'DC',
        dc_start_number: data.dc_start_number || 1,
        dc_suffix: data.dc_suffix || '',
        dc_padding: data.dc_padding || 4,
        invoice_prefix: data.invoice_prefix || 'INV',
        invoice_start_number: data.invoice_start_number || 1,
        invoice_suffix: data.invoice_suffix || '',
        invoice_padding: data.invoice_padding || 4,
        quotation_prefix: data.quotation_prefix || 'QT',
        quotation_start_number: data.quotation_start_number || 1,
        quotation_suffix: data.quotation_suffix || '',
        quotation_padding: data.quotation_padding || 4,
        nb_dc_prefix: data.nb_dc_prefix || 'NBDC',
        nb_dc_start_number: data.nb_dc_start_number || 1,
        nb_dc_suffix: data.nb_dc_suffix || '',
        nb_dc_padding: data.nb_dc_padding || 4,
      });
    }
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    const empId = 'EMP-' + Date.now().toString().slice(-6);
    await supabase.from('users').insert({ ...formData, emp_id: empId });
    setShowUserForm(false);
    setFormData({ emp_name: '', email: '', role: 'Assistant' });
    loadUsers();
  };

  const deleteUser = async (id) => { 
    if (confirm('Delete this user?')) { 
      await supabase.from('users').delete().eq('id', id); 
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
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error saving settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const docTypes = [
    { key: 'vendor', label: 'Vendor', icon: User },
    { key: 'po', label: 'Purchase Order', icon: FileCode },
    { key: 'dc', label: 'Delivery Challan', icon: Truck },
    { key: 'nb_dc', label: 'Non-Billable DC', icon: Truck },
    { key: 'invoice', label: 'Invoice', icon: Receipt },
    { key: 'quotation', label: 'Quotation', icon: FileText },
  ];

  const getPreview = (key: string) => {
    const prefix = docSettings[`${key}_prefix`];
    const start = docSettings[`${key}_start_number`];
    const pad = docSettings[`${key}_padding`];
    const suffix = docSettings[`${key}_suffix`];
    return `${prefix}${String(start).padStart(pad, '0')}${suffix}`;
  };

  const updateSetting = (key: string, field: string, value: any) => {
    setDocSettings(prev => ({ ...prev, [`${key}_${field}`]: value }));
  };

  return (
    <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, margin: 0, letterSpacing: '-0.5px' }}>Settings</h1>
        <p style={{ color: '#666', marginTop: '4px', fontSize: '14px' }}>Manage your organisation settings and preferences</p>
      </div>

      <Tabs defaultValue="documents" style={{ minHeight: '500px' }}>
        <TabsList style={{ background: '#f5f5f5', padding: '4px', borderRadius: '8px' }}>
          <TabsTrigger value="documents" style={{ fontSize: '13px', padding: '8px 16px' }}>Documents</TabsTrigger>
          <TabsTrigger value="general" style={{ fontSize: '13px', padding: '8px 16px' }}>General</TabsTrigger>
          <TabsTrigger value="users" style={{ fontSize: '13px', padding: '8px 16px' }}>Users</TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
          <Card style={{ border: '1px solid #e5e5e5', borderRadius: '8px' }}>
            <CardHeader style={{ padding: '20px 24px', borderBottom: '1px solid #e5e5e5' }}>
              <CardTitle style={{ fontSize: '16px', fontWeight: 600 }}>Document Number Series</CardTitle>
              <CardDescription style={{ fontSize: '13px', color: '#666' }}>
                Configure how document numbers are generated across your organisation
              </CardDescription>
            </CardHeader>
            <CardContent style={{ padding: '24px' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 500, color: '#666', background: '#fafafa', width: '140px' }}>Document Type</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 500, color: '#666', background: '#fafafa', width: '100px' }}>Prefix</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 500, color: '#666', background: '#fafafa', width: '100px' }}>Start #</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 500, color: '#666', background: '#fafafa', width: '80px' }}>Padding</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 500, color: '#666', background: '#fafafa', width: '100px' }}>Suffix</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 500, color: '#666', background: '#fafafa' }}>Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docTypes.map(({ key, label, icon: Icon }) => (
                      <tr key={key} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Icon size={14} style={{ color: '#666' }} />
                            </div>
                            <span style={{ fontWeight: 500 }}>{label}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <Input 
                            value={docSettings[`${key}_prefix`]} 
                            onChange={(e) => updateSetting(key, 'prefix', e.target.value)}
                            style={{ width: '80px', fontSize: '13px', fontFamily: 'monospace' }}
                          />
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <Input 
                            type="number"
                            value={docSettings[`${key}_start_number`]} 
                            onChange={(e) => updateSetting(key, 'start_number', parseInt(e.target.value) || 1)}
                            style={{ width: '80px', fontSize: '13px' }}
                          />
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <Input 
                            type="number"
                            value={docSettings[`${key}_padding`]} 
                            onChange={(e) => updateSetting(key, 'padding', parseInt(e.target.value) || 3)}
                            min={1}
                            max={10}
                            style={{ width: '60px', fontSize: '13px' }}
                          />
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <Input 
                            value={docSettings[`${key}_suffix`]} 
                            onChange={(e) => updateSetting(key, 'suffix', e.target.value)}
                            placeholder="-2024"
                            style={{ width: '80px', fontSize: '13px', fontFamily: 'monospace' }}
                          />
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ 
                            fontFamily: 'monospace', 
                            fontSize: '14px', 
                            fontWeight: 600,
                            background: '#f5f5f5',
                            padding: '4px 10px',
                            borderRadius: '4px',
                            letterSpacing: '0.5px'
                          }}>
                            {getPreview(key)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
            <CardFooter style={{ padding: '16px 24px', borderTop: '1px solid #e5e5e5', background: '#fafafa' }}>
              <Button onClick={saveDocSettings} disabled={saving}>
                <Save size={14} style={{ marginRight: '8px' }} />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="general">
          <Card style={{ border: '1px solid #e5e5e5', borderRadius: '8px' }}>
            <CardContent style={{ padding: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', minHeight: '280px' }}>
                <div style={{ 
                  background: '#0f0f0f', 
                  padding: '32px 24px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '16px'
                }}>
                  <div style={{ 
                    width: '72px', 
                    height: '72px', 
                    borderRadius: '50%', 
                    background: '#fff', 
                    color: '#0f0f0f', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontSize: '28px', 
                    fontWeight: 600,
                    letterSpacing: '-0.5px'
                  }}>
                    {(user?.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ color: '#fff', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.6 }}>
                    Account
                  </div>
                </div>
                <div style={{ padding: '32px' }}>
                  <div style={{ marginBottom: '32px' }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#999', marginBottom: '6px' }}>
                      Email
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 500 }}>{user?.email}</div>
                  </div>
                  <div style={{ marginBottom: '32px' }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#999', marginBottom: '6px' }}>
                      Organisation
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 500 }}>{organisation?.name}</div>
                  </div>
                  <div style={{ paddingTop: '16px', borderTop: '1px solid #e5e5e5' }}>
                    <Button 
                      variant="ghost" 
                      onClick={handleLogout}
                      style={{ 
                        color: '#666', 
                        fontSize: '13px',
                        padding: '8px 0',
                        marginLeft: '-8px'
                      }}
                    >
                      <LogOut size={14} style={{ marginRight: '8px' }} />
                      Sign out
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card style={{ border: '1px solid #e5e5e5', borderRadius: '8px' }}>
            <CardHeader style={{ padding: '20px 24px', borderBottom: '1px solid #e5e5e5' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <CardTitle style={{ fontSize: '16px', fontWeight: 600 }}>User Access</CardTitle>
                  <CardDescription style={{ fontSize: '13px', color: '#666' }}>Manage team members and their roles</CardDescription>
                </div>
                <Button variant="secondary" onClick={() => setShowUserForm(!showUserForm)} size="sm">
                  <Plus size={14} style={{ marginRight: '6px' }} />
                  Add User
                </Button>
              </div>
            </CardHeader>
            <CardContent style={{ padding: showUserForm ? '24px 24px 0 24px' : '24px' }}>
              {showUserForm && (
                <form onSubmit={handleUserSubmit} style={{ marginBottom: '24px', padding: '20px', background: '#fafafa', borderRadius: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                      <div>
                        <Label style={{ fontSize: '13px', display: 'block', marginBottom: '6px' }}>Employee Name</Label>
                        <Input 
                          value={formData.emp_name} 
                          onChange={e => setFormData({...formData, emp_name: e.target.value})} 
                          placeholder="John Doe"
                          required 
                        />
                      </div>
                      <div>
                        <Label style={{ fontSize: '13px', display: 'block', marginBottom: '6px' }}>Email</Label>
                        <Input 
                          type="email"
                          value={formData.email} 
                          onChange={e => setFormData({...formData, email: e.target.value})} 
                          placeholder="john@company.com"
                          required 
                        />
                      </div>
                      <div>
                        <Label style={{ fontSize: '13px', display: 'block', marginBottom: '6px' }}>Role</Label>
                        <Select value={formData.role} onValueChange={(v) => setFormData({...formData, role: v})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Admin">Admin</SelectItem>
                            <SelectItem value="Engineer">Engineer</SelectItem>
                            <SelectItem value="Manager">Manager</SelectItem>
                            <SelectItem value="Assistant">Assistant</SelectItem>
                            <SelectItem value="Stores">Stores</SelectItem>
                            <SelectItem value="Site Engineer">Site Engineer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
                      <Button type="submit" size="sm">Save User</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setShowUserForm(false)}>Cancel</Button>
                    </div>
                  </form>
                )}

              <div style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 500, color: '#666', background: '#fafafa' }}>Emp ID</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 500, color: '#666', background: '#fafafa' }}>Name</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 500, color: '#666', background: '#fafafa' }}>Email</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 500, color: '#666', background: '#fafafa' }}>Role</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 500, color: '#666', background: '#fafafa' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 500 }}>{u.emp_id}</td>
                        <td style={{ padding: '12px 16px' }}>{u.emp_name}</td>
                        <td style={{ padding: '12px 16px', color: '#666' }}>{u.email}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ padding: '4px 10px', background: '#f5f5f5', borderRadius: '4px', fontSize: '12px' }}>
                            {u.role}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <Button variant="ghost" size="sm" onClick={() => deleteUser(u.id)} style={{ color: '#dc2626', fontSize: '12px' }}>
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}