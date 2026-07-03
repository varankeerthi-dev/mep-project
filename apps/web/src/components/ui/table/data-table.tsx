import { ReactNode } from "react"
import { cn } from "../../../lib/utils"

export function DataTable({ toolbar, header, table, pagination, className }: any) {
  return (
    <div className={cn("w-full bg-white border border-zinc-200 rounded-8px flex flex-col shadow-sm", className)}>
      {header && <div className="px-5 py-4 border-b border-zinc-100">{header}</div>}
      {toolbar && <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50/30">{toolbar}</div>}
      <div className="flex-1 overflow-auto">{table}</div>
      {pagination && <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50/30">{pagination}</div>}
    </div>
  )
}
