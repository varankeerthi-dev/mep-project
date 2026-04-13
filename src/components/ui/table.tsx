import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full text-sm border-collapse', className)} {...props} />
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('text-left bg-gray-50/50', className)} {...props} />
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('', className)} {...props} />
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-b border-gray-100 hover:bg-gray-50/50 transition-colors', className)} {...props} />
}

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('px-4 py-3 text-left text-xs font-medium text-gray-500', className)} {...props} />
}

export function TableCell({ className, colSpan, style, ...props }: HTMLAttributes<HTMLTableCellElement> & { colSpan?: number }) {
  return <td className={cn('px-4 py-3', className)} colSpan={colSpan} style={style} {...props} />
}

// Dense variant for compact rows
export function TableRowDense({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-b border-gray-100 hover:bg-gray-50/50 transition-colors cursor-pointer', className)} {...props} />
}

export function TableCellDense({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3 text-sm', className)} {...props} />
}
