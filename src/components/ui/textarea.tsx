import type { TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export function Textarea({
  className,
  label,
  error,
  ...props
}: TextareaProps) {
  return (
    <div style={{ width: '100%' }}>
      {label && (
        <label className="block text-sm font-medium text-zinc-700 mb-1.5">{label}</label>
      )}
      <textarea
        className={cn(
          'w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500',
          error && 'border-red-400 focus:ring-red-500',
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
