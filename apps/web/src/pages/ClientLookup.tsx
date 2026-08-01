import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { Search, Phone, ShieldAlert, CheckCircle, Clock, AlertTriangle, User, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

type Client = {
  id: string;
  client_name: string;
  client_id: string;
};

type Project = {
  id: string;
  name: string;
  client_id: string;
  site_engineer_id?: string | null;
};

type SalesOrder = {
  id: string;
  sales_order_no: string;
  status: string;
  stock_status: string;
  created_by: string;
  quotation_id?: string | null;
};

type OrganisationMember = {
  user_id: string;
  full_name: string;
  role_name: string;
};

function SearchableSelect<T>({
  items,
  selectedId,
  onSelect,
  getLabel,
  getId,
  placeholder,
  disabled = false,
  heightClass = 'h-10',
  errorText = 'No items found'
}: {
  items: T[];
  selectedId: string;
  onSelect: (id: string) => void;
  getLabel: (item: T) => string;
  getId: (item: T) => string;
  placeholder: string;
  disabled?: boolean;
  heightClass?: string;
  errorText?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = items.filter(item =>
    getLabel(item).toLowerCase().includes(search.toLowerCase())
  );

  const selectedItem = items.find(item => getId(item) === selectedId);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full ${heightClass} px-3 pr-8 bg-[#eff4ff] border border-[#c6c6cd] rounded-lg text-left text-[13px] transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[#76777d]'} ${isOpen ? 'ring-2 ring-[#0058be] border-[#0058be]' : ''}`}
      >
        <span className={selectedItem ? 'text-[#0b1c30]' : 'text-[#76777d]'}>
          {selectedItem ? getLabel(selectedItem) : placeholder}
        </span>
      </button>
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#76777d] pointer-events-none text-xs">▾</span>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-[#c6c6cd] rounded-lg shadow-lg max-h-60 overflow-auto">
          <div className="p-2 border-b border-[#e2e8f0]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full px-3 py-1.5 text-sm border border-[#c6c6cd] rounded focus:outline-none focus:ring-1 focus:ring-[#0058be]"
              autoFocus
            />
          </div>
          <div className="py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-[#76777d]">{errorText}</div>
            ) : (
              filtered.map(item => (
                <button
                  key={getId(item)}
                  type="button"
                  onClick={() => {
                    onSelect(getId(item));
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full px-3 py-2 text-left text-[13px] hover:bg-[#eff4ff] transition-colors ${getId(item) === selectedId ? 'bg-[#eff4ff] font-semibold text-[#0058be]' : 'text-[#0b1c30]'}`}
                >
                  {getLabel(item)}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {isOpen && <div className="fixed inset-0 z-40" onClick={() => { setIsOpen(false); setSearch(''); }} />}
    </div>
  );
}

export default function ClientLookup() {
  const { user, organisation, organisations } = useAuth();

  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isClientChanging, setIsClientChanging] = useState<boolean>(false);

  const [scopeKeyword, setScopeKeyword] = useState<string>('');
  const [searchTriggered, setSearchTriggered] = useState<boolean>(false);
  const [scopeMatches, setScopeMatches] = useState<any[]>([]);
  const [scopeInScope, setScopeInScope] = useState<boolean | null>(null);
  const [isSearchingScope, setIsSearchingScope] = useState<boolean>(false);

  const [callNotes, setCallNotes] = useState<string>('');
  const [callPriority, setCallPriority] = useState<'Normal' | 'Urgent'>('Normal');
  const [callCategory, setCallCategory] = useState<'CLIENT' | 'VENDOR'>('CLIENT');
  const [isResolvedOnCall, setIsResolvedOnCall] = useState<boolean>(false);
  const [assignedToId, setAssignedToId] = useState<string>('');
  const [requestedAdditionalScope, setRequestedAdditionalScope] = useState<boolean>(false);
  const [additionalScopeText, setAdditionalScopeText] = useState<string>('');
  const [isSavingLog, setIsSavingLog] = useState<boolean>(false);
  const [historyTab, setHistoryTab] = useState<'pos' | 'quotations' | 'invoices' | 'history'>('pos');

  const currentMember = organisations.find(o => o.organisation_id === organisation?.id);
  const userRoleSnapshot = currentMember?.role || 'member';

  const { data: clients = [], isLoading: isClientsLoading } = useQuery<Client[]>({
    queryKey: ['quick-lookup-clients', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_name, client_id')
        .eq('organisation_id', organisation.id)
        .order('client_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  const { data: allProjects = [], isLoading: isProjectsLoading } = useQuery<Project[]>({
    queryKey: ['quick-lookup-projects', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, client_id, site_engineer_id')
        .eq('organisation_id', organisation.id)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  const filteredProjects = allProjects.filter(p => p.client_id === selectedClientId);

  const { data: activeSO, isLoading: isSoLoading } = useQuery<SalesOrder | null>({
    queryKey: ['quick-lookup-so', organisation?.id, selectedClientId, selectedProjectId],
    queryFn: async () => {
      if (!organisation?.id || !selectedClientId || !selectedProjectId) return null;
      const { data, error } = await supabase
        .from('sales_orders')
        .select('id, sales_order_no, status, stock_status, created_by, quotation_id')
        .eq('organisation_id', organisation.id)
        .eq('client_id', selectedClientId)
        .eq('project_id', selectedProjectId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!organisation?.id && !!selectedClientId && !!selectedProjectId,
  });

  const { data: dispatchStatus, isLoading: isDispatchLoading } = useQuery({
    queryKey: ['quick-lookup-dispatch', activeSO?.id],
    queryFn: async () => {
      if (!activeSO?.id) return null;
      const { data, error } = await supabase
        .rpc('get_dispatch_status', { p_sales_order_id: activeSO.id });
      if (error) throw error;
      return data;
    },
    enabled: !!activeSO?.id,
  });

  const { data: orgMembers = [] } = useQuery<OrganisationMember[]>({
    queryKey: ['quick-lookup-members', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('org_members')
        .select('user_id, role:roles(name), profile:user_profiles(full_name)')
        .eq('organisation_id', organisation.id);
      if (error) throw error;
      return (data || []).map((m: any) => ({
        user_id: m.user_id,
        full_name: m.profile?.full_name || 'Unnamed Member',
        role_name: m.role?.name || 'Member',
      }));
    },
    enabled: !!organisation?.id,
  });

  const { data: clientPOs = [], isLoading: isPosLoading } = useQuery<any[]>({
    queryKey: ['quick-lookup-pos', organisation?.id, selectedClientId],
    queryFn: async () => {
      if (!organisation?.id || !selectedClientId) return [];
      const { data, error } = await supabase
        .from('client_purchase_orders')
        .select('id, po_number, po_date, po_expiry_date, po_total_value, po_utilized_value, po_available_value, status')
        .eq('client_id', selectedClientId)
        .order('po_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id && !!selectedClientId,
  });

  const { data: clientQuotes = [], isLoading: isQuotesLoading } = useQuery<any[]>({
    queryKey: ['quick-lookup-quotes', organisation?.id, selectedClientId],
    queryFn: async () => {
      if (!organisation?.id || !selectedClientId) return [];
      const { data, error } = await supabase
        .from('quotations')
        .select('id, quotation_no, quotation_date, status, total_value, project_id, projects(name)')
        .eq('client_id', selectedClientId)
        .order('quotation_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id && !!selectedClientId,
  });

  const { data: clientInvoices = [], isLoading: isInvoicesLoading } = useQuery<any[]>({
    queryKey: ['quick-lookup-invoices', organisation?.id, selectedClientId],
    queryFn: async () => {
      if (!organisation?.id || !selectedClientId) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_no, invoice_date, total, status, project_id, projects(name)')
        .eq('client_id', selectedClientId)
        .order('invoice_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id && !!selectedClientId,
  });

  const { data: commHistory = [], isLoading: isHistoryLoading } = useQuery<any[]>({
    queryKey: ['quick-lookup-comm-history', organisation?.id, selectedClientId],
    queryFn: async () => {
      if (!organisation?.id || !selectedClientId) return [];
      const { data, error } = await supabase
        .from('client_communication')
        .select('id, created_at, call_type, call_category, call_brief, next_action, status, priority, logged_by_role, call_received_by')
        .eq('client_id', selectedClientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id && !!selectedClientId,
  });

  useEffect(() => {
    setSelectedProjectId('');
    setScopeKeyword('');
    setSearchTriggered(false);
    setScopeMatches([]);
    setScopeInScope(null);

    if (selectedClientId) {
      setIsClientChanging(true);
      const timer = setTimeout(() => {
        setIsClientChanging(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [selectedClientId]);

  useEffect(() => {
    setScopeKeyword('');
    setSearchTriggered(false);
    setScopeMatches([]);
    setScopeInScope(null);
    setCallNotes('');
    setRequestedAdditionalScope(false);
    setAdditionalScopeText('');

    if (selectedProjectId) {
      const proj = allProjects.find(p => p.id === selectedProjectId);
      if (proj?.site_engineer_id) {
        setAssignedToId(proj.site_engineer_id);
      } else if (activeSO?.created_by) {
        setAssignedToId(activeSO.created_by);
      } else {
        setAssignedToId('');
      }
    }
  }, [selectedProjectId, activeSO]);

  const handleScopeSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !scopeKeyword.trim()) return;

    setIsSearchingScope(true);
    try {
      const { data, error } = await supabase
        .rpc('search_quotation_scope', {
          p_project_id: selectedProjectId,
          p_keyword: scopeKeyword.trim()
        });

      if (error) throw error;

      setScopeMatches(data?.matches || []);
      setScopeInScope(data?.in_scope || false);
      setSearchTriggered(true);
    } catch (err: any) {
      console.error('Scope lookup error:', err);
      toast.error('Failed to run scope check: ' + err.message);
    } finally {
      setIsSearchingScope(false);
    }
  };

  const handleLogCall = async () => {
    if (!selectedClientId) {
      toast.error('Client is required to log a call.');
      return;
    }
    setIsSavingLog(true);

    try {
      const briefSummary = [];
      if (dispatchStatus?.status_label) {
        briefSummary.push(`Dispatch Status: ${dispatchStatus.status_label} (${dispatchStatus.detail})`);
      }
      if (searchTriggered) {
        briefSummary.push(`Scope Checked: "${scopeKeyword}" - Result: ${scopeInScope ? 'In Scope' : 'Not Found in Quotation'}`);
      }
      if (callNotes) {
        briefSummary.push(`Notes: ${callNotes}`);
      }
      if (requestedAdditionalScope && additionalScopeText) {
        briefSummary.push(`Additional Scope Request: ${additionalScopeText}`);
      }

      const rawBrief = briefSummary.join(' | ');

      const { data: commData, error: commError } = await supabase
        .from('client_communication')
        .insert({
          organisation_id: organisation?.id,
          client_id: selectedClientId,
          project_id: selectedProjectId || null,
          call_type: 'Incoming',
          call_category: callCategory,
          call_regarding: 'Quick Lookup Resolution',
          call_brief: rawBrief,
          next_action: requestedAdditionalScope ? `Follow up on additional scope: ${additionalScopeText}` : (isResolvedOnCall ? 'Resolved' : 'Follow up required'),
          status: isResolvedOnCall ? 'Closed' : 'Open',
          priority: callPriority,
          is_resolved: isResolvedOnCall,
          assigned_to: assignedToId || null,
          logged_by_role: userRoleSnapshot,
          call_received_by: user?.id,
          call_entered_by: user?.id,
          linked_type: activeSO?.id ? 'sales_order' : (activeSO?.quotation_id ? 'quotation' : null),
          linked_id: activeSO?.id || activeSO?.quotation_id || null
        })
        .select()
        .single();

      if (commError) throw commError;

      const { error: entryError } = await supabase
        .from('client_communication_entries')
        .insert({
          parent_communication_id: commData.id,
          entry_type: 'Briefing',
          brief: `Lookup completed by ${userRoleSnapshot}. Blocker/Scope verified. Assigned to owner for follow-up.`,
          entered_by: user?.id
        });

      if (entryError) throw entryError;

      if (assignedToId && assignedToId !== user?.id) {
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            user_id: assignedToId,
            organisation_id: organisation?.id,
            title: `Client Call Logged: ${clients.find(c => c.id === selectedClientId)?.client_name}`,
            body: `Logged by ${userRoleSnapshot}. Action Required: ${requestedAdditionalScope ? additionalScopeText : 'Check query lookup logs'}`,
            link: '/follow-up'
          });
        if (notifError) console.warn('Failed to dispatch notification:', notifError);
      }

      toast.success('Call logged and routed successfully!');

      setCallNotes('');
      setIsResolvedOnCall(false);
      setRequestedAdditionalScope(false);
      setAdditionalScopeText('');
    } catch (err: any) {
      console.error('Call logging error:', err);
      toast.error('Failed to log call: ' + err.message);
    } finally {
      setIsSavingLog(false);
    }
  };

  const getStatusBadge = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes('payment') || l.includes('shortfall') || l.includes('block')) {
      return { bg: 'bg-[#ffdad6]', text: 'text-[#93000a]', dot: 'bg-[#ba1a1a]' };
    }
    if (l.includes('ready') || l.includes('complete')) {
      return { bg: 'bg-[#d8e2ff]', text: 'text-[#004395]', dot: 'bg-[#0058be]' };
    }
    if (l.includes('production') || l.includes('waiting')) {
      return { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' };
    }
    return { bg: 'bg-[#d8e2ff]', text: 'text-[#004395]', dot: 'bg-[#0058be]' };
  };

  const getStatusIcon = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes('payment') || l.includes('shortfall') || l.includes('block')) {
      return <ShieldAlert className="h-5 w-5 text-[#ba1a1a]" />;
    }
    if (l.includes('ready') || l.includes('complete')) {
      return <CheckCircle className="h-5 w-5 text-[#0058be]" />;
    }
    if (l.includes('production') || l.includes('waiting')) {
      return <Clock className="h-5 w-5 text-amber-500" />;
    }
    return <AlertTriangle className="h-5 w-5 text-[#76777d]" />;
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 bg-[#f8f9ff] space-y-6 w-full font-[Inter]">
      {/* Header Section */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white px-6 h-16 border border-[#c6c6cd] rounded-xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-[#000000] text-white rounded-lg">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-[#0b1c30] tracking-tight leading-tight">
              {selectedClient ? `${selectedClient.client_name} (${selectedClient.client_id})` : 'Quick Lookup'}
            </h2>
            <p className="text-[11px] text-[#76777d] leading-tight">
              {selectedClient ? 'Select Project/Site to begin lookup' : 'Answer client dispatch and scope questions in real time'}
            </p>
          </div>
        </div>
        <div className="relative w-full md:w-80">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#76777d]"><Search className="h-4 w-4" /></span>
          <input
            className="w-full pl-10 pr-4 h-10 bg-[#eff4ff] border border-[#c6c6cd] rounded-lg text-[13px] focus:ring-2 focus:ring-[#0058be] focus:outline-none text-[#0b1c30]"
            placeholder="Search Project or ID..."
            type="text"
          />
        </div>
      </section>

      {/* Selectors Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-[11px] font-semibold text-[#76777d] mb-1 block uppercase tracking-wider">Client</label>
          {isClientsLoading ? (
            <div className="h-11 bg-[#eff4ff] animate-pulse rounded-lg" />
          ) : (
            <SearchableSelect
              items={clients}
              selectedId={selectedClientId}
              onSelect={setSelectedClientId}
              getLabel={(c) => `${c.client_name} (${c.client_id})`}
              getId={(c) => c.id}
              placeholder="Select Client..."
              heightClass="h-11"
              errorText="No clients found"
            />
          )}
        </div>
        <div>
          <label className="text-[11px] font-semibold text-[#76777d] mb-1 block uppercase tracking-wider">Project / Site</label>
          {isProjectsLoading ? (
            <div className="h-11 bg-[#eff4ff] animate-pulse rounded-lg" />
          ) : (
            <SearchableSelect
              items={filteredProjects}
              selectedId={selectedProjectId}
              onSelect={setSelectedProjectId}
              getLabel={(p) => p.name}
              getId={(p) => p.id}
              placeholder={selectedClientId ? "Select Project..." : "Select client first"}
              disabled={!selectedClientId}
              heightClass="h-11"
              errorText="No projects found"
            />
          )}
        </div>
      </div>

      {!selectedClientId ? (
        <div className="p-10 flex flex-col items-center justify-center bg-[#eff4ff] rounded-xl border border-dashed border-[#c6c6cd] text-center">
          <svg className="h-8 w-8 text-[#c6c6cd] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <p className="text-[13px] font-semibold text-[#76777d]">Select a client to begin lookup</p>
          <p className="text-[11px] text-[#76777d] mt-1">Cross-referencing across ERP and CRM systems active.</p>
        </div>
      ) : isClientChanging ? (
        <div className="flex gap-6 animate-pulse">
          <div className="w-[40%] space-y-4">
            <div className="p-4 bg-white border border-[#c6c6cd] rounded-xl space-y-3">
              <div className="h-3 bg-[#e2e8f0] rounded w-1/3"></div>
              <div className="h-11 bg-[#eff4ff] rounded-lg"></div>
            </div>
            <div className="p-4 bg-white border border-[#c6c6cd] rounded-xl space-y-3">
              <div className="h-3 bg-[#e2e8f0] rounded w-1/3"></div>
              <div className="h-11 bg-[#eff4ff] rounded-lg"></div>
            </div>
          </div>
          <div className="w-[60%]">
            <div className="p-4 bg-white border border-[#c6c6cd] rounded-xl space-y-3">
              <div className="h-3 bg-[#e2e8f0] rounded w-1/4"></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="h-9 bg-[#eff4ff] rounded-lg"></div>
                <div className="h-9 bg-[#eff4ff] rounded-lg"></div>
              </div>
              <div className="h-24 bg-[#eff4ff] rounded-lg"></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Left Column: Status Checks - 40% */}
          <div className="w-[40%] space-y-4">
            <h3 className="text-[11px] font-semibold text-[#76777d] px-1 uppercase tracking-wider">Status Checks</h3>

            {/* Dispatch Check Card */}
            <div className="bg-white border border-[#c6c6cd] rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-[#0058be]"><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 17a2 2 0 100-4 2 2 0 000 4zm8 0a2 2 0 100-4 2 2 0 000 4zM8 17H5a2 2 0 01-2-2V7a2 2 0 012-2h10m4 0h2v5h-2M3 17h2m10-5h2v5h-2" /></svg></span>
                  <span className="text-[13px] font-semibold text-[#0b1c30]">Dispatch & Order Blocker Check</span>
                </div>
                {!selectedProjectId ? (
                  <span className="px-2 py-0.5 bg-[#eff4ff] text-[#76777d] text-[10px] font-bold rounded-full">Pending</span>
                ) : isSoLoading || isDispatchLoading ? (
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full">Loading</span>
                ) : dispatchStatus ? (
                  (() => {
                    const badge = getStatusBadge(dispatchStatus.status_label);
                    return (
                      <span className={`px-2 py-0.5 ${badge.bg} ${badge.text} text-[10px] font-bold rounded-full inline-flex items-center`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot} mr-1.5`}></span>
                        {dispatchStatus.status_label}
                      </span>
                    );
                  })()
                ) : (
                  <span className="px-2 py-0.5 bg-[#ffdad6] text-[#93000a] text-[10px] font-bold rounded-full">Error</span>
                )}
              </div>

              {!selectedProjectId ? (
                <p className="text-[13px] text-[#76777d]">Select a Project/Site to verify dispatch blockers.</p>
              ) : isSoLoading || isDispatchLoading ? (
                <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-[#76777d]" /></div>
              ) : !activeSO ? (
                <p className="text-[13px] text-[#76777d]">No active Sales Orders found for this project.</p>
              ) : !dispatchStatus ? (
                <p className="text-[13px] text-[#76777d]">Failed to compute dispatch status.</p>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center text-[13px]">
                    <span className="text-[#76777d]">Active Blockers</span>
                    <span className="font-bold text-[#0b1c30]">
                      {dispatchStatus.status_label?.toLowerCase().includes('block') ||
                       dispatchStatus.status_label?.toLowerCase().includes('payment')
                        ? dispatchStatus.status_label
                        : 'None'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[13px]">
                    <span className="text-[#76777d]">Sales Order</span>
                    <span className="text-[#0b1c30]">{activeSO.sales_order_no}</span>
                  </div>
                  <p className="text-[11px] text-[#76777d] leading-relaxed">{dispatchStatus.detail}</p>
                </div>
              )}
            </div>

            {/* Scope Verification Card */}
            <div className="bg-white border border-[#c6c6cd] rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-[#0058be]"><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></span>
                  <span className="text-[13px] font-semibold text-[#0b1c30]">Scope & Quotation Verification</span>
                </div>
                {searchTriggered && (
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${scopeInScope ? 'bg-[#d8e2ff] text-[#004395]' : 'bg-[#ffdad6] text-[#93000a]'}`}>
                    {scopeInScope ? 'In Scope' : 'Review Required'}
                  </span>
                )}
              </div>

              {!selectedProjectId ? (
                <p className="text-[13px] text-[#76777d]">Select a Project/Site to verify quotation scope.</p>
              ) : (
                <>
                  <form onSubmit={handleScopeSearch} className="flex gap-2 mb-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#76777d]" />
                      <input
                        type="text"
                        placeholder="Search approved Quotation..."
                        className="w-full pl-9 pr-3 h-9 bg-[#eff4ff] border border-[#c6c6cd] rounded-lg text-[13px] focus:ring-2 focus:ring-[#0058be] focus:outline-none text-[#0b1c30]"
                        value={scopeKeyword}
                        onChange={(e) => setScopeKeyword(e.target.value)}
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSearchingScope}
                      className="px-3 h-9 bg-[#dce9ff] border border-[#c6c6cd] rounded-lg text-[13px] font-semibold text-[#0b1c30] hover:bg-[#d3e4fe] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {isSearchingScope ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Check'}
                    </button>
                  </form>

                  {searchTriggered && (
                    <div className="space-y-2">
                      {scopeInScope ? (
                        <>
                          <div className="p-2.5 bg-[#d8e2ff] border border-[#adc6ff] rounded-lg text-[#004395] flex items-center gap-2 text-[11px] font-semibold">
                            <CheckCircle className="h-3.5 w-3.5" />
                            In Agreed Scope — Found matching items.
                          </div>
                          <div className="border border-[#c6c6cd] rounded-lg overflow-hidden">
                            {scopeMatches.map((m, idx) => (
                              <div key={idx} className={`p-2.5 flex justify-between items-center text-[11px] bg-[#f8f9ff] hover:bg-[#eff4ff] transition-colors ${idx < scopeMatches.length - 1 ? 'border-b border-[#c6c6cd]' : ''}`}>
                                <div>
                                  <p className="font-semibold text-[#0b1c30]">{m.item_name}</p>
                                  <p className="text-[10px] text-[#76777d]">Approved: {m.approved_date}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-[#0b1c30]">₹{m.rate.toLocaleString('en-IN')}</p>
                                  <span className="text-[9px] font-bold text-[#76777d]">{m.quotation_no}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="p-2.5 bg-[#ffdad6] border border-[#ffdad6] rounded-lg text-[#93000a] flex items-start gap-2 text-[11px]">
                          <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-bold">Not Found in Scope</p>
                            <p className="opacity-90 mt-0.5">Keyword "{scopeKeyword}" matches no items in approved Quotations.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right Column: Log Client Interaction - 60% */}
          <div className="w-[60%]">
            <div className="bg-[#eff4ff] border border-[#c6c6cd] rounded-xl p-5 h-full flex flex-col">
              <h3 className="text-[11px] font-semibold text-[#76777d] mb-4 uppercase tracking-wider">Log Client Interaction</h3>
              <div className="space-y-4 flex-1">
                {/* Toggle Rows */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-semibold text-[#76777d] mb-2 block">Party Type</label>
                    <div className="flex p-1 bg-white border border-[#c6c6cd] rounded-lg">
                      {['CLIENT', 'VENDOR'].map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCallCategory(c as any)}
                          className={`flex-1 h-9 text-[12px] font-semibold rounded transition-colors cursor-pointer ${
                            callCategory === c
                              ? 'bg-white shadow-sm font-bold text-[#0058be]'
                              : 'text-[#76777d] hover:bg-[#dce9ff]'
                          }`}
                        >
                          {c === 'CLIENT' ? 'Client' : 'Vendor'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#76777d] mb-2 block">Priority</label>
                    <div className="flex p-1 bg-white border border-[#c6c6cd] rounded-lg">
                      {['Normal', 'Urgent'].map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setCallPriority(p as any)}
                          className={`flex-1 h-9 text-[12px] font-semibold rounded transition-colors cursor-pointer ${
                            callPriority === p
                              ? p === 'Urgent'
                                ? 'bg-[#ba1a1a] text-white font-bold'
                                : 'bg-white shadow-sm font-bold text-[#0b1c30]'
                              : 'text-[#76777d] hover:bg-[#dce9ff]'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-[11px] font-semibold text-[#76777d] mb-2 block">Interaction Notes</label>
                  <textarea
                    placeholder="Briefly describe the call resolution or follow-up requirements..."
                    className="w-full px-4 py-3 bg-white border border-[#c6c6cd] rounded-lg text-[13px] focus:ring-2 focus:ring-[#0058be] focus:outline-none text-[#0b1c30] resize-none"
                    style={{ height: '120px' }}
                    value={callNotes}
                    onChange={(e) => setCallNotes(e.target.value)}
                  />
                </div>

                {/* Checkboxes */}
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative w-5 h-5 flex items-center justify-center border-2 border-[#76777d] rounded group-hover:border-[#0058be] transition-colors">
                      <input
                        type="checkbox"
                        checked={requestedAdditionalScope}
                        onChange={(e) => setRequestedAdditionalScope(e.target.checked)}
                        className="absolute inset-0 opacity-0 cursor-pointer peer"
                      />
                      <span className="text-white bg-[#0058be] w-full h-full flex items-center justify-center opacity-0 peer-checked:opacity-100 transition-opacity rounded-[1px] text-[12px]">✓</span>
                    </div>
                    <span className="text-[13px] text-[#0b1c30]">Requested Extra Scope</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative w-5 h-5 flex items-center justify-center border-2 border-[#76777d] rounded group-hover:border-[#0058be] transition-colors">
                      <input
                        type="checkbox"
                        checked={isResolvedOnCall}
                        onChange={(e) => setIsResolvedOnCall(e.target.checked)}
                        className="absolute inset-0 opacity-0 cursor-pointer peer"
                      />
                      <span className="text-white bg-[#0058be] w-full h-full flex items-center justify-center opacity-0 peer-checked:opacity-100 transition-opacity rounded-[1px] text-[12px]">✓</span>
                    </div>
                    <span className="text-[13px] text-[#0b1c30]">Resolved on the Call</span>
                  </label>
                </div>
              </div>

              {/* Action */}
              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleLogCall}
                  disabled={isSavingLog || !selectedClientId}
                  className="w-full h-12 bg-[#000000] text-white font-semibold rounded text-[13px] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                >
                  {isSavingLog ? <Loader2 className="h-4 w-4 animate-spin" /> : <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg> Log & Route Call</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 360° Connected History */}
      {selectedClientId && (
        <section className="bg-white border border-[#c6c6cd] rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 pt-5 pb-0 border-b border-[#c6c6cd]">
            <h3 className="text-[15px] font-bold text-[#0b1c30] mb-4 tracking-tight">360° Connected History</h3>
            <div className="flex gap-6 overflow-x-auto">
              {[
                { key: 'pos' as const, label: `Client POs (${clientPOs.length})` },
                { key: 'quotations' as const, label: `Quotations (${clientQuotes.length})` },
                { key: 'invoices' as const, label: `Invoices (${clientInvoices.length})` },
                { key: 'history' as const, label: `Call History (${commHistory.length})` },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setHistoryTab(tab.key)}
                  className={`pb-3 text-[13px] font-semibold border-b-2 whitespace-nowrap transition-colors ${
                    historyTab === tab.key
                      ? 'border-[#000000] text-[#0b1c30]'
                      : 'border-transparent text-[#76777d] hover:text-[#0b1c30]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5">
            <div className="min-h-[200px]">
              {/* Purchase Orders */}
              {historyTab === 'pos' && (
                isPosLoading ? (
                  <div className="flex justify-center items-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[#76777d]" /></div>
                ) : clientPOs.length === 0 ? (
                  <div className="p-10 flex flex-col items-center justify-center bg-[#eff4ff] rounded-xl border border-dashed border-[#c6c6cd] text-center">
                    <svg className="h-8 w-8 text-[#c6c6cd] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                    <p className="text-[13px] font-semibold text-[#76777d]">No client purchase orders found.</p>
                    <p className="text-[11px] text-[#76777d] mt-1">Cross-referencing across ERP and CRM systems active.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[11px] text-[#76777d] uppercase tracking-wider">
                          <th className="pb-3 px-3 font-medium">Document ID</th>
                          <th className="pb-3 px-3 font-medium">Status</th>
                          <th className="pb-3 px-3 font-medium">Value</th>
                          <th className="pb-3 px-3 font-medium">Utilization</th>
                          <th className="pb-3 px-3 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e2e8f0]">
                        {clientPOs.map(po => (
                          <tr key={po.id} className="group hover:bg-[#eff4ff] transition-colors h-10">
                            <td className="px-3">
                              <div className="flex items-center gap-2.5">
                                <svg className="h-4 w-4 text-[#76777d]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                <div>
                                  <p className="text-[14px] font-semibold text-[#0b1c30]">PO #{po.po_number}</p>
                                  <p className="text-[11px] text-[#76777d]">Created {po.po_date}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                po.status === 'Open'
                                  ? 'bg-[#d8e2ff] text-[#004395]'
                                  : po.status === 'Partially Billed'
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-[#eff4ff] text-[#76777d]'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                  po.status === 'Open' ? 'bg-[#0058be]' : po.status === 'Partially Billed' ? 'bg-amber-500' : 'bg-[#76777d]'
                                }`}></span>
                                {po.status}
                              </span>
                            </td>
                            <td className="px-3 text-[14px] font-medium text-[#0b1c30]">₹{Number(po.po_total_value).toLocaleString('en-IN')}</td>
                            <td className="px-3">
                              <div className="w-44">
                                <div className="flex justify-between text-[10px] mb-1">
                                  <span className="text-[#0b1c30]">{Math.round((po.po_utilized_value / po.po_total_value) * 100)}% Consumed</span>
                                  <span className="text-[#76777d]">₹{Number(po.po_utilized_value).toLocaleString('en-IN')}</span>
                                </div>
                                <div className="w-full h-1.5 bg-[#dce9ff] rounded overflow-hidden">
                                  <div className="h-full bg-[#0058be] rounded" style={{ width: `${Math.round((po.po_utilized_value / po.po_total_value) * 100)}%` }}></div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 text-right">
                              <button className="text-[#76777d] hover:text-[#0b1c30] transition-colors">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* Quotations */}
              {historyTab === 'quotations' && (
                isQuotesLoading ? (
                  <div className="flex justify-center items-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[#76777d]" /></div>
                ) : clientQuotes.length === 0 ? (
                  <div className="p-10 flex flex-col items-center justify-center bg-[#eff4ff] rounded-xl border border-dashed border-[#c6c6cd] text-center">
                    <svg className="h-8 w-8 text-[#c6c6cd] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <p className="text-[13px] font-semibold text-[#76777d]">No quotations found for this client.</p>
                    <p className="text-[11px] text-[#76777d] mt-1">Cross-referencing across ERP and CRM systems active.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[11px] text-[#76777d] uppercase tracking-wider">
                          <th className="pb-3 px-3 font-medium">Document ID</th>
                          <th className="pb-3 px-3 font-medium">Status</th>
                          <th className="pb-3 px-3 font-medium">Project</th>
                          <th className="pb-3 px-3 font-medium">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e2e8f0]">
                        {clientQuotes.map(q => (
                          <tr key={q.id} className="group hover:bg-[#eff4ff] transition-colors h-10">
                            <td className="px-3">
                              <div className="flex items-center gap-2.5">
                                <svg className="h-4 w-4 text-[#76777d]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                <div>
                                  <p className="text-[14px] font-semibold text-[#0b1c30]">{q.quotation_no}</p>
                                  <p className="text-[11px] text-[#76777d]">{q.quotation_date}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                q.status.toLowerCase() === 'approved' || q.status.toLowerCase() === 'converted'
                                  ? 'bg-[#d8e2ff] text-[#004395]'
                                  : 'bg-[#eff4ff] text-[#76777d]'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                  q.status.toLowerCase() === 'approved' || q.status.toLowerCase() === 'converted' ? 'bg-[#0058be]' : 'bg-[#76777d]'
                                }`}></span>
                                {q.status}
                              </span>
                            </td>
                            <td className="px-3 text-[14px] text-[#0b1c30]">{q.projects?.name || '—'}</td>
                            <td className="px-3 text-[14px] font-medium text-[#0b1c30]">₹{Number(q.total_value).toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* Invoices */}
              {historyTab === 'invoices' && (
                isInvoicesLoading ? (
                  <div className="flex justify-center items-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[#76777d]" /></div>
                ) : clientInvoices.length === 0 ? (
                  <div className="p-10 flex flex-col items-center justify-center bg-[#eff4ff] rounded-xl border border-dashed border-[#c6c6cd] text-center">
                    <svg className="h-8 w-8 text-[#c6c6cd] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <p className="text-[13px] font-semibold text-[#76777d]">No invoices found for this client.</p>
                    <p className="text-[11px] text-[#76777d] mt-1">Cross-referencing across ERP and CRM systems active.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[11px] text-[#76777d] uppercase tracking-wider">
                          <th className="pb-3 px-3 font-medium">Document ID</th>
                          <th className="pb-3 px-3 font-medium">Status</th>
                          <th className="pb-3 px-3 font-medium">Project</th>
                          <th className="pb-3 px-3 font-medium">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e2e8f0]">
                        {clientInvoices.map(inv => (
                          <tr key={inv.id} className="group hover:bg-[#eff4ff] transition-colors h-10">
                            <td className="px-3">
                              <div className="flex items-center gap-2.5">
                                <svg className="h-4 w-4 text-[#76777d]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                <div>
                                  <p className="text-[14px] font-semibold text-[#0b1c30]">{inv.invoice_no}</p>
                                  <p className="text-[11px] text-[#76777d]">{inv.invoice_date}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                inv.status.toLowerCase() === 'paid'
                                  ? 'bg-[#d8e2ff] text-[#004395]'
                                  : inv.status.toLowerCase() === 'partial' || inv.status.toLowerCase() === 'unpaid'
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-[#eff4ff] text-[#76777d]'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                  inv.status.toLowerCase() === 'paid' ? 'bg-[#0058be]' : inv.status.toLowerCase() === 'partial' || inv.status.toLowerCase() === 'unpaid' ? 'bg-amber-500' : 'bg-[#76777d]'
                                }`}></span>
                                {inv.status}
                              </span>
                            </td>
                            <td className="px-3 text-[14px] text-[#0b1c30]">{inv.projects?.name || '—'}</td>
                            <td className="px-3 text-[14px] font-medium text-[#0b1c30]">₹{Number(inv.total).toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* Call History */}
              {historyTab === 'history' && (
                isHistoryLoading ? (
                  <div className="flex justify-center items-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[#76777d]" /></div>
                ) : commHistory.length === 0 ? (
                  <div className="p-10 flex flex-col items-center justify-center bg-[#eff4ff] rounded-xl border border-dashed border-[#c6c6cd] text-center">
                    <svg className="h-8 w-8 text-[#c6c6cd] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    <p className="text-[13px] font-semibold text-[#76777d]">No past call interactions logged for this client.</p>
                    <p className="text-[11px] text-[#76777d] mt-1">Cross-referencing across ERP and CRM systems active.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {commHistory.map(comm => {
                      const receiver = orgMembers.find(m => m.user_id === comm.call_received_by);
                      return (
                        <div key={comm.id} className="p-3 bg-[#f8f9ff] border border-[#c6c6cd] rounded-xl space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[#0b1c30]">
                                {comm.call_type} Inflow — {comm.call_category}
                              </span>
                              <span className="text-[10px] text-[#76777d]">
                                {new Date(comm.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                                comm.status === 'Closed'
                                  ? 'bg-[#d8e2ff] text-[#004395]'
                                  : 'bg-amber-50 text-amber-700'
                              }`}>
                                {comm.status}
                              </span>
                              {comm.priority === 'Urgent' && (
                                <span className="bg-[#ffdad6] text-[#93000a] text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                  Urgent
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-[12px] text-[#0b1c30] bg-white p-2.5 rounded-lg border border-[#c6c6cd] leading-relaxed">
                            {comm.call_brief}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-[#76777d] pt-0.5">
                            <p>Logged by: <span className="font-medium text-[#0b1c30]">{receiver?.full_name || 'System'} ({comm.logged_by_role || 'member'})</span></p>
                            {comm.next_action && <p className="font-semibold text-[#0058be]">Action: {comm.next_action}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
