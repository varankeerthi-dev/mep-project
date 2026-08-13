import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 transition-all outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-zinc-500">
      {children}
    </label>
  )
}

function Select({
  label,
  options = [],
  className,
  ...props
}: {
  label?: string
  options?: Array<{ value: string; label: string }>
} & React.ComponentProps<"select">) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <FieldLabel>{label}</FieldLabel>}
      <select
        data-slot="select"
        className={cn(
          "h-10 w-full min-w-0 cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 transition-all outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextArea({
  label,
  className,
  ...props
}: {
  label?: string
} & React.ComponentProps<"textarea">) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <FieldLabel>{label}</FieldLabel>}
      <textarea
        data-slot="textarea"
        className={cn(
          "min-h-16 w-full resize-y rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 transition-all outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    </div>
  );
}

export { Input, Select, TextArea }
