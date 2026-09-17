import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../../App';
import { SubcontractorModuleNav } from '../Shared/SubcontractorModuleNav';
import { Plus, Trash2, Edit2, Search, Filter, Calendar, Users, X, CheckCircle, Clock, XCircle } from 'lucide-react';
import { subcontractorService } from '../../services/subcontractorService';

interface AttendanceListPageProps {
  onNavigate?: (path: string) => void;
}

export function AttendanceListPage({ onNavigate }: AttendanceListPageProps) {
  const { organisation } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubcontractor, setSelectedSubcontractor] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const { data: subcontractors } = useQuery({
    queryKey: ['v2-subcontractors', 'list', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      return subcontractorService.getSubcontractors(organisation.id, 'all');
    },
    enabled: !!organisation?.id,
  });

  const queryClient = useQueryClient();

  const { data: attendance, isLoading, refetch } = useQuery({
    queryKey: ['v2-manpower-attendance-list', organisation?.id, selectedSubcontractor, startDate, endDate],
    queryFn: async () => {
      if (!organisation?.id) return [];
      return subcontractorService.getAttendanceByDateRange(organisation.id, selectedSubcontractor || undefined, startDate || undefined, endDate || undefined);
    },
    enabled: !!organisation?.id,
  });

  const updateAttendance = useMutation({
    mutationFn: async (input: { id: string; workers_count: number; hours_worked: number; supervisor_name?: string; remarks?: string }) => {
      if (!organisation?.id) throw new Error('No organisation');
      return subcontractorService.updateAttendance({
        id: input.id,
        organisation_id: organisation.id,
        workers_count: input.workers_count,
        hours_worked: input.hours_worked,
        supervisor_name: input.supervisor_name || null,
        remarks: input.remarks || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['v2-manpower-attendance-list'] });
    },
  });

  const deleteAttendance = useMutation({
    mutationFn: async (id: string) => {
      if (!organisation?.id) throw new Error('No organisation');
      return subcontractorService.deleteAttendance(id, organisation.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['v2-manpower-attendance-list'] });
    },
  });

  const approveAttendance = useMutation({
    mutationFn: async (id: string) => {
      if (!organisation?.id) throw new Error('No organisation');
      return subcontractorService.approveAttendance(id, organisation.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['v2-manpower-attendance-list'] });
    },
  });

  const filteredAttendance = useMemo(() => {
    return attendance?.filter((att: any) => {
      const matchesSearch = searchTerm === '' ||
        att.labour_categories?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        att.subcontractors?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        att.supervisor_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = selectedStatus === '' || att.status === selectedStatus;
      return matchesSearch && matchesStatus;
    }) || [];
  }, [attendance, searchTerm, selectedStatus]);

  const groupedAttendance = useMemo(() => {
    return filteredAttendance.reduce((acc: any, att: any) => {
      const date = att.attendance_date;
      if (!acc[date]) acc[date] = [];
      acc[date].push(att);
      return acc;
    }, {});
  }, [filteredAttendance]);

  const totalWorkers = useMemo(() => filteredAttendance.reduce((sum: number, att: any) => sum + (att.workers_count || 0), 0), [filteredAttendance]);
  const totalAmount = useMemo(() => filteredAttendance.reduce((sum: number, att: any) => sum + (att.adjusted_amount || 0), 0), [filteredAttendance]);

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
    if (!confirm('Are you sure you want to delete this attendance entry?')) return;
    await deleteAttendance.mutateAsync(id);
    refetch();
  };

  const handleApprove = async (id: string) => {
    await approveAttendance.mutateAsync(id);
    refetch();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return { bg: '#dcfce7', text: '#16a34a' };
      case 'SUBMITTED': return { bg: '#fef9c3', text: '#ca8a04' };
      case 'REJECTED': return { bg: '#fee2e2', text: '#dc2626' };
      default: return { bg: '#f1f5f9', text: '#64748b' };
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ padding: '24px 24px 0', background: '#f8fafc' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '-0.5px', color: '#0f172a', margin: 0 }}>
                Attendance Logs
              </h1>
              <p style={{ fontSize: '14px', color: '#64748b', marginTop: '4px', margin: '4px 0 0 0' }}>
                View and manage all manpower attendance records
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => onNavigate?.('/subcontractors-v2/attendance')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px', borderRadius: '8px',
                  background: '#0f172a', padding: '10px 20px', fontSize: '14px', fontWeight: '600',
                  color: '#fff', border: 'none', cursor: 'pointer', transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#1e293b'}
                onMouseOut={(e) => e.currentTarget.style.background = '#0f172a'}
              >
                <Plus size={16} />
                Add Attendance
              </button>
              <button
                onClick={() => onNavigate?.('/subcontractors-v2')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px', borderRadius: '8px',
                  background: '#fff', padding: '10px 20px', fontSize: '14px', fontWeight: '600',
                  color: '#0f172a', border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
              >
                <X size={16} />
                Close
              </button>
            </div>
          </div>

          {onNavigate && <SubcontractorModuleNav onNavigate={onNavigate} />}

          {/* Filters */}
          <div style={{
            borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)', marginBottom: '16px'
          }}>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                <div style={{ flex: '1', minWidth: '280px', position: 'relative' }}>
                  <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by category, subcontractor, or supervisor..." style={{ width: '100%', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', padding: '10px 12px 10px 40px', fontSize: '14px', color: '#0f172a', outline: 'none' }} />
                  <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '14px' }}>🔍</span>
                </div>
                <div style={{ minWidth: '200px' }}>
                  <select value={selectedSubcontractor} onChange={(e) => setSelectedSubcontractor(e.target.value)} style={{ width: '100%', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', padding: '10px 12px', fontSize: '14px', color: '#0f172a', outline: 'none' }}>
                    <option value="">All subcontractors</option>
                    {subcontractors?.map((sub: any) => <option key={sub.id} value={sub.id}>{sub.company_name}</option>)}
                  </select>
                </div>
                <div style={{ minWidth: '150px' }}>
                  <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} style={{ width: '100%', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', padding: '10px 12px', fontSize: '14px', color: '#0f172a', outline: 'none' }}>
                    <option value="">All statuses</option>
                    <option value="DRAFT">Draft</option>
                    <option value="SUBMITTED">Submitted</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
                <div style={{ minWidth: '150px' }}>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: '100%', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', padding: '10px 12px', fontSize: '14px', color: '#0f172a', outline: 'none' }} />
                </div>
                <div style={{ minWidth: '150px' }}>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: '100%', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', padding: '10px 12px', fontSize: '14px', color: '#0f172a', outline: 'none' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
            <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '12px', borderRadius: '8px', background: '#f1f5f9' }}><Users size={24} style={{ color: '#0f172a' }} /></div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>Total Workers</div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a' }}>{totalWorkers}</div>
              </div>
            </div>
            <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '12px', borderRadius: '8px', background: '#f1f5f9' }}><Calendar size={24} style={{ color: '#0f172a' }} /></div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>Total Entries</div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a' }}>{filteredAttendance.length}</div>
              </div>
            </div>
            <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '12px', borderRadius: '8px', background: '#dcfce7' }}><Users size={24} style={{ color: '#16a34a' }} /></div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>Total Amount</div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a' }}>₹{totalAmount.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Attendance Table */}
          <div style={{ borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', overflow: 'hidden' }}>
            {isLoading ? (
              <div style={{ padding: '64px 24px', textAlign: 'center' }}><div style={{ color: '#64748b' }}>Loading...</div></div>
            ) : Object.keys(groupedAttendance).length === 0 ? (
              <div style={{ padding: '64px 24px', textAlign: 'center' }}><div style={{ color: '#64748b' }}>No attendance records found</div></div>
            ) : (
              Object.entries(groupedAttendance).map(([date, entries]: [string, any[]]) => (
                <div key={date} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ padding: '10px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                    <Calendar size={14} />
                    {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                        {['Subcontractor', 'Category', 'Workers', 'Hours', 'Supervisor', 'Base Rate', 'Adjusted Rate', 'Amount', 'Status', 'Source', 'Actions'].map((header) => (
                          <th key={header} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b' }}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry: any) => {
                        const statusColor = getStatusColor(entry.status);
                        return (
                          <tr key={entry.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 12px', fontSize: '13px', color: '#0f172a' }}>{entry.subcontractors?.company_name || '-'}</td>
                            <td style={{ padding: '10px 12px', fontSize: '13px', color: '#0f172a' }}>{entry.labour_categories?.name || '-'}</td>
                            <td style={{ padding: '10px 12px', fontSize: '13px', color: '#0f172a' }}>{entry.workers_count}</td>
                            <td style={{ padding: '10px 12px', fontSize: '13px', color: '#0f172a' }}>{entry.hours_worked}</td>
                            <td style={{ padding: '10px 12px', fontSize: '13px', color: '#0f172a' }}>{entry.supervisor_name || '-'}</td>
                            <td style={{ padding: '10px 12px', fontSize: '13px', color: '#0f172a' }}>₹{entry.base_rate?.toFixed(2)}</td>
                            <td style={{ padding: '10px 12px', fontSize: '13px', color: entry.adjusted_rate > entry.base_rate ? '#16a34a' : '#0f172a', fontWeight: '600' }}>₹{entry.adjusted_rate?.toFixed(2)}</td>
                            <td style={{ padding: '10px 12px', fontSize: '13px', color: '#0f172a', fontWeight: '600' }}>₹{entry.adjusted_amount?.toFixed(2)}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', background: statusColor.bg, color: statusColor.text, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                {entry.status === 'APPROVED' && <CheckCircle size={12} />}
                                {(entry.status === 'SUBMITTED' || entry.status === 'DRAFT') && <Clock size={12} />}
                                {entry.status === 'REJECTED' && <XCircle size={12} />}
                                {entry.status}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', background: entry.source === 'site_report' ? '#eff6ff' : '#f1f5f9', color: entry.source === 'site_report' ? '#2563eb' : '#64748b' }}>
                                {entry.source === 'site_report' ? 'Site Report' : entry.source === 'direct' ? 'Direct' : '—'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                <button onClick={() => { setEditingEntry(entry); setShowEditModal(true); }} style={{ padding: '6px', background: '#f1f5f9', border: 'none', cursor: 'pointer', borderRadius: '4px', color: '#0f172a' }} title="Edit"><Edit2 size={14} /></button>
                                {entry.status === 'DRAFT' && <button onClick={() => handleApprove(entry.id)} style={{ padding: '6px', background: '#dcfce7', border: 'none', cursor: 'pointer', borderRadius: '4px', color: '#16a34a' }} title="Approve"><CheckCircle size={14} /></button>}
                                <button onClick={() => handleDelete(entry.id)} style={{ padding: '6px', background: '#fee2e2', border: 'none', cursor: 'pointer', borderRadius: '4px', color: '#dc2626' }} title="Delete"><Trash2 size={14} /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && editingEntry && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '90%', maxWidth: '500px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginBottom: '16px' }}>Edit Attendance</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>Workers Count</label>
                <input type="number" min="1" value={editingEntry.workers_count} onChange={(e) => setEditingEntry({ ...editingEntry, workers_count: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>Hours Worked</label>
                <input type="number" step="0.5" min="0" value={editingEntry.hours_worked} onChange={(e) => setEditingEntry({ ...editingEntry, hours_worked: parseFloat(e.target.value) || 0 })} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>Supervisor Name</label>
                <input type="text" value={editingEntry.supervisor_name || ''} onChange={(e) => setEditingEntry({ ...editingEntry, supervisor_name: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>Remarks</label>
                <input type="text" value={editingEntry.remarks || ''} onChange={(e) => setEditingEntry({ ...editingEntry, remarks: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowEditModal(false); setEditingEntry(null); }} style={{ padding: '8px 16px', borderRadius: '8px', background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Cancel</button>
              <button onClick={handleSaveEdit} disabled={updateAttendance.isPending} style={{ padding: '8px 16px', borderRadius: '8px', background: '#0f172a', color: '#fff', border: 'none', cursor: updateAttendance.isPending ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '500', opacity: updateAttendance.isPending ? 0.6 : 1 }}>
                {updateAttendance.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
