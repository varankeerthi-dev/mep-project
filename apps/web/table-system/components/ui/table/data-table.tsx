import { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function DataTable({ toolbar, header, table, pagination, className }: any) {
  return (
    <div className={cn("w-full bg-white border border-gray-200 rounded-md flex flex-col", className)}>
      {header && <div className="px-4 py-3 border-b">{header}</div>}
      {toolbar && <div className="px-4 py-2 border-b">{toolbar}</div>}
      <div className="flex-1 overflow-auto">{table}</div>
      {pagination && <div className="px-4 py-2 border-t">{pagination}</div>}
    </div>
  )
}
