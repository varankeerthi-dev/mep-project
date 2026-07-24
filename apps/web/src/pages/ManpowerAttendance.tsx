// ============================================
// MANPOWER ATTENDANCE PAGE
// ============================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';
import { useManpower } from '../hooks/useManpower';
import { calculateAttendanceValues } from '../utils/manpowerBilling';
import {
  ManpowerAttendance as ManpowerAttendanceType,
  CreateManpowerAttendanceInput,
  LabourCategory,
  ContextModifier,
  RateUnit,
} from '../types/manpower';
import { EnhancedDataTable } from '../components/ui/table/index';
import { SubcontractorModuleNav } from '../components/SubcontractorModuleNav';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Trash2, Save, Calendar, Users, Building2, X, ChevronDown, Search, Filter, RefreshCcw, BarChart3 } from 'lucide-react';

const RECORDS_CSS = `
.records-section {
  padding: 32px 32px 48px;
   max-width: 1200px;
  margin: 0 auto;
}
.records-top {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 28px;
}
.records-eyebrow {
  display: inline-block;
  padding: 4px 14px;
  border-radius: 9999px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  background: #000;
  color: #fff;
  margin-bottom: 10px;
}
.records-title {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #0c0c0c;
  margin: 0;
}
.records-refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 22px;
  border-radius: 9999px;
  border: none;
  background: var(--primary, #4f46e5);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}
.records-refresh-btn:hover { transform: scale(1.03); background: var(--primary-dark, #4338ca); }
.records-refresh-btn:active { transform: scale(0.97); background: #3730a3; }
@media (max-width: 900px) {
  .records-section { padding: 24px 16px 40px; }
  .records-top { flex-direction: column; align-items: flex-start; gap: 16px; }
}
.filter-doppel-outer {
  padding: 2px;
  border-radius: 22px;
  background: rgba(0,0,0,0.04);
  margin-bottom: 16px;
}
.filter-doppel-inner {
  padding: 20px 24px;
  border-radius: 20px;
  background: #fff;
  box-shadow: inset 0 1px 1px rgba(255,255,255,0.8);
}
.filter-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 14px;
}
@media (max-width: 1100px) { .filter-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 640px) { .filter-grid { grid-template-columns: repeat(2, 1fr); } }
.filter-field { display: flex; flex-direction: column; gap: 4px; }
.filter-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #a1a1aa;
}
.filter-input-wrap { position: relative; display: flex; align-items: center; }
.filter-input-icon { position: absolute; left: 12px; color: #d4d4d8; pointer-events: none; }
.filter-input, .filter-select {
  width: 100%;
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid #e4e4e7;
  background: #fafafa;
  font-size: 13px;
  font-weight: 500;
  color: #18181b;
  outline: none;
  transition: all 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.filter-input:focus, .filter-select:focus {
  border-color: #18181b;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(12,12,12,0.08);
}
.filter-input-icon + .filter-input { padding-left: 34px; }
.filter-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid #f4f4f5;
  margin-top: 8px;
}
.download-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: 9999px;
  border: none;
  background: var(--primary, #4f46e5);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.32, 0.72, 0, 1);
}
.download-btn:hover { transform: scale(1.03); background: var(--primary-dark, #4338ca); }
.download-btn:active { transform: scale(0.97); background: #3730a3; }
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  background: var(--primary, #4f46e5);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-primary:hover {
  background: var(--primary-dark, #4338ca);
}
.btn-primary:active {
  background: #3730a3;
}
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.table-doppel-outer {
  padding: 2px;
  border-radius: 22px;
  background: rgba(0,0,0,0.04);
}
.table-doppel-inner {
  border-radius: 20px;
  background: #fff;
  overflow: hidden;
  box-shadow: inset 0 1px 1px rgba(255,255,255,0.8);
  min-height: 560px;
  display: flex;
  flex-direction: column;
}
`;

interface ManpowerAttendanceProps {
  onNavigate?: (path: string) => void;
}

export function ManpowerAttendance({ onNavigate }: ManpowerAttendanceProps) {
  const { organisation } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'add' | 'records'>('add');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSubcontractor, setSelectedSubcontractor] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedWorkUnit, setSelectedWorkUnit] = useState('');
  const [workUnitType, setWorkUnitType] = useState<'PROJECT' | 'ALTERATION' | 'AMC' | 'WORK_ORDER'>('PROJECT');
  const [supervisor, setSupervisor] = useState('');
  const [remarks, setRemarks] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Records tab filters
  const [recSearch, setRecSearch] = useState('');
  const [recSubcontractor, setRecSubcontractor] = useState('');
  const [recClient, setRecClient] = useState('');
  const [recWorkType, setRecWorkType] = useState('');
  const [recStatus, setRecStatus] = useState('');
  const [recDateFrom, setRecDateFrom] = useState('');
  const [recDateTo, setRecDateTo] = useState('');

  const { data: allAttendance, isLoading: loadingRecords, refetch: refetchRecords } = useQuery({
    queryKey: ['all-manpower-attendance', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('manpower_attendance')
        .select(`
          *,
          labour_categories(id, name, code, unit),
          subcontractors(id, company_name),
          clients(id, client_name)
        `)
        .eq('organisation_id', organisation.id)
        .order('attendance_date', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!organisation?.id,
  });

  // Attendance entries for the day
  const defaultEntry = () => ({
    labour_category_id: '',
    workers_count: 1,
    hours_worked: 8,
    applied_modifiers: [] as string[],
    base_rate: 0,
    adjusted_rate: 0,
    original_amount: 0,
    adjusted_amount: 0,
  });

  const [attendanceEntries, setAttendanceEntries] = useState<ReturnType<typeof defaultEntry>[]>([defaultEntry(), defaultEntry()]);

  // Fetch data
  const { data: subcontractors } = useQuery({
    queryKey: ['subcontractors', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data } = await supabase
        .from('subcontractors')
        .select('*')
        .eq('organisation_id', organisation.id)
        .order('company_name');
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  const { data: clients } = useQuery({
    queryKey: ['clients', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data } = await supabase
        .from('clients')
        .select('id, client_name')
        .eq('organisation_id', organisation.id)
        .order('client_name');
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  const { data: labourCategories } = useManpower.useLabourCategories(organisation?.id);
  const createCategory = useManpower.useCreateLabourCategory();
  const deleteCategory = useManpower.useDeleteLabourCategory();
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatRate, setNewCatRate] = useState(800);
  const [newCatUnit, setNewCatUnit] = useState<'day' | 'hour' | 'piece'>('day');
  const { data: contextModifiers } = useManpower.useContextModifiers(organisation?.id);
  const { data: rateCards } = useManpower.useRateCards(organisation?.id, selectedSubcontractor);
  const { data: existingAttendance } = useManpower.useManpowerAttendance(
    organisation?.id,
    selectedSubcontractor,
    selectedDate,
    selectedDate
  );

  const createAttendance = useManpower.useCreateManpowerAttendance();

  const handleAddCategory = async () => {
    if (!newCatName.trim() || !organisation?.id) return;
    try {
      await createCategory.mutateAsync({
        organisation_id: organisation.id,
        name: newCatName.trim(),
        code: newCatName.trim().toUpperCase().replace(/\s+/g, '_').slice(0, 20),
        base_rate: newCatRate,
        unit: newCatUnit,
      });
      setNewCatName('');
      setNewCatRate(800);
      setNewCatUnit('day');
    } catch (e) {
      console.error('Error adding category:', e);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this labour category?')) return;
    try {
      await deleteCategory.mutateAsync(id);
    } catch (e) {
      console.error('Error deleting category:', e);
    }
  };

  // Add new attendance entry row
  const addAttendanceEntry = () => {
    setAttendanceEntries([...attendanceEntries, defaultEntry()]);
  };

  // Remove attendance entry row
  const removeAttendanceEntry = (index: number) => {
    setAttendanceEntries(attendanceEntries.filter((_, i) => i !== index));
  };

  // Update attendance entry field
  const updateAttendanceEntry = (index: number, field: string, value: any) => {
    const updated = [...attendanceEntries];
    updated[index] = { ...updated[index], [field]: value };

    // Recalculate rates when labour category or modifiers change
    if (field === 'labour_category_id' || field === 'applied_modifiers' || field === 'workers_count' || field === 'base_rate') {
      const category = labourCategories?.find(lc => lc.id === updated[index].labour_category_id);
      const rate = field === 'base_rate' ? value : (category?.base_rate ?? updated[index].base_rate);
      if (rate > 0) {
        const calculated = calculateAttendanceValues(
          rate,
          updated[index].workers_count,
          updated[index].applied_modifiers,
          contextModifiers || []
        );
        updated[index] = {
          ...updated[index],
          base_rate: rate,
          ...calculated,
        };
      }
    }

    setAttendanceEntries(updated);
  };

  // Save all attendance entries
  const handleSave = async () => {
    if (!selectedSubcontractor || !organisation?.id) {
      alert('Please select a subcontractor');
      return;
    }

    const validEntries = attendanceEntries.filter(e => e.labour_category_id && e.workers_count > 0);
    if (validEntries.length === 0) {
      alert('Please add at least one attendance entry with a labour category');
      return;
    }

    try {
      for (const entry of validEntries) {
        const input: CreateManpowerAttendanceInput = {
          organisation_id: organisation.id,
          subcontractor_id: selectedSubcontractor,
          client_id: selectedClient || undefined,
          work_unit_id: selectedWorkUnit || undefined,
          work_unit_type: workUnitType,
          attendance_date: selectedDate,
          labour_category_id: entry.labour_category_id,
          workers_count: entry.workers_count,
          hours_worked: entry.hours_worked,
          supervisor_name: supervisor,
          applied_modifiers: entry.applied_modifiers,
          base_rate: entry.base_rate,
          adjusted_rate: entry.adjusted_rate,
          original_amount: entry.original_amount,
          adjusted_amount: entry.adjusted_amount,
          remarks,
        };

        await createAttendance.mutateAsync(input);
      }

      // Reset form
      setAttendanceEntries([defaultEntry(), defaultEntry()]);
      setSelectedClient('');
      setSupervisor('');
      setRemarks('');
      setShowForm(false);
      alert('Attendance saved successfully!');
    } catch (error) {
      console.error('Error saving attendance:', error);
      alert('Error saving attendance. Please check if the database migration has been run in Supabase.');
    }
  };

  // Calculate totals
  const totalOriginalAmount = attendanceEntries.reduce((sum, entry) => sum + entry.original_amount, 0);
  const totalAdjustedAmount = attendanceEntries.reduce((sum, entry) => sum + entry.adjusted_amount, 0);
  const totalDifference = totalAdjustedAmount - totalOriginalAmount;
  const totalWorkers = attendanceEntries.reduce((sum, entry) => sum + (entry.labour_category_id ? entry.workers_count : 0), 0);

  const filteredRecords = useMemo(() => {
    return (allAttendance || []).filter((r: any) => {
      if (recSubcontractor && r.subcontractor_id !== recSubcontractor) return false;
      if (recClient && r.client_id !== recClient) return false;
      if (recWorkType && r.work_unit_type !== recWorkType) return false;
      if (recStatus && r.status !== recStatus) return false;
      if (recDateFrom && r.attendance_date < recDateFrom) return false;
      if (recDateTo && r.attendance_date > recDateTo) return false;
      if (recSearch) {
        const q = recSearch.toLowerCase();
        const name = r.subcontractors?.company_name || '';
        const supv = r.supervisor_name || '';
        if (!name.toLowerCase().includes(q) && !supv.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allAttendance, recSubcontractor, recClient, recWorkType, recStatus, recDateFrom, recDateTo, recSearch]);

  const attendanceColumns: ColumnDef<any>[] = useMemo(() => [
    {
      id: 'date',
      header: 'Date',
      accessorKey: 'attendance_date',
      cell: (info: any) => {
        const val = info.getValue() as string;
        if (!val) return <span className="text-sm text-zinc-400">—</span>;
        const d = new Date(val + 'T00:00:00');
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const day = d.getDate();
        const month = months[d.getMonth()];
        const year = d.getFullYear();
        return <span className="text-sm font-medium text-zinc-700">{day} {month} {year}</span>;
      },
    },
    {
      id: 'client',
      header: 'Client',
      accessorKey: 'clients.client_name',
      cell: (info: any) => (
        <span className="text-sm font-medium text-zinc-700">{info.getValue() || '—'}</span>
      ),
    },
    {
      id: 'subcontractor',
      header: 'Name',
      accessorKey: 'subcontractors.company_name',
      cell: (info: any) => (
        <span className="font-semibold text-zinc-900">{info.getValue() || '—'}</span>
      ),
    },
    {
      id: 'project',
      header: 'Project',
      accessorKey: 'work_unit_id',
      cell: (info: any) => {
        const row = info.row.original;
        return (
          <span className="text-sm text-zinc-600">
            {row.work_unit_type === 'PROJECT' && row.work_unit_id
              ? row.work_unit_id.slice(0, 8) + '...'
              : row.work_unit_type === 'GENERAL'
                ? 'General / Non-Project'
                : row.work_unit_id
                  ? row.work_unit_id.slice(0, 8) + '...'
                  : '—'}
          </span>
        );
      },
    },
    {
      id: 'work_type',
      header: 'Work Type',
      accessorKey: 'work_unit_type',
      cell: (info: any) => (
        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
          {info.getValue() || '—'}
        </span>
      ),
    },
    {
      id: 'workers_count',
      header: 'No. of Employees',
      accessorKey: 'workers_count',
      cell: (info: any) => (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 font-bold text-white text-[11px]">
          {info.getValue()}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Payment Status',
      accessorKey: 'status',
      cell: (info: any) => {
        const status = info.getValue() as string;
        const colors: Record<string, { bg: string; text: string }> = {
          DRAFT: { bg: '#f1f5f9', text: '#64748b' },
          SUBMITTED: { bg: '#fef9c3', text: '#ca8a04' },
          APPROVED: { bg: '#dcfce7', text: '#16a34a' },
          REJECTED: { bg: '#fef2f2', text: '#dc2626' },
        };
        const c = colors[status] || colors.DRAFT;
        return (
          <span style={{
            padding: '3px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 700,
            background: c.bg, color: c.text,
          }}>
            {status}
          </span>
        );
      },
    },
    {
      id: 'supervisor_name',
      header: 'Site Engineer Name',
      accessorKey: 'supervisor_name',
      cell: (info: any) => (
        <span className="text-sm font-medium text-zinc-700">{info.getValue() || '—'}</span>
      ),
    },
    {
      id: 'entered_by',
      header: 'Entered By',
      accessorKey: 'created_at',
      cell: (info: any) => {
        const val = info.getValue() as string;
        if (!val) return <span className="text-sm text-zinc-400">—</span>;
        const d = new Date(val);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor(diffMs / (1000 * 60));
        let relative: string;
        if (diffMins < 1) relative = 'Just now';
        else if (diffMins < 60) relative = `${diffMins}m ago`;
        else if (diffHrs < 24) relative = `${diffHrs}h ago`;
        else relative = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        return (
          <span className="text-sm text-zinc-500">{relative}</span>
        );
      },
    },
  ], []);

  const downloadPDF = useCallback(async () => {
    const jsPDF = (await import('jspdf')).default;
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const rows = filteredRecords.map((r: any) => [
      r.attendance_date || '—',
      r.subcontractors?.company_name || '—',
      r.work_unit_type || '—',
      String(r.workers_count),
      r.status || '—',
      r.supervisor_name || '—',
      r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—',
    ]);

    autoTable(doc, {
      head: [['Date', 'Name', 'Work Type', 'Employees', 'Status', 'Site Engineer', 'Entered On']],
      body: rows,
      theme: 'grid',
      headStyles: {
        fillColor: [12, 12, 12],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 7,
        cellPadding: 2.5,
      },
      alternateRowStyles: {
        fillColor: [248, 248, 248],
      },
      styles: {
        lineColor: [220, 220, 220],
        lineWidth: 0.3,
      },
      columnStyles: {
        0: { cellWidth: 22, halign: 'center' },
        1: { cellWidth: 38 },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 16, halign: 'center' },
        4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 28 },
        6: { cellWidth: 22, halign: 'center' },
      },
      margin: { top: 15, right: 10, bottom: 10, left: 10 },
    });

    doc.save(`attendance-records-${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [filteredRecords]);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #e2e8f0',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Users size={24} style={{ color: '#0f172a' }} />
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              Manpower Attendance
            </h1>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
              Daily workforce tracking with category breakdown
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => onNavigate?.('/subcontractors')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: '8px',
              background: '#f1f5f9',
              color: '#0f172a',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
            }}
          >
            <X size={16} />
            Close
          </button>
        </div>
      </div>

      <SubcontractorModuleNav onNavigate={(path) => onNavigate?.(path)} />

      {/* Sub-tab Navigation */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #e2e8f0',
        padding: '0 24px',
        display: 'flex',
        gap: '4px',
      }}>
        {[
          { id: 'add' as const, label: 'Add Attendance', icon: Plus },
          { id: 'records' as const, label: 'Attendance Records', icon: Calendar },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              border: 'none',
              background: 'transparent',
              color: activeSubTab === tab.id ? '#0f172a' : '#94a3b8',
              fontSize: '13px',
              fontWeight: activeSubTab === tab.id ? 600 : 500,
              cursor: 'pointer',
              borderBottom: activeSubTab === tab.id ? '2px solid #0f172a' : '2px solid transparent',
              marginBottom: '-1px',
              transition: 'all 0.15s ease',
            }}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'add' && (
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Filters */}
        <div style={{
          background: '#fff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          padding: '16px',
          marginBottom: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '16px',
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '6px' }}>
              Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '14px',
                outline: 'none',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '6px' }}>
              Client
            </label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '14px',
                outline: 'none',
                background: '#fff',
              }}
            >
              <option value="">Select client</option>
              {clients?.map((c: any) => (
                <option key={c.id} value={c.id}>{c.client_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '6px' }}>
              Subcontractor
            </label>
            <select
              value={selectedSubcontractor}
              onChange={(e) => setSelectedSubcontractor(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '14px',
                outline: 'none',
                background: '#fff',
              }}
            >
              <option value="">Select subcontractor</option>
              {subcontractors?.map((sub: any) => (
                <option key={sub.id} value={sub.id}>{sub.company_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '6px' }}>
              Work Unit Type
            </label>
            <select
              value={workUnitType}
              onChange={(e) => setWorkUnitType(e.target.value as any)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '14px',
                outline: 'none',
                background: '#fff',
              }}
            >
              <option value="PROJECT">Project</option>
              <option value="ALTERATION">Alteration</option>
              <option value="AMC">AMC</option>
              <option value="WORK_ORDER">Work Order</option>
              <option value="GENERAL">General / Non-Project</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            {showForm ? (
              <button
                onClick={() => setShowForm(false)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                  transition: 'all 0.15s ease',
                }}
                title="Close form"
              >
                <X size={16} />
              </button>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="btn-primary"
                style={{ width: '100%' }}
              >
                Add Attendance
              </button>
            )}
          </div>
        </div>

        {/* Attendance Form */}
        {showForm && (
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '16px',
            marginBottom: '16px',
          }}>
            {/* Header Fields */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '16px',
              marginBottom: '16px',
              paddingBottom: '16px',
              borderBottom: '1px solid #e2e8f0',
            }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '6px' }}>
                  Supervisor Name
                </label>
                <input
                  type="text"
                  value={supervisor}
                  onChange={(e) => setSupervisor(e.target.value)}
                  placeholder="Enter supervisor name"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '6px' }}>
                  Remarks
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional remarks"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Attendance Entries */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a', margin: 0 }}>
                  Labour Categories
                </h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setShowCategoryManager(!showCategoryManager)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: showCategoryManager ? '#0f172a' : '#f1f5f9',
                      color: showCategoryManager ? '#fff' : '#0f172a',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '500',
                    }}
                  >
                    Manage
                  </button>
                  <button
                    onClick={addAttendanceEntry}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: '#f1f5f9',
                      color: '#0f172a',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Plus size={14} />
                    Add Row
                  </button>
                </div>
              </div>

              {showCategoryManager && (
                <div style={{
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  padding: '12px',
                  marginBottom: '12px',
                }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>
                    Existing Categories
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                    {labourCategories?.map((lc) => (
                      <div key={lc.id} style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '4px 10px', borderRadius: '6px',
                        background: '#fff', border: '1px solid #e2e8f0',
                        fontSize: '12px',
                      }}>
                        <span>{lc.name} (₹{lc.base_rate}/{lc.unit})</span>
                        <button
                          onClick={() => handleDeleteCategory(lc.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '2px', fontSize: '14px', lineHeight: 1 }}
                          title="Delete category"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>
                    Add New Category
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="Category name"
                      style={{
                        flex: 1, padding: '6px 8px', borderRadius: '6px',
                        border: '1px solid #e2e8f0', fontSize: '12px', outline: 'none',
                      }}
                    />
                    <input
                      type="number"
                      min="0"
                      value={newCatRate}
                      onChange={(e) => setNewCatRate(parseFloat(e.target.value) || 0)}
                      style={{
                        width: '80px', padding: '6px 8px', borderRadius: '6px',
                        border: '1px solid #e2e8f0', fontSize: '12px', outline: 'none',
                      }}
                      placeholder="Rate"
                    />
                    <select
                      value={newCatUnit}
                      onChange={(e) => setNewCatUnit(e.target.value as any)}
                      style={{
                        padding: '6px 8px', borderRadius: '6px',
                        border: '1px solid #e2e8f0', fontSize: '12px', outline: 'none',
                        background: '#fff',
                      }}
                    >
                      <option value="day">Day</option>
                      <option value="hour">Hour</option>
                      <option value="piece">Piece</option>
                    </select>
                    <button
                      onClick={handleAddCategory}
                      style={{
                        padding: '6px 14px', borderRadius: '6px',
                        background: '#0f172a', color: '#fff', border: 'none',
                        cursor: 'pointer', fontSize: '12px', fontWeight: '500',
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {attendanceEntries.map((entry, index) => (
                <div
                  key={index}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 2fr 1fr 1fr auto',
                    gap: '12px',
                    padding: '12px',
                    background: index % 2 === 0 ? '#f8fafc' : '#fff',
                    borderRadius: '6px',
                    marginBottom: '8px',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                      Category
                    </label>
                    <select
                      value={entry.labour_category_id}
                      onChange={(e) => updateAttendanceEntry(index, 'labour_category_id', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        fontSize: '13px',
                        outline: 'none',
                        background: '#fff',
                      }}
                    >
                      <option value="">Select category</option>
                      {labourCategories?.map((lc) => (
                        <option key={lc.id} value={lc.id}>{lc.name} ({lc.unit})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                      Workers
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={entry.workers_count}
                      onChange={(e) => updateAttendanceEntry(index, 'workers_count', parseInt(e.target.value) || 0)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                      Hours
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={entry.hours_worked}
                      onChange={(e) => updateAttendanceEntry(index, 'hours_worked', parseFloat(e.target.value) || 0)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                      Modifiers
                    </label>
                    <select
                      multiple
                      value={entry.applied_modifiers}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions).map(opt => opt.value);
                        updateAttendanceEntry(index, 'applied_modifiers', selected);
                      }}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                        outline: 'none',
                        background: '#fff',
                        minHeight: '60px',
                      }}
                    >
                      {contextModifiers?.map((cm) => (
                        <option key={cm.id} value={cm.id}>
                          {cm.name} ({cm.is_percentage ? `${(cm.multiplier - 1) * 100}%` : `+${cm.multiplier}`})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                      Base Rate
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={entry.base_rate}
                      onChange={(e) => updateAttendanceEntry(index, 'base_rate', parseFloat(e.target.value) || 0)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                      Adjusted Rate
                    </label>
                    <div style={{ padding: '6px 8px', fontSize: '13px', color: entry.adjusted_rate > entry.base_rate ? '#16a34a' : '#0f172a', fontWeight: '600' }}>
                      {entry.adjusted_rate.toFixed(2)}
                    </div>
                  </div>
                  <button
                    onClick={() => removeAttendanceEntry(index)}
                    style={{
                      padding: '6px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#dc2626',
                      borderRadius: '4px',
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
              padding: '16px',
              background: '#f8fafc',
              borderRadius: '8px',
              marginBottom: '16px',
            }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                  Total Workers
                </div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                  {totalWorkers}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                  Original Amount
                </div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                  ₹{totalOriginalAmount.toFixed(2)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                  Adjusted Amount
                </div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                  ₹{totalAdjustedAmount.toFixed(2)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                  Difference
                </div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: totalDifference > 0 ? '#16a34a' : totalDifference < 0 ? '#dc2626' : '#0f172a' }}>
                  {totalDifference > 0 ? '+' : ''}₹{totalDifference.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setAttendanceEntries([defaultEntry(), defaultEntry()]);
                  setSelectedClient('');
                  setSupervisor('');
                  setRemarks('');
                  setShowForm(false);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: '#fff',
                  color: '#0f172a',
                  border: '1px solid #e2e8f0',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={attendanceEntries.length === 0 || createAttendance.isPending}
                className="btn-primary"
                style={{ padding: '12px' }}
              >
                {createAttendance.isPending ? 'Saving...' : 'Save Attendance'}
              </button>
            </div>
          </div>
        )}

        {/* Existing Attendance Table */}
        {existingAttendance && existingAttendance.length > 0 && (
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '16px',
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a', marginBottom: '12px' }}>
              Existing Attendance for {selectedDate}
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '8px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>
                    Category
                  </th>
                  <th style={{ padding: '8px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>
                    Workers
                  </th>
                  <th style={{ padding: '8px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>
                    Hours
                  </th>
                  <th style={{ padding: '8px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>
                    Base Rate
                  </th>
                  <th style={{ padding: '8px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>
                    Adjusted Rate
                  </th>
                  <th style={{ padding: '8px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>
                    Amount
                  </th>
                  <th style={{ padding: '8px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {existingAttendance.map((att) => (
                  <tr key={att.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px', fontSize: '13px', color: '#0f172a' }}>
                      {att.labour_categories?.name}
                    </td>
                    <td style={{ padding: '8px', fontSize: '13px', color: '#0f172a' }}>
                      {att.workers_count}
                    </td>
                    <td style={{ padding: '8px', fontSize: '13px', color: '#0f172a' }}>
                      {att.hours_worked}
                    </td>
                    <td style={{ padding: '8px', fontSize: '13px', color: '#0f172a' }}>
                      ₹{att.base_rate.toFixed(2)}
                    </td>
                    <td style={{ padding: '8px', fontSize: '13px', color: att.adjusted_rate > att.base_rate ? '#16a34a' : '#0f172a' }}>
                      ₹{att.adjusted_rate.toFixed(2)}
                    </td>
                    <td style={{ padding: '8px', fontSize: '13px', color: '#0f172a', fontWeight: '600' }}>
                      ₹{att.adjusted_amount.toFixed(2)}
                    </td>
                    <td style={{ padding: '8px', fontSize: '13px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600',
                        background: att.status === 'APPROVED' ? '#dcfce7' : att.status === 'DRAFT' ? '#f1f5f9' : '#fef9c3',
                        color: att.status === 'APPROVED' ? '#16a34a' : att.status === 'DRAFT' ? '#64748b' : '#ca8a04',
                      }}>
                        {att.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {activeSubTab === 'records' && (
        <div className="records-section">
          <style>{RECORDS_CSS}</style>
          {/* Double-Bezel Filter Card */}
          <div className="filter-doppel-outer">
            <div className="filter-doppel-inner">
              <div className="filter-grid">
                <div className="filter-field">
                  <label className="filter-label">Search</label>
                  <div className="filter-input-wrap">
                    <Search size={13} className="filter-input-icon" />
                    <input
                      type="text"
                      value={recSearch}
                      onChange={(e) => setRecSearch(e.target.value)}
                      placeholder="Name or engineer..."
                      className="filter-input"
                    />
                  </div>
                </div>
                <div className="filter-field">
                  <label className="filter-label">Subcontractor</label>
                  <select value={recSubcontractor} onChange={(e) => setRecSubcontractor(e.target.value)} className="filter-select">
                    <option value="">All</option>
                    {subcontractors?.map((sub: any) => (
                      <option key={sub.id} value={sub.id}>{sub.company_name}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-field">
                  <label className="filter-label">Client</label>
                  <select value={recClient} onChange={(e) => setRecClient(e.target.value)} className="filter-select">
                    <option value="">All</option>
                    {clients?.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.client_name}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-field">
                  <label className="filter-label">Work Type</label>
                  <select value={recWorkType} onChange={(e) => setRecWorkType(e.target.value)} className="filter-select">
                    <option value="">All</option>
                    <option value="PROJECT">Project</option>
                    <option value="ALTERATION">Alteration</option>
                    <option value="AMC">AMC</option>
                    <option value="WORK_ORDER">Work Order</option>
                    <option value="GENERAL">General</option>
                  </select>
                </div>
                <div className="filter-field">
                  <label className="filter-label">Status</label>
                  <select value={recStatus} onChange={(e) => setRecStatus(e.target.value)} className="filter-select">
                    <option value="">All</option>
                    <option value="DRAFT">Draft</option>
                    <option value="SUBMITTED">Submitted</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
                <div className="filter-field">
                  <label className="filter-label">From</label>
                  <input type="date" value={recDateFrom} onChange={(e) => setRecDateFrom(e.target.value)} className="filter-input" />
                </div>
                <div className="filter-field">
                  <label className="filter-label">To</label>
                  <input type="date" value={recDateTo} onChange={(e) => setRecDateTo(e.target.value)} className="filter-input" />
                </div>
              </div>
              <div className="filter-actions">
                <button className="download-btn" onClick={downloadPDF}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Download PDF
                </button>
              </div>
            </div>
          </div>

          {/* Double-Bezel Table Card */}
          <div className="table-doppel-outer">
            <div className="table-doppel-inner">
              <EnhancedDataTable
                data={filteredRecords}
                columns={attendanceColumns}
                enableSearch={false}
                enableSorting={true}
                enablePagination={true}
                defaultPageSize={15}
                emptyMessage="No attendance records found matching your filters"
                loading={loadingRecords}
                onRefresh={() => refetchRecords()}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
