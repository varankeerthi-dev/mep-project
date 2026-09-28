import type { CatalogModule } from '../../rbac/api';

export function RolePermissionMatrix({
  modules,
  grantSet,
  onToggle,
  disabled,
}: {
  modules: CatalogModule[];
  grantSet: Set<string>;
  onToggle: (moduleKey: string, actionKey: string) => void;
  disabled?: boolean;
}) {
  const v1Order = ['read', 'create', 'update', 'delete', 'print', 'export'];
  const v1Labels: Record<string, string> = {
    read: 'Read',
    create: 'Create',
    update: 'Edit',
    delete: 'Delete',
    print: 'Print',
    export: 'Export',
  };

  let lastGroup = '';

  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200">
      <table className="min-w-full border-collapse bg-white text-xs">
        <thead>
          <tr className="bg-zinc-50/80">
            <th className="px-3 py-2 text-left font-bold uppercase tracking-wider text-zinc-500">
              Module
            </th>
            {v1Order.map((a) => (
              <th
                key={a}
                className="w-16 px-2 py-2 text-center font-bold uppercase tracking-wider text-zinc-500"
              >
                {v1Labels[a]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {modules.map((m) => {
            const groupHeader =
              m.grp !== lastGroup ? (
                <tr key={`grp-${m.grp}`} className="bg-zinc-100/60">
                  <td
                    colSpan={v1Order.length + 1}
                    className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500"
                  >
                    {m.grp}
                  </td>
                </tr>
              ) : null;
            lastGroup = m.grp;
            const byAction = new Map(m.actions.map((a) => [a.key, a]));
            return [
              groupHeader,
              <tr key={m.key} className="hover:bg-zinc-50/60">
                <td className="px-3 py-2 font-medium text-zinc-800">{m.label}</td>
                {v1Order.map((a) => {
                  const def = byAction.get(a);
                  const applicable = def?.applicable ?? false;
                  const grantKey = `${m.key}.${a}`;
                  if (!applicable) {
                    return (
                      <td key={a} className="px-2 py-2 text-center text-zinc-300">
                        —
                      </td>
                    );
                  }
                  return (
                    <td key={a} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={grantSet.has(grantKey)}
                        disabled={disabled}
                        onChange={() => onToggle(m.key, a)}
                        className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={`${m.label} ${v1Labels[a]}`}
                      />
                    </td>
                  );
                })}
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

export function SensitiveFieldsSection({
  fields,
  grantedMap,
  onToggle,
  disabled,
}: {
  fields: Array<{ key: string; module_key: string; label: string }>;
  grantedMap: Record<string, boolean>;
  onToggle: (fieldKey: string) => void;
  disabled?: boolean;
}) {
  if (fields.length === 0) return null;
  return (
    <div className="mt-4 rounded-md border border-zinc-200">
      <div className="border-b border-zinc-200 bg-zinc-50/50 px-3 py-2">
        <div className="text-xs font-bold text-zinc-900">Sensitive fields</div>
        <div className="text-[11px] text-zinc-500">
          Separately granted — module Read alone never exposes these.
        </div>
      </div>
      <div className="divide-y divide-zinc-100">
        {fields.map((f) => (
          <label
            key={f.key}
            className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-zinc-50/60"
          >
            <input
              type="checkbox"
              checked={Boolean(grantedMap[f.key])}
              disabled={disabled}
              onChange={() => onToggle(f.key)}
              className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <span className="text-xs font-medium text-zinc-800">{f.label}</span>
            <span className="ml-auto font-mono text-[10px] text-zinc-400">{f.key}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
