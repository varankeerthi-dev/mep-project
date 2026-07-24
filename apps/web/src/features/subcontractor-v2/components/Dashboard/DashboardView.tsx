import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../../supabase';
import { useAuth } from '../../../../App';
import { 
  Users, 
  Plus, 
  Search, 
  RefreshCcw, 
  Eye, 
  Phone, 
  Mail, 
  Briefcase, 
  ShieldCheck, 
  FileSignature 
} from 'lucide-react';
import { EnhancedDataTable } from '../../../../components/ui/table/index';
import { SubcontractorModuleNav } from '../Shared/SubcontractorModuleNav';
import { cn } from '../../../../lib/utils';
import type { ColumnDef } from '@tanstack/react-table';
import { SUBCONTRACTOR_V2_QUERY_KEYS } from '../../hooks/queryKeys';
import { subcontractorService } from '../../services/subcontractorService';

interface DashboardViewProps {
  onNavigate: (path: string) => void;
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const { organisation } = useAuth();
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

  const { 
    data: subcontractors = [], 
    isLoading, 
    isFetching,
    refetch 
  } = useQuery({
    queryKey: SUBCONTRACTOR_V2_QUERY_KEYS.list(organisation?.id || null, filter),
    queryFn: async () => {
      if (!organisation?.id) return [];
      return subcontractorService.getSubcontractors(organisation.id, filter);
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!organisation?.id,
  });

  const filtered = subcontractors.filter(s => 
    s.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.nature_of_work?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns: ColumnDef<any>[] = useMemo(() => [
    {
      id: 'sub_number',
      header: 'Sub ID',
      accessorKey: 'sub_number',
      cell: (info) => (
        <span className="font-black tracking-tight text-blue-600 uppercase text-[11px] pl-5">{info.getValue() || '-'}</span>
      )
    },
    {
      id: 'company_name',
      header: 'Company & Contact',
      accessorKey: 'company_name',
      cell: (info) => (
        <div className="flex flex-col animate-none">
          <span className="font-bold text-zinc-900">{info.getValue()}</span>
          <span className="text-xs text-zinc-400 font-medium">{info.row.original.contact_person || 'No contact person'}</span>
        </div>
      )
    },
    {
      id: 'phone',
      header: 'Contact Info',
      accessorKey: 'phone',
      cell: (info) => (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600">
            <Phone size={10} className="text-zinc-300" />
            {info.getValue() || '-'}
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
            <Mail size={10} className="text-zinc-300" />
            {info.row.original.email || '-'}
          </div>
        </div>
      )
    },
    {
      id: 'nature_of_work',
      header: 'Nature of Work',
      accessorKey: 'nature_of_work',
      cell: (info) => (
        <div className="flex items-center gap-1.5">
          <Briefcase size={12} className="text-zinc-300" />
          <span className="truncate max-w-[150px] font-medium text-zinc-600">{info.getValue() || '-'}</span>
        </div>
      )
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      cell: (info) => (
        <div className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest",
          info.getValue() === 'Active' ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"
        )}>
          <div className={cn("h-1.5 w-1.5 rounded-full", info.getValue() === 'Active' ? "bg-emerald-500" : "bg-zinc-400")} />
          {info.getValue()}
        </div>
      )
    },
    {
      id: 'compliance',
      header: 'Compliance',
      accessorKey: 'id',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.nda_signed ? (
            <div title="NDA Signed" className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-500">
              <ShieldCheck size={14} />
            </div>
          ) : (
            <div title="NDA Missing" className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-50 text-zinc-300">
              <ShieldCheck size={14} />
            </div>
          )}
          {row.original.contract_signed ? (
            <div title="Contract Signed" className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500">
              <FileSignature size={14} />
            </div>
          ) : (
            <div title="Contract Missing" className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-50 text-zinc-300">
              <FileSignature size={14} />
            </div>
          )}
        </div>
      )
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex justify-end">
          <button
            onClick={() => { window.subToView = row.original; onNavigate('/subcontractors-v2/view?id=' + row.original.id) }}
            className="flex h-8 w-12 items-center justify-center rounded-xl border border-zinc-100 bg-white text-zinc-400 shadow-sm transition-all hover:border-blue-200 hover:text-blue-600 hover:shadow-md active:scale-95"
          >
            <Eye size={16} />
          </button>
        </div>
      )
    }
  ], [onNavigate]);

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10">
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '40px',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 style={{
                fontSize: '24px',
                fontWeight: 600,
                color: '#171717',
                margin: 0,
              }}>
                Sub-Contractors (V2)
              </h1>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#eff6ff',
                padding: '4px 12px',
                borderRadius: '9999px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#2563eb',
                textTransform: 'uppercase',
              }}>
                <Users size={12} />
                {subcontractors.length} Registered
              </div>
            </div>
            <p style={{
              fontSize: '14px',
              color: '#737373',
              margin: '4px 0 0 0',
            }}>
              Manage workforce partners, compliance, and performance tracking
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => onNavigate('/subcontractors-v2/attendance')}
              style={{
                padding: '10px 20px',
                border: '1px solid #e5e5e5',
                borderRadius: '4px',
                background: '#fff',
                color: '#525252',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
            >
              Attendance
            </button>
            <button
              onClick={() => onNavigate('/subcontractors-v2/new')}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '4px',
                background: '#171717',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#262626'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#171717'}
            >
              <Plus size={16} />
              Add Sub-Contractor
            </button>
          </div>
        </div>

        <SubcontractorModuleNav onNavigate={onNavigate} />

        {/* Main Container */}
        <div style={{
          background: '#fff',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
        }}>
          {/* Filter & Search Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #e5e5e5',
            gap: '16px',
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{
                display: 'flex',
                background: '#fff',
                border: '1px solid #e5e5e5',
                borderRadius: '4px',
                padding: '4px',
              }}>
                <button
                  onClick={() => setFilter('all')}
                  style={{
                    padding: '6px 16px',
                    border: 'none',
                    borderRadius: '4px',
                    background: filter === 'all' ? '#171717' : 'transparent',
                    color: filter === 'all' ? '#fff' : '#737373',
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => filter !== 'all' && (e.currentTarget.style.background = '#f5f5f5')}
                  onMouseLeave={(e) => filter !== 'all' && (e.currentTarget.style.background = 'transparent')}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter('active')}
                  style={{
                    padding: '6px 16px',
                    border: 'none',
                    borderRadius: '4px',
                    background: filter === 'active' ? '#059669' : 'transparent',
                    color: filter === 'active' ? '#fff' : '#737373',
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => filter !== 'active' && (e.currentTarget.style.background = '#f5f5f5')}
                  onMouseLeave={(e) => filter !== 'active' && (e.currentTarget.style.background = 'transparent')}
                >
                  Active
                </button>
                <button
                  onClick={() => setFilter('inactive')}
                  style={{
                    padding: '6px 16px',
                    border: 'none',
                    borderRadius: '4px',
                    background: filter === 'inactive' ? '#9ca3af' : 'transparent',
                    color: filter === 'inactive' ? '#fff' : '#737373',
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => filter !== 'inactive' && (e.currentTarget.style.background = '#f5f5f5')}
                  onMouseLeave={(e) => filter !== 'inactive' && (e.currentTarget.style.background = 'transparent')}
                >
                  Inactive
                </button>
              </div>

              <div style={{ position: 'relative', minWidth: '300px' }}>
                <Search style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#a3a3a3',
                }} size={16} />
                <input
                  type="text"
                  placeholder="Search by company, person or trade..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 40px',
                    border: '1px solid #d4d4d4',
                    borderRadius: '4px',
                    fontSize: '14px',
                    color: '#171717',
                  }}
                />
              </div>
            </div>

            <button
              onClick={() => refetch()}
              disabled={isFetching}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                border: '1px solid #e5e5e5',
                borderRadius: '4px',
                background: '#fff',
                color: '#525252',
                cursor: isFetching ? 'not-allowed' : 'pointer',
                opacity: isFetching ? 0.6 : 1,
              }}
              onMouseEnter={(e) => !isFetching && (e.currentTarget.style.background = '#f5f5f5')}
              onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
            >
              <RefreshCcw size={18} style={isFetching ? { animation: 'spin 1s linear infinite' } : {}} />
            </button>
          </div>

          {/* Table Area */}
          <div style={{ padding: '8px' }}>
            <EnhancedDataTable
              data={filtered}
              columns={columns}
              enableSearch={false}
              enableSorting={true}
              enablePagination={true}
              defaultPageSize={10}
              emptyMessage="No sub-contractors found matching your search"
              loading={isLoading}
              onRowClick={(row) => { window.subToView = row; onNavigate('/subcontractors-v2/view?id=' + row.id) }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
