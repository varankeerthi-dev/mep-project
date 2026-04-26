// ============================================
// MANPOWER ATTENDANCE PAGE
// ============================================

import { useState, useEffect } from 'react';
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
import { Plus, Trash2, Save, Calendar, Users, Building2, X, ChevronDown } from 'lucide-react';

interface ManpowerAttendanceProps {
  onNavigate?: (path: string) => void;
}

export function ManpowerAttendance({ onNavigate }: ManpowerAttendanceProps) {
  const { organisation } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSubcontractor, setSelectedSubcontractor] = useState('');
  const [selectedWorkUnit, setSelectedWorkUnit] = useState('');
  const [workUnitType, setWorkUnitType] = useState<'PROJECT' | 'ALTERATION' | 'AMC' | 'WORK_ORDER'>('PROJECT');
  const [supervisor, setSupervisor] = useState('');
  const [remarks, setRemarks] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Attendance entries for the day
  const [attendanceEntries, setAttendanceEntries] = useState<{
    labour_category_id: string;
    workers_count: number;
    hours_worked: number;
    applied_modifiers: string[];
    base_rate: number;
    adjusted_rate: number;
    original_amount: number;
    adjusted_amount: number;
  }[]>([]);

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

  const { data: labourCategories } = useManpower.useLabourCategories(organisation?.id);
  const { data: contextModifiers } = useManpower.useContextModifiers(organisation?.id);
  const { data: rateCards } = useManpower.useRateCards(organisation?.id, selectedSubcontractor);
  const { data: existingAttendance } = useManpower.useManpowerAttendance(
    organisation?.id,
    selectedSubcontractor,
    selectedDate,
    selectedDate
  );

  const createAttendance = useManpower.useCreateManpowerAttendance();

  // Add new attendance entry row
  const addAttendanceEntry = () => {
    setAttendanceEntries([
      ...attendanceEntries,
      {
        labour_category_id: '',
        workers_count: 1,
        hours_worked: 8,
        applied_modifiers: [],
        base_rate: 0,
        adjusted_rate: 0,
        original_amount: 0,
        adjusted_amount: 0,
      },
    ]);
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
    if (field === 'labour_category_id' || field === 'applied_modifiers' || field === 'workers_count') {
      const category = labourCategories?.find(lc => lc.id === updated[index].labour_category_id);
      if (category) {
        const calculated = calculateAttendanceValues(
          category.base_rate,
          updated[index].workers_count,
          updated[index].applied_modifiers,
          contextModifiers || []
        );
        updated[index] = {
          ...updated[index],
          base_rate: category.base_rate,
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

    if (attendanceEntries.length === 0) {
      alert('Please add at least one attendance entry');
      return;
    }

    try {
      for (const entry of attendanceEntries) {
        if (!entry.labour_category_id || entry.workers_count === 0) continue;

        const input: CreateManpowerAttendanceInput = {
          organisation_id: organisation.id,
          subcontractor_id: selectedSubcontractor,
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
      setAttendanceEntries([]);
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
  const totalWorkers = attendanceEntries.reduce((sum, entry) => sum + entry.workers_count, 0);

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
            onClick={() => onNavigate?.('/subcontractors/attendance/list')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              background: '#f1f5f9',
              color: '#0f172a',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
            }}
          >
            <Users size={16} />
            View Logs
          </button>
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

      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Filters */}
        <div style={{
          background: '#fff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          padding: '16px',
          marginBottom: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
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
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={() => setShowForm(!showForm)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                background: '#0f172a',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <Plus size={16} />
              {showForm ? 'Close Form' : 'Add Attendance'}
            </button>
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
                      {labourCategories?.filter(lc => lc.is_active).map((lc) => (
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
                    <div style={{ padding: '6px 8px', fontSize: '13px', color: '#0f172a' }}>
                      {entry.base_rate.toFixed(2)}
                    </div>
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
                  setAttendanceEntries([]);
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
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: '#0f172a',
                  color: '#fff',
                  border: 'none',
                  cursor: attendanceEntries.length === 0 || createAttendance.isPending ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: attendanceEntries.length === 0 || createAttendance.isPending ? 0.6 : 1,
                }}
              >
                <Save size={16} />
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
    </div>
  );
}
