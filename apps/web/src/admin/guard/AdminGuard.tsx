import { useAuth } from '@/contexts/AuthContext';

function getAllowlist(): string[] {
  const raw = (import.meta as any)?.env?.VITE_PLATFORM_ADMINS as string | undefined;
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const allowlist = getAllowlist();
  const email = (user?.email || '').toLowerCase();

  if (!email) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Not signed in. Please <a className="underline" href="/login">sign in</a> to access the admin console.
      </div>
    );
  }

  if (allowlist.length === 0 || !allowlist.includes(email)) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <h1 className="text-lg font-semibold">Admin access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Signed in as <span className="font-mono">{user?.email || 'unknown'}</span>, which is not on the
          platform-admin allowlist.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Set <code className="font-mono">VITE_PLATFORM_ADMINS</code> (comma-separated emails) in the
          deployment env to grant access. No org-level <code className="font-mono">admin</code> role
          grants platform access by design.
        </p>
        <a className="mt-6 inline-block text-sm underline" href="/dashboard">Back to dashboard</a>
      </div>
    );
  }

  return <>{children}</>;
}
