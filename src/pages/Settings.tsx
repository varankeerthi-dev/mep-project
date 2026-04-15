import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { Settings as SettingsIcon, User, FileText, LogOut, Save, Plus, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const pushPath = (path) => {
  const nextPath = path || '/';
  if (`${window.location.pathname}${window.location.search}` !== nextPath || window.location.hash) {
    window.history.pushState({}, '', nextPath);
    window.dispatchEvent(new Event('locationchange'));
  }
};

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
  });
  
  const [loadingDocSettings, setLoadingDocSettings] = useState(false);
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

  const generatePreview = (prefix, startNum, padding, suffix) => {
    const paddedNum = String(startNum).padStart(padding, '0');
    return `${prefix}${paddedNum}${suffix}`;
  };

  return (
    <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, margin: 0, letterSpacing: '-0.5px' }}>
          Settings
        </h1>
        <p style={{ color: '#666', marginTop: '4px', fontSize: '14px' }}>
          Manage your organisation settings and preferences
        </p>
      </div>

      <Tabs defaultValue="general" style={{ minHeight: '500px' }}>
        <TabsList style={{ background: '#f5f5f5', padding: '4px', borderRadius: '8px' }}>
          <TabsTrigger value="general" style={{ fontSize: '13px', padding: '8px 16px' }}>General</TabsTrigger>
          <TabsTrigger value="documents" style={{ fontSize: '13px', padding: '8px 16px' }}>Documents</TabsTrigger>
          <TabsTrigger value="users" style={{ fontSize: '13px', padding: '8px 16px' }}>Users</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card style={{ border: '1px solid #e5e5e5', borderRadius: '8px' }}>
            <CardHeader style={{ padding: '20px 24px', borderBottom: '1px solid #e5e5e5' }}>
              <CardTitle style={{ fontSize: '16px', fontWeight: 600 }}>Account</CardTitle>
              <CardDescription style={{ fontSize: '13px', color: '#666' }}>Your account information</CardDescription>
            </CardHeader>
            <CardContent style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ 
                  width: '64px', 
                  height: '64px', 
                  borderRadius: '50%', 
                  background: '#1a1a1a', 
                  color: '#fff', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: '24px', 
                  fontWeight: 600 
                }}>
                  {(user?.email || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '15px' }}>{user?.email}</div>
                  <div style={{ color: '#666', fontSize: '13px', marginTop: '2px' }}>{organisation?.name}</div>
                </div>
              </div>
            </CardContent>
            <CardFooter style={{ padding: '16px 24px', borderTop: '1px solid #e5e5e5', background: '#fafafa' }}>
              <Button variant="secondary" onClick={handleLogout} style={{ fontSize: '13px' }}>
                <LogOut size={14} style={{ marginRight: '8px' }} />
                Sign Out
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card style={{ border: '1px solid #e5e5e5', borderRadius: '8px' }}>
            <CardHeader style={{ padding: '20px 24px', borderBottom: '1px solid #e5e5e5' }}>
              <CardTitle style={{ fontSize: '16px', fontWeight: 600 }}>Document Number Series</CardTitle>
              <CardDescription style={{ fontSize: '13px', color: '#666' }}>
                Configure prefixes, starting numbers, and padding for document numbering
              </CardDescription>
            </CardHeader>
            <CardContent style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                <NumberSeriesBlock 
                  title="Vendor" 
                  prefix={docSettings.vendor_prefix}
                  setPrefix={(v) => setDocSettings({...docSettings, vendor_prefix: v})}
                  startNumber={docSettings.vendor_start_number}
                  setStartNumber={(v) => setDocSettings({...docSettings, vendor_start_number: v})}
                  suffix={docSettings.vendor_suffix}
                  setSuffix={(v) => setDocSettings({...docSettings, vendor_suffix: v})}
                  padding={docSettings.vendor_padding}
                  setPadding={(v) => setDocSettings({...docSettings, vendor_padding: v})}
                  preview={generatePreview(docSettings.vendor_prefix, docSettings.vendor_start_number, docSettings.vendor_padding, docSettings.vendor_suffix)}
                />
                <NumberSeriesBlock 
                  title="Purchase Order" 
                  prefix={docSettings.po_prefix}
                  setPrefix={(v) => setDocSettings({...docSettings, po_prefix: v})}
                  startNumber={docSettings.po_start_number}
                  setStartNumber={(v) => setDocSettings({...docSettings, po_start_number: v})}
                  suffix={docSettings.po_suffix}
                  setSuffix={(v) => setDocSettings({...docSettings, po_suffix: v})}
                  padding={docSettings.po_padding}
                  setPadding={(v) => setDocSettings({...docSettings, po_padding: v})}
                  preview={generatePreview(docSettings.po_prefix, docSettings.po_start_number, docSettings.po_padding, docSettings.po_suffix)}
                />
                <NumberSeriesBlock 
                  title="Delivery Challan" 
                  prefix={docSettings.dc_prefix}
                  setPrefix={(v) => setDocSettings({...docSettings, dc_prefix: v})}
                  startNumber={docSettings.dc_start_number}
                  setStartNumber={(v) => setDocSettings({...docSettings, dc_start_number: v})}
                  suffix={docSettings.dc_suffix}
                  setSuffix={(v) => setDocSettings({...docSettings, dc_suffix: v})}
                  padding={docSettings.dc_padding}
                  setPadding={(v) => setDocSettings({...docSettings, dc_padding: v})}
                  preview={generatePreview(docSettings.dc_prefix, docSettings.dc_start_number, docSettings.dc_padding, docSettings.dc_suffix)}
                />
                <NumberSeriesBlock 
                  title="Invoice" 
                  prefix={docSettings.invoice_prefix}
                  setPrefix={(v) => setDocSettings({...docSettings, invoice_prefix: v})}
                  startNumber={docSettings.invoice_start_number}
                  setStartNumber={(v) => setDocSettings({...docSettings, invoice_start_number: v})}
                  suffix={docSettings.invoice_suffix}
                  setSuffix={(v) => setDocSettings({...docSettings, invoice_suffix: v})}
                  padding={docSettings.invoice_padding}
                  setPadding={(v) => setDocSettings({...docSettings, invoice_padding: v})}
                  preview={generatePreview(docSettings.invoice_prefix, docSettings.invoice_start_number, docSettings.invoice_padding, docSettings.invoice_suffix)}
                />
              </div>
            </CardContent>
            <CardFooter style={{ padding: '16px 24px', borderTop: '1px solid #e5e5e5', background: '#fafafa' }}>
              <Button onClick={saveDocSettings} disabled={saving} style={{ fontSize: '13px' }}>
                <Save size={14} style={{ marginRight: '8px' }} />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </CardFooter>
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

function NumberSeriesBlock({ title, prefix, setPrefix, startNumber, setStartNumber, suffix, setSuffix, padding, setPadding, preview }) {
  return (
    <div style={{ padding: '20px', background: '#fafafa', borderRadius: '8px', border: '1px solid #e5e5e5' }}>
      <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>{title} Number</h4>
      
      <div style={{ display: 'grid', gap: '12px' }}>
        <div>
          <Label style={{ fontSize: '12px', display: 'block', marginBottom: '4px', color: '#666' }}>Prefix</Label>
          <Input 
            value={prefix} 
            onChange={(e) => setPrefix(e.target.value)} 
            placeholder="PREFIX"
            style={{ fontSize: '13px' }}
          />
        </div>
        
        <div>
          <Label style={{ fontSize: '12px', display: 'block', marginBottom: '4px', color: '#666' }}>Starting Number</Label>
          <Input 
            type="number"
            value={startNumber} 
            onChange={(e) => setStartNumber(parseInt(e.target.value) || 1)} 
            style={{ fontSize: '13px' }}
          />
        </div>
        
        <div>
          <Label style={{ fontSize: '12px', display: 'block', marginBottom: '4px', color: '#666' }}>Suffix (optional)</Label>
          <Input 
            value={suffix} 
            onChange={(e) => setSuffix(e.target.value)} 
            placeholder="-2024"
            style={{ fontSize: '13px' }}
          />
        </div>
        
        <div>
          <Label style={{ fontSize: '12px', display: 'block', marginBottom: '4px', color: '#666' }}>Padding (digits)</Label>
          <Input 
            type="number"
            value={padding} 
            onChange={(e) => setPadding(parseInt(e.target.value) || 3)}
            min="1"
            max="10"
            style={{ fontSize: '13px' }}
          />
        </div>
      </div>

      <div style={{ marginTop: '16px', padding: '12px', background: '#fff', borderRadius: '6px', border: '1px solid #e5e5e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: '#666' }}>Preview:</span>
        <span style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'monospace', letterSpacing: '0.5px' }}>
          {preview}
        </span>
      </div>
    </div>
  );
}