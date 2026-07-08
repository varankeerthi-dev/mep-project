import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BottomSheetPicker } from '../components/BottomSheetPicker';
import { 
  Search, ShieldAlert, CheckCircle, Clock, 
  Loader2, ArrowLeft, Send
} from 'lucide-react';

interface ClientLookupProps {
  onBack: () => void;
  isDemo?: boolean;
}

interface Option {
  id: string;
  name: string;
}

export const ClientLookup: React.FC<ClientLookupProps> = ({ onBack, isDemo = false }) => {
  const [loading, setLoading] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  
  // Lists
  const [clients, setClients] = useState<Option[]>([]);
  const [projects, setProjects] = useState<Option[]>([]);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [orgMembers, setOrgMembers] = useState<any[]>([]);

  // active SO & status
  const [activeSO, setActiveSO] = useState<any>(null);
  const [dispatchStatus, setDispatchStatus] = useState<any>(null);
  const [isDispatchLoading, setIsDispatchLoading] = useState(false);

  // Search scope state
  const [scopeKeyword, setScopeKeyword] = useState('');
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [scopeMatches, setScopeMatches] = useState<any[]>([]);
  const [scopeInScope, setScopeInScope] = useState<boolean | null>(null);
  const [isSearchingScope, setIsSearchingScope] = useState(false);

  // Call logging form state
  const [callNotes, setCallNotes] = useState('');
  const [callPriority, setCallPriority] = useState<'Normal' | 'Urgent'>('Normal');
  const [callCategory, setCallCategory] = useState<'CLIENT' | 'VENDOR'>('CLIENT');
  const [isResolvedOnCall, setIsResolvedOnCall] = useState(false);
  const [assignedToId, setAssignedToId] = useState('');
  const [requestedAdditionalScope, setRequestedAdditionalScope] = useState(false);
  const [additionalScopeText, setAdditionalScopeText] = useState('');
  const [isSavingLog, setIsSavingLog] = useState(false);

  // Fetch initial selectors
  useEffect(() => {
    if (isDemo) {
      loadDemoSelectors();
    } else {
      fetchSelectors();
    }
  }, [isDemo]);

  const loadDemoSelectors = () => {
    setClients([
      { id: 'demo-c1', name: 'Metro Developers' },
      { id: 'demo-c2', name: 'Skyline Builders' }
    ]);
    setAllProjects([
      { id: 'demo-p1', name: 'Metro Line Expansion', client_id: 'demo-c1', site_engineer_id: 'demo-eng-1' },
      { id: 'demo-p2', name: 'Commercial Complex B', client_id: 'demo-c1', site_engineer_id: 'demo-eng-2' },
      { id: 'demo-p3', name: 'Skyline Residential A', client_id: 'demo-c2', site_engineer_id: 'demo-eng-1' }
    ]);
    setOrgMembers([
      { user_id: 'demo-eng-1', full_name: 'Anil Kumar', role_name: 'Site Engineer' },
      { user_id: 'demo-eng-2', full_name: 'Vikram Singh', role_name: 'Senior Engineer' },
      { user_id: 'demo-sales', full_name: 'Priya Sharma', role_name: 'Sales Manager' }
    ]);
  };

  const fetchSelectors = async () => {
    setLoading(true);
    try {
      // 1. Get current user organisation_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberData } = await supabase
        .from('org_members')
        .select('organisation_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      const orgId = memberData?.organisation_id;
      if (!orgId) return;

      // 2. Fetch clients
      const { data: clientData } = await supabase
        .from('clients')
        .select('id, client_name')
        .eq('organisation_id', orgId)
        .order('client_name');
      
      setClients((clientData || []).map(c => ({ id: c.id, name: c.client_name })));

      // 3. Fetch projects
      const { data: projectData } = await supabase
        .from('projects')
        .select('id, name, client_id, site_engineer_id')
        .eq('organisation_id', orgId)
        .order('name');
      
      setAllProjects(projectData || []);

      // 4. Fetch members
      const { data: memberList } = await supabase
        .from('org_members')
        .select('user_id, roles(name), user_profiles(full_name)')
        .eq('organisation_id', orgId);

      setOrgMembers((memberList || []).map((m: any) => ({
        user_id: m.user_id,
        full_name: m.user_profiles?.full_name || 'Unnamed',
        role_name: m.roles?.name || 'Member'
      })));

    } catch (err) {
      console.error('Error fetching quick lookup data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter projects by client
  useEffect(() => {
    const filtered = allProjects
      .filter(p => p.client_id === selectedClientId)
      .map(p => ({ id: p.id, name: p.name }));
    setProjects(filtered);
    setSelectedProjectId('');
    setScopeKeyword('');
    setSearchTriggered(false);
    setScopeMatches([]);
  }, [selectedClientId, allProjects]);

  // Fetch Sales Order & compute status
  useEffect(() => {
    if (!selectedClientId || !selectedProjectId) {
      setActiveSO(null);
      setDispatchStatus(null);
      return;
    }

    if (isDemo) {
      loadDemoSOStatus();
    } else {
      fetchSOStatus();
    }
  }, [selectedClientId, selectedProjectId]);

  const loadDemoSOStatus = () => {
    if (selectedProjectId === 'demo-p1') {
      setActiveSO({ id: 'demo-so-1', sales_order_no: 'SO-2026-004', created_by: 'demo-sales' });
      setDispatchStatus({
        status_label: 'Blocked: Advance Payment Pending',
        detail: '₹2,40,000 due on Invoice #INV-118, no receipt recorded',
        so_status: 'open',
        stock_status: 'partially_reserved',
        payment_pending: 240000
      });
    } else {
      setActiveSO({ id: 'demo-so-2', sales_order_no: 'SO-2026-009', created_by: 'demo-sales' });
      setDispatchStatus({
        status_label: 'In Production',
        detail: '60% complete, no blockers.',
        so_status: 'in_production',
        stock_status: 'fully_reserved',
        payment_pending: 0
      });
    }
  };

  const fetchSOStatus = async () => {
    setIsDispatchLoading(true);
    try {
      const { data: memberData } = await supabase
        .from('org_members')
        .select('organisation_id')
        .limit(1)
        .maybeSingle();

      const orgId = memberData?.organisation_id;
      if (!orgId) return;

      const { data: so } = await supabase
        .from('sales_orders')
        .select('id, sales_order_no, status, stock_status, created_by, quotation_id')
        .eq('organisation_id', orgId)
        .eq('client_id', selectedClientId)
        .eq('project_id', selectedProjectId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setActiveSO(so);

      if (so) {
        const { data: status } = await supabase
          .rpc('get_dispatch_status', { p_sales_order_id: so.id });
        setDispatchStatus(status);
      } else {
        setDispatchStatus(null);
      }
    } catch (err) {
      console.error('SO status error:', err);
    } finally {
      setIsDispatchLoading(false);
    }
  };

  // Pre-select assignee based on SO/project settings
  useEffect(() => {
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
  }, [selectedProjectId, activeSO, allProjects]);

  // Execute search
  const handleScopeCheck = async () => {
    if (!selectedProjectId || !scopeKeyword.trim()) return;

    setIsSearchingScope(true);
    if (isDemo) {
      setTimeout(() => {
        const kw = scopeKeyword.toLowerCase();
        if (selectedProjectId === 'demo-p1' && kw.includes('ceil')) {
          setScopeMatches([{ item_name: 'False Ceiling Electrical Wiring', quotation_no: 'Q-118', rate: 45000, approved_date: '2026-05-12' }]);
          setScopeInScope(true);
        } else if (selectedProjectId === 'demo-p2' && kw.includes('wir')) {
          setScopeMatches([{ item_name: 'Main Electrical Panel Wiring', quotation_no: 'Q-120', rate: 120000, approved_date: '2026-06-01' }]);
          setScopeInScope(true);
        } else {
          setScopeMatches([]);
          setScopeInScope(false);
        }
        setSearchTriggered(true);
        setIsSearchingScope(false);
      }, 500);
    } else {
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
      } catch (err) {
        console.error('Scope check error:', err);
      } finally {
        setIsSearchingScope(false);
      }
    }
  };

  // Save call log
  const handleLogCall = async () => {
    if (!selectedClientId || !selectedProjectId) return;
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

      if (isDemo) {
        setTimeout(() => {
          setIsSavingLog(false);
          setCallNotes('');
          setRequestedAdditionalScope(false);
          setAdditionalScopeText('');
          alert('Call logged and routed (Demo Mode)!');
        }, 800);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: memberData } = await supabase
          .from('org_members')
          .select('organisation_id, role')
          .eq('user_id', user?.id)
          .limit(1)
          .maybeSingle();

        const { data: commData } = await supabase
          .from('client_communication')
          .insert({
            organisation_id: memberData?.organisation_id,
            client_id: selectedClientId,
            call_type: 'Incoming',
            call_category: callCategory,
            call_regarding: 'Quick Lookup Resolution',
            call_brief: rawBrief,
            next_action: requestedAdditionalScope ? `Follow up on additional scope: ${additionalScopeText}` : (isResolvedOnCall ? 'Resolved' : 'Follow up required'),
            status: isResolvedOnCall ? 'Closed' : 'Open',
            priority: callPriority,
            is_resolved: isResolvedOnCall,
            assigned_to: assignedToId || null,
            logged_by_role: memberData?.role || 'member',
            call_received_by: user?.id,
            call_entered_by: user?.id,
            linked_type: activeSO?.id ? 'sales_order' : (activeSO?.quotation_id ? 'quotation' : null),
            linked_id: activeSO?.id || activeSO?.quotation_id || null
          })
          .select()
          .single();

        await supabase
          .from('client_communication_entries')
          .insert({
            parent_communication_id: commData.id,
            entry_type: 'Briefing',
            brief: `Mobile lookup resolution logging by ${memberData?.role || 'member'}.`,
            entered_by: user?.id
          });

        if (assignedToId && assignedToId !== user?.id) {
          await supabase
            .from('notifications')
            .insert({
              user_id: assignedToId,
              organisation_id: memberData?.organisation_id,
              title: `Client Call Logged: ${clients.find(c => c.id === selectedClientId)?.name}`,
              body: `Mobile Logged. Action Required: ${requestedAdditionalScope ? additionalScopeText : 'Check lookup log'}`,
              link: '/follow-up'
            });
        }

        setIsSavingLog(false);
        setCallNotes('');
        setRequestedAdditionalScope(false);
        setAdditionalScopeText('');
        alert('Call logged and routed successfully!');
      }
    } catch (err: any) {
      console.error(err);
      setIsSavingLog(false);
      alert('Error: ' + err.message);
    }
  };

  const getStatusBgClass = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes('payment') || l.includes('shortfall') || l.includes('block')) {
      return 'bg-red-500/10 border-red-500/20 text-red-500';
    }
    if (l.includes('ready') || l.includes('complete')) {
      return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500';
    }
    return 'bg-amber-500/10 border-amber-500/20 text-amber-500';
  };

  const getStatusIconComponent = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes('payment') || l.includes('shortfall') || l.includes('block')) {
      return <ShieldAlert className="h-5 w-5 text-red-500" />;
    }
    if (l.includes('ready') || l.includes('complete')) {
      return <CheckCircle className="h-5 w-5 text-emerald-500" />;
    }
    return <Clock className="h-5 w-5 text-amber-500" />;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24 max-w-lg mx-auto">
      {/* Header */}
      <header className="px-4 pt-10 pb-4 flex items-center gap-3 border-b border-border bg-card">
        <button onClick={onBack} className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground active:scale-95 transition-all">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-base font-bold text-foreground">Quick Lookup</h1>
          <p className="text-[10px] text-muted-foreground">Client query resolver</p>
        </div>
      </header>

      <main className="px-4 py-4 space-y-5 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Pickers */}
            <div className="space-y-3.5">
              <BottomSheetPicker
                label="Client Name"
                options={clients}
                value={selectedClientId}
                onChange={setSelectedClientId}
                placeholder="Tap to select client"
              />
              <BottomSheetPicker
                label="Project Site"
                options={projects}
                value={selectedProjectId}
                onChange={setSelectedProjectId}
                placeholder="Tap to select project"
              />
            </div>

            {selectedProjectId && (
              <>
                {/* 1. Dispatch Check */}
                <div className="glass-card rounded-2xl p-4 space-y-3 border border-border/40">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">1. Dispatch & Blockers</h3>
                  
                  {isDispatchLoading ? (
                    <div className="flex justify-center items-center py-3">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : !activeSO ? (
                    <p className="text-xs text-muted-foreground text-center py-2">No active Sales Order found.</p>
                  ) : !dispatchStatus ? (
                    <p className="text-xs text-muted-foreground text-center py-2">No status computed.</p>
                  ) : (
                    <div className={`p-3.5 rounded-xl border flex gap-3 items-start ${getStatusBgClass(dispatchStatus.status_label)}`}>
                      <div className="mt-0.5 shrink-0 bg-white/30 dark:bg-black/20 p-1 rounded-lg">
                        {getStatusIconComponent(dispatchStatus.status_label)}
                      </div>
                      <div className="space-y-1 flex-1">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-bold">{dispatchStatus.status_label}</h4>
                          <span className="text-[9px] px-1.5 py-0.2 bg-white/20 dark:bg-black/20 rounded font-semibold">
                            {activeSO.sales_order_no}
                          </span>
                        </div>
                        <p className="text-[11px] leading-snug opacity-90">{dispatchStatus.detail}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Scope verification */}
                <div className="glass-card rounded-2xl p-4 space-y-3 border border-border/40">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">2. Scope Check</h3>
                  
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                      <input
                        type="text"
                        placeholder="Search Quotation items (e.g. wiring)..."
                        className="w-full h-9 pl-9 pr-3 rounded-xl border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        value={scopeKeyword}
                        onChange={(e) => setScopeKeyword(e.target.value)}
                      />
                    </div>
                    <button
                      onClick={handleScopeCheck}
                      disabled={isSearchingScope || !scopeKeyword.trim()}
                      className="px-3 h-9 bg-primary text-white font-semibold text-xs rounded-xl active:scale-95 transition-all cursor-pointer disabled:opacity-40"
                    >
                      {isSearchingScope ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Check'}
                    </button>
                  </div>

                  {searchTriggered && (
                    <div className="space-y-2.5 pt-1">
                      {scopeInScope ? (
                        <>
                          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg text-[11px] font-semibold flex items-center gap-1.5">
                            <CheckCircle className="h-4 w-4" />
                            In Scope — Matched quotation items:
                          </div>
                          
                          <div className="divide-y divide-border/40 border border-border/40 rounded-xl overflow-hidden bg-card/45">
                            {scopeMatches.map((m, idx) => (
                              <div key={idx} className="p-2.5 flex justify-between items-center text-[11px]">
                                <div className="space-y-0.5">
                                  <p className="font-semibold text-foreground">{m.item_name}</p>
                                  <p className="text-[9px] text-muted-foreground">Approved: {m.approved_date}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-foreground">₹{m.rate.toLocaleString('en-IN')}</p>
                                  <span className="text-[9px] text-muted-foreground px-1 border border-border rounded">
                                    {m.quotation_no}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-[11px] leading-snug flex gap-2">
                          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-bold">Not in agreed Quotation</p>
                            <p className="opacity-80 mt-0.5">This item is likely out of scope.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Call Log */}
                <div className="glass-card rounded-2xl p-4 space-y-3.5 border border-border/40">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">3. Log Conversation</h3>
                  
                  {/* Party Type Toggle */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">Party Type</label>
                    <div className="flex gap-2">
                      {['CLIENT', 'VENDOR'].map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCallCategory(c as any)}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                            callCategory === c
                              ? 'bg-primary border-primary text-white shadow-sm'
                              : 'bg-card border-border text-muted-foreground active:bg-secondary'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Priority Toggle */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">Priority</label>
                    <div className="flex gap-2">
                      {['Normal', 'Urgent'].map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setCallPriority(p as any)}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                            callPriority === p
                              ? p === 'Urgent'
                                ? 'bg-destructive border-destructive text-white shadow-sm'
                                : 'bg-primary border-primary text-white shadow-sm'
                              : 'bg-card border-border text-muted-foreground active:bg-secondary'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">Discussion Notes</label>
                    <textarea
                      placeholder="Brief notes from the call..."
                      className="w-full min-h-[60px] p-2.5 rounded-xl border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                      value={callNotes}
                      onChange={(e) => setCallNotes(e.target.value)}
                    />
                  </div>

                  {/* Extra Scope checkbox */}
                  <div className="p-3 bg-secondary/40 border border-border/30 rounded-xl space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={requestedAdditionalScope}
                        onChange={(e) => setRequestedAdditionalScope(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-foreground">Requested additional scope</span>
                    </label>
                    
                    {requestedAdditionalScope && (
                      <textarea
                        placeholder="Detail the scope addition request..."
                        className="w-full min-h-[45px] p-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                        value={additionalScopeText}
                        onChange={(e) => setAdditionalScopeText(e.target.value)}
                      />
                    )}
                  </div>

                  {/* Routing dropdown */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">Assign Action To</label>
                    <select
                      className="w-full h-10 px-2.5 border border-input bg-background rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      value={assignedToId}
                      onChange={(e) => setAssignedToId(e.target.value)}
                    >
                      <option value="">-- Route to Admins / Fallback --</option>
                      {orgMembers.map(m => (
                        <option key={m.user_id} value={m.user_id}>{m.full_name} ({m.role_name})</option>
                      ))}
                    </select>
                  </div>

                  {/* Resolved switch */}
                  <label className="flex items-center gap-2 cursor-pointer select-none py-1">
                    <input
                      type="checkbox"
                      checked={isResolvedOnCall}
                      onChange={(e) => setIsResolvedOnCall(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-foreground">Resolved on the Call</span>
                  </label>

                  {/* Log Call Button */}
                  <button
                    onClick={handleLogCall}
                    disabled={isSavingLog}
                    className="w-full rounded-xl h-11 bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-md shadow-primary/20 disabled:opacity-50"
                  >
                    {isSavingLog ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Log & Route Call
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
};
