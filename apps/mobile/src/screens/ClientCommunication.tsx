import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  MessageSquare, Plus, Search, Filter, Calendar, Phone, 
  Mail, Users, ArrowLeft, Loader2, 
  X, AlertCircle, Sparkles, Edit,
  Clock, CheckCircle2, AlertTriangle, Zap, Check
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
  assigned_to?: string | null;
  client_id?: string | null;
  vendor_id?: string | null;
  subcontractor_id?: string | null;
  lead_id?: string | null;
  client?: { client_name: string };
  vendor?: { company_name: string };
  subcontractor?: { company_name: string };
  lead?: { company_name: string; contact_name: string };
  // Action Intent & Workflows
  action_intent?: string | null;
  requested_discount_percent?: number | null;
  requested_discount_amount?: number | null;
  target_quotation_id?: string | null;
  variation_type?: string | null;
  estimated_variation_cost?: number | null;
  escalation_type?: string | null;
  escalation_severity?: string | null;
  md_intervention_notes?: string | null;
  manpower_count?: number | null;
  manpower_trade?: string | null;
  requested_date?: string | null;
  required_approver_role?: string | null;
  approval_status?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  approval_notes?: string | null;
  needs_discussion?: boolean | null;
  discussion_notes?: string | null;
  rolled_over_at?: string | null;
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
  { value: 'operational_feedback', label: 'Operational Feedback' },
  { value: 'site_visit', label: 'Site Visit' },
  { value: 'approval', label: 'Approval' },
  { value: 'payment', label: 'Payment' },
  { value: 'general', label: 'General Inquiry' },
  { value: 'other', label: 'Other' },
];

const PRIORITY_PICKER_OPTIONS = [
  { id: 'low', name: 'Low' },
  { id: 'normal', name: 'Normal' },
  { id: 'high', name: 'High' },
  { id: 'urgent', name: 'Urgent' },
];

const STATUS_PICKER_OPTIONS = [
  { id: 'open', name: 'Open' },
  { id: 'in_progress', name: 'In Progress' },
  { id: 'awaiting_decision', name: 'Awaiting Decision' },
  { id: 'resolved', name: 'Resolved' },
  { id: 'closed', name: 'Closed' },
];

const PARTY_TYPES = [
  { id: '', name: 'All Party Types' },
  { id: 'client', name: 'Client' },
  { id: 'vendor', name: 'Vendor' },
  { id: 'lead', name: 'Lead' },
  { id: 'subcontractor', name: 'Subcontractor' },
];

const ACTION_INTENTS = [
  { id: 'general', name: 'General Call' },
  { id: 'discount_request', name: 'Quotation Discount' },
  { id: 'variation_request', name: 'Scope Variation (VO)' },
  { id: 'md_escalation', name: 'MD Escalation / Dispute' },
  { id: 'site_visit', name: 'Site Visit / Inspection' },
  { id: 'site_measurement', name: 'Site Measurement' },
  { id: 'manpower_request', name: 'Manpower Supply' },
];

const APPROVER_ROLES = [
  { id: 'MD', name: 'Managing Director (MD)' },
  { id: 'project_manager', name: 'Project Manager' },
  { id: 'estimation_head', name: 'Estimation Head' },
  { id: 'department_head', name: 'Department Head' },
];

const MANPOWER_TRADES = [
  { id: 'Electrician', name: 'Electrician' },
  { id: 'Plumber', name: 'Plumber' },
  { id: 'HVAC Technician', name: 'HVAC Technician' },
  { id: 'Welder', name: 'Welder' },
  { id: 'Ductman', name: 'Ductman' },
  { id: 'Pipe Fitter', name: 'Pipe Fitter' },
  { id: 'Cable Jointer', name: 'Cable Jointer' },
  { id: 'Site Supervisor', name: 'Site Supervisor' },
  { id: 'General Labor', name: 'General Labor' },
];

const ESCALATION_CATEGORIES = [
  { id: 'tool_retention', name: 'Tool Demobilization Blocked' },
  { id: 'payment_dispute', name: 'Severe Payment Delay' },
  { id: 'scope_dispute', name: 'Major Scope Disagreement' },
  { id: 'shutdown_conflict', name: 'Shutdown Schedule Clash' },
  { id: 'other', name: 'Other Executive Intervention' },
];

export const ClientCommunication: React.FC<ClientCommunicationProps> = ({ isDemo = false }) => {
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'list' | 'create'>('list');
  const [orgId, setOrgId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Data State
  const [comms, setComms] = useState<CommItem[]>([]);
  const [selectedComm, setSelectedComm] = useState<CommItem | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'needs_attention' | 'approvals' | 'discussions' | 'site_ops'>('all');
  const [userRole, setUserRole] = useState<string>('site_engineer');
  const [clientQuotations, setClientQuotations] = useState<{ id: string; name: string }[]>([]);
  
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
  const [usersList, setUsersList] = useState<{ id: string; name: string }[]>([]);
  const [formReceivedBy, setFormReceivedBy] = useState('');
  const [formAssignedTo, setFormAssignedTo] = useState('');
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
  // Action Intent & Workflows
  const [formActionIntent, setFormActionIntent] = useState('general');
  const [formDiscountPercent, setFormDiscountPercent] = useState('');
  const [formDiscountAmount, setFormDiscountAmount] = useState('');
  const [formTargetQuotationId, setFormTargetQuotationId] = useState('');
  const [formVariationType, setFormVariationType] = useState('chargeable_vo');
  const [formEstimatedVariationCost, setFormEstimatedVariationCost] = useState('');
  const [formEscalationType, setFormEscalationType] = useState('tool_retention');
  const [formEscalationSeverity, setFormEscalationSeverity] = useState('high');
  const [formMdInterventionNotes, setFormMdInterventionNotes] = useState('');
  const [formManpowerCount, setFormManpowerCount] = useState('');
  const [formManpowerTrade, setFormManpowerTrade] = useState('Electrician');
  const [formRequestedDate, setFormRequestedDate] = useState('');
  const [formRequireApproval, setFormRequireApproval] = useState(false);
  const [formApproverRole, setFormApproverRole] = useState('MD');
  const [formNeedsDiscussion, setFormNeedsDiscussion] = useState(false);
  const [formDiscussionNotes, setFormDiscussionNotes] = useState('');
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
      call_received_by: 'demo-user-id',
      action_intent: 'discount_request',
      requested_discount_percent: 5,
      approval_status: 'pending',
      required_approver_role: 'MD',
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
      call_received_by: 'demo-user-id',
      action_intent: 'md_escalation',
      escalation_type: 'shutdown_conflict',
      escalation_severity: 'high',
      needs_discussion: true,
      discussion_notes: 'Confirm if site casting can be postponed in morning standup',
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
      call_received_by: 'demo-user-id',
      action_intent: 'site_measurement',
      requested_date: new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString().split('T')[0],
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
  const demoQuotations = [
    { id: 'demo-q1', name: 'QT-2026-001 (SAR 250,000)' },
    { id: 'demo-q2', name: 'QT-2026-002 (SAR 48,000)' }
  ];

  useEffect(() => {
    if (isDemo) {
      setClients(demoClients);
      setVendors(demoVendors);
      setSubcontractors(demoSubcontractors);
      setLeads(demoLeads);
      setClientQuotations(demoQuotations);
      setUserRole('MD');
      setComms(demoComms);
      setUserProfilesMap({ 'demo-user-id': 'Demo User' });
      setUsersList([{ id: 'demo-user-id', name: 'Demo User' }]);
      setFormReceivedBy('demo-user-id');
      setFormAssignedTo('demo-user-id');
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
        .select('organisation_id, role')
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
      if (memberData?.role) {
        setUserRole(memberData.role);
      }

      // Load form selector data & user profiles
      const [clientsRes, vendorsRes, subRes, leadsRes, employeesRes, quotationsRes] = await Promise.all([
        supabase.from('clients').select('id, client_name').eq('organisation_id', userOrgId).order('client_name'),
        supabase.from('purchase_vendors').select('id, company_name').eq('organisation_id', userOrgId).order('company_name'),
        supabase.from('subcontractors').select('id, company_name').eq('organisation_id', userOrgId).order('company_name'),
        supabase.from('leads').select('id, company_name, contact_name').eq('organisation_id', userOrgId).order('company_name'),
        supabase.from('employees').select('id, name').eq('organisation_id', userOrgId),
        supabase.from('quotation_header').select('id, quotation_number, total_amount').eq('organisation_id', userOrgId).order('created_at', { ascending: false }).limit(25)
      ]);

      const profileMap: Record<string, string> = {};
      const uList: { id: string; name: string }[] = [];
      if (employeesRes.data) {
        employeesRes.data.forEach((p: any) => {
          const uId = p.id;
          if (uId) {
            profileMap[uId] = p.name || 'System User';
            uList.push({ id: uId, name: p.name || 'System User' });
          }
        });
      }
      setUserProfilesMap(profileMap);
      setUsersList(uList.sort((a, b) => a.name.localeCompare(b.name)));
      setFormReceivedBy(user.id);
      setFormAssignedTo(user.id);

      setClients(clientsRes.data?.map(c => ({ id: c.id, name: c.client_name })) || []);
      setVendors(vendorsRes.data?.map(v => ({ id: v.id, name: v.company_name })) || []);
      setSubcontractors(subRes.data?.map(s => ({ id: s.id, name: s.company_name })) || []);
      setLeads(leadsRes.data?.map(l => ({ id: l.id, name: l.company_name ? `${l.company_name} (${l.contact_name})` : l.contact_name })) || []);
      setClientQuotations(quotationsRes.data?.map(q => ({ id: q.id, name: `${q.quotation_number} (SAR ${Number(q.total_amount || 0).toLocaleString()})` })) || []);

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
      status: formStatus === 'open' ? 'Open' : formStatus === 'in_progress' ? 'In Progress' : formStatus === 'awaiting_decision' ? 'Awaiting Decision' : formStatus === 'resolved' ? 'Resolved' : 'Closed',
      is_resolved: formStatus === 'resolved' || formStatus === 'closed',
      client_id: formPartyType === 'client' ? formPartyId : null,
      vendor_id: formPartyType === 'vendor' ? formPartyId : null,
      subcontractor_id: formPartyType === 'subcontractor' ? formPartyId : null,
      lead_id: formPartyType === 'lead' ? formPartyId : null,
      assigned_to: formAssignedTo || null,
      call_received_by: formReceivedBy || null,
      call_entered_by: userId,
      // Operational Intent & Workflow
      action_intent: formActionIntent || 'general',
      requested_discount_percent: formDiscountPercent ? Number(formDiscountPercent) : null,
      requested_discount_amount: formDiscountAmount ? Number(formDiscountAmount) : null,
      target_quotation_id: formTargetQuotationId || null,
      variation_type: formActionIntent === 'variation_request' ? formVariationType : null,
      estimated_variation_cost: formEstimatedVariationCost ? Number(formEstimatedVariationCost) : null,
      escalation_type: formActionIntent === 'md_escalation' ? formEscalationType : null,
      escalation_severity: formActionIntent === 'md_escalation' ? formEscalationSeverity : 'normal',
      md_intervention_notes: formMdInterventionNotes || null,
      manpower_count: formManpowerCount ? parseInt(formManpowerCount) : null,
      manpower_trade: formActionIntent === 'manpower_request' ? formManpowerTrade : null,
      requested_date: formRequestedDate || null,
      required_approver_role: formRequireApproval ? formApproverRole : null,
      approval_status: formRequireApproval ? 'pending' : 'not_required',
      needs_discussion: !!formNeedsDiscussion,
      discussion_notes: formDiscussionNotes || null,
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

      if ((formActionIntent === 'site_visit' || formActionIntent === 'site_measurement') && formRequestedDate) {
        try {
          await supabase.from('site_visits').insert({
            client_id: formPartyType === 'client' ? formPartyId : null,
            visit_date: formRequestedDate,
            visit_type: formActionIntent === 'site_measurement' ? 'measurement' : 'inspection',
            purpose_of_visit: `[${formActionIntent === 'site_measurement' ? 'Measurement' : 'Site Visit'}] ${formSubject || (formBrief || '').slice(0, 150)}`,
            organisation_id: orgId,
            status: 'scheduled',
            created_at: new Date().toISOString(),
          });
        } catch (e) {
          console.warn('Auto site-visit creation skipped on mobile:', e);
        }
      }
      
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
          contact: newPhone,
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
    setFormReceivedBy(userId || '');
    setFormAssignedTo(userId || '');
    setEditingCommId(null);
    setFormActionIntent('general');
    setFormDiscountPercent('');
    setFormDiscountAmount('');
    setFormTargetQuotationId('');
    setFormVariationType('chargeable_vo');
    setFormEstimatedVariationCost('');
    setFormEscalationType('tool_retention');
    setFormEscalationSeverity('high');
    setFormMdInterventionNotes('');
    setFormManpowerCount('');
    setFormManpowerTrade('Electrician');
    setFormRequestedDate('');
    setFormRequireApproval(false);
    setFormApproverRole('MD');
    setFormNeedsDiscussion(false);
    setFormDiscussionNotes('');
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
      (item.status || '').toLowerCase() === 'awaiting decision' || (item.status || '').toLowerCase() === 'awaiting_decision' ? 'awaiting_decision' :
      (item.status || '').toLowerCase() === 'resolved' ? 'resolved' :
      (item.status || '').toLowerCase() === 'closed' ? 'closed' : 'open'
    );
    setFormReceivedBy(item.call_received_by || '');
    setFormAssignedTo(item.assigned_to || '');
    setFormActionIntent(item.action_intent || 'general');
    setFormDiscountPercent(item.requested_discount_percent !== null && item.requested_discount_percent !== undefined ? String(item.requested_discount_percent) : '');
    setFormDiscountAmount(item.requested_discount_amount !== null && item.requested_discount_amount !== undefined ? String(item.requested_discount_amount) : '');
    setFormTargetQuotationId(item.target_quotation_id || '');
    setFormVariationType(item.variation_type || 'chargeable_vo');
    setFormEstimatedVariationCost(item.estimated_variation_cost !== null && item.estimated_variation_cost !== undefined ? String(item.estimated_variation_cost) : '');
    setFormEscalationType(item.escalation_type || 'tool_retention');
    setFormEscalationSeverity(item.escalation_severity || 'high');
    setFormMdInterventionNotes(item.md_intervention_notes || '');
    setFormManpowerCount(item.manpower_count !== null && item.manpower_count !== undefined ? String(item.manpower_count) : '');
    setFormManpowerTrade(item.manpower_trade || 'Electrician');
    setFormRequestedDate(item.requested_date || '');
    setFormRequireApproval(Boolean(item.approval_status === 'pending' || (item.approval_status && item.approval_status !== 'not_required')));
    setFormApproverRole(item.required_approver_role || 'MD');
    setFormNeedsDiscussion(!!item.needs_discussion);
    setFormDiscussionNotes(item.discussion_notes || '');
    setSelectedComm(null);
    setActiveView('create');
  };

  const handleQuickAction = async (id: string, action: 'approve' | 'reject' | 'mark_discussed') => {
    try {
      if (isDemo) {
        setDemoComms(prev => prev.map(c => {
          if (c.id !== id) return c;
          if (action === 'approve') return { ...c, approval_status: 'approved' };
          if (action === 'reject') return { ...c, approval_status: 'rejected' };
          if (action === 'mark_discussed') return { ...c, needs_discussion: false };
          return c;
        }));
        return;
      }

      let updateData: any = {};
      if (action === 'approve') {
        updateData = { approval_status: 'approved', approved_at: new Date().toISOString(), approved_by: userId };
      } else if (action === 'reject') {
        updateData = { approval_status: 'rejected', approved_at: new Date().toISOString(), approved_by: userId };
      } else if (action === 'mark_discussed') {
        updateData = { needs_discussion: false };
      }

      const { error: err } = await supabase
        .from('client_communication')
        .update(updateData)
        .eq('id', id);

      if (err) throw err;

      setComms(prev => prev.map(c => c.id === id ? { ...c, ...updateData } : c));
      if (selectedComm && selectedComm.id === id) {
        setSelectedComm(prev => prev ? { ...prev, ...updateData } : null);
      }
    } catch (err: any) {
      console.error('Quick action error:', err);
      alert('Action failed: ' + (err?.message || 'Unknown error'));
    }
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

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const summaryStats = useMemo(() => {
    let todayCount = 0;
    let pendingApprovalCount = 0;
    let needsDiscussionCount = 0;
    let rolloverAlertCount = 0;

    comms.forEach(c => {
      const isToday = c.created_at && c.created_at.startsWith(todayStr);
      if (isToday) todayCount++;

      const isPendingApproval = c.approval_status === 'pending';
      if (isPendingApproval) pendingApprovalCount++;

      const isNeedsDiscussion = !!c.needs_discussion;
      if (isNeedsDiscussion) needsDiscussionCount++;

      const isResolved = c.status === 'Resolved' || c.status === 'Closed' || c.status === 'resolved' || c.status === 'closed';
      const isOlderThanToday = c.created_at && c.created_at.slice(0, 10) < todayStr;
      const isRolledOver = isOlderThanToday && (!isResolved || isPendingApproval || isNeedsDiscussion || (c.follow_up_date && c.follow_up_date <= todayStr));
      if (isRolledOver) rolloverAlertCount++;
    });

    return { todayCount, pendingApprovalCount, needsDiscussionCount, rolloverAlertCount };
  }, [comms, todayStr]);

  const tabFilteredComms = useMemo(() => {
    return filteredComms.filter(c => {
      if (activeTab === 'all') return true;
      if (activeTab === 'approvals') return c.approval_status === 'pending';
      if (activeTab === 'discussions') return !!c.needs_discussion;
      if (activeTab === 'site_ops') return c.action_intent === 'site_visit' || c.action_intent === 'site_measurement' || c.action_intent === 'manpower_request';
      if (activeTab === 'needs_attention') {
        const isResolved = c.status === 'Resolved' || c.status === 'Closed' || c.status === 'resolved' || c.status === 'closed';
        const isOlderThanToday = c.created_at && c.created_at.slice(0, 10) < todayStr;
        return isOlderThanToday && (!isResolved || c.approval_status === 'pending' || !!c.needs_discussion || (c.follow_up_date && c.follow_up_date <= todayStr));
      }
      return true;
    });
  }, [filteredComms, activeTab, todayStr]);

  const isAuthorizedApprover = useMemo(() => {
    const r = (userRole || '').toLowerCase();
    return r === 'md' || r === 'managing_director' || r === 'admin' || r === 'administrator' || r === 'project_manager' || isDemo;
  }, [userRole, isDemo]);

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
            {/* Executive KPI Summary Cards */}
            <div className="grid grid-cols-2 gap-2">
              <div
                onClick={() => setActiveTab('all')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                  activeTab === 'all' ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'glass-card'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Today's Logs</span>
                  <Phone className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="text-xl font-bold text-foreground mt-1 text-left">{summaryStats.todayCount}</div>
              </div>

              <div
                onClick={() => setActiveTab('approvals')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                  activeTab === 'approvals' ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30' : 'glass-card'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-600 uppercase">Approvals</span>
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                </div>
                <div className="text-xl font-bold text-amber-600 mt-1 text-left">{summaryStats.pendingApprovalCount}</div>
              </div>

              <div
                onClick={() => setActiveTab('discussions')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                  activeTab === 'discussions' ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30' : 'glass-card'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-blue-600 uppercase">Discussions</span>
                  <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                </div>
                <div className="text-xl font-bold text-blue-600 mt-1 text-left">{summaryStats.needsDiscussionCount}</div>
              </div>

              <div
                onClick={() => setActiveTab('needs_attention')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                  activeTab === 'needs_attention' ? 'border-destructive bg-destructive/10 ring-1 ring-destructive/30' : 'glass-card'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-destructive uppercase">Rollover Alerts</span>
                  <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                </div>
                <div className="text-xl font-bold text-destructive mt-1 text-left">{summaryStats.rolloverAlertCount}</div>
              </div>
            </div>

            {/* Workflow Navigation Pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {[
                { id: 'all', label: 'All Logs', count: comms.length },
                { id: 'needs_attention', label: 'Rollover Alerts', count: summaryStats.rolloverAlertCount, isAlert: summaryStats.rolloverAlertCount > 0 },
                { id: 'approvals', label: 'Approvals', count: summaryStats.pendingApprovalCount },
                { id: 'discussions', label: 'Discussions', count: summaryStats.needsDiscussionCount },
                { id: 'site_ops', label: 'Site Ops', count: comms.filter(c => c.action_intent === 'site_visit' || c.action_intent === 'site_measurement' || c.action_intent === 'manpower_request').length },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    activeTab === tab.id
                      ? tab.isAlert ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/80 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-card text-foreground'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

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
            ) : tabFilteredComms.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                <p className="text-xs font-semibold text-muted-foreground">No communication logs found</p>
                <p className="text-[10px] text-muted-foreground/75">
                  {activeTab === 'needs_attention' ? 'Zero overnight rollover alerts! All clear.' : 'Try switching tabs or log a new call.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {tabFilteredComms.map((item) => (
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
                            <h4 className="text-sm font-bold text-foreground truncate max-w-[160px]">
                              {getPartyDisplayName(item)}
                            </h4>
                            <span className="text-[11px] font-medium text-muted-foreground shrink-0">
                              {formatDate(item.created_at, true)}
                            </span>
                          </div>
                          <p className="text-[10px] font-medium text-muted-foreground mt-0.5">
                            Entered by: {userProfilesMap[item.call_entered_by] || 'System'} • Received by: {userProfilesMap[item.call_received_by] || 'System'}
                          </p>
                          <p className="text-[10px] font-semibold uppercase text-muted-foreground/70 mt-0.5">
                            {item.party_type} • {item.call_regarding}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        item.priority === 'urgent' ? 'bg-red-500/10 text-red-500' :
                        item.priority === 'high' ? 'bg-orange-500/10 text-orange-500' :
                        item.priority === 'normal' ? 'bg-blue-500/10 text-blue-500' :
                        'bg-slate-500/10 text-slate-500'
                      }`}>
                        {item.priority}
                      </span>
                    </div>

                    {/* Operational Intent & Approval Badges */}
                    <div className="flex flex-wrap gap-1 items-center pt-1">
                      {item.action_intent && item.action_intent !== 'general' && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          item.action_intent === 'md_escalation' ? 'bg-red-500/10 text-red-600 border border-red-500/20' :
                          item.action_intent === 'discount_request' ? 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20' :
                          item.action_intent === 'variation_request' ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' :
                          item.action_intent === 'manpower_request' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
                          'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                        }`}>
                          <Zap className="h-3 w-3" />
                          <span>{ACTION_INTENTS.find(i => i.id === item.action_intent)?.name || item.action_intent}</span>
                        </span>
                      )}

                      {item.created_at && item.created_at.slice(0, 10) < todayStr && (item.approval_status === 'pending' || item.needs_discussion || !['Resolved', 'Closed', 'resolved', 'closed'].includes(item.status)) && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>Rollover Alert</span>
                        </span>
                      )}

                      {item.approval_status === 'pending' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>Pending {item.required_approver_role || 'MD'}</span>
                        </span>
                      )}
                      {item.approval_status === 'approved' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Approved</span>
                        </span>
                      )}
                      {item.approval_status === 'rejected' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 flex items-center gap-1">
                          <X className="h-3 w-3" />
                          <span>Rejected</span>
                        </span>
                      )}

                      {item.needs_discussion && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/20 flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          <span>Needs Discussion</span>
                        </span>
                      )}
                    </div>

                    {/* Operational Details Preview */}
                    {item.action_intent === 'discount_request' && (item.requested_discount_percent || item.requested_discount_amount) && (
                      <div className="text-left text-xs bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 text-indigo-900 font-medium">
                        Requested Discount: <span className="font-bold">{item.requested_discount_percent ? `${item.requested_discount_percent}%` : ''}</span>
                        {item.requested_discount_amount && <span className="ml-1">(SAR <strong className="font-bold">{Number(item.requested_discount_amount).toLocaleString()}</strong>)</span>}
                      </div>
                    )}

                    {item.action_intent === 'variation_request' && (
                      <div className="text-left text-xs bg-blue-50/50 p-2 rounded-lg border border-blue-100 text-blue-900 font-medium">
                        Variation: <span className="font-bold">{item.variation_type === 'chargeable_vo' ? 'Billable VO' : 'Goodwill / FOC'}</span>
                        {item.estimated_variation_cost && <span className="ml-1">— Est: SAR <strong className="font-bold">{Number(item.estimated_variation_cost).toLocaleString()}</strong></span>}
                      </div>
                    )}

                    {item.action_intent === 'md_escalation' && (
                      <div className="text-left text-xs bg-red-50/50 p-2 rounded-lg border border-red-100 text-red-900 font-medium">
                        Escalation: <span className="font-bold">{ESCALATION_CATEGORIES.find(c => c.id === item.escalation_type)?.name || item.escalation_type?.replace(/_/g, ' ')}</span>
                        {item.md_intervention_notes && <p className="text-[11px] text-red-700 italic mt-0.5 line-clamp-1">"{item.md_intervention_notes}"</p>}
                      </div>
                    )}

                    {(item.action_intent === 'site_visit' || item.action_intent === 'site_measurement') && item.requested_date && (
                      <div className="text-left text-xs bg-emerald-50/50 p-2 rounded-lg border border-emerald-100 text-emerald-900 font-medium flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>Target Date: <strong className="font-bold">{formatDate(item.requested_date, true)}</strong></span>
                      </div>
                    )}

                    {item.action_intent === 'manpower_request' && item.manpower_count && (
                      <div className="text-left text-xs bg-amber-50/50 p-2 rounded-lg border border-amber-100 text-amber-900 font-medium flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <span>Allocation: <strong className="font-bold">{item.manpower_count} × {item.manpower_trade || 'Workers'}</strong> {item.requested_date ? `by ${formatDate(item.requested_date, true)}` : ''}</span>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase mr-1">About:</span>
                        <span className="text-sm font-semibold text-foreground">{item.subject}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase mr-1">Additional Notes:</span>
                        <span className="text-xs text-muted-foreground/90 line-clamp-2 leading-relaxed">{item.call_brief}</span>
                      </div>
                    </div>

                    {item.follow_up_date && (
                      <div className="flex justify-between items-center pt-2 border-t border-border/20 text-[10px] text-muted-foreground font-semibold">
                        <div className="flex items-center gap-1 bg-amber-500/5 text-amber-600 px-1.5 py-0.5 rounded border border-amber-500/10">
                          <Calendar className="h-3 w-3" />
                          <span>Follow up: {formatDate(item.follow_up_date, true)}</span>
                        </div>
                      </div>
                    )}

                    {/* Inline Approval & Discussion Actions */}
                    {(item.approval_status === 'pending' || item.needs_discussion) && isAuthorizedApprover && (
                      <div className="flex gap-2 pt-2 border-t border-border/20 items-center justify-end" onClick={e => e.stopPropagation()}>
                        {item.approval_status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleQuickAction(item.id, 'approve')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px] active:scale-95 transition-all flex items-center gap-1"
                            >
                              <Check className="h-3 w-3" />
                              <span>Approve</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickAction(item.id, 'reject')}
                              className="px-2.5 py-1 rounded-lg bg-destructive text-destructive-foreground font-bold text-[10px] active:scale-95 transition-all flex items-center gap-1"
                            >
                              <X className="h-3 w-3" />
                              <span>Reject</span>
                            </button>
                          </>
                        )}
                        {item.needs_discussion && (
                          <button
                            type="button"
                            onClick={() => handleQuickAction(item.id, 'mark_discussed')}
                            className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-bold text-[10px] active:scale-95 transition-all flex items-center gap-1"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Discussed</span>
                          </button>
                        )}
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
              <label className="text-xs font-semibold text-muted-foreground">About</label>
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
                <BottomSheetPicker
                  label="Select Category"
                  options={CATEGORIES.map(c => ({ id: c.value, name: c.label }))}
                  value={formCategory}
                  onChange={(val) => setFormCategory(val)}
                  placeholder="Select Category"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Regarding Topic</label>
                <BottomSheetPicker
                  label="Select Regarding Topic"
                  options={TOPICS.map(t => ({ id: t.value, name: t.label }))}
                  value={formRegarding}
                  onChange={(val) => setFormRegarding(val)}
                  placeholder="Select Topic"
                />
              </div>
            </div>

            {/* Priority & Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Priority</label>
                <BottomSheetPicker
                  label="Select Priority"
                  options={PRIORITY_PICKER_OPTIONS}
                  value={formPriority}
                  onChange={(val) => setFormPriority(val)}
                  placeholder="Select Priority"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Status</label>
                <BottomSheetPicker
                  label="Select Status"
                  options={STATUS_PICKER_OPTIONS}
                  value={formStatus}
                  onChange={(val) => setFormStatus(val)}
                  placeholder="Select Status"
                />
              </div>
            </div>

            {/* Operational Intent & MEP Workflows */}
            <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Operational Intent & Workflows
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  MEP Action
                </span>
              </div>

              {/* Action Intent chips */}
              <div className="flex flex-wrap gap-1.5">
                {ACTION_INTENTS.map((intent) => {
                  const active = formActionIntent === intent.id;
                  return (
                    <button
                      key={intent.id}
                      type="button"
                      onClick={() => {
                        setFormActionIntent(intent.id);
                        if (intent.id === 'discount_request' || intent.id === 'md_escalation') {
                          setFormRequireApproval(true);
                          setFormApproverRole('MD');
                        } else if (intent.id === 'variation_request') {
                          setFormRequireApproval(true);
                          setFormApproverRole('project_manager');
                        }
                      }}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all active:scale-95 ${
                        active
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-card text-foreground border border-border/40 hover:border-primary/30'
                      }`}
                    >
                      {intent.name}
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Intent sub-panels */}
              {formActionIntent === 'discount_request' && (
                <div className="p-3 rounded-xl bg-card border border-border/50 space-y-2.5">
                  <span className="text-[10px] font-bold text-primary uppercase">Discount Request Details</span>
                  {clientQuotations.length > 0 && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">Target Quotation</label>
                      <BottomSheetPicker
                        label="Select Quotation"
                        options={clientQuotations}
                        value={formTargetQuotationId}
                        onChange={(val) => setFormTargetQuotationId(val)}
                        placeholder="-- Choose Quotation --"
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">Requested %</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={formDiscountPercent}
                        onChange={(e) => setFormDiscountPercent(e.target.value)}
                        placeholder="e.g. 5"
                        className="w-full px-3 h-10 rounded-xl border border-input bg-card text-xs focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">Discount Amount (SAR)</label>
                      <input
                        type="number"
                        min="0"
                        value={formDiscountAmount}
                        onChange={(e) => setFormDiscountAmount(e.target.value)}
                        placeholder="e.g. 15000"
                        className="w-full px-3 h-10 rounded-xl border border-input bg-card text-xs focus:outline-none text-left"
                      />
                    </div>
                  </div>
                </div>
              )}

              {formActionIntent === 'variation_request' && (
                <div className="p-3 rounded-xl bg-card border border-border/50 space-y-2.5">
                  <span className="text-[10px] font-bold text-primary uppercase">Scope Variation (VO)</span>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">Commercial Treatment</label>
                    <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted/60 border border-border/30">
                      <button
                        type="button"
                        onClick={() => setFormVariationType('chargeable_vo')}
                        className={`py-1 rounded-lg text-[10px] font-bold ${
                          formVariationType === 'chargeable_vo' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                        }`}
                      >
                        Billable VO
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormVariationType('goodwill_foc')}
                        className={`py-1 rounded-lg text-[10px] font-bold ${
                          formVariationType === 'goodwill_foc' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                        }`}
                      >
                        Goodwill / FOC
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">Estimated Cost (SAR)</label>
                    <input
                      type="number"
                      min="0"
                      value={formEstimatedVariationCost}
                      onChange={(e) => setFormEstimatedVariationCost(e.target.value)}
                      placeholder="e.g. 8000"
                      className="w-full px-3 h-10 rounded-xl border border-input bg-card text-xs focus:outline-none text-left"
                    />
                  </div>
                </div>
              )}

              {formActionIntent === 'md_escalation' && (
                <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20 space-y-2.5">
                  <span className="text-[10px] font-bold text-destructive uppercase flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> High-Level Dispute / MD Intervention
                  </span>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-destructive">Dispute Category</label>
                    <BottomSheetPicker
                      label="Select Escalation Category"
                      options={ESCALATION_CATEGORIES}
                      value={formEscalationType}
                      onChange={(val) => setFormEscalationType(val)}
                      placeholder="Select Category"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-destructive">Executive Brief for MD</label>
                    <textarea
                      value={formMdInterventionNotes}
                      onChange={(e) => setFormMdInterventionNotes(e.target.value)}
                      placeholder="What decision or intervention is required from MD?"
                      rows={2}
                      className="w-full p-2.5 rounded-xl border border-destructive/20 bg-card text-xs focus:outline-none resize-none"
                    />
                  </div>
                </div>
              )}

              {(formActionIntent === 'site_visit' || formActionIntent === 'site_measurement') && (
                <div className="p-3 rounded-xl bg-card border border-border/50 space-y-2.5">
                  <span className="text-[10px] font-bold text-primary uppercase">
                    {formActionIntent === 'site_measurement' ? 'Site Measurement Target' : 'Site Visit Target'}
                  </span>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">Requested Target Date</label>
                    <input
                      type="date"
                      value={formRequestedDate}
                      onChange={(e) => {
                        setFormRequestedDate(e.target.value);
                        if (!formFollowUp) setFormFollowUp(e.target.value);
                      }}
                      className="w-full px-3 h-10 rounded-xl border border-input bg-card text-xs focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {formActionIntent === 'manpower_request' && (
                <div className="p-3 rounded-xl bg-card border border-border/50 space-y-2.5">
                  <span className="text-[10px] font-bold text-primary uppercase">Site Manpower Supply</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">Workers Headcount</label>
                      <input
                        type="number"
                        min="1"
                        value={formManpowerCount}
                        onChange={(e) => setFormManpowerCount(e.target.value)}
                        placeholder="e.g. 4"
                        className="w-full px-3 h-10 rounded-xl border border-input bg-card text-xs focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">Trade</label>
                      <BottomSheetPicker
                        label="Select Trade"
                        options={MANPOWER_TRADES}
                        value={formManpowerTrade}
                        onChange={(val) => setFormManpowerTrade(val)}
                        placeholder="Select Trade"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">Deployment Date</label>
                    <input
                      type="date"
                      value={formRequestedDate}
                      onChange={(e) => setFormRequestedDate(e.target.value)}
                      className="w-full px-3 h-10 rounded-xl border border-input bg-card text-xs focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Approval Routing & Morning Discussion */}
              <div className="pt-2 border-t border-border/40 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formRequireApproval}
                    onChange={(e) => setFormRequireApproval(e.target.checked)}
                    className="h-4 w-4 rounded accent-primary"
                  />
                  <span className="text-xs font-semibold text-foreground">Route for Executive / Manager Approval</span>
                </label>

                {formRequireApproval && (
                  <div className="pl-6 space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Designated Approver</label>
                    <BottomSheetPicker
                      label="Select Approver Role"
                      options={APPROVER_ROLES}
                      value={formApproverRole}
                      onChange={(val) => setFormApproverRole(val)}
                      placeholder="Select Approver"
                    />
                  </div>
                )}

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={formNeedsDiscussion}
                    onChange={(e) => setFormNeedsDiscussion(e.target.checked)}
                    className="h-4 w-4 rounded accent-amber-500"
                  />
                  <span className="text-xs font-semibold text-foreground">Flag for Morning Standup / MD Discussion</span>
                </label>

                {formNeedsDiscussion && (
                  <div className="pl-6 space-y-1">
                    <input
                      type="text"
                      value={formDiscussionNotes}
                      onChange={(e) => setFormDiscussionNotes(e.target.value)}
                      placeholder="Talking points for MD or morning standup..."
                      className="w-full px-3 h-9 rounded-xl border border-input bg-card text-xs focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Received By & Assigned To */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Received By</label>
                <BottomSheetPicker
                  label="Select Received By"
                  options={usersList}
                  value={formReceivedBy}
                  onChange={(val) => setFormReceivedBy(val)}
                  placeholder="Select User"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Assigned To</label>
                <BottomSheetPicker
                  label="Select Assigned To"
                  options={usersList}
                  value={formAssignedTo}
                  onChange={(val) => setFormAssignedTo(val)}
                  placeholder="Select User"
                />
              </div>
            </div>

            {/* Brief Summary */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Additional Notes</label>
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
                  <h3 className="text-sm font-bold text-foreground">{getPartyDisplayName(selectedComm)}</h3>
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground/75">{selectedComm.party_type} • {selectedComm.call_regarding}</p>
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
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">About</span>
                <p className="text-sm font-bold text-foreground leading-relaxed">{selectedComm.subject}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Discussion Notes</span>
                <div className="p-3 rounded-lg bg-muted/40 border border-border/20 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {selectedComm.call_brief}
                </div>
              </div>

              {selectedComm.next_action && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Next Action / Next plan</span>
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span>{selectedComm.next_action}</span>
                  </div>
                </div>
              )}

              {/* Operational Workflow Card in Modal */}
              {(selectedComm.action_intent !== 'general' || selectedComm.approval_status === 'pending' || selectedComm.needs_discussion) && (
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-primary uppercase flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      Workflow: {ACTION_INTENTS.find(i => i.id === selectedComm.action_intent)?.name || selectedComm.action_intent}
                    </span>
                    {selectedComm.approval_status && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        selectedComm.approval_status === 'approved' ? 'bg-emerald-500/10 text-emerald-600' :
                        selectedComm.approval_status === 'rejected' ? 'bg-destructive/10 text-destructive' :
                        'bg-amber-500/10 text-amber-600'
                      }`}>
                        {selectedComm.approval_status}
                      </span>
                    )}
                  </div>

                  {selectedComm.action_intent === 'discount_request' && (
                    <div className="text-left text-xs text-foreground font-medium">
                      Requested Discount: <strong className="font-bold">{selectedComm.requested_discount_percent}%</strong>
                      {selectedComm.requested_discount_amount && <span className="ml-1">(SAR <strong className="font-bold">{Number(selectedComm.requested_discount_amount).toLocaleString()}</strong>)</span>}
                    </div>
                  )}

                  {selectedComm.action_intent === 'variation_request' && (
                    <div className="text-left text-xs text-foreground font-medium">
                      Treatment: <strong className="font-bold">{selectedComm.variation_type === 'chargeable_vo' ? 'Billable VO' : 'Goodwill / FOC'}</strong>
                      {selectedComm.estimated_variation_cost && <span className="ml-1">— SAR <strong className="font-bold">{Number(selectedComm.estimated_variation_cost).toLocaleString()}</strong></span>}
                    </div>
                  )}

                  {selectedComm.action_intent === 'md_escalation' && (
                    <div className="text-left text-xs text-destructive font-medium">
                      Escalation: <strong className="font-bold">{ESCALATION_CATEGORIES.find(c => c.id === selectedComm.escalation_type)?.name || selectedComm.escalation_type}</strong>
                      {selectedComm.md_intervention_notes && <p className="text-[11px] text-destructive/80 italic mt-0.5">"{selectedComm.md_intervention_notes}"</p>}
                    </div>
                  )}

                  {(selectedComm.action_intent === 'site_visit' || selectedComm.action_intent === 'site_measurement') && selectedComm.requested_date && (
                    <div className="text-left text-xs text-foreground font-medium">
                      Target Date: <strong className="font-bold">{formatDate(selectedComm.requested_date, true)}</strong>
                    </div>
                  )}

                  {selectedComm.action_intent === 'manpower_request' && (
                    <div className="text-left text-xs text-foreground font-medium">
                      Manpower: <strong className="font-bold">{selectedComm.manpower_count} × {selectedComm.manpower_trade}</strong>
                    </div>
                  )}

                  {selectedComm.needs_discussion && (
                    <div className="text-[11px] bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg text-amber-800">
                      <strong>Standup Discussion:</strong> {selectedComm.discussion_notes || 'Pending morning meeting.'}
                    </div>
                  )}

                  {/* Quick Action Buttons in Modal */}
                  {(selectedComm.approval_status === 'pending' || selectedComm.needs_discussion) && isAuthorizedApprover && (
                    <div className="flex gap-2 pt-1 border-t border-border/20 items-center justify-end">
                      {selectedComm.approval_status === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleQuickAction(selectedComm.id, 'approve')}
                            className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] active:scale-95 transition-all flex items-center gap-1"
                          >
                            <Check className="h-3 w-3" />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickAction(selectedComm.id, 'reject')}
                            className="px-3 py-1 rounded-lg bg-destructive text-destructive-foreground font-bold text-[11px] active:scale-95 transition-all flex items-center gap-1"
                          >
                            <X className="h-3 w-3" />
                            <span>Reject</span>
                          </button>
                        </>
                      )}
                      {selectedComm.needs_discussion && (
                        <button
                          type="button"
                          onClick={() => handleQuickAction(selectedComm.id, 'mark_discussed')}
                          className="px-3 py-1 rounded-lg bg-amber-600 text-white font-bold text-[11px] active:scale-95 transition-all flex items-center gap-1"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Mark Discussed</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border/30 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Priority</span>
                  <p className="font-semibold capitalize text-foreground">{selectedComm.priority}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Status</span>
                  <p className="font-semibold capitalize text-foreground">{selectedComm.status}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Entered By</span>
                  <p className="font-semibold text-foreground">{userProfilesMap[selectedComm.call_entered_by] || 'System'}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Received By</span>
                  <p className="font-semibold text-foreground">{userProfilesMap[selectedComm.call_received_by] || 'System'}</p>
                </div>
                {selectedComm.assigned_to && (
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Assigned To</span>
                    <p className="font-semibold text-foreground">{userProfilesMap[selectedComm.assigned_to] || 'System'}</p>
                  </div>
                )}
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Date Logged</span>
                  <p className="font-semibold text-foreground">{formatDateTime(selectedComm.created_at)}</p>
                </div>
                {selectedComm.follow_up_date && (
                  <div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase text-amber-600">Follow-Up Date</span>
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
                <BottomSheetPicker
                  label="Select Party Type"
                  options={PARTY_TYPES}
                  value={filterPartyType}
                  onChange={(val) => { setFilterPartyType(val); setFilterPartyId(''); }}
                  placeholder="All Party Types"
                />
              </div>

              {filterPartyType && (
                <div className="space-y-1">
                  <label className="font-semibold text-muted-foreground capitalize flex items-center gap-1">
                    <Search className="h-3.5 w-3.5 text-primary" />
                    <span>Search {filterPartyType}</span>
                  </label>
                  <BottomSheetPicker
                    label={`Select ${filterPartyType.charAt(0).toUpperCase() + filterPartyType.slice(1)}`}
                    options={[{ id: '', name: `All ${filterPartyType}s` }, ...getFilterPartyOptions()]}
                    value={filterPartyId}
                    onChange={(val) => setFilterPartyId(val)}
                    placeholder={`All ${filterPartyType}s`}
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Category</label>
                <BottomSheetPicker
                  label="Select Category"
                  options={[{ id: '', name: 'All Categories' }, ...CATEGORIES.map(c => ({ id: c.value, name: c.label }))]}
                  value={filterCategory}
                  onChange={(val) => setFilterCategory(val)}
                  placeholder="All Categories"
                />
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
