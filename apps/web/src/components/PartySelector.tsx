import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, UserPlus, X } from 'lucide-react';
import { supabase } from '../supabase';

type PartyRole = 'customer' | 'vendor' | 'subcontractor';

export interface PartyOption {
  id: string;
  name: string;
  role: PartyRole;
  roles: PartyRole[];
  gstin: string | null;
  state: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

interface PartySelectorProps {
  organisationId?: string | null;
  value?: string | null;
  role?: PartyRole;
  allowedRoles?: PartyRole[];
  onChange: (party: PartyOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  compact?: boolean;
  className?: string;
  allowClear?: boolean;
}

const ROLE_LABELS: Record<PartyRole, string> = {
  customer: 'Customer',
  vendor: 'Vendor',
  subcontractor: 'Subcontractor',
};

export function PartySelector({
  organisationId,
  value,
  role,
  allowedRoles = role ? [role] : ['customer'],
  onChange,
  placeholder = 'Search party...',
  disabled = false,
  required = false,
  compact = false,
  className = '',
  allowClear = true,
}: PartySelectorProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<PartyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PartyOption | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const rolesKey = useMemo(() => allowedRoles.join(','), [allowedRoles]);

  useEffect(() => {
    let cancelled = false;
    async function loadSelected() {
      if (!organisationId || !value) {
        setSelected(null);
        return;
      }
      const { data, error } = await supabase
        .from('v_party_search')
        .select('party_id, party_name, gstin, state, email, contact, roles')
        .eq('organisation_id', organisationId)
        .eq('party_id', value)
        .maybeSingle();
      if (cancelled || error || !data) return;
      const roles = (data.roles ?? []) as PartyRole[];
      const selectedRole = role ?? roles.find((r) => allowedRoles.includes(r));
      if (!selectedRole) return;
      setSelected({
        id: String(data.party_id),
        name: String(data.party_name),
        role: selectedRole,
        roles,
        gstin: data.gstin ?? null,
        state: data.state ?? null,
        email: data.email ?? null,
        phone: data.contact ?? null,
        address: null,
      });
    }
    void loadSelected();
    return () => { cancelled = true; };
  }, [organisationId, value, role, rolesKey]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!open || !organisationId) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      let request = supabase
        .from('v_party_search')
        .select('party_id, party_name, gstin, state, email, contact, roles')
        .eq('organisation_id', organisationId)
        .limit(50);

      if (query.trim()) {
        request = request.or(`party_name.ilike.%${query.trim()}%,gstin.ilike.%${query.trim()}%`);
      }

      const { data, error } = await request;
      if (cancelled) return;
      setLoading(false);
      if (error) {
        setOptions([]);
        return;
      }

      const mapped = (data ?? []).flatMap((row: any) => {
        const roles = (row.roles ?? []) as PartyRole[];
        return roles
          .filter((r) => allowedRoles.includes(r))
          .map((r) => ({
            id: String(row.party_id),
            name: String(row.party_name),
            role: r,
            roles,
            gstin: row.gstin ?? null,
            state: row.state ?? null,
            email: row.email ?? null,
            phone: row.contact ?? null,
            address: null,
          } satisfies PartyOption));
      });
      setOptions(mapped);
    }, 150);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query, organisationId, rolesKey]);

  const select = (party: PartyOption) => {
    setSelected(party);
    setQuery('');
    setOpen(false);
    onChange(party);
  };

  const clear = () => {
    setSelected(null);
    setQuery('');
    onChange(null);
  };

  const height = compact ? 32 : 36;

  return (
    <div ref={rootRef} className={`relative w-full ${className}`}>
      <div
        className="flex items-center gap-2 rounded-md border border-input bg-background px-2"
        style={{ minHeight: height }}
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={open ? query : (selected?.name ?? '')}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          disabled={disabled}
          required={required && !selected}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        {selected && allowClear && !disabled && (
          <button type="button" onClick={clear} className="shrink-0 text-muted-foreground hover:text-foreground" aria-label="Clear party">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {selected && !open && (
        <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
          <span className="rounded bg-muted px-1.5 py-0.5">{ROLE_LABELS[selected.role]}</span>
          {selected.gstin && <span>{selected.gstin}</span>}
        </div>
      )}

      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full z-[200] mt-1 max-h-72 overflow-auto rounded-md border bg-popover p-1 shadow-lg">
          {loading && <div className="px-3 py-2 text-sm text-muted-foreground">Searching...</div>}
          {!loading && options.length === 0 && (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              {query ? 'No matching party found.' : 'No parties available.'}
            </div>
          )}
          {!loading && options.map((party) => (
            <button
              type="button"
              key={`${party.id}:${party.role}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(party)}
              className="flex w-full items-start gap-3 rounded px-3 py-2 text-left hover:bg-accent"
            >
              <div className="mt-0.5 rounded-full bg-muted p-1.5">
                <UserPlus className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{party.name}</span>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px]">{ROLE_LABELS[party.role]}</span>
                </div>
                <div className="mt-0.5 flex gap-2 text-[11px] text-muted-foreground">
                  {party.gstin && <span>{party.gstin}</span>}
                  {party.state && <span>{party.state}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default PartySelector;
