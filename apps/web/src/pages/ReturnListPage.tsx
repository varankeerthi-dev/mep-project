// apps/web/src/pages/ReturnListPage.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from '../lib/logger';
import { 
  ArrowPathIcon, 
  PlusIcon, 
  MagnifyingGlassIcon, 
  DocumentArrowDownIcon,
  EyeIcon,
  PencilIcon
} from '@heroicons/react/24/outline';

type ReturnDocument = {
  id: string;
  return_number: string;
  return_date: string;
  status: 'draft' | 'completed' | 'cancelled';
  remarks: string;
  customer_dc_number?: string;
  vehicle_number?: string;
  project: {
    id: string;
    project_name: string;
  };
  warehouse?: {
    id: string;
    name: string;
  };
  employee?: {
    id: string;
    name: string;
  };
  next_action_type?: string;
  next_action_status?: string;
};

export default function ReturnListPage() {
  const { organisation } = useAuth();
  const [returns, setReturns] = useState<ReturnDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [projects, setProjects] = useState<any[]>([]);

  const formatWarehouseName = (wh: any) => {
    if (!wh) return '-';
    if (typeof wh === 'string') return wh;
    if (Array.isArray(wh)) {
      const first = wh[0];
      return typeof first === 'object' ? first?.warehouse_name || '-' : String(first || '-');
    }
    if (typeof wh === 'object') {
      return wh.warehouse_name || '-';
    }
    return '-';
  };

  const fetchReturns = async () => {
    if (!organisation?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('returns')
        .select(`
          id,
          return_number,
          return_date,
          status,
          remarks,
          customer_dc_number,
          vehicle_number,
          next_action_type,
          next_action_status,
          project:projects(id, project_name),
          warehouse:warehouses(id, warehouse_name),
          employee:employees(id, name)
        `)
        .eq('organisation_id', organisation.id)
        .order('return_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReturns((data || []) as any);
    } catch (err: any) {
      console.error('Error fetching returns:', err);
      toast.error('Failed to load material returns');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    if (!organisation?.id) return;
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name')
        .eq('organisation_id', organisation.id)
        .order('project_name');
      if (error) throw error;
      setProjects(data || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  useEffect(() => {
    fetchReturns();
    fetchProjects();
  }, [organisation?.id]);

  const filteredReturns = returns.filter(item => {
    const matchesSearch = 
      item.return_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.remarks && item.remarks.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.customer_dc_number && item.customer_dc_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.vehicle_number && item.vehicle_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      item.project?.project_name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesProject = projectFilter === '' || item.project?.id === projectFilter;

    return matchesSearch && matchesProject;
  });

  const getStatusBadge = (status: ReturnDocument['status']) => {
    const styles = {
      draft: 'bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800/40 dark:text-zinc-400 dark:border-zinc-700/60',
      completed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
      cancelled: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20'
    };

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${styles[status]}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const getNextActionBadge = (type?: string, status?: string) => {
    if (!type) return <span className="text-zinc-400 dark:text-zinc-500">-</span>;
    const styles = status === 'completed'
      ? 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800/40 dark:text-zinc-400'
      : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20';
    
    return (
      <div className="flex flex-col gap-0.5">
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${styles} w-fit`}>
          {type.replace('_', ' ').toUpperCase()}
        </span>
        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
          Status: {status || 'pending'}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800/80 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Material Returns</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage and track material returns from project sites back to warehouses.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={fetchReturns}
            className="p-2 border border-zinc-250 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-lg transition"
            title="Refresh returns"
          >
            <ArrowPathIcon className="h-5 w-5" />
          </button>
          
          <a
            href="/returns/create"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-550 dark:hover:bg-indigo-600 text-white rounded-lg font-medium shadow-sm transition"
          >
            <PlusIcon className="h-5 w-5" />
            <span>New Material Return</span>
          </a>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-250 dark:border-zinc-800/60 px-6 py-3 flex flex-col md:flex-row items-center gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
            <MagnifyingGlassIcon className="h-5 w-5" />
          </span>
          <input
            type="text"
            placeholder="Search return #, DC, vehicle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-zinc-250 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent transition"
          />
        </div>

        {/* Project Filter */}
        <div className="w-full md:w-60">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-250 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          >
            <option value="">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.project_name}</option>
            ))}
          </select>
        </div>
        
        <div className="text-sm text-zinc-500 dark:text-zinc-400 ml-auto">
          Showing {filteredReturns.length} of {returns.length} records
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">Loading returns...</span>
            </div>
          ) : filteredReturns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <DocumentArrowDownIcon className="h-12 w-12 text-zinc-300 dark:text-zinc-650 mb-3" />
              <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">No returns found</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mt-1">
                Create a new return document to log surplus or leftover materials returned from site locations.
              </p>
              <a
                href="/returns/create"
                className="mt-4 px-4 py-2 border border-indigo-600 text-indigo-600 dark:border-indigo-500 dark:text-indigo-400 rounded-lg text-sm font-medium hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition"
              >
                Create Material Return
              </a>
            </div>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <th className="px-6 py-3">Return #</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Project</th>
                  <th className="px-6 py-3">Default Warehouse</th>
                  <th className="px-6 py-3">Logistics</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Next Action</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/80 text-sm text-zinc-700 dark:text-zinc-300">
                {filteredReturns.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                      {item.return_number}
                    </td>
                    <td className="px-6 py-4">
                      {new Date(item.return_date).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4">
                      {item.project?.project_name}
                    </td>
                    <td className="px-6 py-4">
                      {formatWarehouseName(item.warehouse)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5 text-xs">
                        {item.customer_dc_number && (
                          <span className="text-zinc-800 dark:text-zinc-200">
                            DC: <strong className="font-semibold">{item.customer_dc_number}</strong>
                          </span>
                        )}
                        {item.vehicle_number && (
                          <span className="text-zinc-500 dark:text-zinc-450">
                            Veh: {item.vehicle_number}
                          </span>
                        )}
                        {item.employee && (
                          <span className="text-zinc-400 dark:text-zinc-500 text-[10px]">
                            By: {item.employee.name}
                          </span>
                        )}
                        {!item.customer_dc_number && !item.vehicle_number && !item.employee && (
                          <span className="text-zinc-400 dark:text-zinc-500">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(item.status)}
                    </td>
                    <td className="px-6 py-4">
                      {getNextActionBadge(item.next_action_type, item.next_action_status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {item.status === 'draft' ? (
                          <a
                            href={`/returns/edit?id=${item.id}`}
                            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition"
                            title="Edit Draft"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </a>
                        ) : null}
                        
                        <a
                          href={`/returns/view?id=${item.id}`}
                          className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition"
                          title="View Details"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
