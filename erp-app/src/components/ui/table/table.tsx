import type { HTMLAttributes } from 'react'
import { cn } from '../../../lib/utils'

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full text-sm border-collapse', className)} {...props} />
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('[&_tr]:border-b', className)} {...props} />
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
}

export function TableFooter({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tfoot className={cn('bg-zinc-50 font-medium text-zinc-500', className)} {...props} />
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-b border-zinc-100 transition-colors hover:bg-zinc-50 data-[state=selected]:bg-zinc-50', className)} {...props} />
}

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('h-12 px-4 text-left align-middle font-semibold text-zinc-700 text-xs uppercase tracking-wider [&:has([role=checkbox])]:pr-0', className)} {...props} />
}

export function TableCell({ className, colSpan, ...props }: HTMLAttributes<HTMLTableCellElement> & { colSpan?: number }) {
  return <td colSpan={colSpan} className={cn('p-4 align-middle text-zinc-600 [&:has([role=checkbox])]:pr-0', className)} {...props} />
}

export function TableCaption({ className, ...props }: HTMLAttributes<HTMLTableCaptionElement>) {
  return <caption className={cn('mt-4 text-sm text-zinc-500', className)} {...props} />
}
