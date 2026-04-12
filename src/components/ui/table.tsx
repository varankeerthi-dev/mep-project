import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full text-sm', className)} {...props} />
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('text-left', className)} {...props} />
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('', className)} {...props} />
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-b border-slate-100', className)} {...props} />
}

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide', className)} {...props} />
}

export function TableCell({ className, colSpan, style, ...props }: HTMLAttributes<HTMLTableCellElement> & { colSpan?: number }) {
  return <td className={cn('px-3 py-2', className)} colSpan={colSpan} style={style} {...props} />
}

// Dense variant for compact rows
export function TableRowDense({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-b border-slate-100 hover:bg-slate-50 cursor-pointer', className)} {...props} />
}

export function TableCellDense({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-3 py-1.5 text-sm', className)} {...props} />
}
