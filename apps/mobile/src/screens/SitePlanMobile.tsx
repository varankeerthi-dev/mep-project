import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  HardHat, Calendar, Clock, Users, ArrowLeft, Search, 
  CheckCircle2, AlertTriangle, RefreshCw, UserCheck
} from 'lucide-react';

interface SitePlanMobileProps {
  onBack: () => void;
  isDemo?: boolean;
}

interface SitePlanAllocationItem {
  id: string;
  allocation_type: 'employee' | 'subcontractor' | 'headcount_placeholder';
  allocated_trade?: string | null;
  headcount: number;
  status: string;
  employee?: {
    id: string;
    name: string;
    employee_code?: string;
    designation?: string;
  } | null;
  subcontractor?: {
    id: string;
    vendor_name?: string;
    company_name?: string;
  } | null;
}

interface SitePlanItem {
  id: string;
  organisation_id: string;
  plan_name: string;
  plan_date: string;
  start_time: string | null;
  end_time: string | null;
  trade: string | null;
  headcount_required: number;
  allocated_headcount?: number;
  notes: string | null;
  plan_status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled';
  client_confirmation_status: 'not_confirmed' | 'confirmed' | 'postponement_requested' | 'cancelled';
  execution_status: 'scheduled' | 'dispatched' | 'in_progress' | 'completed' | 'cancelled';
  site_visit_id: string | null;
  is_billable?: boolean;
  bill_rate?: number;
  bill_amount?: number;
  invoice_id?: string | null;
  project?: { id: string; title?: string } | null;
  client?: { id: string; company_name?: string } | null;
  allocations?: SitePlanAllocationItem[];
}

export const SitePlanMobile: React.FC<SitePlanMobileProps> = ({ onBack, isDemo = false }) => {
  const [plans, setPlans] = useState<SitePlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'tomorrow' | 'confirmed' | 'postponed'>('all');
  
  // Reschedule state
  const [reschedulePlan, setReschedulePlan] = useState<SitePlanItem | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('Client requested postponement');
  const [clientAgreed, setClientAgreed] = useState(false);
  const [isSubmittingReschedule, setIsSubmittingReschedule] = useState(false);

  // Convert to actual state
  const [convertingPlan, setConvertingPlan] = useState<SitePlanItem | null>(null);
  const [actualHeadcount, setActualHeadcount] = useState(1);
  const [actualHours, setActualHours] = useState(8);
  const [supervisorName, setSupervisorName] = useState('');
  const [actualRemarks, setActualRemarks] = useState('');
  const [isSubmittingConvert, setIsSubmittingConvert] = useState(false);

  // Tomorrow string YYYY-MM-DD
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  useEffect(() => {
    loadPlans();
  }, [isDemo]);

  const loadPlans = async () => {
    setLoading(true);
    if (isDemo) {
      const demoPlans: SitePlanItem[] = [
        {
          id: 'demo-sp-1',
          organisation_id: 'demo-org',
          plan_name: 'Main HVAC Ductwork Erection',
          plan_date: tomorrowStr,
          start_time: '08:30:00',
          end_time: '17:30:00',
          trade: 'HVAC',
          headcount_required: 4,
          allocated_headcount: 3,
          notes: 'Client agreed to open roof access door by 08:00 AM.',
          plan_status: 'approved',
          client_confirmation_status: 'confirmed',
          execution_status: 'scheduled',
          site_visit_id: null,
          project: { id: 'p1', title: 'Metro Station HVAC Phase 2' },
          client: { id: 'c1', company_name: 'Metro Rail Corp' },
          allocations: [
            {
              id: 'a1',
              allocation_type: 'employee',
              allocated_trade: 'HVAC',
              headcount: 2,
              status: 'confirmed',
              employee: { id: 'e1', name: 'Rajesh Kumar', employee_code: 'EMP-001', designation: 'Lead Tech' },
            },
            {
              id: 'a2',
              allocation_type: 'subcontractor',
              allocated_trade: 'Ductwork',
              headcount: 1,
              status: 'confirmed',
              subcontractor: { id: 's1', company_name: 'Vortex Ducting Solutions' },
            },
          ],
        },
        {
          id: 'demo-sp-2',
          organisation_id: 'demo-org',
          plan_name: 'Fire Alarm Loop 3 Cabling',
          plan_date: tomorrowStr,
          start_time: '09:00:00',
          end_time: '18:00:00',
          trade: 'Fire Protection',
          headcount_required: 2,
          allocated_headcount: 2,
          notes: 'Pending client confirmation of corridor access clearance.',
          plan_status: 'draft',
          client_confirmation_status: 'not_confirmed',
          execution_status: 'scheduled',
          site_visit_id: null,
          project: { id: 'p2', title: 'IT Tech Park Block C' },
          client: { id: 'c2', company_name: 'Prestige Infra' },
          allocations: [
            {
              id: 'a3',
              allocation_type: 'employee',
              allocated_trade: 'Electrical',
              headcount: 2,
              status: 'assigned',
              employee: { id: 'e2', name: 'Senthil Nathan', employee_code: 'EMP-008', designation: 'Master Electrician' },
            },
          ],
        },
      ];
      setPlans(demoPlans);
      setLoading(false);
      return;
    }

    try {
      // First attempt query on unified manpower_attendance with entry_kind = 'PLANNED'
      const { data: attendanceData, error: attError } = await supabase
        .from('manpower_attendance')
        .select(`
          id,
          organisation_id,
          attendance_date,
          workers_count,
          remarks,
          status,
          client_confirmation,
          project_id,
          client_id,
          subcontractor_id,
          is_billable,
          bill_rate,
          bill_amount,
          invoice_id,
          project:projects(id, name, project_name),
          client:clients(id, client_name, name),
          category:labour_categories(id, name, code),
          subcontractor:subcontractors(id, company_name),
          worker:labour_workers(id, name)
        `)
        .eq('entry_kind', 'PLANNED')
        .order('attendance_date', { ascending: true });

      if (!attError && attendanceData && attendanceData.length > 0) {
        const formatted: SitePlanItem[] = attendanceData.map((p: any) => ({
          id: p.id,
          organisation_id: p.organisation_id,
          plan_name: p.remarks || `${p.category?.name || 'Labour'} on ${p.project?.project_name || p.project?.name || 'Project'}`,
          plan_date: p.attendance_date,
          start_time: '08:00:00',
          end_time: '17:00:00',
          trade: p.category?.name || 'Labour',
          headcount_required: p.workers_count || 1,
          allocated_headcount: p.workers_count || 1,
          notes: p.remarks,
          plan_status: p.status === 'CONVERTED' ? 'approved' : (p.status === 'APPROVED' ? 'approved' : 'draft'),
          client_confirmation_status: p.client_confirmation === 'confirmed' ? 'confirmed' : 'not_confirmed',
          execution_status: p.status === 'CONVERTED' ? 'completed' : 'scheduled',
          site_visit_id: null,
          is_billable: p.is_billable,
          bill_rate: p.bill_rate ? Number(p.bill_rate) : undefined,
          bill_amount: p.bill_amount ? Number(p.bill_amount) : undefined,
          invoice_id: p.invoice_id,
          project: p.project ? { id: p.project.id, title: p.project.project_name || p.project.name } : null,
          client: p.client ? { id: p.client.id, company_name: p.client.client_name || p.client.name } : null,
          allocations: [
            {
              id: p.id + '-alloc',
              allocation_type: p.subcontractor_id ? 'subcontractor' : 'headcount_placeholder',
              allocated_trade: p.category?.name || 'Labour',
              headcount: p.workers_count || 1,
              status: p.client_confirmation === 'confirmed' ? 'confirmed' : 'assigned',
              subcontractor: p.subcontractor ? { id: p.subcontractor.id, company_name: p.subcontractor.company_name } : null,
            }
          ]
        }));
        setPlans(formatted);
        return;
      }

      // Fallback to site_plans table if available
      const { data, error } = await supabase
        .from('site_plans')
        .select(`
          *,
          project:projects(id, title),
          client:clients(id, company_name),
          allocations:site_plan_allocations(
            *,
            employee:employees(id, name, employee_code, designation),
            subcontractor:subcontractors(id, vendor_name, company_name)
          )
        `)
        .order('plan_date', { ascending: true });

      if (error) throw error;

      const formatted = (data || []).map((p: any) => ({
        ...p,
        allocated_headcount: (p.allocations || []).reduce(
          (sum: number, a: any) => sum + (Number(a.headcount) || 1),
          0
        ),
      }));

      setPlans(formatted);
    } catch (err: any) {
      console.error('Error fetching mobile site plans:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleConfirmation = async (plan: SitePlanItem) => {
    const newConfirmation = plan.client_confirmation_status === 'confirmed' ? 'planned_unconfirmed' : 'confirmed';
    if (isDemo) {
      setPlans(prev => prev.map(p => p.id === plan.id ? {
        ...p,
        client_confirmation_status: newConfirmation === 'confirmed' ? 'confirmed' : 'not_confirmed'
      } : p));
      return;
    }

    try {
      const { error } = await supabase.rpc('confirm_plan_with_client', {
        p_attendance_id: plan.id,
        p_organisation_id: plan.organisation_id,
        p_confirmation: newConfirmation,
      });

      if (error) throw error;

      setPlans(prev => prev.map(p => p.id === plan.id ? {
        ...p,
        client_confirmation_status: newConfirmation === 'confirmed' ? 'confirmed' : 'not_confirmed'
      } : p));
    } catch (err: any) {
      alert(`Confirmation toggle failed: ${err?.message || 'Server error'}`);
    }
  };

  const handleConvertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertingPlan) return;

    setIsSubmittingConvert(true);
    try {
      if (isDemo) {
        setPlans(prev => prev.map(p => p.id === convertingPlan.id ? {
          ...p,
          execution_status: 'completed',
          plan_status: 'approved'
        } : p));
        setConvertingPlan(null);
        return;
      }

      const { error } = await supabase.rpc('convert_plan_to_actual', {
        p_plan_id: convertingPlan.id,
        p_organisation_id: convertingPlan.organisation_id,
        p_actual_headcount: actualHeadcount,
        p_actual_hours: actualHours,
        p_supervisor_name: supervisorName || null,
        p_applied_modifiers: [],
        p_remarks: actualRemarks || null,
      });

      if (error) throw error;

      setPlans(prev => prev.map(p => p.id === convertingPlan.id ? {
        ...p,
        execution_status: 'completed',
        plan_status: 'approved'
      } : p));

      setConvertingPlan(null);
    } catch (err: any) {
      alert(`Conversion failed: ${err?.message || 'Server error'}`);
    } finally {
      setIsSubmittingConvert(false);
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedulePlan || !rescheduleDate) return;

    setIsSubmittingReschedule(true);
    try {
      if (isDemo) {
        setPlans(prev => prev.map(p => p.id === reschedulePlan.id ? { 
          ...p, 
          plan_date: rescheduleDate, 
          client_confirmation_status: clientAgreed ? 'confirmed' : 'postponement_requested' 
        } : p));
        setReschedulePlan(null);
        return;
      }

      // Update plan on manpower_attendance
      const { error: updateError } = await supabase
        .from('manpower_attendance')
        .update({
          attendance_date: rescheduleDate,
          client_confirmation: clientAgreed ? 'confirmed' : 'planned_unconfirmed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', reschedulePlan.id);

      if (updateError) {
        // Fallback to site_plans update if needed
        await supabase
          .from('site_plans')
          .update({
            plan_date: rescheduleDate,
            client_confirmation_status: clientAgreed ? 'confirmed' : 'postponement_requested',
            updated_at: new Date().toISOString(),
          })
          .eq('id', reschedulePlan.id);
      }

      setPlans(prev => prev.map(p => p.id === reschedulePlan.id ? {
        ...p,
        plan_date: rescheduleDate,
        client_confirmation_status: clientAgreed ? 'confirmed' : 'postponement_requested'
      } : p));

      setReschedulePlan(null);
    } catch (err: any) {
      alert(`Reschedule failed: ${err?.message || 'Server error'}`);
    } finally {
      setIsSubmittingReschedule(false);
    }
  };

  // Filtered plans
  const filteredPlans = useMemo(() => {
    return plans.filter(p => {
      const matchesSearch = 
        !searchQuery ||
        p.plan_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.client?.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.trade?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterMode === 'tomorrow') return p.plan_date === tomorrowStr;
      if (filterMode === 'confirmed') return p.client_confirmation_status === 'confirmed';
      if (filterMode === 'postponed') return p.client_confirmation_status === 'postponement_requested';

      return true;
    });
  }, [plans, searchQuery, filterMode, tomorrowStr]);

  // Tomorrow totals
  const tomorrowPlans = useMemo(() => plans.filter(p => p.plan_date === tomorrowStr), [plans, tomorrowStr]);
  const tomorrowReq = useMemo(() => tomorrowPlans.reduce((sum, p) => sum + (Number(p.headcount_required) || 1), 0), [tomorrowPlans]);
  const tomorrowAlloc = useMemo(() => tomorrowPlans.reduce((sum, p) => sum + (Number(p.allocated_headcount) || 0), 0), [tomorrowPlans]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans select-none antialiased">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-xl border-b border-border/50 px-4 pt-10 pb-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button 
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <div className="flex items-center gap-2">
            <HardHat className="w-5 h-5 text-primary" />
            <h1 className="text-base font-bold text-foreground">Site Plans & Manpower</h1>
          </div>
          <button 
            onClick={loadPlans}
            disabled={loading}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-lg mx-auto w-full px-4 pt-3 pb-24 space-y-4">
        {/* Tomorrow's Standup Metric Card */}
        <div className="glass-card rounded-2xl p-4 bg-card/80 border border-border/50 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              Tomorrow's Standup ({tomorrowStr})
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {tomorrowPlans.length} Site Plans
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="bg-background/60 p-3 rounded-xl border border-border/40">
              <span className="text-[11px] text-muted-foreground block font-medium">Headcount Required</span>
              <span className="text-xl font-black text-foreground">{tomorrowReq}</span>
            </div>
            <div className="bg-background/60 p-3 rounded-xl border border-border/40">
              <span className="text-[11px] text-muted-foreground block font-medium">Headcount Allocated</span>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-foreground">{tomorrowAlloc}</span>
                {tomorrowAlloc < tomorrowReq ? (
                  <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                    Gap: {tomorrowReq - tomorrowAlloc}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    Ready
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by project, client, or trade..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium"
            />
          </div>

          {/* Quick Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'all', label: 'All Plans' },
              { id: 'tomorrow', label: 'Tomorrow' },
              { id: 'confirmed', label: 'Client Confirmed' },
              { id: 'postponed', label: 'Postponed' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterMode(f.id as any)}
                className={`py-1 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  filterMode === f.id
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-card border border-border/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Plan Cards List */}
        {loading ? (
          <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
            <RefreshCw className="w-5 h-5 mx-auto animate-spin text-primary" />
            <p>Loading planned site manpower...</p>
          </div>
        ) : filteredPlans.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground border border-dashed border-border rounded-2xl p-6 bg-card/40">
            <HardHat className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="font-semibold text-foreground">No site plans found</p>
            <p className="mt-1">Try switching filters or adjusting your search query.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPlans.map((plan) => {
              const isConfirmed = plan.client_confirmation_status === 'confirmed';
              const isPostponed = plan.client_confirmation_status === 'postponement_requested';
              const isCompleted = plan.execution_status === 'completed';

              return (
                <div
                  key={plan.id}
                  className="glass-card rounded-2xl p-4 bg-card/90 border border-border/60 shadow-xs space-y-3 transition-all"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-foreground">
                          {plan.plan_name}
                        </span>
                        {plan.trade && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">
                            {plan.trade}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground font-medium">
                        {plan.client?.company_name || 'Direct Client'} • {plan.project?.title || 'General'}
                      </p>
                    </div>

                    {/* Confirmation Status Badge / Action */}
                    <button
                      onClick={() => handleToggleConfirmation(plan)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors cursor-pointer ${
                        isConfirmed
                          ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                          : isPostponed
                          ? 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
                          : 'bg-muted text-muted-foreground border border-border'
                      }`}
                      title="Tap to toggle client confirmation"
                    >
                      {isConfirmed ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Confirmed</span>
                        </>
                      ) : isPostponed ? (
                        <>
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span>Postponed</span>
                        </>
                      ) : (
                        <span>Tap to Confirm</span>
                      )}
                    </button>
                  </div>

                  {/* Date & Time & Headcount Summary */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-border/30">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span className="flex items-center gap-1 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-primary" />
                        {plan.plan_date}
                      </span>
                      <span className="flex items-center gap-1 font-medium">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        {plan.start_time?.slice(0, 5) || '08:00'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Users className="w-3.5 h-3.5 text-primary" />
                      <span>{plan.allocated_headcount || plan.headcount_required} workers</span>
                    </div>
                  </div>

                  {/* Notes / Remarks if any */}
                  {plan.notes && (
                    <p className="text-[11px] bg-secondary/50 p-2 rounded-xl text-muted-foreground italic border border-border/30">
                      "{plan.notes}"
                    </p>
                  )}

                  {/* Billable & Client Recharge info (left-aligned) */}
                  {plan.is_billable && (
                    <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-border/20 text-left">
                      <div className="flex items-center gap-1.5 text-left font-semibold text-primary">
                        <span>Recharge: ₹{Number(plan.bill_amount || 0).toFixed(2)}</span>
                        {plan.bill_rate && (
                          <span className="text-muted-foreground text-[10px]">(@ ₹{Number(plan.bill_rate).toFixed(2)}/day)</span>
                        )}
                      </div>
                      {plan.invoice_id ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                          Invoiced
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/15 text-blue-600 border border-blue-500/30">
                          Billable Uninvoiced
                        </span>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setReschedulePlan(plan);
                        setRescheduleDate(plan.plan_date);
                        setClientAgreed(false);
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold transition-colors"
                    >
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Reschedule</span>
                    </button>

                    {!isCompleted ? (
                      <button
                        onClick={() => {
                          setConvertingPlan(plan);
                          setActualHeadcount(plan.allocated_headcount || plan.headcount_required || 1);
                          setActualHours(8);
                          setSupervisorName('');
                          setActualRemarks('');
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Log Actual</span>
                      </button>
                    ) : (
                      <div className="flex-1 py-2 px-3 rounded-xl bg-emerald-500/10 text-emerald-600 text-xs font-bold text-center flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Actual Recorded</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Convert to Actual Bottom Sheet */}
      {convertingPlan && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-card rounded-t-3xl sm:rounded-2xl p-5 border border-border shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <div>
                <h3 className="text-base font-bold text-foreground">Record Actual Attendance</h3>
                <p className="text-xs text-muted-foreground">Plan: {convertingPlan.plan_name}</p>
              </div>
              <button 
                onClick={() => setConvertingPlan(null)}
                className="text-xs text-muted-foreground hover:text-foreground p-1"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleConvertSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Actual Headcount
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={actualHeadcount}
                    onChange={(e) => setActualHeadcount(parseInt(e.target.value) || 1)}
                    className="w-full h-11 px-3 bg-background border border-border rounded-xl text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Hours Worked
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={actualHours}
                    onChange={(e) => setActualHours(parseFloat(e.target.value) || 8)}
                    className="w-full h-11 px-3 bg-background border border-border rounded-xl text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Supervisor Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={supervisorName}
                  onChange={(e) => setSupervisorName(e.target.value)}
                  className="w-full h-11 px-3 bg-background border border-border rounded-xl text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Site Remarks (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Completed ductwork on Zone 2"
                  value={actualRemarks}
                  onChange={(e) => setActualRemarks(e.target.value)}
                  className="w-full h-11 px-3 bg-background border border-border rounded-xl text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingConvert}
                className="w-full h-11 mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors disabled:opacity-50"
              >
                {isSubmittingConvert ? 'Recording...' : 'Save Actual Attendance (Server Rates)'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Reschedule Bottom Sheet */}
      {reschedulePlan && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-card rounded-t-3xl sm:rounded-2xl p-5 border border-border shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <div>
                <h3 className="text-base font-bold text-foreground">Reschedule Site Plan</h3>
                <p className="text-xs text-muted-foreground">Plan: {reschedulePlan.plan_name}</p>
              </div>
              <button 
                onClick={() => setReschedulePlan(null)}
                className="text-xs text-muted-foreground hover:text-foreground p-1"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  New Target Date
                </label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full h-11 px-3 bg-background border border-border rounded-xl text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Reschedule Reason
                </label>
                <select
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  className="w-full h-11 px-3 bg-background border border-border rounded-xl text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="Client requested postponement">Client requested postponement</option>
                  <option value="Materials / equipment delayed">Materials / equipment delayed</option>
                  <option value="Site not ready / access denied">Site not ready / access denied</option>
                  <option value="Manpower shortage / crew reallocation">Manpower shortage / crew reallocation</option>
                  <option value="Weather / safety stoppage">Weather / safety stoppage</option>
                  <option value="Other operational constraint">Other operational constraint</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="clientAgreedMobile"
                  checked={clientAgreed}
                  onChange={(e) => setClientAgreed(e.target.checked)}
                  className="w-4 h-4 rounded text-primary border-border focus:ring-primary"
                />
                <label htmlFor="clientAgreedMobile" className="text-xs font-medium text-foreground">
                  Client has verbally agreed to this new date
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmittingReschedule}
                className="w-full h-11 mt-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs transition-colors disabled:opacity-50"
              >
                {isSubmittingReschedule ? 'Saving...' : 'Confirm Reschedule'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
