import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'secondary' | 'outline'
}

const variants: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-indigo-600 text-white',
  secondary: 'bg-slate-100 text-slate-700',
  outline: 'border border-slate-300 text-slate-700 bg-white',
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        variants[variant],
        className
      )}
      {...props}
    />
  )
}
