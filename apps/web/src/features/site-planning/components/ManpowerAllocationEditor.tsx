import React, { useState, useMemo } from 'react';
import { 
  X, Users, UserCheck, HardHat, Plus, Trash2, 
  Building2, AlertTriangle, CheckCircle2, Shield
} from 'lucide-react';
import { useEmployees } from '../../../hooks/useEmployees';
import { useSubcontractors } from '../../../hooks/useSubcontractors';
import { useSitePlans, useAddAllocation, useRemoveAllocation } from '../hooks/useSitePlans';
import type { SitePlan, AllocationType, AllocationStatus } from '../types';

interface ManpowerAllocationEditorProps {
  plan: SitePlan | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ManpowerAllocationEditor: React.FC<ManpowerAllocationEditorProps> = ({
  plan,
  isOpen,
  onClose,
}) => {
  const { data: employees = [] } = useEmployees();
  const { data: subcontractors = [] } = useSubcontractors();
  const { data: datePlans = [] } = useSitePlans(
    plan?.plan_date ? { startDate: plan.plan_date, endDate: plan.plan_date } : undefined
  );
  const addAllocation = useAddAllocation();
  const removeAllocation = useRemoveAllocation();

  const [allocType, setAllocType] = useState<AllocationType>('employee');
  const [employeeId, setEmployeeId] = useState('');
  const [subcontractorId, setSubcontractorId] = useState('');
  const [trade, setTrade] = useState(plan?.trade || 'Electrical');
  const [headcount, setHeadcount] = useState(1);
  const [subcontractorName, setSubcontractorName] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !plan) return null;

  const totalRequired = Number(plan.headcount_required) || 1;
  const currentAllocations = plan.allocations || [];
  const totalAllocated = currentAllocations.reduce(
    (sum, a) => sum + (Number(a.headcount) || 1),
    0
  );
  const unallocated = Math.max(0, totalRequired - totalAllocated);

  // Double-booking collision detector
  const conflictWarning = useMemo(() => {
    if (allocType !== 'employee' || !employeeId) return null;
    const selectedEmp = employees.find((e: any) => e.id === employeeId);
    const empName = selectedEmp?.name || 'Selected employee';

    for (const p of datePlans) {
      if (p.id === plan.id) continue;
      const match = (p.allocations || []).find((a) => a.employee_id === employeeId);
      if (match) {
        return `${empName} is already assigned to "${p.plan_name}" (${p.trade || 'Work'}) on ${p.plan_date}`;
      }
    }
    return null;
  }, [allocType, employeeId, employees, datePlans, plan]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (allocType === 'employee' && !employeeId) {
      setError('Please select an employee');
      return;
    }
    if (allocType === 'subcontractor' && !subcontractorId && !subcontractorName.trim()) {
      setError('Please select or specify a subcontractor team');
      return;
    }

    const selectedSub = subcontractors.find((s) => s.id === subcontractorId);
    const resolvedSubName = selectedSub?.company_name || subcontractorName.trim();

    try {
      await addAllocation.mutateAsync({
        site_plan_id: plan.id,
        allocation_type: allocType,
        employee_id: allocType === 'employee' ? employeeId : null,
        subcontractor_id: allocType === 'subcontractor' && subcontractorId ? subcontractorId : null,
        allocated_trade: trade,
        headcount: allocType === 'employee' ? 1 : Number(headcount) || 1,
        status: 'assigned',
        notes: allocType === 'subcontractor' ? `Crew: ${resolvedSubName}` : notes.trim() || null,
      });

      // Reset form
      setEmployeeId('');
      setSubcontractorId('');
      setSubcontractorName('');
      setNotes('');
      setHeadcount(1);
    } catch (err: any) {
      setError(err?.message || 'Failed to allocate worker');
    }
  };

  const handleRemove = async (allocationId: string) => {
    if (!confirm('Remove this workforce allocation from the plan?')) return;
    try {
      await removeAllocation.mutateAsync({ allocationId, planId: plan.id });
    } catch (err: any) {
      alert(err?.message || 'Failed to remove allocation');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/50 backdrop-blur-xs p-4 sm:p-6 flex justify-center items-start pt-14 pb-14">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[calc(100vh-4.5rem)] animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Manpower Allocations</h2>
              <span className="text-xs px-2 py-0.5 rounded font-semibold bg-blue-100 text-blue-800">
                {plan.plan_name}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Assign staff or subcontractor crews to satisfy the site requirement of {totalRequired} head(s).
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Demand & Allocation Bar */}
        <div className="px-6 py-3 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-slate-500">Required:</span>{' '}
              <strong className="text-slate-900 text-sm font-bold">{totalRequired}</strong>
            </div>
            <div>
              <span className="text-slate-500">Allocated:</span>{' '}
              <strong className="text-emerald-700 text-sm font-bold">{totalAllocated}</strong>
            </div>
            <div>
              <span className="text-slate-500">Remaining Need:</span>{' '}
              <strong className={`text-sm font-bold ${unallocated > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
                {unallocated}
              </strong>
            </div>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            {unallocated === 0 ? (
              <span className="text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Full Crew Covered
              </span>
            ) : (
              <span className="text-amber-700 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> Unassigned Manpower
              </span>
            )}
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-5 gap-6 overflow-y-auto flex-1 min-h-0">
          {/* Left Column: Assigned List */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-slate-400" />
              <span>Assigned Personnel & Crews ({currentAllocations.length})</span>
            </h3>

            {currentAllocations.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
                <HardHat className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500">No personnel allocated yet.</p>
                <p className="text-[11px] text-slate-400">Use the form on the right to assign staff or subcontractor teams.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {currentAllocations.map((a) => (
                  <div
                    key={a.id}
                    className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-3 shadow-xs hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        {a.allocation_type === 'employee' ? <UserCheck className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900">
                            {a.employee?.name || a.notes?.replace('Crew: ', '') || 'Headcount Line'}
                          </h4>
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-slate-100 text-slate-700">
                            {a.allocated_trade || plan.trade}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>{a.allocation_type === 'employee' ? 'Staff' : 'Subcontractor Crew'}</span>
                          <span>•</span>
                          <span className="font-semibold text-slate-700">{a.headcount} Head(s)</span>
                          {a.employee?.designation && <span>({a.employee.designation})</span>}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemove(a.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                      title="Remove allocation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Add Assignment Form */}
          <div className="md:col-span-2 bg-slate-50/80 border border-slate-200 rounded-xl p-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-blue-600" />
              <span>Add Resource</span>
            </h3>

            {error && (
              <div className="p-2 mb-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded">
                {error}
              </div>
            )}

            {conflictWarning && (
              <div className="p-2.5 mb-3 text-xs bg-amber-50 text-amber-900 border border-amber-300 rounded-lg flex items-start gap-2 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Double-Booking Warning:</span>
                  <p className="text-[11px] mt-0.5">{conflictWarning}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Resource Source
                </label>
                <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-lg border border-slate-200 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setAllocType('employee')}
                    className={`py-1 rounded text-center transition-colors ${
                      allocType === 'employee'
                        ? 'bg-blue-600 text-white font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Internal Staff
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllocType('subcontractor')}
                    className={`py-1 rounded text-center transition-colors ${
                      allocType === 'subcontractor'
                        ? 'bg-blue-600 text-white font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Subcontractor
                  </button>
                </div>
              </div>

              {allocType === 'employee' ? (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Select Employee
                  </label>
                  <select
                    value={employeeId}
                    onChange={(e) => {
                      setEmployeeId(e.target.value);
                      const emp = employees.find((x: any) => x.id === e.target.value);
                      if (emp?.designation) setTrade(emp.designation);
                    }}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees
                      .filter((e: any) => e.status !== 'Inactive')
                      .map((e: any) => (
                        <option key={e.id} value={e.id}>
                          {e.name} {e.designation ? `(${e.designation})` : ''}
                        </option>
                      ))}
                  </select>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Approved Subcontractor
                    </label>
                    <select
                      value={subcontractorId}
                      onChange={(e) => {
                        setSubcontractorId(e.target.value);
                        if (e.target.value) setSubcontractorName('');
                      }}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white mb-2"
                    >
                      <option value="">-- Select Registered Vendor --</option>
                      {subcontractors.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.company_name} {s.nature_of_work ? `(${s.nature_of_work})` : ''}
                        </option>
                      ))}
                    </select>

                    {!subcontractorId && (
                      <div>
                        <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                          Or Enter Custom / Unregistered Team Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Metro Electricals Crew A"
                          value={subcontractorName}
                          onChange={(e) => setSubcontractorName(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Headcount Provided
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={headcount}
                      onChange={(e) => setHeadcount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Trade / Skill
                </label>
                <input
                  type="text"
                  value={trade}
                  onChange={(e) => setTrade(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Assignment Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lead technician, carries thermal camera"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <button
                type="submit"
                disabled={addAllocation.isPending}
                className="w-full mt-2 py-2 text-xs font-bold text-white bg-[var(--brand)] rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {addAllocation.isPending && (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                <span>Assign to Plan</span>
              </button>
            </form>
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
