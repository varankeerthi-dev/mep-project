import { useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Building2, Loader2, LogOut, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import { useCreateAccessRequest, useMyAccessRequests, usePublicOrganisations } from '@/rbac';
import { signOut } from '@/supabase';

type Props = {
  user: User;
  onCreateOrganisation: (name: string) => Promise<void>;
  onRefreshMemberships: () => Promise<void>;
};

const cardCn =
  'rounded-2xl border border-slate-200 bg-white shadow-sm';
const labelCn =
  'text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400';
const inputCn =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200';

function statusBadge(status: string) {
  const s = (status || '').toLowerCase();
  if (s === 'approved') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (s === 'rejected') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

export default function RequestAccessPage({ user, onCreateOrganisation, onRefreshMemberships }: Props) {
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [createOrgMode, setCreateOrgMode] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await signOut();
    window.location.href = '/login';
  };

  const publicOrgs = usePublicOrganisations();
  const myRequests = useMyAccessRequests(user.id);
  const createReq = useCreateAccessRequest();

  const latest = useMemo(() => (myRequests.data ?? [])[0] ?? null, [myRequests.data]);

  const submitRequest = async () => {
    if (!selectedOrgId) return;
    if (!user.email) throw new Error('Your user is missing an email address.');

    await createReq.mutateAsync({
      organisation_id: selectedOrgId,
      user_id: user.id,
      email: user.email,
      status: 'pending',
    });
    await myRequests.refetch();
  };

  const [isCreatingOrg, setIsCreatingOrg] = useState(false);

  const submitCreateOrg = async () => {
    if (!orgName.trim() || isCreatingOrg) return;
    setIsCreatingOrg(true);
    try {
      await onCreateOrganisation(orgName.trim());
    } finally {
      setIsCreatingOrg(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-[980px] flex-col gap-5 px-6 py-8">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">
              <ShieldCheck size={14} />
              Access Control
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-60"
            >
              <LogOut size={14} />
              {loggingOut ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Request access</h1>
          <p className="text-[13px] leading-6 text-slate-500">
            You're signed in as <span className="font-medium text-slate-900">{user.email}</span>. Select an organisation and request approval from its admins.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className={cardCn}>
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="text-[13px] font-semibold text-slate-950">Request access</div>
              <div className="mt-1 text-[12px] text-slate-500">Your email must exist as an active employee in the organisation.</div>
            </div>
            <div className="px-5 py-5 space-y-4">
              <label className="space-y-2">
                <div className={labelCn}>Organisation</div>
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className={inputCn}
                  disabled={publicOrgs.isLoading || createReq.isPending}
                >
                  <option value="">Select organisation</option>
                  {(publicOrgs.data ?? []).map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </label>

              {publicOrgs.isError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                  {String((publicOrgs.error as Error | null)?.message ?? 'Unable to load organisations.')}
                </div>
              )}

              {createReq.isError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                  {String((createReq.error as Error | null)?.message ?? 'Unable to submit request.')}
                </div>
              )}

              <button
                type="button"
                onClick={() => void submitRequest()}
                disabled={!selectedOrgId || createReq.isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createReq.isPending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                Submit request
              </button>

              <button
                type="button"
                onClick={() => void onRefreshMemberships()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCw size={16} />
                Refresh access
              </button>
            </div>
          </section>

          <section className={cardCn}>
            <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
              <div>
                <div className="text-[13px] font-semibold text-slate-950">Requests</div>
                <div className="mt-1 text-[12px] text-slate-500">Track approvals and rejections.</div>
              </div>
              <button
                type="button"
                onClick={() => void myRequests.refetch()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>

            <div className="px-5 py-5 space-y-3">
              {myRequests.isLoading && (
                <div className="text-[12px] text-slate-500">Loading requests...</div>
              )}

              {!myRequests.isLoading && (myRequests.data ?? []).length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-[12px] text-slate-500">
                  No requests yet.
                </div>
              )}

              {(myRequests.data ?? []).slice(0, 6).map((req) => (
                <div key={req.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-slate-900 truncate">
                      {req.organisation?.name ?? 'Organisation'}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500 truncate">{req.email}</div>
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusBadge(req.status)}`}>
                    {req.status}
                  </span>
                </div>
              ))}

              {latest?.status === 'approved' && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-800">
                  Access approved. Click "Refresh access" to continue.
                </div>
              )}
            </div>
          </section>
        </div>

        <section className={cardCn}>
          <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
            <div>
              <div className="text-[13px] font-semibold text-slate-950">Create a new organisation</div>
              <div className="mt-1 text-[12px] text-slate-500">
                If you're setting up a new workspace, create an organisation and you'll be the first admin.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCreateOrgMode((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Building2 size={14} />
              {createOrgMode ? 'Cancel' : 'Create org'}
            </button>
          </div>

          {createOrgMode && (
            <div className="px-5 py-5 grid gap-3 sm:grid-cols-[1fr_180px] items-end">
              <label className="space-y-2">
                <div className={labelCn}>Organisation name</div>
                <input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className={inputCn}
                  placeholder="Your company name"
                />
              </label>
              <button
                type="button"
                onClick={() => void submitCreateOrg()}
                disabled={!orgName.trim() || isCreatingOrg}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreatingOrg ? <Loader2 className="animate-spin" size={16} /> : <Building2 size={16} />}
                {isCreatingOrg ? 'Creating...' : 'Create'}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
