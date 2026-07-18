import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../App';
import { PermissionGuard } from '../../../../rbac';
import { usePartners, useDeletePartner } from '../../hooks/usePartners';
import type { PartnerFilterParams } from '../../api/partners';
import { partnerTypeEnum } from '../../model';
import { Plus, Search, Trash2, Edit, Building2 } from 'lucide-react';

export default function PartnerListPage() {
  const { organisation } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const filters: PartnerFilterParams = useMemo(() => ({
    organisation_id: organisation?.id || '',
    search: search || undefined,
    partner_type: typeFilter || undefined,
  }), [organisation?.id, search, typeFilter]);

  const { data: partners, isLoading } = usePartners(filters);
  const deletePartner = useDeletePartner();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
        <h1 className="text-xl font-semibold text-zinc-800">Partners</h1>
        <PermissionGuard permission="partners.create">
          <Link
            to="/partner-allocation/partners/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            New Partner
          </Link>
        </PermissionGuard>
      </div>

      <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-100">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text" placeholder="Search partners..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <option value="">All Types</option>
          {partnerTypeEnum.options.map(t => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-sm text-zinc-500">Loading...</div>
        ) : partners?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-sm text-zinc-400">
            <Building2 className="h-8 w-8 mb-2" />
            No partners found
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">
                <th className="px-6 py-3">Business Name</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Contact</th>
                <th className="px-6 py-3">Phone</th>
                <th className="px-6 py-3">Categories</th>
                <th className="px-6 py-3">Active Jobs</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {partners?.map((partner: any) => (
                <tr key={partner.id} className="border-b border-zinc-50 hover:bg-zinc-50 text-sm">
                  <td className="px-6 py-3 font-medium text-zinc-800">{partner.business_name}</td>
                  <td className="px-6 py-3 text-zinc-600">{partner.partner_type}</td>
                  <td className="px-6 py-3 text-zinc-600">{partner.contact_person || '-'}</td>
                  <td className="px-6 py-3 text-zinc-600">{partner.phone || '-'}</td>
                  <td className="px-6 py-3 text-zinc-600">{(partner.categories || []).slice(0, 2).join(', ') || '-'}</td>
                  <td className="px-6 py-3 text-zinc-600">{partner.max_active_jobs || 'Unlimited'}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${partner.is_active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                      {partner.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1">
                      <PermissionGuard permission="partners.update">
                        <button onClick={() => navigate(`/partner-allocation/partners/edit?id=${partner.id}`)}
                          className="p-1 hover:bg-zinc-100 rounded text-zinc-400 hover:text-blue-600" title="Edit" type="button">
                          <Edit className="h-4 w-4" />
                        </button>
                      </PermissionGuard>
                      <PermissionGuard permission="partners.delete">
                        <button onClick={async () => { if (confirm('Delete this partner?')) await deletePartner.mutateAsync(partner.id); }}
                          className="p-1 hover:bg-zinc-100 rounded text-zinc-400 hover:text-red-600" title="Delete" type="button">
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
