import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../App';
import { PermissionGuard } from '../../../../rbac';
import { useBOQs, useDeleteBOQ } from '../../hooks/useBOQ';
import type { BOQFilterParams } from '../../api/boq';
import { BOQ_STATUSES } from '../../constants';
import { MoreHorizontal, Plus, Search, FileText, Trash2, Edit } from 'lucide-react';

export default function BOQListPage() {
  const { organisation } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filters: BOQFilterParams = useMemo(() => ({
    organisation_id: organisation?.id || '',
    search: search || undefined,
    status: statusFilter || undefined,
  }), [organisation?.id, search, statusFilter]);

  const { data: boqs, isLoading } = useBOQs(filters);
  const deleteBOQ = useDeleteBOQ();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
        <h1 className="text-xl font-semibold text-zinc-800">Bill of Quantities (BOQ)</h1>
        <PermissionGuard permission="estimation.boq.create">
          <Link
            to="/estimation/boq/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            New BOQ
          </Link>
        </PermissionGuard>
      </div>

      <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-100">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search BOQ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          {BOQ_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-6 text-zinc-500">Loading...</div>
        ) : boqs?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-400">
            <FileText className="h-12 w-12 mb-3" />
            <p className="text-lg font-medium">No BOQs yet</p>
            <p className="text-sm">Create your first BOQ to get started.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                <th className="px-6 py-3">BOQ No</th>
                <th className="px-6 py-3">Title</th>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Project</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {boqs?.map((boq) => (
                <tr
                  key={boq.id}
                  className="hover:bg-zinc-50 cursor-pointer"
                  onClick={() => navigate(`/estimation/boq/detail?id=${boq.id}`)}
                >
                  <td className="px-6 py-4 text-sm font-medium text-zinc-800">{boq.boq_no}</td>
                  <td className="px-6 py-4 text-sm text-zinc-600">{boq.title || '-'}</td>
                  <td className="px-6 py-4 text-sm text-zinc-600">{(boq as any).client?.client_name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-zinc-600">{(boq as any).project?.project_name || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      boq.status === 'Approved' ? 'bg-green-100 text-green-700' :
                      boq.status === 'Final' ? 'bg-blue-100 text-blue-700' :
                      boq.status === 'Converted' ? 'bg-purple-100 text-purple-700' :
                      'bg-zinc-100 text-zinc-600'
                    }`}>
                      {boq.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-500">{boq.date ? new Date(boq.date).toLocaleDateString() : '-'}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <PermissionGuard permission="estimation.boq.update">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/estimation/boq/edit?id=${boq.id}`); }}
                          className="p-1.5 hover:bg-zinc-100 rounded text-zinc-400 hover:text-zinc-600"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </PermissionGuard>
                      <PermissionGuard permission="estimation.boq.delete">
                        <button
                          onClick={(e) => { e.stopPropagation(); if (confirm('Delete this BOQ?')) deleteBOQ.mutate(boq.id!); }}
                          className="p-1.5 hover:bg-red-50 rounded text-zinc-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </PermissionGuard>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
