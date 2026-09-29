const KPIS = [
  'Tenants',
  'Active orgs',
  'Users',
  'MRR',
  'Avg time/user',
  'Active overrides',
  'Plans ending (30d)',
  'Paid modules',
];

export default function Overview() {
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Platform health. Live values arrive after the Supabase migration (Admin/schema.sql).
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {KPIS.map((label) => (
          <div key={label} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">—</div>
            <div className="mt-1 text-xs text-muted-foreground">pending data</div>
          </div>
        ))}
      </div>
    </div>
  );
}
