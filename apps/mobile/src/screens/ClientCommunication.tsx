import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  MessageSquare, Plus, Search, Filter, Calendar, Phone, 
  Mail, Users, ArrowLeft, Loader2, 
  X, AlertCircle, Sparkles, Edit
} from 'lucide-react';
import { BottomSheetPicker } from '../components/BottomSheetPicker';

interface ClientCommunicationProps {
  isDemo?: boolean;
}

interface CommItem {
  id: string;
  subject: string;
  party_type: string;
  call_category: string;
  call_regarding: string;
  call_brief: string;
  next_action: string;
  follow_up_date: string | null;
  priority: string;
  status: string;
  created_at: string;
  call_entered_by: string;
  call_received_by: string;
  client_id?: string | null;
  vendor_id?: string | null;
  subcontractor_id?: string | null;
  lead_id?: string | null;
  client?: { client_name: string };
  vendor?: { company_name: string };
  subcontractor?: { company_name: string };
  lead?: { company_name: string; contact_name: string };
}

interface PartyOption {
  id: string;
  name: string;
}

const CATEGORIES = [
  { value: 'incoming', label: 'Incoming Call' },
  { value: 'outgoing', label: 'Outgoing Call' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'sms', label: 'SMS' },
];

const TOPICS = [
  { value: 'quotation', label: 'Quotation' },
  { value: 'project', label: 'Project' },
  { value: 'issue', label: 'Issue/Complaint' },
  { value: 'site_visit', label: 'Site Visit' },
  { value: 'approval', label: 'Approval' },
  { value: 'payment', label: 'Payment' },
  { value: 'general', label: 'General Inquiry' },
  { value: 'other', label: 'Other' },
];

export const ClientCommunication: React.FC<ClientCommunicationProps> = ({ isDemo = false }) => {
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'list' | 'create'>('list');
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Data State
  const [comms, setComms] = useState<CommItem[]>([]);
  const [selectedComm, setSelectedComm] = useState<CommItem | null>(null);
  
  // Form Lists
  const [clients, setClients] = useState<PartyOption[]>([]);
  const [vendors, setVendors] = useState<PartyOption[]>([]);
  const [subcontractors, setSubcontractors] = useState<PartyOption[]>([]);
  const [leads, setLeads] = useState<PartyOption[]>([]);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPartyType, setFilterPartyType] = useState('');
  const [filterPartyId, setFilterPartyId] = useState('');
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [userProfilesMap, setUserProfilesMap] = useState<Record<string, string>>({});

  // Form State
  const [editingCommId, setEditingCommId] = useState<string | null>(null);
  const [formPartyType, setFormPartyType] = useState('client');
  const [formPartyId, setFormPartyId] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formCategory, setFormCategory] = useState('incoming');
  const [formRegarding, setFormRegarding] = useState('general');
  const [formBrief, setFormBrief] = useState('');
  const [formNextAction, setFormNextAction] = useState('');
  const [formFollowUp, setFormFollowUp] = useState('');
  const [formPriority, setFormPriority] = useState('normal');
  const [formStatus, setFormStatus] = useState('open');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Add Client Modal State
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newContactPerson, setNewContactPerson] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newCity, setNewCity] = useState('');
  const [addingClient, setAddingClient] = useState(false);
  const [addClientError, setAddClientError] = useState<string | null>(null);

  // Add Vendor Modal State
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorContact, setNewVendorContact] = useState('');
  const [newVendorPhone, setNewVendorPhone] = useState('');
  const [newVendorEmail, setNewVendorEmail] = useState('');
  const [newVendorAddress, setNewVendorAddress] = useState('');
  const [addingVendor, setAddingVendor] = useState(false);
  const [addVendorError, setAddVendorError] = useState<string | null>(null);

  // Add Subcontractor Modal State
  const [showAddSubcontractorModal, setShowAddSubcontractorModal] = useState(false);
  const [newSubCompanyName, setNewSubCompanyName] = useState('');
  const [newSubContact, setNewSubContact] = useState('');
  const [newSubPhone, setNewSubPhone] = useState('');
  const [newSubEmail, setNewSubEmail] = useState('');
  const [newSubAddress, setNewSubAddress] = useState('');
  const [addingSubcontractor, setAddingSubcontractor] = useState(false);
  const [addSubcontractorError, setAddSubcontractorError] = useState<string | null>(null);

  // Add Lead Modal State
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [newLeadContactName, setNewLeadContactName] = useState('');
  const [newLeadCompanyName, setNewLeadCompanyName] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadEmail, setNewLeadEmail] = useState('');
  const [newLeadCity, setNewLeadCity] = useState('');
  const [addingLead, setAddingLead] = useState(false);
  const [addLeadError, setAddLeadError] = useState<string | null>(null);

  // Demo Mock Data
  const [demoComms, setDemoComms] = useState<CommItem[]>([
    {
      id: 'demo-c1',
      subject: 'Quotation Feedback',
      party_type: 'client',
      call_category: 'incoming',
      call_regarding: 'quotation',
      call_brief: 'Client called to request a 5% discount on the structural works quotation. They are ready to sign if we can adjust the pricing.',
      next_action: 'Discuss discount margin with management and revise quotation.',
      follow_up_date: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString().split('T')[0], // Tomorrow
      priority: 'high',
      status: 'Open',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
      client: { client_name: 'Acme Developments' },
      call_entered_by: 'demo-user-id',
      call_received_by: 'demo-user-id'
    },
    {
      id: 'demo-c2',
      subject: 'Cement Delivery Delay',
      party_type: 'vendor',
      call_category: 'outgoing',
      call_regarding: 'project',
      call_brief: 'Followed up with supplier regarding delayed cement bags. They confirmed shipment is stuck in transit and will arrive by tomorrow morning.',
      next_action: 'Coordinate with site supervisor to reschedule concrete casting.',
      follow_up_date: null,
      priority: 'high',
      status: 'In Progress',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
      vendor: { company_name: 'UltraTech Cement Suppliers' },
      call_entered_by: 'demo-user-id',
      call_received_by: 'demo-user-id'
    },
    {
      id: 'demo-c3',
      subject: 'Initial Call - Commercial Lead',
      party_type: 'lead',
      call_category: 'whatsapp',
      call_regarding: 'general',
      call_brief: 'Shared project portfolio and company presentation on WhatsApp. Lead responded positively and asked for a brief introductory meeting.',
      next_action: 'Schedule intro call for Monday.',
      follow_up_date: new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString().split('T')[0],
      priority: 'normal',
      status: 'Open',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(),
      lead: { company_name: 'Nexus Retailers', contact_name: 'Rajesh Kumar' },
      call_entered_by: 'demo-user-id',
      call_received_by: 'demo-user-id'
    }
  ]);

  const demoClients = [
    { id: 'demo-cl1', name: 'Acme Developments' },
    { id: 'demo-cl2', name: 'Metro Infra Projects' }
  ];
  const demoVendors = [
    { id: 'demo-vn1', name: 'UltraTech Cement Suppliers' },
    { id: 'demo-vn2', name: 'Apex Steel Distributors' }
  ];
  const demoSubcontractors = [
    { id: 'demo-sb1', name: 'Shiva Electricals' },
    { id: 'demo-sb2', name: 'Royal Plumbing Works' }
  ];
  const demoLeads = [
    { id: 'demo-ld1', name: 'Nexus Retailers (Rajesh Kumar)' }
  ];

  useEffect(() => {
    if (isDemo) {
      setClients(demoClients);
      setVendors(demoVendors);
      setSubcontractors(demoSubcontractors);
      setLeads(demoLeads);
      setComms(demoComms);
      setUserProfilesMap({ 'demo-user-id': 'Demo User' });
      setLoading(false);
    } else {
      initSessionAndFetch();
    }
  }, [isDemo, demoComms]);

  const initSessionAndFetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('User not authenticated');
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const { data: memberData } = await supabase
        .from('org_members')
        .select('organisation_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      const userOrgId = memberData?.organisation_id;
      if (!userOrgId) {
        setError('No organization associated with this account');
        setLoading(false);
        return;
      }
      setOrgId(userOrgId);

      // Load form selector data & user profiles
      const [clientsRes, vendorsRes, subRes, leadsRes, profilesRes] = await Promise.all([
        supabase.from('clients').select('id, client_name').eq('organisation_id', userOrgId).order('client_name'),
        supabase.from('purchase_vendors').select('id, company_name').eq('organisation_id', userOrgId).order('company_name'),
        supabase.from('subcontractors').select('id, company_name').eq('organisation_id', userOrgId).order('company_name'),
        supabase.from('leads').select('id, company_name, contact_name').eq('organisation_id', userOrgId).order('company_name'),
        supabase.from('user_profiles').select('id, user_id, full_name')
      ]);

      const profileMap: Record<string, string> = {};
      if (profilesRes.data) {
        profilesRes.data.forEach((p: any) => {
          const uId = p.user_id || p.id;
          if (uId) {
            profileMap[uId] = p.full_name || 'System User';
          }
        });
      }
      setUserProfilesMap(profileMap);

      setClients(clientsRes.data?.map(c => ({ id: c.id, name: c.client_name })) || []);
      setVendors(vendorsRes.data?.map(v => ({ id: v.id, name: v.company_name })) || []);
      setSubcontractors(subRes.data?.map(s => ({ id: s.id, name: s.company_name })) || []);
      setLeads(leadsRes.data?.map(l => ({ id: l.id, name: l.company_name ? `${l.company_name} (${l.contact_name})` : l.contact_name })) || []);

      await fetchCommunications(userOrgId);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to load communications');
      setLoading(false);
    }
  };

  const fetchCommunications = async (userOrgId: string) => {
    try {
      const { data, error: fetchErr } = await supabase
        .from('client_communication')
        .select(`
          *,
          client_id,
          vendor_id,
          subcontractor_id,
          lead_id,
          client:clients(client_name),
          vendor:purchase_vendors(company_name),
          subcontractor:subcontractors(company_name),
          lead:leads(company_name, contact_name)
        `)
        .eq('organisation_id', userOrgId)
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setComms(data || []);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch past communications');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload: any = {
      subject: formSubject,
      party_type: formPartyType,
      call_category: formCategory,
      call_regarding: formRegarding,
      call_brief: formBrief,
      next_action: formNextAction,
      follow_up_date: formFollowUp || null,
      priority: formPriority,
      status: formStatus === 'open' ? 'Open' : formStatus === 'in_progress' ? 'In Progress' : formStatus === 'resolved' ? 'Resolved' : 'Closed',
      client_id: formPartyType === 'client' ? formPartyId : null,
      vendor_id: formPartyType === 'vendor' ? formPartyId : null,
      subcontractor_id: formPartyType === 'subcontractor' ? formPartyId : null,
      lead_id: formPartyType === 'lead' ? formPartyId : null,
      assigned_to: userId,
      call_received_by: userId,
      call_entered_by: userId,
    };

    if (editingCommId) {
      if (isDemo) {
        setTimeout(() => {
          setDemoComms(prev =>
            prev.map(item => (item.id === editingCommId ? { ...item, ...payload } : item))
          );
          setSaving(false);
          setActiveView('list');
          setEditingCommId(null);
          resetForm();
        }, 600);
        return;
      }

      try {
        const { error: updateErr } = await supabase
          .from('client_communication')
          .update(payload)
          .eq('id', editingCommId);

        if (updateErr) throw updateErr;

        await fetchCommunications(orgId!);
        setSaving(false);
        setActiveView('list');
        setEditingCommId(null);
        resetForm();
      } catch (err: any) {
        console.error(err);
        setError(err?.message || 'Failed to update communication log');
        setSaving(false);
      }
      return;
    }

    if (isDemo) {
      // Simulate save delay
      setTimeout(() => {
        const newMockComm: CommItem = {
          id: `demo-new-${Date.now()}`,
          ...payload,
          created_at: new Date().toISOString(),
          client: formPartyType === 'client' ? { client_name: clients.find(c => c.id === formPartyId)?.name || 'Unknown Client' } : undefined,
          vendor: formPartyType === 'vendor' ? { company_name: vendors.find(v => v.id === formPartyId)?.name || 'Unknown Vendor' } : undefined,
          subcontractor: formPartyType === 'subcontractor' ? { company_name: subcontractors.find(s => s.id === formPartyId)?.name || 'Unknown Subcontractor' } : undefined,
          lead: formPartyType === 'lead' ? { company_name: leads.find(l => l.id === formPartyId)?.name || 'Unknown Lead', contact_name: '' } : undefined,
        };
        
        setDemoComms(prev => [newMockComm, ...prev]);
        setSaving(false);
        setActiveView('list');
        resetForm();
      }, 600);
      return;
    }

    try {
      const { error: insertErr } = await supabase
        .from('client_communication')
        .insert({
          ...payload,
          organisation_id: orgId
        });

      if (insertErr) throw insertErr;
      
      await fetchCommunications(orgId!);
      setSaving(false);
      setActiveView('list');
      resetForm();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to save communication log');
      setSaving(false);
    }
  };

  const handleAddClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim() || !orgId) return;

    setAddingClient(true);
    setAddClientError(null);

    if (isDemo) {
      setTimeout(() => {
        const mockId = `demo-client-${Date.now()}`;
        const option: PartyOption = {
          id: mockId,
          name: newClientName
        };
        setClients(prev => [...prev, option].sort((a, b) => a.name.localeCompare(b.name)));
        setFormPartyId(mockId);
        
        // Reset form
        setNewClientName('');
        setNewContactPerson('');
        setNewPhone('');
        setNewEmail('');
        setNewCity('');
        setAddingClient(false);
        setShowAddClientModal(false);
      }, 500);
      return;
    }

    try {
      const { data, error: insertErr } = await supabase
        .from('clients')
        .insert([{
          client_name: newClientName,
          contact_person: newContactPerson,
          phone: newPhone,
          email: newEmail,
          city: newCity,
          organisation_id: orgId,
          client_id: `CL-${Date.now()}`,
          created_at: new Date().toISOString()
        }])
        .select();

      if (insertErr) throw insertErr;

      const newClient = data?.[0];
      if (newClient) {
        // Add to clients state list
        const option: PartyOption = {
          id: newClient.id,
          name: newClient.client_name
        };
        setClients(prev => [...prev, option].sort((a, b) => a.name.localeCompare(b.name)));
        setFormPartyId(newClient.id);
      }

      // Reset form
      setNewClientName('');
      setNewContactPerson('');
      setNewPhone('');
      setNewEmail('');
      setNewCity('');
      setShowAddClientModal(false);
    } catch (err: any) {
      console.error(err);
      setAddClientError(err?.message || 'Failed to add client');
    } finally {
      setAddingClient(false);
    }
  };

  const handleAddVendorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendorName.trim() || !orgId) return;

    setAddingVendor(true);
    setAddVendorError(null);

    if (isDemo) {
      setTimeout(() => {
        const mockId = `demo-vendor-${Date.now()}`;
        const option: PartyOption = {
          id: mockId,
          name: newVendorName
        };
        setVendors(prev => [...prev, option].sort((a, b) => a.name.localeCompare(b.name)));
        setFormPartyId(mockId);
        
        setNewVendorName('');
        setNewVendorContact('');
        setNewVendorPhone('');
        setNewVendorEmail('');
        setNewVendorAddress('');
        setAddingVendor(false);
        setShowAddVendorModal(false);
      }, 500);
      return;
    }

    try {
      const { data, error: insertErr } = await supabase
        .from('purchase_vendors')
        .insert([{
          company_name: newVendorName,
          contact_person: newVendorContact,
          phone: newVendorPhone,
          email: newVendorEmail,
          address: newVendorAddress,
          organisation_id: orgId,
          vendor_code: `VN-${Date.now()}`,
          status: 'Active',
          created_at: new Date().toISOString()
        }])
        .select();

      if (insertErr) throw insertErr;

      const newVendor = data?.[0];
      if (newVendor) {
        const option: PartyOption = {
          id: newVendor.id,
          name: newVendor.company_name
        };
        setVendors(prev => [...prev, option].sort((a, b) => a.name.localeCompare(b.name)));
        setFormPartyId(newVendor.id);
      }

      setNewVendorName('');
      setNewVendorContact('');
      setNewVendorPhone('');
      setNewVendorEmail('');
      setNewVendorAddress('');
      setShowAddVendorModal(false);
    } catch (err: any) {
      console.error(err);
      setAddVendorError(err?.message || 'Failed to add vendor');
    } finally {
      setAddingVendor(false);
    }
  };

  const handleAddSubcontractorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubCompanyName.trim() || !orgId) return;

    setAddingSubcontractor(true);
    setAddSubcontractorError(null);

    if (isDemo) {
      setTimeout(() => {
        const mockId = `demo-sub-${Date.now()}`;
        const option: PartyOption = {
          id: mockId,
          name: newSubCompanyName
        };
        setSubcontractors(prev => [...prev, option].sort((a, b) => a.name.localeCompare(b.name)));
        setFormPartyId(mockId);
        
        setNewSubCompanyName('');
        setNewSubContact('');
        setNewSubPhone('');
        setNewSubEmail('');
        setNewSubAddress('');
        setAddingSubcontractor(false);
        setShowAddSubcontractorModal(false);
      }, 500);
      return;
    }

    try {
      const { data, error: insertErr } = await supabase
        .from('subcontractors')
        .insert([{
          company_name: newSubCompanyName,
          contact_person: newSubContact,
          phone: newSubPhone,
          email: newSubEmail,
          address: newSubAddress,
          organisation_id: orgId,
          sub_number: `SUB-${Date.now()}`,
          status: 'Active',
          created_at: new Date().toISOString()
        }])
        .select();

      if (insertErr) throw insertErr;

      const newSub = data?.[0];
      if (newSub) {
        const option: PartyOption = {
          id: newSub.id,
          name: newSub.company_name
        };
        setSubcontractors(prev => [...prev, option].sort((a, b) => a.name.localeCompare(b.name)));
        setFormPartyId(newSub.id);
      }

      setNewSubCompanyName('');
      setNewSubContact('');
      setNewSubPhone('');
      setNewSubEmail('');
      setNewSubAddress('');
      setShowAddSubcontractorModal(false);
    } catch (err: any) {
      console.error(err);
      setAddSubcontractorError(err?.message || 'Failed to add subcontractor');
    } finally {
      setAddingSubcontractor(false);
    }
  };

  const handleAddLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadContactName.trim() || !orgId) return;

    setAddingLead(true);
    setAddLeadError(null);

    if (isDemo) {
      setTimeout(() => {
        const mockId = `demo-lead-${Date.now()}`;
        const option: PartyOption = {
          id: mockId,
          name: newLeadCompanyName ? `${newLeadCompanyName} (${newLeadContactName})` : newLeadContactName
        };
        setLeads(prev => [...prev, option].sort((a, b) => a.name.localeCompare(b.name)));
        setFormPartyId(mockId);
        
        setNewLeadContactName('');
        setNewLeadCompanyName('');
        setNewLeadPhone('');
        setNewLeadEmail('');
        setNewLeadCity('');
        setAddingLead(false);
        setShowAddLeadModal(false);
      }, 500);
      return;
    }

    try {
      const { data: statusRows } = await supabase
        .from('lead_statuses')
        .select('id')
        .eq('name', 'New')
        .limit(1);
      
      const leadStatusId = statusRows && statusRows.length > 0 ? statusRows[0].id : null;

      const { data, error: insertErr } = await supabase
        .from('leads')
        .insert([{
          contact_name: newLeadContactName,
          company_name: newLeadCompanyName,
          contact_phone: newLeadPhone,
          contact_email: newLeadEmail,
          city: newLeadCity,
          status: 'New',
          lead_status_id: leadStatusId,
          organisation_id: orgId,
          created_at: new Date().toISOString()
        }])
        .select();

      if (insertErr) throw insertErr;

      const newLead = data?.[0];
      if (newLead) {
        const displayName = newLead.company_name ? `${newLead.company_name} (${newLead.contact_name})` : newLead.contact_name;
        const option: PartyOption = {
          id: newLead.id,
          name: displayName
        };
        setLeads(prev => [...prev, option].sort((a, b) => a.name.localeCompare(b.name)));
        setFormPartyId(newLead.id);
      }

      setNewLeadContactName('');
      setNewLeadCompanyName('');
      setNewLeadPhone('');
      setNewLeadEmail('');
      setNewLeadCity('');
      setShowAddLeadModal(false);
    } catch (err: any) {
      console.error(err);
      setAddLeadError(err?.message || 'Failed to add lead');
    } finally {
      setAddingLead(false);
    }
  };

  const formatDate = (dateStr: string | null | undefined, useTextMonth = true) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '—';
      const day = String(d.getDate()).padStart(2, '0');
      if (useTextMonth) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[d.getMonth()];
        const year = d.getFullYear();
        return `${day}-${month}-${year}`; // dd-mmm-yyyy
      } else {
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}-${month}-${year}`; // dd-mm-yyyy
      }
    } catch {
      return '—';
    }
  };

  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '—';
      const datePart = formatDate(dateStr, true);
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${datePart} ${hours}:${minutes}`;
    } catch {
      return '—';
    }
  };

  const resetForm = () => {
    setFormPartyId('');
    setFormSubject('');
    setFormCategory('incoming');
    setFormRegarding('general');
    setFormBrief('');
    setFormNextAction('');
    setFormFollowUp('');
    setFormPriority('normal');
    setFormStatus('open');
    setEditingCommId(null);
  };

  const handleEditClick = (item: CommItem) => {
    setEditingCommId(item.id);
    setFormPartyType(item.party_type);
    const pId = item.client_id || item.vendor_id || item.subcontractor_id || item.lead_id || '';
    setFormPartyId(pId);
    setFormSubject(item.subject || '');
    setFormCategory(item.call_category || 'incoming');
    setFormRegarding(item.call_regarding || 'general');
    setFormBrief(item.call_brief || '');
    setFormNextAction(item.next_action || '');
    setFormFollowUp(item.follow_up_date || '');
    setFormPriority(item.priority || 'normal');
    setFormStatus(
      (item.status || '').toLowerCase() === 'open' ? 'open' :
      (item.status || '').toLowerCase() === 'in_progress' ? 'in_progress' :
      (item.status || '').toLowerCase() === 'resolved' ? 'resolved' :
      (item.status || '').toLowerCase() === 'closed' ? 'closed' : 'open'
    );
    setSelectedComm(null);
    setActiveView('create');
  };

  const getPartyOptions = () => {
    switch (formPartyType) {
      case 'client': return clients;
      case 'vendor': return vendors;
      case 'subcontractor': return subcontractors;
      case 'lead': return leads;
      default: return [];
    }
  };

  const getFilterPartyOptions = () => {
    switch (filterPartyType) {
      case 'client': return clients;
      case 'vendor': return vendors;
      case 'subcontractor': return subcontractors;
      case 'lead': return leads;
      default: return [];
    }
  };

  const getPartyNameById = (id: string) => {
    const list = [...clients, ...vendors, ...subcontractors, ...leads];
    return list.find(item => item.id === id)?.name || 'Specific Party';
  };

  const getPartyDisplayName = (item: CommItem) => {
    if (item.client) return item.client.client_name;
    if (item.vendor) return item.vendor.company_name;
    if (item.subcontractor) return item.subcontractor.company_name;
    if (item.lead) return item.lead.company_name || item.lead.contact_name;
    return 'General / Internal';
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'incoming':
      case 'outgoing':
        return <Phone className="h-4 w-4" />;
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'whatsapp':
      case 'sms':
        return <MessageSquare className="h-4 w-4" />;
      case 'meeting':
        return <Users className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  // Filter communications
  const filteredComms = comms.filter(item => {
    const partyName = getPartyDisplayName(item).toLowerCase();
    const subject = (item.subject || '').toLowerCase();
    const brief = (item.call_brief || '').toLowerCase();
    const nextAction = (item.next_action || '').toLowerCase();
    const matchesSearch = partyName.includes(searchQuery.toLowerCase()) || 
                          subject.includes(searchQuery.toLowerCase()) || 
                          brief.includes(searchQuery.toLowerCase()) || 
                          nextAction.includes(searchQuery.toLowerCase());
    
    const matchesCategory = filterCategory ? item.call_category === filterCategory : true;
    const matchesPartyType = filterPartyType ? item.party_type === filterPartyType : true;
    const matchesPartyId = filterPartyId ? (
      item.client_id === filterPartyId ||
      item.vendor_id === filterPartyId ||
      item.subcontractor_id === filterPartyId ||
      item.lead_id === filterPartyId
    ) : true;
    
    return matchesSearch && matchesCategory && matchesPartyType && matchesPartyId;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <span className="font-bold text-base tracking-tight text-foreground">
            {activeView === 'create' && editingCommId ? 'Edit Comm Log' : 'Communications'}
          </span>
        </div>
        {activeView === 'list' ? (
          <button
            onClick={() => setActiveView('create')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs transition-all active:scale-[0.97]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Log Comm</span>
          </button>
        ) : (
          <button
            onClick={() => { setActiveView('list'); resetForm(); }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-input text-muted-foreground font-semibold text-xs active:scale-[0.97] transition-all"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{editingCommId ? 'Cancel' : 'Back'}</span>
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {error && (
          <div className="p-3 text-xs rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {activeView === 'list' ? (
          <>
            {/* Search & Filter Bar */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search communications..."
                  className="w-full pl-9 pr-4 h-10 rounded-xl border border-input bg-card text-xs focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                />
              </div>
              <button
                onClick={() => setShowFiltersModal(true)}
                className={`p-2 rounded-xl border border-input flex items-center justify-center bg-card active:scale-[0.97] transition-all ${
                  filterCategory || filterPartyType || filterPartyId ? 'border-primary text-primary bg-primary/5' : 'text-muted-foreground'
                }`}
              >
                <Filter className="h-4 w-4" />
              </button>
            </div>

            {/* Active filters display */}
            {(filterCategory || filterPartyType || filterPartyId) && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] text-muted-foreground font-medium">Active:</span>
                {filterPartyType && (
                  <span className="text-[9px] font-bold uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                    {filterPartyType}
                    <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => { setFilterPartyType(''); setFilterPartyId(''); }} />
                  </span>
                )}
                {filterPartyId && (
                  <span className="text-[9px] font-bold uppercase bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Search className="h-2.5 w-2.5" />
                    {getPartyNameById(filterPartyId)}
                    <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => setFilterPartyId('')} />
                  </span>
                )}
                {filterCategory && (
                  <span className="text-[9px] font-bold uppercase bg-secondary/10 text-secondary-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                    {CATEGORIES.find(c => c.value === filterCategory)?.label || filterCategory}
                    <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => setFilterCategory('')} />
                  </span>
                )}
              </div>
            )}

            {/* Comms List */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredComms.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                <p className="text-xs font-semibold text-muted-foreground">No communication logs found</p>
                <p className="text-[10px] text-muted-foreground/75">Try clearing filters or log a new call.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredComms.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedComm(item)}
                    className="glass-card rounded-xl p-4 shadow-sm border border-border/40 hover:border-primary/20 transition-all cursor-pointer flex flex-col space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-primary/5 text-primary">
                          {getCategoryIcon(item.call_category)}
                        </div>
                        <div>
                          <div className="flex items-baseline gap-2">
                            <h4 className="text-xs font-bold text-foreground truncate max-w-[150px]">
                              {getPartyDisplayName(item)}
                            </h4>
                            <span className="text-[9px] font-medium text-muted-foreground shrink-0">
                              {formatDate(item.created_at, true)}
                            </span>
                          </div>
                          <p className="text-[9px] font-semibold uppercase text-muted-foreground/70">
                            {item.party_type} • {item.call_regarding} • Entered by: {userProfilesMap[item.call_entered_by] || 'System'} • Received by: {userProfilesMap[item.call_received_by] || 'System'}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        item.priority === 'urgent' ? 'bg-red-500/10 text-red-500' :
                        item.priority === 'high' ? 'bg-orange-500/10 text-orange-500' :
                        item.priority === 'normal' ? 'bg-blue-500/10 text-blue-500' :
                        'bg-slate-500/10 text-slate-500'
                      }`}>
                        {item.priority}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-bold text-foreground truncate">{item.subject}</p>
                      <p className="text-[10px] text-muted-foreground/90 line-clamp-2 leading-relaxed">{item.call_brief}</p>
                    </div>

                    {item.follow_up_date && (
                      <div className="flex justify-between items-center pt-2 border-t border-border/20 text-[9px] text-muted-foreground font-semibold">
                        <div className="flex items-center gap-1 bg-amber-500/5 text-amber-600 px-1.5 py-0.5 rounded border border-amber-500/10">
                          <Calendar className="h-3 w-3" />
                          <span>Follow up: {formatDate(item.follow_up_date, true)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Create Log Form */
          <form onSubmit={handleCreateSubmit} className="space-y-4 pb-10">
            {/* Party Type Tabs */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Party Type</label>
              <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-muted/60 border border-border/30">
                {['client', 'vendor', 'lead', 'subcontractor'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => { setFormPartyType(type); setFormPartyId(''); }}
                    className={`py-1.5 rounded-lg text-[10px] font-bold capitalize transition-all ${
                      formPartyType === type
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Select Party Dropdown */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground">Select {formPartyType}</label>
                {formPartyType === 'client' && (
                  <button
                    type="button"
                    onClick={() => {
                      setAddClientError(null);
                      setShowAddClientModal(true);
                    }}
                    className="text-[11px] font-bold text-primary active:scale-95 transition-all flex items-center gap-1"
                  >
                    + Add Client
                  </button>
                )}
              </div>
              <BottomSheetPicker
                label={`Select ${formPartyType.charAt(0).toUpperCase() + formPartyType.slice(1)}`}
                options={getPartyOptions()}
                value={formPartyId}
                onChange={(val) => setFormPartyId(val)}
                placeholder={`-- Choose ${formPartyType} --`}
              />
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Subject / Topic Summary</label>
              <input
                type="text"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                placeholder="E.g., Revision of scope, delayed payments..."
                className="w-full px-3 h-10 rounded-xl border border-input bg-card text-xs focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                required
              />
            </div>

            {/* Category & Regarding */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Comm. Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3 h-10 rounded-xl border border-input bg-card text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Regarding Topic</label>
                <select
                  value={formRegarding}
                  onChange={(e) => setFormRegarding(e.target.value)}
                  className="w-full px-3 h-10 rounded-xl border border-input bg-card text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {TOPICS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            {/* Priority & Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Priority</label>
                <select
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value)}
                  className="w-full px-3 h-10 rounded-xl border border-input bg-card text-xs focus:outline-none"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full px-3 h-10 rounded-xl border border-input bg-card text-xs focus:outline-none"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            {/* Brief Summary */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Brief Summary (Notes)</label>
              <textarea
                value={formBrief}
                onChange={(e) => setFormBrief(e.target.value)}
                placeholder="What did you discuss? Key takeaways..."
                rows={3}
                className="w-full p-3 rounded-xl border border-input bg-card text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                required
              />
            </div>

            {/* Next Action */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Next Action Required / Next plan</label>
              <input
                type="text"
                value={formNextAction}
                onChange={(e) => setFormNextAction(e.target.value)}
                placeholder="E.g., Send updated invoice details..."
                className="w-full px-3 h-10 rounded-xl border border-input bg-card text-xs focus:outline-none"
              />
            </div>

            {/* Follow Up Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Follow-Up Date</label>
              <input
                type="date"
                value={formFollowUp}
                onChange={(e) => setFormFollowUp(e.target.value)}
                className="w-full px-3 h-10 rounded-xl border border-input bg-card text-xs focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm active:scale-[0.98] transition-all hover:bg-primary/95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingCommId ? 'Save Changes' : 'Save Communication Log')}
            </button>
          </form>
        )}
      </div>

      {/* Details Sheet Modal */}
      {selectedComm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-[1px] p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-border shadow-lg p-6 flex flex-col space-y-4 animate-slide-up">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/5 text-primary">
                  {getCategoryIcon(selectedComm.call_category)}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-foreground">{getPartyDisplayName(selectedComm)}</h3>
                  <p className="text-[9px] font-semibold uppercase text-muted-foreground/75">{selectedComm.party_type} • {selectedComm.call_regarding}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleEditClick(selectedComm)}
                  className="p-1 rounded-full hover:bg-muted text-primary active:scale-95 transition-all"
                  title="Edit Log"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => setSelectedComm(null)}
                  className="p-1 rounded-full hover:bg-muted text-muted-foreground active:scale-95 transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Subject</span>
                <p className="text-xs font-bold text-foreground leading-relaxed">{selectedComm.subject}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Discussion Notes</span>
                <div className="p-3 rounded-lg bg-muted/40 border border-border/20 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {selectedComm.call_brief}
                </div>
              </div>

              {selectedComm.next_action && (
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Next Action / Next plan</span>
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span>{selectedComm.next_action}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border/30 text-[10px]">
                <div>
                  <span className="text-[8px] font-bold text-muted-foreground uppercase">Priority</span>
                  <p className="font-semibold capitalize text-foreground">{selectedComm.priority}</p>
                </div>
                <div>
                  <span className="text-[8px] font-bold text-muted-foreground uppercase">Status</span>
                  <p className="font-semibold capitalize text-foreground">{selectedComm.status}</p>
                </div>
                <div>
                  <span className="text-[8px] font-bold text-muted-foreground uppercase">Entered By</span>
                  <p className="font-semibold text-foreground">{userProfilesMap[selectedComm.call_entered_by] || 'System'}</p>
                </div>
                <div>
                  <span className="text-[8px] font-bold text-muted-foreground uppercase">Received By</span>
                  <p className="font-semibold text-foreground">{userProfilesMap[selectedComm.call_received_by] || 'System'}</p>
                </div>
                <div>
                  <span className="text-[8px] font-bold text-muted-foreground uppercase">Date Logged</span>
                  <p className="font-semibold text-foreground">{formatDateTime(selectedComm.created_at)}</p>
                </div>
                {selectedComm.follow_up_date && (
                  <div>
                    <span className="text-[8px] font-bold text-muted-foreground uppercase text-amber-600">Follow-Up Date</span>
                    <p className="font-semibold text-amber-600">{formatDate(selectedComm.follow_up_date, true)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters Modal */}
      {showFiltersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[1px] p-6">
          <div className="w-full max-w-xs rounded-2xl bg-card border border-border shadow-lg p-5 flex flex-col space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-foreground">Filter Logs</h3>
              <button onClick={() => setShowFiltersModal(false)} className="text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Party Type</label>
                <select
                  value={filterPartyType}
                  onChange={(e) => { setFilterPartyType(e.target.value); setFilterPartyId(''); }}
                  className="w-full px-2 h-8 rounded-lg border border-input bg-card text-xs focus:outline-none"
                >
                  <option value="">All Party Types</option>
                  <option value="client">Client</option>
                  <option value="vendor">Vendor</option>
                  <option value="lead">Lead</option>
                  <option value="subcontractor">Subcontractor</option>
                </select>
              </div>

              {filterPartyType && (
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground capitalize flex items-center gap-1">
                    <Search className="h-3.5 w-3.5 text-primary" />
                    <span>Search {filterPartyType}</span>
                  </label>
                  <select
                    value={filterPartyId}
                    onChange={(e) => setFilterPartyId(e.target.value)}
                    className="w-full px-2 h-8 rounded-lg border border-input bg-card text-xs focus:outline-none"
                  >
                    <option value="">All {filterPartyType}s</option>
                    {getFilterPartyOptions().map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Category</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full px-2 h-8 rounded-lg border border-input bg-card text-xs focus:outline-none"
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => { setFilterCategory(''); setFilterPartyType(''); setFilterPartyId(''); setShowFiltersModal(false); }}
                className="flex-1 h-9 rounded-lg border border-input text-[10px] font-bold text-muted-foreground active:scale-95 transition-all"
              >
                Clear
              </button>
              <button
                onClick={() => setShowFiltersModal(false)}
                className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-[10px] font-bold active:scale-95 transition-all"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      {showAddClientModal && (
        <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card rounded-2xl border border-border/50 shadow-xl overflow-hidden flex flex-col p-5 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">Add New Client</h3>
              <button
                type="button"
                onClick={() => setShowAddClientModal(false)}
                className="text-muted-foreground hover:text-foreground active:scale-95 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Error Message if any */}
            {addClientError && (
              <div className="mb-3 text-[11px] font-semibold text-rose-500 bg-rose-500/5 border border-rose-500/10 p-2.5 rounded-xl">
                {addClientError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleAddClientSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Client Name *</label>
                <input
                  type="text"
                  required
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="e.g. Acme Corporation"
                  className="w-full px-3 h-10 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Contact Person (POC)</label>
                <input
                  type="text"
                  value={newContactPerson}
                  onChange={(e) => setNewContactPerson(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 h-10 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Phone Number</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full px-3 h-10 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Email Address</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. email@company.com"
                  className="w-full px-3 h-10 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">City</label>
                <input
                  type="text"
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  placeholder="e.g. Mumbai"
                  className="w-full px-3 h-10 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-border/30 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddClientModal(false)}
                  className="flex-1 h-10 rounded-xl border border-border text-xs font-semibold text-muted-foreground active:scale-95 transition-all bg-transparent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingClient}
                  className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-xs font-semibold active:scale-95 transition-all disabled:opacity-50"
                >
                  {addingClient ? 'Saving...' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Vendor Modal */}
      {showAddVendorModal && (
        <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card rounded-2xl border border-border/50 shadow-xl overflow-hidden flex flex-col p-5 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">Add New Vendor</h3>
              <button
                type="button"
                onClick={() => setShowAddVendorModal(false)}
                className="text-muted-foreground hover:text-foreground active:scale-95 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Error Message if any */}
            {addVendorError && (
              <div className="mb-3 text-[11px] font-semibold text-rose-500 bg-rose-500/5 border border-rose-500/10 p-2.5 rounded-xl">
                {addVendorError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleAddVendorSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Vendor / Company Name *</label>
                <input
                  type="text"
                  required
                  value={newVendorName}
                  onChange={(e) => setNewVendorName(e.target.value)}
                  placeholder="e.g. Acme Corporation"
                  className="w-full px-3 h-10 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Contact Person (POC)</label>
                <input
                  type="text"
                  value={newVendorContact}
                  onChange={(e) => setNewVendorContact(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 h-10 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Phone Number</label>
                <input
                  type="tel"
                  value={newVendorPhone}
                  onChange={(e) => setNewVendorPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full px-3 h-10 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Email Address</label>
                <input
                  type="email"
                  value={newVendorEmail}
                  onChange={(e) => setNewVendorEmail(e.target.value)}
                  placeholder="e.g. email@company.com"
                  className="w-full px-3 h-10 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Address</label>
                <input
                  type="text"
                  value={newVendorAddress}
                  onChange={(e) => setNewVendorAddress(e.target.value)}
                  placeholder="e.g. Street Address"
                  className="w-full px-3 h-10 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-border/30 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddVendorModal(false)}
                  className="flex-1 h-10 rounded-xl border border-border text-xs font-semibold text-muted-foreground active:scale-95 transition-all bg-transparent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingVendor}
                  className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-xs font-semibold active:scale-95 transition-all disabled:opacity-50"
                >
                  {addingVendor ? 'Saving...' : 'Add Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Subcontractor Modal */}
      {showAddSubcontractorModal && (
        <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card rounded-2xl border border-border/50 shadow-xl overflow-hidden flex flex-col p-5 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">Add Subcontractor</h3>
              <button
                type="button"
                onClick={() => setShowAddSubcontractorModal(false)}
                className="text-muted-foreground hover:text-foreground active:scale-95 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Error Message if any */}
            {addSubcontractorError && (
              <div className="mb-3 text-[11px] font-semibold text-rose-500 bg-rose-500/5 border border-rose-500/10 p-2.5 rounded-xl">
                {addSubcontractorError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleAddSubcontractorSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Subcontractor Name *</label>
                <input
                  type="text"
                  required
                  value={newSubCompanyName}
                  onChange={(e) => setNewSubCompanyName(e.target.value)}
                  placeholder="e.g. Acme Contracting"
                  className="w-full px-3 h-10 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Contact Person (POC)</label>
                <input
                  type="text"
                  value={newSubContact}
                  onChange={(e) => setNewSubContact(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 h-10 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Phone Number</label>
                <input
                  type="tel"
                  value={newSubPhone}
                  onChange={(e) => setNewSubPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full px-3 h-10 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Email Address</label>
                <input
                  type="email"
                  value={newSubEmail}
                  onChange={(e) => setNewSubEmail(e.target.value)}
                  placeholder="e.g. email@company.com"
                  className="w-full px-3 h-10 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Address</label>
                <input
                  type="text"
                  value={newSubAddress}
                  onChange={(e) => setNewSubAddress(e.target.value)}
                  placeholder="e.g. Street Address"
                  className="w-full px-3 h-10 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-border/30 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddSubcontractorModal(false)}
                  className="flex-1 h-10 rounded-xl border border-border text-xs font-semibold text-muted-foreground active:scale-95 transition-all bg-transparent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingSubcontractor}
                  className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-xs font-semibold active:scale-95 transition-all disabled:opacity-50"
                >
                  {addingSubcontractor ? 'Saving...' : 'Add Subcontractor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddLeadModal && (
        <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card rounded-2xl border border-border/50 shadow-xl overflow-hidden flex flex-col p-5 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">Add New Lead</h3>
              <button
                type="button"
                onClick={() => setShowAddLeadModal(false)}
                className="text-muted-foreground hover:text-foreground active:scale-95 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Error Message if any */}
            {addLeadError && (
              <div className="mb-3 text-[11px] font-semibold text-rose-500 bg-rose-500/5 border border-rose-500/10 p-2.5 rounded-xl">
                {addLeadError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleAddLeadSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Lead Contact Name *</label>
                <input
                  type="text"
                  required
                  value={newLeadContactName}
                  onChange={(e) => setNewLeadContactName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 h-10 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Company Name</label>
                <input
                  type="text"
                  value={newLeadCompanyName}
                  onChange={(e) => setNewLeadCompanyName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="w-full px-3 h-10 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Phone Number</label>
                <input
                  type="tel"
                  value={newLeadPhone}
                  onChange={(e) => setNewLeadPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full px-3 h-10 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Email Address</label>
                <input
                  type="email"
                  value={newLeadEmail}
                  onChange={(e) => setNewLeadEmail(e.target.value)}
                  placeholder="e.g. email@company.com"
                  className="w-full px-3 h-10 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">City</label>
                <input
                  type="text"
                  value={newLeadCity}
                  onChange={(e) => setNewLeadCity(e.target.value)}
                  placeholder="e.g. Mumbai"
                  className="w-full px-3 h-10 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-border/30 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddLeadModal(false)}
                  className="flex-1 h-10 rounded-xl border border-border text-xs font-semibold text-muted-foreground active:scale-95 transition-all bg-transparent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingLead}
                  className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-xs font-semibold active:scale-95 transition-all disabled:opacity-50"
                >
                  {addingLead ? 'Saving...' : 'Add Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
