import { useMemo } from 'react';
import { useAdminPlans, useTogglePlanModule } from '../lib/adminQueries';
import { formatMoney } from '../lib/format';
import KpiCard from '../components/KpiCard';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';

const TIER_STYLES: Record<string, string> = {
  free: 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  starter: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  growth: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  premium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  enterprise: 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900',
};

export default function Plans() {
  const { data, isLoading, isError } = useAdminPlans();
  const toggle = useTogglePlanModule();

  const plans = useMemo(() => data?.plans || [], [data]);
  const modules = useMemo(() => (data?.modules || []).filter((m) => Number(m.price_monthly) > 0), [data]);

  const kpis = useMemo(() => {
    const mrr = plans.reduce((s, p) => s + Number(p.price_monthly || 0) * Number(p.orgs || 0), 0);
    const orgs = plans.reduce((s, p) => s + Number(p.orgs || 0), 0);
    return [
      { label: 'Plans', value: String(plans.length), sub: 'tiers' },
      { label: 'Total MRR', value: formatMoney(mrr), sub: 'subscribed orgs' },
      { label: 'Subscribed orgs', value: String(orgs), sub: 'across plans' },
      { label: 'Paid modules', value: String(modules.length), sub: 'in matrix' },
    ];
  }, [plans, modules.length]);

  if (isLoading) return <div className="p-2 text-sm text-muted-foreground">Loading plans…</div>;
  if (isError) return <div className="p-2 text-sm text-red-600">Failed to load plans.</div>;

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Plans</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Bundle modules into plans. Toggling a switch opens the module to every org on that plan.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} label={k.label} value={k.value} sub={k.sub} />
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((p) => (
          <div key={p.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold">{p.name}</div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIER_STYLES[p.tier] || TIER_STYLES.free}`}>
                {p.tier}
              </span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {formatMoney(p.price_monthly)}/mo per org · {p.max_users == null ? 'unlimited seats' : `${p.max_users} seats`}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {p.orgs || 0} orgs · {formatMoney(Number(p.price_monthly || 0) * Number(p.orgs || 0))} MRR
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {p.includes_module_ids.map((id) => (
                <span key={id} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                  #{id}
                </span>
              ))}
              {p.includes_module_ids.length === 0 ? (
                <span className="text-xs text-muted-foreground">no bundled modules</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border bg-card shadow-sm">
        <div className="border-b px-4 py-3">
          <div className="font-medium">Module access matrix</div>
          <div className="text-xs text-muted-foreground">Rows = paid modules · columns = plans</div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Module</TableHead>
              {plans.map((p) => (
                <TableHead key={p.id} className="text-center">{p.name}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {modules.map((mod) => (
              <TableRow key={mod.id}>
                <TableCell>
                  <div className="font-medium">{mod.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {mod.tier} · {formatMoney(Number(mod.price_monthly))}/mo
                  </div>
                </TableCell>
                {plans.map((p) => {
                  const included = p.includes_module_ids.includes(Number(mod.id));
                  return (
                    <TableCell key={p.id} className="text-center">
                      <Switch
                        checked={included}
                        disabled={toggle.isPending}
                        onCheckedChange={(v) =>
                          toggle.mutate({ planId: Number(p.id), moduleId: Number(mod.id), included: Boolean(v) })
                        }
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {toggle.isError ? (
          <div className="border-t px-4 py-2 text-xs text-red-600">
            Toggle failed — likely RLS (writes need service-role or an admin write policy). Reads work; writes pending.
          </div>
        ) : null}
      </div>
    </div>
  );
}
