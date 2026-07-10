// src/pages/ManagerAlerts.tsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { BellIcon, CheckIcon, ArrowRightIcon } from 'lucide-react';

type SuggestedOption = { label: string; action: string };

type ManagerAlert = {
  id: string;
  organisation_id: string;
  communication_id: string | null;
  logged_by: string | null;
  logged_by_name: string | null;
  party_type: string | null;
  party_name: string | null;
  summary: string;
  suggested_options: SuggestedOption[];
  status: 'new' | 'acknowledged' | 'actioned';
  selected_option: string | null;
  created_at: string;
};

const statusStyles: Record<ManagerAlert['status'], string> = {
  new: 'bg-amber-100 text-amber-800 ring-amber-200',
  acknowledged: 'bg-sky-100 text-sky-800 ring-sky-200',
  actioned: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
};

export default function ManagerAlerts() {
  const { organisation } = useAuth();
  const [alerts, setAlerts] = useState<ManagerAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const orgId = organisation?.id;

  const load = useCallback(async () => {
    if (!orgId) return;
    const { data, error } = await supabase
      .from('manager_alerts')
      .select('*')
      .eq('organisation_id', orgId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (!error && data) setAlerts(data as ManagerAlert[]);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Live updates: new alerts appear without refresh.
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel(`manager_alerts:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'manager_alerts',
          filter: `organisation_id=eq.${orgId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setAlerts((prev) => [payload.new as ManagerAlert, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setAlerts((prev) =>
              prev.map((a) => (a.id === (payload.new as ManagerAlert).id ? (payload.new as ManagerAlert) : a)),
            );
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId]);

  const setStatus = useCallback(
    async (id: string, status: ManagerAlert['status'], selectedOption?: string) => {
      const update: Record<string, unknown> = { status };
      if (selectedOption !== undefined) update.selected_option = selectedOption;
      const { data, error } = await supabase.from('manager_alerts').update(update).eq('id', id).select().single();
      if (!error && data) {
        setAlerts((prev) => prev.map((a) => (a.id === id ? (data as ManagerAlert) : a)));
      }
    },
    [],
  );

  const newCount = useMemo(() => alerts.filter((a) => a.status === 'new').length, [alerts]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-950">
            <BellIcon className="h-6 w-6 text-zinc-700" />
            Manager Alerts
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            AI briefings on new communication logs from your team.
          </p>
        </div>
        {newCount > 0 && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800 ring-1 ring-amber-200">
            {newCount} new
          </span>
        )}
      </header>

      {loading ? (
        <div className="animate-pulse space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-zinc-100" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500">
          No alerts yet. They will appear here automatically when a team member logs a communication.
        </div>
      ) : (
        <ul className="space-y-4">
          {alerts.map((a) => (
            <li
              key={a.id}
              className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span className="font-medium text-zinc-700">
                      {a.logged_by_name || 'Employee'}
                    </span>
                    {a.party_name && (
                      <span className="text-zinc-400">· {a.party_type}: {a.party_name}</span>
                    )}
                    <span className="text-zinc-300">·</span>
                    <span>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
                  </div>
                  <p className="mt-2 text-[15px] leading-6 text-zinc-900">{a.summary}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusStyles[a.status]}`}
                >
                  {a.status}
                </span>
              </div>

              {a.suggested_options?.length > 0 && (
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {a.suggested_options.map((opt, idx) => {
                    const chosen = a.selected_option === opt.label && a.status === 'actioned';
                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={a.status === 'actioned'}
                        onClick={() => setStatus(a.id, 'actioned', opt.label)}
                        className={`group flex flex-col rounded-xl border p-3 text-left text-sm transition ${
                          chosen
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300 hover:bg-white'
                        } disabled:cursor-default`}
                      >
                        <span className="flex items-center justify-between font-semibold text-zinc-800">
                          {opt.label}
                          {chosen ? (
                            <CheckIcon className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <ArrowRightIcon className="h-4 w-4 text-zinc-400 group-hover:text-zinc-600" />
                          )}
                        </span>
                        <span className="mt-1 text-xs leading-5 text-zinc-500">{opt.action}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {a.status === 'new' && (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setStatus(a.id, 'acknowledged')}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                  >
                    Acknowledge
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
