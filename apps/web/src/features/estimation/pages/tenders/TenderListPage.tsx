import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PermissionGuard } from '../../../../rbac';
import { useTenders, useDeleteTender } from '../../hooks/useTenders';
import type { TenderFilterParams } from '../../api/tenders';
import { TENDER_STATUSES } from '../../constants';
import { Plus, Search, FileText, Trash2, Edit, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function TenderListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filters: TenderFilterParams = useMemo(() => ({
    organisation_id: '',
    search: search || undefined,
    status: statusFilter || undefined,
  }), [search, statusFilter]);

  const { data: tenders, isLoading } = useTenders(filters);
  const deleteTender = useDeleteTender();

  const marginIcon = (margin: number | null | undefined) => {
    if (margin == null) return null;
    if (margin >= 15) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (margin >= 5) return <Minus className="h-4 w-4 text-amber-500" />;
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
        <h1 className="text-xl font-semibold text-zinc-800">Tenders</h1>
        <PermissionGuard permission="estimation.tender.create">
          <Link
            to="/estimation/tenders/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            New Tender
          </Link>
        </PermissionGuard>
      </div>

      <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-100">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search tenders..."
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
          {TENDER_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-6 text-zinc-500">Loading...</div>
        ) : tenders?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-400">
            <FileText className="h-12 w-12 mb-3" />
            <p className="text-lg font-medium">No tenders yet</p>
            <p className="text-sm">Create your first tender to get started.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
                <th className="px-6 py-3">Tender No</th>
                <th className="px-6 py-3">Title</th>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Bid Amount</th>
                <th className="px-6 py-3">Est. Cost</th>
                <th className="px-6 py-3">Margin</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Submission Date</th>
                <th className="px-6 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {tenders?.map((tender) => (
                <tr
                  key={tender.id}
                  className="hover:bg-zinc-50 cursor-pointer"
                  onClick={() => navigate(`/estimation/tenders/detail?id=${tender.id}`)}
                >
                  <td className="px-6 py-4 text-sm font-medium text-zinc-800">{tender.tender_no}</td>
                  <td className="px-6 py-4 text-sm text-zinc-600">{tender.title || '-'}</td>
                  <td className="px-6 py-4 text-sm text-zinc-600">{(tender as any).client?.client_name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-zinc-700">
                    {tender.bid_amount ? `₹${Number(tender.bid_amount).toLocaleString()}` : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-600">
                    {tender.estimated_cost ? `₹${Number(tender.estimated_cost).toLocaleString()}` : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      {marginIcon(tender.expected_margin)}
                      <span className="text-sm">{tender.expected_margin != null ? `${tender.expected_margin}%` : '-'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      tender.status === 'Won' ? 'bg-green-100 text-green-700' :
                      tender.status === 'Lost' ? 'bg-red-100 text-red-700' :
                      tender.status === 'Submitted' ? 'bg-blue-100 text-blue-700' :
                      tender.status === 'Cancelled' ? 'bg-zinc-100 text-zinc-500' :
                      'bg-amber-100 text-amber-700'
                    }`}>{tender.status}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-500">
                    {tender.submission_date ? new Date(tender.submission_date).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <PermissionGuard permission="estimation.tender.update">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/estimation/tenders/edit?id=${tender.id}`); }}
                          className="p-1.5 hover:bg-zinc-100 rounded text-zinc-400 hover:text-zinc-600"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </PermissionGuard>
                      <PermissionGuard permission="estimation.tender.delete">
                        <button
                          onClick={(e) => { e.stopPropagation(); if (confirm('Delete this tender?')) deleteTender.mutate(tender.id!); }}
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
