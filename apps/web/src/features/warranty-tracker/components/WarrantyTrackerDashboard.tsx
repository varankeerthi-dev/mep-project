import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabase';
import { useAuth } from '@/App';
import { warrantyService } from '../services/warrantyService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Filter, RefreshCcw, AlertTriangle, Clock, CheckCircle, XCircle } from 'lucide-react';
import { SubcontractorModuleNav } from '@/features/subcontractor-v2/components/Shared/SubcontractorModuleNav';

type StatusFilter = 'all' | 'active' | 'expiring_soon' | 'expired' | 'unknown';

export function WarrantyTrackerDashboard() {
  const { organisation } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expiryDays, setExpiryDays] = useState<number | undefined>(undefined);

  const { data: warrantyData = [], isLoading, refetch } = useQuery({
    queryKey: ['warranty-tracker', organisation?.id, statusFilter, expiryDays],
    queryFn: async () => {
      if (!organisation?.id) return [];
      return warrantyService.getWarrantyTrackerData({
        organisation_id: organisation.id,
        filter_status: statusFilter === 'all' ? null : statusFilter,
        filter_expiry_days: expiryDays || null,
      });
    },
    enabled: !!organisation?.id,
    staleTime: 5 * 60 * 1000,
  });

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return warrantyData;
    const q = searchQuery.toLowerCase();
    return warrantyData.filter((item: any) =>
      item.serial_number?.toLowerCase().includes(q) ||
      item.material_name?.toLowerCase().includes(q) ||
      item.client_name?.toLowerCase().includes(q) ||
      item.dc_number?.toLowerCase().includes(q)
    );
  }, [warrantyData, searchQuery]);

  const stats = useMemo(() => {
    const active = warrantyData.filter((i: any) => i.status === 'active').length;
    const expiring = warrantyData.filter((i: any) => i.status === 'expiring_soon').length;
    const expired = warrantyData.filter((i: any) => i.status === 'expired').length;
    const unknown = warrantyData.filter((i: any) => i.status === 'unknown').length;
    return { active, expiring, expired, unknown, total: warrantyData.length };
  }, [warrantyData]);

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; color: string; icon: any; label: string }> = {
      active: { bg: '#dcfce7', color: '#166534', icon: CheckCircle, label: 'Active' },
      expiring_soon: { bg: '#fef9c3', color: '#ca8a04', icon: Clock, label: 'Expiring Soon' },
      expired: { bg: '#fee2e2', color: '#991b1b', icon: XCircle, label: 'Expired' },
      unknown: { bg: '#f3f4f6', color: '#6b7280', icon: AlertTriangle, label: 'Unknown' },
    };
    const c = config[status] || config.unknown;
    const Icon = c.icon;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
        background: c.bg, color: c.color
      }}>
        <Icon size={12} />
        {c.label}
      </span>
    );
  };

  return (
    <div style={{ padding: '24px', background: '#fafafa', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Warranty Tracker</h1>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Track warranty status of serialized items delivered to customers</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Total Tracked</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827' }}>{stats.total}</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Active</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#16a34a' }}>{stats.active}</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Expiring Soon</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#ca8a04' }}>{stats.expiring}</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Expired</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#dc2626' }}>{stats.expired}</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Unknown</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#6b7280' }}>{stats.unknown}</div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search by serial, item, customer, DC..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px 8px 36px', border: '1px solid #d1d5db', borderRadius: '6px',
                  fontSize: '13px', outline: 'none'
                }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Filter size={16} color="#6b7280" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="expiring_soon">Expiring Soon</option>
              <option value="expired">Expired</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
          <div>
            <select
              value={expiryDays || ''}
              onChange={(e) => setExpiryDays(e.target.value ? parseInt(e.target.value) : undefined)}
              style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
            >
              <option value="">All Expiry</option>
              <option value="30">Next 30 days</option>
              <option value="60">Next 60 days</option>
              <option value="90">Next 90 days</option>
            </select>
          </div>
          <Button variant="secondary" size="sm" onClick={() => refetch()} leftIcon={<RefreshCcw size={14} />}>
            Refresh
          </Button>
        </div>

        {/* Table */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                {['Customer', 'Item', 'Serial Number', 'Warranty Start', 'Warranty End', 'Days Remaining', 'Status', 'DC Number', 'DC Date'].map((header) => (
                  <th key={header} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b' }}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>Loading warranty data...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>No warranty records found</td></tr>
              ) : (
                filteredData.map((record: any) => (
                  <tr key={record.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#111827', fontWeight: 500 }}>{record.client_name || '-'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#334155' }}>{record.material_name || '-'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#111827', fontFamily: 'monospace', fontWeight: 600 }}>{record.serial_number}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>{record.warranty_start_date || '-'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>{record.warranty_end_date || '-'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: record.days_remaining === -1 ? '#dc2626' : record.days_remaining && record.days_remaining < 30 ? '#ca8a04' : '#16a34a' }}>
                      {record.days_remaining === null || record.days_remaining === undefined ? '-' : record.days_remaining === -1 ? 'Expired' : `${record.days_remaining} days`}
                    </td>
                    <td style={{ padding: '12px 16px' }}>{getStatusBadge(record.status)}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#2563eb' }}>{record.dc_number}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>{record.dc_date}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
