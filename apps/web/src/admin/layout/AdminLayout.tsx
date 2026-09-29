const NAV: Array<{ to: string; label: string }> = [
  { to: '/admin', label: 'Overview' },
  { to: '/admin/organizations', label: 'Organizations' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/plans', label: 'Plans' },
  { to: '/admin/modules', label: 'Modules' },
  { to: '/admin/grants', label: 'Grants' },
  { to: '/admin/payments', label: 'Payments' },
  { to: '/admin/reminders', label: 'Reminders' },
  { to: '/admin/security', label: 'Security' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = typeof window !== 'undefined' ? window.location.pathname : '/admin';
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3">
          <a href="/admin" className="mr-4 text-sm font-semibold tracking-tight">
            SaaS Admin Console
          </a>
          {NAV.map((item) => {
            const active = path === item.to || (item.to !== '/admin' && path.startsWith(item.to));
            return (
              <a
                key={item.to}
                href={item.to}
                className={
                  active
                    ? 'rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground'
                    : 'rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground'
                }
              >
                {item.label}
              </a>
            );
          })}
          <a href="/dashboard" className="ml-auto text-xs text-muted-foreground underline">
            Back to app
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
