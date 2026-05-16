import { ReactNode } from "react"
import { cn } from "../../../lib/utils"

export function DataTableHeader({ title, subtitle, actions, className }: any) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
        {subtitle && <p className="text-sm text-zinc-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}
