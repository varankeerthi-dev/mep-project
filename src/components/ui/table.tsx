import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

const baseStyles = {
  table: 'w-full border-collapse',
  thead: 'text-left',
  th: 'px-4 py-3 text-left text-xs font-medium text-zinc-500',
  td: 'px-4 py-3',
  tr: 'border-b border-zinc-100',
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn(baseStyles.table, className)} {...props} />
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn(baseStyles.thead, 'bg-zinc-50/50', className)} {...props} />
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn(baseStyles.tr, 'hover:bg-zinc-50/50', className)} {...props} />
}

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn(baseStyles.th, className)} {...props} />
}

export function TableCell({ className, colSpan, style, ...props }: HTMLAttributes<HTMLTableCellElement> & { colSpan?: number }) {
  return <td className={cn(baseStyles.td, className)} colSpan={colSpan} style={style} {...props} />
}

export function TableRowDense({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn(baseStyles.tr, 'hover:bg-zinc-50/50 cursor-pointer', className)} {...props} />
}

export function TableCellDense({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-2 text-sm', className)} {...props} />
}