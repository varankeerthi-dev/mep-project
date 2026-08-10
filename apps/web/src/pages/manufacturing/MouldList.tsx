import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Loader2, Plus, Wrench, ChevronDown, ChevronUp, AlertTriangle, Home, ArrowLeft, Edit2, ChevronRight, Save } from 'lucide-react';
import { EntryContainer } from '../../components/ui/EntryContainer';
import { CardBody } from '../../components/cards/CardBody';
import { Button } from '../../components/ui/button';
import { ManufacturingTooling } from '../../api/machineBoard';
import { getShotsSinceMaintenance, getTotalShots } from '../../queries/shotCounters';

interface MouldListProps {
  onNavigate?: (path: string) => void;
}

export default function MouldList({ onNavigate }: MouldListProps) {
  const { organisation } = useAuth();
  const [toolings, setToolings] = useState<(ManufacturingTooling & { total_shots: number; shots_since_maint: number; is_reserved: boolean })[]>([]);
  const [loading, setLoading] = useState(true);

  // View Mode: 'list' | 'form'
  const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Collapsible Sections State in Form
  const [techOpen, setTechOpen] = useState(true);
  const [maintOpen, setMaintOpen] = useState(true);

  // Maintenance Log Modal State
  const [maintModalTooling, setMaintModalTooling] = useState<ManufacturingTooling | null>(null);
  const [maintWorkDone, setMaintWorkDone] = useState('');
  const [maintDoneBy, setMaintDoneBy] = useState('');
  const [maintCost, setMaintCost] = useState('');

  // Form inputs
  const [toolingName, setToolingName] = useState('');
  const [toolingNumber, setToolingNumber] = useState('');
  const [toolingType, setToolingType] = useState<'mould' | 'die' | 'jig' | 'fixture'>('mould');
  const [noOfCavities, setNoOfCavities] = useState<number | ''>(4);
  const [compatibleMachineType, setCompatibleMachineType] = useState('injection_moulding');
  const [minTonnage, setMinTonnage] = useState<number | ''>('');
  const [maxTonnage, setMaxTonnage] = useState<number | ''>('');
  const [materialType, setMaterialType] = useState('');
  const [cycleTimeSeconds, setCycleTimeSeconds] = useState<number | ''>('');
  const [maintIntervalShots, setMaintIntervalShots] = useState<number | ''>(50000);
  const [notes, setNotes] = useState('');

  const fetchToolings = async () => {
    if (!organisation?.id) return;
    setLoading(true);
    try {
      const { data: rawToolings, error } = await supabase
        .from('manufacturing_tooling')
        .select('*')
        .eq('organisation_id', organisation.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Check active job cards for reservation status
      const { data: activeJobs } = await supabase
        .from('job_cards')
        .select('tooling_id')
        .eq('organisation_id', organisation.id)
        .not('status', 'in', '("completed","cancelled")');

      const reservedSet = new Set((activeJobs || []).map(j => j.tooling_id).filter(Boolean));

      // Compute shot counters for each tooling dynamically
      const enriched = await Promise.all(
        (rawToolings || []).map(async (t) => {
          const total_shots = await getTotalShots(t.id);
          const shots_since_maint = await getShotsSinceMaintenance(t.id);
          return {
            ...t,
            total_shots,
            shots_since_maint,
            is_reserved: reservedSet.has(t.id),
          };
        })
      );

      setToolings(enriched);
    } catch (err) {
      console.error('Error fetching toolings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchToolings();
  }, [organisation?.id]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setToolingName('');
    setToolingNumber('');
    setToolingType('mould');
    setNoOfCavities(4);
    setCompatibleMachineType('injection_moulding');
    setMinTonnage('');
    setMaxTonnage('');
    setMaterialType('');
    setCycleTimeSeconds('');
    setMaintIntervalShots(50000);
    setNotes('');
    setTechOpen(true);
    setMaintOpen(true);
    setViewMode('form');
  };

  const handleOpenEdit = (t: ManufacturingTooling) => {
    setEditingId(t.id);
    setToolingName(t.tooling_name || '');
    setToolingNumber(t.tooling_number || '');
    setToolingType((t.tooling_type as any) || 'mould');
    setNoOfCavities(t.no_of_cavities ?? '');
    setCompatibleMachineType(t.compatible_machine_type || 'injection_moulding');
    setMinTonnage(t.compatible_min_tonnage ?? '');
    setMaxTonnage(t.compatible_max_tonnage ?? '');
    setMaterialType(t.material_type || '');
    setCycleTimeSeconds(t.cycle_time_seconds ?? '');
    setMaintIntervalShots(t.maintenance_interval_shots ?? 50000);
    setNotes(t.notes || '');
    setTechOpen(true);
    setMaintOpen(true);
    setViewMode('form');
  };

  const handleSaveTooling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toolingName.trim()) {
      alert('Tooling name is required');
      return;
    }

    const payload = {
      tooling_name: toolingName,
      tooling_number: toolingNumber || null,
      tooling_type: toolingType,
      no_of_cavities: noOfCavities === '' ? null : Number(noOfCavities),
      compatible_machine_type: compatibleMachineType,
      compatible_min_tonnage: minTonnage === '' ? null : Number(minTonnage),
      compatible_max_tonnage: maxTonnage === '' ? null : Number(maxTonnage),
      material_type: materialType || null,
      cycle_time_seconds: cycleTimeSeconds === '' ? null : Number(cycleTimeSeconds),
      maintenance_interval_shots: maintIntervalShots === '' ? null : Number(maintIntervalShots),
      notes: notes || null,
      organisation_id: organisation?.id,
    };

    if (editingId) {
      await supabase.from('manufacturing_tooling').update(payload).eq('id', editingId);
    } else {
      await supabase.from('manufacturing_tooling').insert(payload);
    }

    setViewMode('list');
    fetchToolings();
  };

  const handleSaveMaintenanceLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintModalTooling || !maintWorkDone.trim()) {
      alert('Please enter work done description');
      return;
    }

    const shots = await getShotsSinceMaintenance(maintModalTooling.id);

    await supabase.from('manufacturing_tooling_maintenance').insert({
      tooling_id: maintModalTooling.id,
      maintenance_date: new Date().toISOString().split('T')[0],
      shots_at_maintenance: shots,
      work_done: maintWorkDone,
      done_by: maintDoneBy || null,
      cost: maintCost ? Number(maintCost) : null,
      organisation_id: organisation?.id,
    });

    setMaintModalTooling(null);
    setMaintWorkDone('');
    setMaintDoneBy('');
    setMaintCost('');
    fetchToolings();
  };

  /* Input Style with 5px radius */
  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '40px',
    padding: '0 12px',
    fontSize: '13px',
    borderRadius: '5px', // Entry field container - Radius 5px
    border: '1px solid #cbd5e1',
    outline: 'none',
    background: '#ffffff',
  };

  return (
    <div className="moulds-page-container p-6 max-w-[1200px] mx-auto font-['Inter']">
      {/* Explicit Scoped CSS to override any global CSS for Moulds Page */}
      <style>{`
        .moulds-page-container .inner-container-20px {
          border-radius: 20px !important;
        }
        .moulds-page-container .entry-field-container-5px {
          border-radius: 5px !important;
        }
        .moulds-page-container .content-body-left-pad-12px {
          padding-left: 12px !important;
        }
        .moulds-page-container label {
          margin-bottom: 8px !important;
        }
        .moulds-page-container input, .moulds-page-container select, .moulds-page-container textarea {
          border-radius: 5px !important;
        }
      `}</style>

      {/* ========================================================= */}
      {/* FORM VIEW ("Add New Mould" Breadcrumb Page View)          */}
      {/* ========================================================= */}
      {viewMode === 'form' ? (
        <div className="max-w-[1000px] mx-auto space-y-6">
          {/* Breadcrumb Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                <Button variant="link" size="sm" onClick={() => setViewMode('list')} className="h-auto p-0 text-slate-500 hover:text-indigo-600 font-medium">
                  Moulds Master
                </Button>
                <ChevronRight size={12} />
                <span className="text-slate-900 font-semibold">
                  {editingId ? 'Edit Tooling' : 'Add New Mould'}
                </span>
              </div>
              <h1 className="text-xl font-bold text-slate-900">
                {editingId ? `Edit Mould: ${toolingName}` : 'Add New Mould'}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setViewMode('list')} leftIcon={<ArrowLeft size={14} />}>
                Back to List
              </Button>
            </div>
          </div>

          {/* Page Form Container (Inner Container - Radius 20px) */}
          <form onSubmit={handleSaveTooling} className="space-y-6">
            {/* Card 1: Basic Information (Inner Container - Radius 20px) */}
            <div
              className="inner-container-20px content-body-left-pad-12px bg-white border border-slate-200 p-6 shadow-2xs space-y-4"
              style={{ borderRadius: '20px', paddingLeft: '12px' }}
            >
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-2">
                1. Basic Mould Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <EntryContainer label="Tooling / Mould Name *" className="entry-field-container-5px">
                  <input
                    type="text"
                    value={toolingName}
                    onChange={(e) => setToolingName(e.target.value)}
                    placeholder="e.g. Cover Plate Mould"
                    style={inputStyle}
                    required
                  />
                </EntryContainer>

                <EntryContainer label="Tooling Code / Number" className="entry-field-container-5px">
                  <input
                    type="text"
                    value={toolingNumber}
                    onChange={(e) => setToolingNumber(e.target.value)}
                    placeholder="e.g. MD-045"
                    style={inputStyle}
                  />
                </EntryContainer>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <EntryContainer label="No. of Cavities *" className="entry-field-container-5px">
                  <input
                    type="number"
                    value={noOfCavities}
                    onChange={(e) => setNoOfCavities(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 4 (user types freely)"
                    style={inputStyle}
                    required
                  />
                </EntryContainer>

                <EntryContainer label="Tooling Type" className="entry-field-container-5px">
                  <select
                    value={toolingType}
                    onChange={(e) => setToolingType(e.target.value as any)}
                    style={inputStyle}
                  >
                    <option value="mould">Mould</option>
                    <option value="die">Die</option>
                    <option value="jig">Jig</option>
                    <option value="fixture">Fixture</option>
                  </select>
                </EntryContainer>
              </div>
            </div>

            {/* Card 2: Technical Specifications (Inner Container - Radius 20px) */}
            <div
              className="inner-container-20px bg-white border border-slate-200 shadow-2xs overflow-hidden"
              style={{ borderRadius: '20px' }}
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setTechOpen(!techOpen)}
                className="content-body-left-pad-12px w-full px-6 py-2 bg-slate-50 hover:bg-slate-100/80 text-sm font-bold text-slate-800 flex justify-between items-center rounded-none"
                style={{ paddingLeft: '12px', paddingTop: '8px', paddingBottom: '8px', height: 'auto' }}
              >
                <span className="flex items-center gap-2">
                  <span className="text-indigo-600 font-mono">2.</span> Technical Specifications & Machine Compatibility
                </span>
                {techOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </Button>

              {techOpen && (
                <div className="content-body-left-pad-12px p-6 space-y-4 border-t border-slate-200" style={{ paddingLeft: '12px', paddingTop: '8px', paddingBottom: '8px' }}>
                  <EntryContainer label="Compatible Machine Type" className="entry-field-container-5px">
                    <select
                      value={compatibleMachineType}
                      onChange={(e) => setCompatibleMachineType(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="injection_moulding">Injection Moulding</option>
                      <option value="blow_moulding">Blow Moulding</option>
                      <option value="press">Press</option>
                      <option value="extruder">Extruder</option>
                      <option value="assembly">Assembly</option>
                    </select>
                  </EntryContainer>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <EntryContainer label="Min Machine Tonnage (T)" className="entry-field-container-5px">
                      <input
                        type="number"
                        value={minTonnage}
                        onChange={(e) => setMinTonnage(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="e.g. 200"
                        style={inputStyle}
                      />
                    </EntryContainer>

                    <EntryContainer label="Max Machine Tonnage (T)" className="entry-field-container-5px">
                      <input
                        type="number"
                        value={maxTonnage}
                        onChange={(e) => setMaxTonnage(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="e.g. 350"
                        style={inputStyle}
                      />
                    </EntryContainer>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <EntryContainer label="Typical Cycle Time (seconds/shot)" className="entry-field-container-5px">
                      <input
                        type="number"
                        step="0.1"
                        value={cycleTimeSeconds}
                        onChange={(e) => setCycleTimeSeconds(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="e.g. 18.5"
                        style={inputStyle}
                      />
                    </EntryContainer>

                    <EntryContainer label="Resin / Material Type" className="entry-field-container-5px">
                      <input
                        type="text"
                        value={materialType}
                        onChange={(e) => setMaterialType(e.target.value)}
                        placeholder="e.g. PP Homopolymer, ABS, HDPE"
                        style={inputStyle}
                      />
                    </EntryContainer>
                  </div>
                </div>
              )}
            </div>

            {/* Card 3: Maintenance Schedule (Inner Container - Radius 20px) */}
            <div
              className="inner-container-20px bg-white border border-slate-200 shadow-2xs overflow-hidden"
              style={{ borderRadius: '20px' }}
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMaintOpen(!maintOpen)}
                className="content-body-left-pad-12px w-full px-6 py-2 bg-slate-50 hover:bg-slate-100/80 text-sm font-bold text-slate-800 flex justify-between items-center rounded-none"
                style={{ paddingLeft: '12px', paddingTop: '8px', paddingBottom: '8px', height: 'auto' }}
              >
                <span className="flex items-center gap-2">
                  <span className="text-indigo-600 font-mono">3.</span> Maintenance & Shot Counter Schedule
                </span>
                {maintOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </Button>

              {maintOpen && (
                <div className="content-body-left-pad-12px p-6 space-y-4 border-t border-slate-200" style={{ paddingLeft: '12px', paddingTop: '8px', paddingBottom: '8px' }}>
                  <EntryContainer label="Maintenance Interval (Shots)" className="entry-field-container-5px">
                    <input
                      type="number"
                      value={maintIntervalShots}
                      onChange={(e) => setMaintIntervalShots(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="e.g. 50000"
                      style={inputStyle}
                    />
                  </EntryContainer>

                  <EntryContainer label="Notes / Special Handling Instructions" className="entry-field-container-5px">
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Keep heated core pin clean; clean flash lines after every 10,000 shots"
                      style={{ ...inputStyle, height: '80px', padding: '10px' }}
                    />
                  </EntryContainer>
                </div>
              )}
            </div>

            {/* Action Buttons Footer */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setViewMode('list')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                leftIcon={<Save size={15} />}
              >
                Save Mould / Tooling
              </Button>
            </div>
          </form>
        </div>
      ) : (
        /* ========================================================= */
        /* LIST VIEW (Main Grid of Toolings)                         */
        /* ========================================================= */
        <>
          {/* Top Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Moulds & Tooling Master</h1>
              <p className="text-xs text-slate-500">Manage plant moulds, cavity details, and dynamic shot counter maintenance</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onNavigate ? onNavigate('/manufacturing/dashboard') : (window.location.href = '/manufacturing/dashboard')}
                leftIcon={<Home size={14} />}
              >
                Home Dashboard
              </Button>
              <Button
                size="sm"
                onClick={handleOpenCreate}
                leftIcon={<Plus size={16} />}
              >
                Add Mould / Tooling
              </Button>
            </div>
          </div>

          {/* Grid of Toolings */}
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="animate-spin text-slate-400" /></div>
          ) : toolings.length === 0 ? (
            <div
              className="inner-container-20px content-body-left-pad-12px bg-white border border-slate-200 p-12 text-center text-slate-500 text-sm"
              style={{ borderRadius: '20px', paddingLeft: '12px' }}
            >
              No moulds or tooling registered yet. Click "Add Mould / Tooling" to get started.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {toolings.map((t) => {
                const isDue = t.maintenance_interval_shots && t.shots_since_maint >= t.maintenance_interval_shots;
                return (
                  <div
                    key={t.id}
                    className="inner-container-20px bg-white border border-slate-200 shadow-xs hover:shadow-md transition-shadow overflow-hidden"
                    style={{ borderRadius: '20px' }}
                  >
                    <CardBody className="content-body-left-pad-12px space-y-3" style={{ paddingLeft: '12px' }}>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">{t.tooling_type}</span>
                          <h3 className="text-base font-semibold text-slate-900">{t.tooling_name}</h3>
                          {t.tooling_number && <p className="text-xs text-slate-500">Code: {t.tooling_number}</p>}
                        </div>

                        <div className="flex flex-col items-end gap-1.5">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleOpenEdit(t)}
                              title="Edit Tooling Page"
                              className="text-slate-400 hover:text-indigo-600"
                            >
                              <Edit2 size={14} />
                            </Button>
                          </div>
                          {t.is_reserved && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                              Pending (Reserved)
                            </span>
                          )}
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                            t.status === 'mounted' ? 'bg-emerald-100 text-emerald-800' :
                            t.status === 'under_maintenance' ? 'bg-rose-100 text-rose-800' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {t.status}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <div>
                          <span className="text-slate-400 block">Cavities:</span>
                          <span className="font-semibold text-slate-800">{t.no_of_cavities ?? 'User defined'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Cycle Time:</span>
                          <span className="font-semibold text-slate-800">{t.cycle_time_seconds ? `${t.cycle_time_seconds}s` : 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Machine Type:</span>
                          <span className="font-semibold text-slate-800 capitalize">{t.compatible_machine_type?.replace('_', ' ')}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Resin / Material:</span>
                          <span className="font-semibold text-slate-800">{t.material_type || 'General'}</span>
                        </div>
                      </div>

                      <div className="pt-1 border-t border-slate-100 flex justify-between items-center text-xs">
                        <div>
                          <span className="text-slate-500">Shots Since Maintenance:</span>
                          <div className="font-bold text-slate-900">{t.shots_since_maint.toLocaleString()} / {t.maintenance_interval_shots ? t.maintenance_interval_shots.toLocaleString() : '∞'}</div>
                        </div>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => setMaintModalTooling(t)}
                          className="h-auto p-0 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                          leftIcon={<Wrench size={14} />}
                        >
                          Log PM
                        </Button>
                      </div>

                      {isDue && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2 rounded-lg text-xs flex items-center gap-1.5">
                          <AlertTriangle size={14} /> Maintenance Due (Exceeded Shot Limit)
                        </div>
                      )}
                    </CardBody>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Maintenance Log Modal */}
      {maintModalTooling && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="inner-container-20px content-body-left-pad-12px bg-white max-w-md w-full p-6 shadow-2xl space-y-4"
            style={{ borderRadius: '20px', paddingLeft: '12px' }}
          >
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Wrench size={18} className="text-indigo-600" /> Log Maintenance – {maintModalTooling.tooling_name}
            </h2>

            <form onSubmit={handleSaveMaintenanceLog} className="space-y-3">
              <EntryContainer label="Work Done / Preventive Maintenance *" className="entry-field-container-5px">
                <textarea
                  value={maintWorkDone}
                  onChange={(e) => setMaintWorkDone(e.target.value)}
                  placeholder="e.g. Cavity cleaning, pin lubrication, seal replacement"
                  style={{ ...inputStyle, height: '80px', padding: '10px' }}
                  required
                />
              </EntryContainer>

              <div className="grid grid-cols-2 gap-3">
                <EntryContainer label="Done By" className="entry-field-container-5px">
                  <input
                    type="text"
                    value={maintDoneBy}
                    onChange={(e) => setMaintDoneBy(e.target.value)}
                    placeholder="e.g. Suresh Kumar"
                    style={inputStyle}
                  />
                </EntryContainer>

                <EntryContainer label="Cost (₹)" className="entry-field-container-5px">
                  <input
                    type="number"
                    value={maintCost}
                    onChange={(e) => setMaintCost(e.target.value)}
                    placeholder="e.g. 2500"
                    style={inputStyle}
                  />
                </EntryContainer>
              </div>

              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-lg text-xs">
                Saving this log will reset the maintenance shot counter for this mould.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setMaintModalTooling(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                >
                  Record Maintenance
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
