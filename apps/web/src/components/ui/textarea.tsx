import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-16 w-full resize-y rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 transition-all outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
