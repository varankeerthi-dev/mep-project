import { ReactNode } from "react"
import { cn } from "../../../lib/utils"

export function DataTableToolbar({ children, className }: any) {
  return <div className={cn("flex items-center justify-between gap-3", className)}>{children}</div>
}
