export function DataTableHeader({ title, subtitle, actions }: any) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}
