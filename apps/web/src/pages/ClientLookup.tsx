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

// Searchable Select following apps/web/DESIGN.md rules
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
  const [searchText, setSearchText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const selectedItem = items.find(item => getId(item) === selectedId);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.dropdown-container')) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredItems = items.filter(item => {
    const label = getLabel(item).toLowerCase();
    const search = searchText.toLowerCase();
    return !searchText || label.includes(search);
  });

  return (
    <div className="dropdown-container" style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        disabled={disabled}
        className={`w-full ${heightClass} px-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-lg text-sm focus:outline-none focus:border-[#185FA5] focus:ring-1 focus:ring-[#185FA5] transition-all text-zinc-900 dark:text-zinc-100 disabled:opacity-50`}
        value={isOpen ? searchText : (selectedItem ? getLabel(selectedItem) : '')}
        onChange={e => {
          setSearchText(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          setSearchText('');
          setIsOpen(true);
        }}
        placeholder={placeholder}
      />
      {isOpen && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 50,
            background: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            maxHeight: '200px',
            overflowY: 'auto',
            marginTop: '4px',
          }}
          className="dark:bg-zinc-900 dark:border-zinc-800"
        >
          {filteredItems.map(item => {
            const id = getId(item);
            const label = getLabel(item);
            return (
              <div
                key={id}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  borderBottom: '1px solid #f3f4f6',
                }}
                className="hover:bg-blue-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-150 border-zinc-100 dark:border-zinc-850"
                onClick={() => {
                  onSelect(id);
                  setSearchText('');
                  setIsOpen(false);
                }}
              >
                {label}
              </div>
            );
          })}
          {filteredItems.length === 0 && (
            <div style={{ padding: '8px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>
              {errorText}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ClientLookup() {
  const { organisation, user, organisations } = useAuth();
  
  // Selection state
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isClientChanging, setIsClientChanging] = useState<boolean>(false);
  
  // Search state
  const [scopeKeyword, setScopeKeyword] = useState<string>('');
  const [searchTriggered, setSearchTriggered] = useState<boolean>(false);
  const [scopeMatches, setScopeMatches] = useState<any[]>([]);
  const [scopeInScope, setScopeInScope] = useState<boolean | null>(null);
  const [isSearchingScope, setIsSearchingScope] = useState<boolean>(false);

  // Call logging form state
  const [callNotes, setCallNotes] = useState<string>('');
  const [callPriority, setCallPriority] = useState<'Normal' | 'Urgent'>('Normal');
  const [callCategory, setCallCategory] = useState<'CLIENT' | 'VENDOR'>('CLIENT');
  const [isResolvedOnCall, setIsResolvedOnCall] = useState<boolean>(false);
  const [assignedToId, setAssignedToId] = useState<string>('');
  const [requestedAdditionalScope, setRequestedAdditionalScope] = useState<boolean>(false);
  const [additionalScopeText, setAdditionalScopeText] = useState<string>('');
  const [isSavingLog, setIsSavingLog] = useState<boolean>(false);
  const [historyTab, setHistoryTab] = useState<'pos' | 'quotations' | 'invoices' | 'history'>('pos');

  // Resolve legacy role snapshot
  const currentMember = organisations.find(o => o.organisation_id === organisation?.id);
  const userRoleSnapshot = currentMember?.role || 'member';

  // 1. Fetch Clients
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

  // 2. Fetch Projects (all for the org, filter in memory by client)
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

  // 3. Fetch active Sales Order for lookup
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

  // 4. Fetch Dispatch Blocker Details
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

  // 5. Fetch Organisation Members for routing assignees
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

  // 6. Fetch Client Purchase Orders (POs)
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

  // 7. Fetch Quotations
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

  // 8. Fetch Invoices
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

  // 9. Fetch Communication History
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

  // Auto-set the project and pre-select assignees
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
    
    // Default assignee resolution
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

  // Execute Quotation Scope Search
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

  // Submit Call Log
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

      // 1. Insert parent client communication
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

      // 2. Insert thread entry
      const { error: entryError } = await supabase
        .from('client_communication_entries')
        .insert({
          parent_communication_id: commData.id,
          entry_type: 'Briefing',
          brief: `Lookup completed by ${userRoleSnapshot}. Blocker/Scope verified. Assigned to owner for follow-up.`,
          entered_by: user?.id
        });

      if (entryError) throw entryError;

      // 3. Create Notification if assigned to someone else
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
      
      // Reset form
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

  const getStatusIcon = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes('payment') || l.includes('shortfall') || l.includes('block')) {
      return <ShieldAlert className="h-5 w-5 text-red-500 animate-pulse" />;
    }
    if (l.includes('ready') || l.includes('complete')) {
      return <CheckCircle className="h-5 w-5 text-emerald-500" />;
    }
    if (l.includes('production') || l.includes('waiting')) {
      return <Clock className="h-5 w-5 text-amber-500" />;
    }
    return <AlertTriangle className="h-5 w-5 text-zinc-400" />;
  };

  const getStatusCardBg = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes('payment') || l.includes('shortfall') || l.includes('block')) {
      return 'bg-red-50/50 border-red-100 text-red-950 dark:bg-red-950/15 dark:border-red-900/30';
    }
    if (l.includes('ready') || l.includes('complete')) {
      return 'bg-emerald-50/50 border-emerald-100 text-emerald-950 dark:bg-emerald-950/15 dark:border-emerald-900/30';
    }
    if (l.includes('production') || l.includes('waiting')) {
      return 'bg-amber-50/50 border-amber-100 text-amber-950 dark:bg-amber-950/15 dark:border-amber-900/30';
    }
    return 'bg-zinc-50 border-zinc-200 text-zinc-900 dark:bg-zinc-900/40 dark:border-zinc-800';
  };

  // DESIGN.md Document Section Pattern
  const headerFieldStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px' };
  const labelColStyle: React.CSSProperties = { minWidth: '100px', maxWidth: '100px', fontWeight: 600, fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' };
  const fieldColStyle: React.CSSProperties = { flex: 1 };
  
  const renderHeaderField = (label: string, field: React.ReactNode, isLast = false) => (
    <div style={{ ...headerFieldStyle, marginBottom: isLast ? 0 : '8px' }}>
      <span style={labelColStyle}>{label}</span>
      <div style={fieldColStyle}>{field}</div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Quick Lookup</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Answer client dispatch and scope questions in real time, and route follow-ups instantly.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs rounded-full font-medium">
          <Phone className="h-3.5 w-3.5" />
          Active Call Resolver Mode
        </div>
      </div>

      {/* Selectors Panel — Card Padding 24px */}
      <div style={{ padding: '24px', borderRadius: '12px' }} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
          {/* Column 1 */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {renderHeaderField('Client:', isClientsLoading ? (
              <div className="h-9 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-lg" />
            ) : (
              <SearchableSelect
                items={clients}
                selectedId={selectedClientId}
                onSelect={setSelectedClientId}
                getLabel={(c) => `${c.client_name} (${c.client_id})`}
                getId={(c) => c.id}
                placeholder="Search and select client..."
                heightClass="h-9"
                errorText="No clients found"
              />
            ), true)}
          </div>
          {/* Column 2 */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {renderHeaderField('Project:', isProjectsLoading ? (
              <div className="h-9 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-lg" />
            ) : (
              <SearchableSelect
                items={filteredProjects}
                selectedId={selectedProjectId}
                onSelect={setSelectedProjectId}
                getLabel={(p) => p.name}
                getId={(p) => p.id}
                placeholder={selectedClientId ? "Search and select project..." : "Select client first"}
                disabled={!selectedClientId}
                heightClass="h-9"
                errorText="No projects found"
              />
            ), true)}
          </div>
        </div>
      </div>

      {!selectedClientId ? (
        <div className="p-12 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-400">
          <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <h3 className="font-semibold text-sm text-zinc-700 dark:text-zinc-300">Select Client to begin Lookup</h3>
          <p className="text-xs text-zinc-500 mt-1">This tool dynamically compiles active orders, invoices, and quotations.</p>
        </div>
      ) : isClientChanging ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
          <div className="lg:col-span-2 space-y-6">
            {/* Blocker Skeleton */}
            <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-4">
              <div className="h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded w-1/4"></div>
              <div className="h-16 bg-zinc-50 dark:bg-zinc-950 rounded-xl"></div>
            </div>
            {/* Scope Skeleton */}
            <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-4">
              <div className="h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded w-1/4"></div>
              <div className="h-10 bg-zinc-50 dark:bg-zinc-950 rounded-xl"></div>
            </div>
          </div>
          {/* Logging Skeleton */}
          <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-4 h-fit">
            <div className="h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3"></div>
            <div className="space-y-3 pt-2">
              <div className="h-8 bg-zinc-50 dark:bg-zinc-950 rounded-lg"></div>
              <div className="h-16 bg-zinc-50 dark:bg-zinc-950 rounded-lg"></div>
              <div className="h-8 bg-zinc-50 dark:bg-zinc-950 rounded-lg"></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main lookup results column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* 1. Dispatch Blocker status — Padding 24px (p-6) */}
            <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm space-y-4">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">1. Dispatch & Order Blocker Check</h2>
              
              {!selectedProjectId ? (
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-500 border border-zinc-200/50 dark:border-zinc-800/40 text-center">
                  Select a Project/Site to verify dispatch blockers.
                </div>
              ) : isSoLoading || isDispatchLoading ? (
                <div className="flex justify-center items-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                </div>
              ) : !activeSO ? (
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-500 border border-zinc-200/50 dark:border-zinc-800/40 text-center">
                  No active Sales Orders found for this project.
                </div>
              ) : !dispatchStatus ? (
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-500 border border-zinc-200/50 dark:border-zinc-800/40 text-center">
                  Failed to compute dispatch status.
                </div>
              ) : (
                <div className={`p-4 rounded-xl border flex gap-3 items-start transition-all ${getStatusCardBg(dispatchStatus.status_label)}`}>
                  <div className="p-1 bg-white/80 dark:bg-zinc-900/80 rounded-lg shadow-sm">
                    {getStatusIcon(dispatchStatus.status_label)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold tracking-tight">{dispatchStatus.status_label}</h4>
                      <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-white/60 dark:bg-zinc-900/60 border border-current/10">
                        {activeSO.sales_order_no}
                      </span>
                    </div>
                    <p className="text-xs leading-normal opacity-90">{dispatchStatus.detail}</p>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Scope Verification — Padding 24px (p-6) */}
            <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm space-y-4">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">2. Scope & Quotation Verification</h2>
              
              {!selectedProjectId ? (
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-500 border border-zinc-200/50 dark:border-zinc-800/40 text-center">
                  Select a Project/Site to verify quotation scope.
                </div>
              ) : (
                <>
                  <form onSubmit={handleScopeSearch} className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                      <input
                        type="text"
                        placeholder="Search approved Quotation (e.g. false ceiling, wiring)..."
                        className="w-full h-9 pl-9 pr-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-lg text-sm focus:outline-none focus:border-[#185FA5] focus:ring-1 focus:ring-[#185FA5] transition-all text-zinc-900 dark:text-zinc-100"
                        value={scopeKeyword}
                        onChange={(e) => setScopeKeyword(e.target.value)}
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSearchingScope}
                      className="px-4 h-9 bg-[#185FA5] border border-[#185FA5] hover:bg-[#0C447C] hover:border-[#0C447C] text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      {isSearchingScope ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Check Scope'}
                    </button>
                  </form>

                  {searchTriggered && (
                    <div className="space-y-3 pt-2">
                      {scopeInScope ? (
                        <div className="space-y-3">
                          <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-emerald-950 flex items-center gap-2 text-xs font-semibold dark:bg-emerald-950/15 dark:border-emerald-900/30">
                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                            In Agreed Scope — Found matching items in Quotation.
                          </div>
                          
                          {/* Matches list */}
                          <div className="divide-y divide-zinc-100 dark:divide-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                            {scopeMatches.map((m, idx) => (
                              <div key={idx} className="p-3 flex justify-between items-center text-xs bg-zinc-50/30 hover:bg-zinc-50 dark:bg-zinc-950/30 dark:hover:bg-zinc-950 transition-colors">
                                <div className="space-y-0.5">
                                  <p className="font-semibold text-zinc-850 dark:text-zinc-200">{m.item_name}</p>
                                  <p className="text-[10px] text-zinc-400">Approved on: {m.approved_date}</p>
                                </div>
                                <div className="text-right space-y-0.5">
                                  <p className="font-bold text-zinc-900 dark:text-zinc-50">₹{m.rate.toLocaleString('en-IN')}</p>
                                  <span className="inline-block text-[9px] font-bold text-zinc-400 border border-zinc-200 dark:border-zinc-800 px-1.5 py-0.5 rounded">
                                    {m.quotation_no}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-3.5 bg-red-50/50 border border-red-100 rounded-xl text-red-950 flex items-start gap-2.5 text-xs leading-normal dark:bg-red-950/15 dark:border-red-900/30">
                          <ShieldAlert className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-bold text-red-950">Not Found in Scope</p>
                            <p className="opacity-90 mt-0.5">Keyword "{scopeKeyword}" matches no items in approved Quotations. Verify spelling or check original BOQ files.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

                  {/* Logging Form Panel — Card Padding 24px */}
          <div style={{ padding: '24px' }} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm space-y-4 h-fit">
            <div className="border-b border-zinc-100 dark:border-zinc-850 pb-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">3. Log Client Interaction</h2>
              <p className="text-[10px] text-zinc-450 mt-0.5">Save resolving actions and route notifications immediately.</p>
            </div>

            <div className="space-y-3">
              {/* Category */}
              {renderHeaderField('Party Type:', (
                <div className="flex gap-2">
                  {['CLIENT', 'VENDOR'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCallCategory(c as any)}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                        callCategory === c
                          ? 'bg-[#185FA5] border-[#185FA5] text-white shadow-sm'
                          : 'bg-white border-zinc-200 text-zinc-650 hover:bg-zinc-50 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-400'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              ))}

              {/* Priority */}
              {renderHeaderField('Priority:', (
                <div className="flex gap-2">
                  {['Normal', 'Urgent'].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCallPriority(p as any)}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                        callPriority === p
                          ? p === 'Urgent'
                            ? 'bg-red-650 border-red-650 text-white shadow-sm'
                            : 'bg-[#185FA5] border-[#185FA5] text-white shadow-sm'
                          : 'bg-white border-zinc-200 text-zinc-650 hover:bg-zinc-50 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-400'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              ))}

              {/* Notes */}
              {renderHeaderField('Notes:', (
                <textarea
                  placeholder="Enter details of client request or discussion..."
                  className="w-full min-h-[70px] p-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-lg text-xs focus:outline-none focus:border-[#185FA5] focus:ring-1 focus:ring-[#185FA5] transition-all text-zinc-900 dark:text-zinc-100"
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                />
              ))}

              {/* Additional Scope Checkbox */}
              {renderHeaderField('Extra Scope:', (
                <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={requestedAdditionalScope}
                      onChange={(e) => setRequestedAdditionalScope(e.target.checked)}
                      className="rounded border-zinc-300 text-[#185FA5] focus:ring-[#185FA5] h-3.5 w-3.5 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Requested Extra Scope</span>
                  </label>
                  
                  {requestedAdditionalScope && (
                    <textarea
                      placeholder="Describe the additional work requested (e.g. extra ceiling wiring requested by GM)..."
                      className="w-full min-h-[50px] p-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-lg text-xs focus:outline-none focus:border-[#185FA5] focus:ring-1 focus:ring-[#185FA5] transition-all text-zinc-900 dark:text-zinc-100"
                      value={additionalScopeText}
                      onChange={(e) => setAdditionalScopeText(e.target.value)}
                      required
                    />
                  )}
                </div>
              ))}

              {/* Routing Assignee */}
              {renderHeaderField('Assign To:', (
                <SearchableSelect
                  items={orgMembers}
                  selectedId={assignedToId}
                  onSelect={setAssignedToId}
                  getLabel={(m) => `${m.full_name} (${m.role_name})`}
                  getId={(m) => m.user_id}
                  placeholder="Route to Admin / Assignee..."
                  heightClass="h-9"
                  errorText="No members found"
                />
              ))}

              {/* Resolve Inline */}
              {renderHeaderField('Resolved:', (
                <label className="flex items-center gap-2 pt-1 pb-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isResolvedOnCall}
                    onChange={(e) => setIsResolvedOnCall(e.target.checked)}
                    className="rounded border-zinc-300 text-[#185FA5] focus:ring-[#185FA5] h-3.5 w-3.5 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Resolved on the Call</span>
                </label>
              ))}

              {/* Save Button — Primary button geometry and colors */}
              <button
                type="button"
                onClick={handleLogCall}
                disabled={isSavingLog}
                className="w-full h-9 bg-[#185FA5] border border-[#185FA5] hover:bg-[#0C447C] hover:border-[#0C447C] text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                {isSavingLog ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Log & Route Call'}
              </button>
            </div>
          </div>
        </div>

        {/* 4. 360° Client History Container */}
        <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm space-y-6">
          <div className="border-b border-zinc-150 dark:border-zinc-800 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">4. 360° Connected History</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">View real-time connected records and historical logs for this client.</p>
            </div>
            
            {/* Tab Selector Buttons */}
            <div className="flex border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5 bg-zinc-50 dark:bg-zinc-950 overflow-x-auto">
              <button
                onClick={() => setHistoryTab('pos')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                  historyTab === 'pos'
                    ? 'bg-white dark:bg-zinc-900 shadow text-[#185FA5] dark:text-blue-400'
                    : 'text-zinc-550 hover:text-zinc-700 dark:text-zinc-400'
                }`}
              >
                Client POs ({clientPOs.length})
              </button>
              <button
                onClick={() => setHistoryTab('quotations')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                  historyTab === 'quotations'
                    ? 'bg-white dark:bg-zinc-900 shadow text-[#185FA5] dark:text-blue-400'
                    : 'text-zinc-550 hover:text-zinc-700 dark:text-zinc-400'
                }`}
              >
                Quotations ({clientQuotes.length})
              </button>
              <button
                onClick={() => setHistoryTab('invoices')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                  historyTab === 'invoices'
                    ? 'bg-white dark:bg-zinc-900 shadow text-[#185FA5] dark:text-blue-400'
                    : 'text-zinc-550 hover:text-zinc-700 dark:text-zinc-400'
                }`}
              >
                Invoices ({clientInvoices.length})
              </button>
              <button
                onClick={() => setHistoryTab('history')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                  historyTab === 'history'
                    ? 'bg-white dark:bg-zinc-900 shadow text-[#185FA5] dark:text-blue-400'
                    : 'text-zinc-550 hover:text-zinc-700 dark:text-zinc-400'
                }`}
              >
                Call History ({commHistory.length})
              </button>
            </div>
          </div>

          {/* Tab Contents */}
          <div className="min-h-[200px]">
            {/* Purchase Orders */}
            {historyTab === 'pos' && (
              isPosLoading ? (
                <div className="flex justify-center items-center py-10"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>
              ) : clientPOs.length === 0 ? (
                <div className="text-center py-10 text-xs text-zinc-400">No client purchase orders found.</div>
              ) : (
                <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 font-semibold">
                      <tr>
                        <th className="p-3">PO Number</th>
                        <th className="p-3">PO Date</th>
                        <th className="p-3">Expiry Date</th>
                        <th className="p-3 text-right">Total Value</th>
                        <th className="p-3 text-right">Utilized Value</th>
                        <th className="p-3 text-right">Available Value</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 dark:bg-zinc-950/20">
                      {clientPOs.map(po => (
                        <tr key={po.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                          <td className="p-3 font-semibold text-[#185FA5] dark:text-blue-400">{po.po_number}</td>
                          <td className="p-3">{po.po_date}</td>
                          <td className="p-3">{po.po_expiry_date || '—'}</td>
                          <td className="p-3 text-right font-semibold">₹{Number(po.po_total_value).toLocaleString('en-IN')}</td>
                          <td className="p-3 text-right text-amber-600 dark:text-amber-500">₹{Number(po.po_utilized_value).toLocaleString('en-IN')}</td>
                          <td className="p-3 text-right text-emerald-600 dark:text-emerald-500 font-semibold">₹{Number(po.po_available_value).toLocaleString('en-IN')}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              po.status === 'Open'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40'
                                : po.status === 'Partially Billed'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40'
                                  : 'bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                            }`}>
                              {po.status}
                            </span>
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
                <div className="flex justify-center items-center py-10"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>
              ) : clientQuotes.length === 0 ? (
                <div className="text-center py-10 text-xs text-zinc-400">No quotations found for this client.</div>
              ) : (
                <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 font-semibold">
                      <tr>
                        <th className="p-3">Quotation Number</th>
                        <th className="p-3">Quotation Date</th>
                        <th className="p-3">Project / Site</th>
                        <th className="p-3 text-right">Total Value</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 dark:bg-zinc-950/20">
                      {clientQuotes.map(q => (
                        <tr key={q.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                          <td className="p-3 font-semibold text-[#185FA5] dark:text-blue-400">{q.quotation_no}</td>
                          <td className="p-3">{q.quotation_date}</td>
                          <td className="p-3">{q.projects?.name || '—'}</td>
                          <td className="p-3 text-right font-semibold">₹{Number(q.total_value).toLocaleString('en-IN')}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              q.status.toLowerCase() === 'approved' || q.status.toLowerCase() === 'converted'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40'
                                : 'bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                            }`}>
                              {q.status}
                            </span>
                          </td>
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
                <div className="flex justify-center items-center py-10"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>
              ) : clientInvoices.length === 0 ? (
                <div className="text-center py-10 text-xs text-zinc-400">No invoices found for this client.</div>
              ) : (
                <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 font-semibold">
                      <tr>
                        <th className="p-3">Invoice Number</th>
                        <th className="p-3">Invoice Date</th>
                        <th className="p-3">Project / Site</th>
                        <th className="p-3 text-right">Total Value</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 dark:bg-zinc-950/20">
                      {clientInvoices.map(inv => (
                        <tr key={inv.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                          <td className="p-3 font-semibold text-[#185FA5] dark:text-blue-400">{inv.invoice_no}</td>
                          <td className="p-3">{inv.invoice_date}</td>
                          <td className="p-3">{inv.projects?.name || '—'}</td>
                          <td className="p-3 text-right font-semibold">₹{Number(inv.total).toLocaleString('en-IN')}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              inv.status.toLowerCase() === 'paid'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40'
                                : inv.status.toLowerCase() === 'partial' || inv.status.toLowerCase() === 'unpaid'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40'
                                  : 'bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                            }`}>
                              {inv.status}
                            </span>
                          </td>
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
                <div className="flex justify-center items-center py-10"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>
              ) : commHistory.length === 0 ? (
                <div className="text-center py-10 text-xs text-zinc-400">No past call interactions logged for this client.</div>
              ) : (
                <div className="space-y-4">
                  {commHistory.map(comm => {
                    const receiver = orgMembers.find(m => m.user_id === comm.call_received_by);
                    return (
                      <div key={comm.id} className="p-4 bg-zinc-50/50 dark:bg-zinc-950/40 border border-zinc-200/60 dark:border-zinc-800 rounded-xl space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-zinc-850 dark:text-zinc-200">
                              {comm.call_type} Inflow — {comm.call_category}
                            </span>
                            <span className="text-[10px] text-zinc-450 dark:text-zinc-500 font-medium">
                              {new Date(comm.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              comm.status === 'Closed'
                                ? 'bg-zinc-100 text-zinc-650 dark:bg-zinc-850 dark:text-zinc-400'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'
                            }`}>
                              {comm.status}
                            </span>
                            {comm.priority === 'Urgent' && (
                              <span className="bg-red-50 text-red-650 dark:bg-red-950/20 dark:text-red-400 text-[9px] font-bold px-1.5 py-0.5 rounded animate-pulse">
                                Urgent
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-zinc-600 dark:text-zinc-300 bg-white dark:bg-zinc-950 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-850 leading-relaxed">
                          {comm.call_brief}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-zinc-450 dark:text-zinc-500 pt-1">
                          <p>Logged by: <span className="font-medium text-zinc-600 dark:text-zinc-300">{receiver?.full_name || 'System'} ({comm.logged_by_role || 'member'})</span></p>
                          {comm.next_action && <p className="font-semibold text-[#185FA5] dark:text-blue-400">Action: {comm.next_action}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
