// ============================================
// MANPOWER ATTENDANCE LIST PAGE
// ============================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';
import { useManpower } from '../hooks/useManpower';
import { ManpowerAttendance as ManpowerAttendanceType, AttendanceStatus } from '../types/manpower';
import { Plus, Trash2, Edit2, Search, Filter, Calendar, Users, X, CheckCircle, Clock, XCircle } from 'lucide-react';

interface ManpowerAttendanceListProps {
  onNavigate?: (path: string) => void;
}

export function ManpowerAttendanceList({ onNavigate }: ManpowerAttendanceListProps) {
  const { organisation } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubcontractor, setSelectedSubcontractor] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [editingEntry, setEditingEntry] = useState<ManpowerAttendanceType | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

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

  const { data: attendance, isLoading, refetch } = useManpower.useManpowerAttendance(
    organisation?.id,
    selectedSubcontractor || undefined,
    startDate || undefined,
    endDate || undefined
  );

  const updateAttendance = useManpower.useUpdateManpowerAttendance();
  const deleteAttendance = useManpower.useDeleteManpowerAttendance();
  const approveAttendance = useManpower.useApproveManpowerAttendance();

  // Filter attendance based on search and status
  const filteredAttendance = attendance?.filter(att => {
    const matchesSearch = searchTerm === '' || 
      att.labour_categories?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      att.subcontractors?.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      att.supervisor_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = selectedStatus === '' || att.status === selectedStatus;
    
    return matchesSearch && matchesStatus;
  }) || [];

  // Group by date
  const groupedAttendance = filteredAttendance.reduce((acc, att) => {
    const date = att.attendance_date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(att);
    return acc;
  }, {} as Record<string, ManpowerAttendanceType[]>);

  // Calculate totals
  const totalWorkers = filteredAttendance.reduce((sum, att) => sum + att.workers_count, 0);
  const totalAmount = filteredAttendance.reduce((sum, att) => sum + att.adjusted_amount, 0);

  const handleEdit = (entry: ManpowerAttendanceType) => {
    setEditingEntry(entry);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;
    
    await updateAttendance.mutateAsync({
      id: editingEntry.id,
      workers_count: editingEntry.workers_count,
      hours_worked: editingEntry.hours_worked,
      supervisor_name: editingEntry.supervisor_name || undefined,
      remarks: editingEntry.remarks || undefined,
    });
    
    setShowEditModal(false);
    setEditingEntry(null);
    refetch();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this attendance entry?')) {
      await deleteAttendance.mutateAsync(id);
      refetch();
    }
  };

  const handleApprove = async (id: string) => {
    await approveAttendance.mutateAsync(id);
    refetch();
  };

  const getStatusIcon = (status: AttendanceStatus) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircle size={16} style={{ color: '#16a34a' }} />;
      case 'SUBMITTED':
        return <Clock size={16} style={{ color: '#ca8a04' }} />;
      case 'REJECTED':
        return <XCircle size={16} style={{ color: '#dc2626' }} />;
      default:
        return <Clock size={16} style={{ color: '#64748b' }} />;
    }
  };

  const getStatusColor = (status: AttendanceStatus) => {
    switch (status) {
      case 'APPROVED':
        return '#dcfce7';
      case 'SUBMITTED':
        return '#fef9c3';
      case 'REJECTED':
        return '#fee2e2';
      default:
        return '#f1f5f9';
    }
  };

  const getStatusTextColor = (status: AttendanceStatus) => {
    switch (status) {
      case 'APPROVED':
        return '#16a34a';
      case 'SUBMITTED':
        return '#ca8a04';
      case 'REJECTED':
        return '#dc2626';
      default:
        return '#64748b';
    }
  };

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
              Attendance Logs
            </h1>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
              View and edit all manpower attendance records
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => onNavigate?.('/subcontractors/attendance')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              background: '#0f172a',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
            }}
          >
            <Plus size={16} />
            Add Attendance
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
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '16px',
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '6px' }}>
              Search
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>
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
              <option value="">All subcontractors</option>
              {subcontractors?.map((sub: any) => (
                <option key={sub.id} value={sub.id}>{sub.company_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '6px' }}>
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as AttendanceStatus | '')}
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
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '6px' }}>
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
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
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
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

        {/* Summary Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          marginBottom: '16px',
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <div style={{
              padding: '12px',
              borderRadius: '8px',
              background: '#f1f5f9',
            }}>
              <Users size={24} style={{ color: '#0f172a' }} />
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                Total Workers
              </div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a' }}>
                {totalWorkers}
              </div>
            </div>
          </div>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <div style={{
              padding: '12px',
              borderRadius: '8px',
              background: '#f1f5f9',
            }}>
              <Calendar size={24} style={{ color: '#0f172a' }} />
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                Total Entries
              </div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a' }}>
                {filteredAttendance.length}
              </div>
            </div>
          </div>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <div style={{
              padding: '12px',
              borderRadius: '8px',
              background: '#dcfce7',
            }}>
              <Users size={24} style={{ color: '#16a34a' }} />
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                Total Amount
              </div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a' }}>
                ₹{totalAmount.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Attendance Table */}
        <div style={{
          background: '#fff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          padding: '16px',
        }}>
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
              <div style={{ color: '#64748b' }}>Loading...</div>
            </div>
          ) : Object.keys(groupedAttendance).length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
              <div style={{ color: '#64748b' }}>No attendance records found</div>
            </div>
          ) : (
            Object.entries(groupedAttendance).map(([date, entries]) => (
              <div key={date} style={{ marginBottom: '24px' }}>
                <div style={{
                  padding: '8px 12px',
                  background: '#f8fafc',
                  borderRadius: '6px',
                  marginBottom: '12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <Calendar size={16} />
                  {new Date(date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '8px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>
                        Subcontractor
                      </th>
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
                        Supervisor
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
                      <th style={{ padding: '8px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px', fontSize: '13px', color: '#0f172a' }}>
                          {entry.subcontractors?.company_name}
                        </td>
                        <td style={{ padding: '8px', fontSize: '13px', color: '#0f172a' }}>
                          {entry.labour_categories?.name}
                        </td>
                        <td style={{ padding: '8px', fontSize: '13px', color: '#0f172a' }}>
                          {entry.workers_count}
                        </td>
                        <td style={{ padding: '8px', fontSize: '13px', color: '#0f172a' }}>
                          {entry.hours_worked}
                        </td>
                        <td style={{ padding: '8px', fontSize: '13px', color: '#0f172a' }}>
                          {entry.supervisor_name || '-'}
                        </td>
                        <td style={{ padding: '8px', fontSize: '13px', color: '#0f172a' }}>
                          ₹{entry.base_rate.toFixed(2)}
                        </td>
                        <td style={{ padding: '8px', fontSize: '13px', color: entry.adjusted_rate > entry.base_rate ? '#16a34a' : '#0f172a' }}>
                          ₹{entry.adjusted_rate.toFixed(2)}
                        </td>
                        <td style={{ padding: '8px', fontSize: '13px', color: '#0f172a', fontWeight: '600' }}>
                          ₹{entry.adjusted_amount.toFixed(2)}
                        </td>
                        <td style={{ padding: '8px' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: getStatusColor(entry.status),
                            color: getStatusTextColor(entry.status),
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}>
                            {getStatusIcon(entry.status)}
                            {entry.status}
                          </span>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleEdit(entry)}
                              style={{
                                padding: '6px',
                                background: '#f1f5f9',
                                border: 'none',
                                cursor: 'pointer',
                                borderRadius: '4px',
                                color: '#0f172a',
                              }}
                              title="Edit"
                            >
                              <Edit2 size={14} />
                            </button>
                            {entry.status === 'DRAFT' && (
                              <button
                                onClick={() => handleApprove(entry.id)}
                                style={{
                                  padding: '6px',
                                  background: '#dcfce7',
                                  border: 'none',
                                  cursor: 'pointer',
                                  borderRadius: '4px',
                                  color: '#16a34a',
                                }}
                                title="Approve"
                              >
                                <CheckCircle size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(entry.id)}
                              style={{
                                padding: '6px',
                                background: '#fee2e2',
                                border: 'none',
                                cursor: 'pointer',
                                borderRadius: '4px',
                                color: '#dc2626',
                              }}
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && editingEntry && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '24px',
            width: '90%',
            maxWidth: '500px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginBottom: '16px' }}>
              Edit Attendance
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>
                  Workers Count
                </label>
                <input
                  type="number"
                  min="1"
                  value={editingEntry.workers_count}
                  onChange={(e) => setEditingEntry({ ...editingEntry, workers_count: parseInt(e.target.value) || 0 })}
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
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>
                  Hours Worked
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={editingEntry.hours_worked}
                  onChange={(e) => setEditingEntry({ ...editingEntry, hours_worked: parseFloat(e.target.value) || 0 })}
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
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>
                  Supervisor Name
                </label>
                <input
                  type="text"
                  value={editingEntry.supervisor_name || ''}
                  onChange={(e) => setEditingEntry({ ...editingEntry, supervisor_name: e.target.value })}
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
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>
                  Remarks
                </label>
                <input
                  type="text"
                  value={editingEntry.remarks || ''}
                  onChange={(e) => setEditingEntry({ ...editingEntry, remarks: e.target.value })}
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
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingEntry(null);
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
                onClick={handleSaveEdit}
                disabled={updateAttendance.isPending}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: '#0f172a',
                  color: '#fff',
                  border: 'none',
                  cursor: updateAttendance.isPending ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  opacity: updateAttendance.isPending ? 0.6 : 1,
                }}
              >
                {updateAttendance.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
