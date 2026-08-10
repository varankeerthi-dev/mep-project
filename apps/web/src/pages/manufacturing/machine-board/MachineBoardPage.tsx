import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { Loader2, Plus, AlertOctagon, Wrench, PlayCircle, Clock, ShieldAlert, ArrowRight, Edit2, Tag } from 'lucide-react';
import { getMachineBoardCards, MachineBoardCardData, WorkCenterMachine } from '../../../api/machineBoard';
import { CardBody } from '../../../components/cards/CardBody';
import { Button } from '../../../components/ui/button';
import { MachineBoardDrawer } from './MachineBoardDrawer';
import { DowntimeModal } from './DowntimeModal';
import { AddMachinePage } from './AddMachinePage';

interface MachineBoardPageProps {
  onNavigate?: (path: string) => void;
}

export default function MachineBoardPage({ onNavigate }: MachineBoardPageProps) {
  const { organisation } = useAuth();
  const [cards, setCards] = useState<MachineBoardCardData[]>([]);
  const [loading, setLoading] = useState(true);

  // View Mode: 'list' | 'create' | 'edit'
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingMachine, setEditingMachine] = useState<WorkCenterMachine | null>(null);

  // Drawer / Modal targets
  const [planMachineTarget, setPlanMachineTarget] = useState<MachineBoardCardData | null>(null);
  const [downtimeTarget, setDowntimeTarget] = useState<MachineBoardCardData | null>(null);

  const fetchBoard = async () => {
    if (!organisation?.id) return;
    setLoading(true);
    try {
      const data = await getMachineBoardCards(organisation.id);
      setCards(data);
    } catch (err) {
      console.error('Error loading machine board:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoard();
  }, [organisation?.id]);

  const handleGoToMoulds = () => {
    if (onNavigate) {
      onNavigate('/manufacturing/moulds');
    } else {
      window.location.href = '/manufacturing/moulds';
    }
  };

  const handleOpenCreate = () => {
    setEditingMachine(null);
    setViewMode('create');
  };

  const handleOpenEdit = (machine: WorkCenterMachine) => {
    setEditingMachine(machine);
    setViewMode('edit');
  };

  /* Render Add/Edit Machine Page if viewMode is 'create' or 'edit' */
  if (viewMode === 'create' || viewMode === 'edit') {
    return (
      <AddMachinePage
        editingMachine={editingMachine}
        onBack={() => setViewMode('list')}
        onSuccess={fetchBoard}
      />
    );
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto font-['Inter'] space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Machine Board</h1>
          <p className="text-xs text-slate-500">Real-time shopfloor visibility across all machines, tooling & active job cards</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={handleOpenCreate}
            leftIcon={<Plus size={14} />}
          >
            Add Machine
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleGoToMoulds}
            leftIcon={<Wrench size={14} />}
          >
            Moulds Master
          </Button>
          <span className="text-xs bg-slate-100 text-slate-700 px-3 py-2 rounded-xl font-medium">
            Morning Shift (06:00 - 14:00)
          </span>
        </div>
      </div>

      {/* Main Grid */}
      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-slate-400" /></div>
      ) : cards.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-sm">
          No machines registered in the shopfloor. Click "+ Add Machine" to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {cards.map((card) => {
            const { machine, currentTooling, activeJobCard, activeDowntime, pendingToolingPM } = card;

            // Status Badges & Styling
            let statusBadge = { text: 'Idle', bg: 'bg-slate-100 text-slate-700 border-slate-200' };
            let borderClass = 'border-slate-200';

            if (activeDowntime) {
              statusBadge = { text: 'Breakdown', bg: 'bg-rose-100 text-rose-800 border-rose-300' };
              borderClass = 'border-rose-300 bg-rose-50/20';
            } else if (machine.machine_status === 'running' || activeJobCard) {
              statusBadge = { text: 'Running', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
              borderClass = 'border-emerald-200';
            } else if (machine.machine_status === 'setup') {
              statusBadge = { text: 'Setup', bg: 'bg-amber-100 text-amber-800 border-amber-300' };
              borderClass = 'border-amber-200';
            }

            // Calculation of remaining shots & hours
            const remainingShots = activeJobCard ? Math.max(0, activeJobCard.planned_shots - activeJobCard.actual_shots) : 0;
            let estRemainingHours = '0.0';
            if (remainingShots > 0) {
              const cycleSec = currentTooling?.cycle_time_seconds || 20;
              estRemainingHours = ((remainingShots * Number(cycleSec)) / 3600).toFixed(1);
            }

            return (
              <div
                key={machine.id}
                className={`bg-white rounded-2xl border ${borderClass} shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden`}
              >
                <CardBody className="space-y-3" style={{ paddingLeft: '12px' }}>
                  {/* Title Bar */}
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-base font-bold text-slate-900">{machine.name}</h3>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleOpenEdit(machine)}
                          className="text-slate-400 hover:text-indigo-600 hover:bg-slate-100"
                          aria-label="Edit Machine Page"
                        >
                          <Edit2 size={13} />
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500">{machine.make || 'Generic'} {machine.model_number || ''} {machine.clamping_force_tonnes ? `· ${machine.clamping_force_tonnes}T` : ''}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide ${statusBadge.bg}`}>
                      {statusBadge.text}
                    </span>
                  </div>

                  {/* Mounted Tooling Section */}
                  <div
                    onClick={handleGoToMoulds}
                    className="bg-slate-50 hover:bg-indigo-50/60 transition-colors cursor-pointer p-2.5 rounded-xl border border-slate-100 text-xs space-y-1"
                    title="Click to view in Moulds Master"
                  >
                    {currentTooling ? (
                      <>
                        <div className="flex justify-between items-center text-slate-900 font-medium">
                          <span className="flex items-center gap-1 font-semibold text-indigo-700">
                            <Wrench size={13} /> {currentTooling.tooling_name}
                          </span>
                          <span className="text-[11px] text-slate-500">{currentTooling.no_of_cavities || 1} cav</span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Cycle Time: <b>{currentTooling.cycle_time_seconds || 20}s</b> · Resin: {currentTooling.material_type || 'PP'}
                        </p>
                      </>
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">No mould/tooling mounted · Click to manage Moulds</span>
                    )}
                  </div>

                  {/* Dynamic Custom Attributes Display Badges */}
                  {machine.custom_attributes && Array.isArray(machine.custom_attributes) && machine.custom_attributes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {machine.custom_attributes.map((attr) => (
                        attr.label && attr.value ? (
                          <span
                            key={attr.id}
                            className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200"
                          >
                            <Tag size={10} className="text-indigo-500" />
                            <span className="font-semibold text-slate-600">{attr.label}:</span>
                            <span className="font-bold text-slate-900">{attr.value}</span>
                          </span>
                        ) : null
                      ))}
                    </div>
                  )}

                  {/* Active Job Card Info / Breakdown info */}
                  {activeDowntime ? (
                    <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-xl text-xs space-y-1">
                      <span className="font-bold flex items-center gap-1">
                        <AlertOctagon size={13} /> Breakdown: {activeDowntime.reason_category.replace('_', ' ')}
                      </span>
                      {activeDowntime.reason_detail && <p className="text-[11px] text-rose-700">{activeDowntime.reason_detail}</p>}
                    </div>
                  ) : activeJobCard ? (
                    <div className="bg-indigo-50/50 border border-indigo-100 p-2.5 rounded-xl text-xs space-y-1">
                      <div className="flex justify-between font-bold text-slate-900">
                        <span>📦 {activeJobCard.product_name}</span>
                        <span className="text-indigo-600 font-mono">{activeJobCard.job_card_number}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 text-[11px]">
                        <span>Shots Remaining: <b>{remainingShots.toLocaleString()}</b></span>
                        <span className="flex items-center gap-1 text-slate-700 font-medium">
                          <Clock size={12} /> ~{estRemainingHours} hrs
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-2 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                      Machine Available for Planning
                    </div>
                  )}

                  {/* Action Buttons Bar */}
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                    <Button
                      variant={activeDowntime ? 'destructive' : 'ghost'}
                      size="xs"
                      onClick={() => setDowntimeTarget(card)}
                      className={activeDowntime ? '' : 'text-rose-600 bg-rose-50 hover:bg-rose-100'}
                      leftIcon={<AlertOctagon size={14} />}
                    >
                      Log Downtime
                    </Button>
                    {!activeDowntime && (
                      <Button
                        size="xs"
                        onClick={() => setPlanMachineTarget(card)}
                        leftIcon={<PlayCircle size={14} />}
                      >
                        Plan Machine
                      </Button>
                    )}
                  </div>
                </CardBody>
              </div>
            );
          })}
        </div>
      )}

      {/* Adaptive Drawer */}
      {planMachineTarget && (
        <MachineBoardDrawer
          machine={planMachineTarget.machine}
          currentTooling={planMachineTarget.currentTooling}
          onClose={() => setPlanMachineTarget(null)}
          onSuccess={fetchBoard}
        />
      )}

      {/* Downtime Modal */}
      {downtimeTarget && (
        <DowntimeModal
          machine={downtimeTarget.machine}
          activeDowntime={downtimeTarget.activeDowntime}
          onClose={() => setDowntimeTarget(null)}
          onSuccess={fetchBoard}
        />
      )}
    </div>
  );
}
