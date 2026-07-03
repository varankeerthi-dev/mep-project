import React, { createContext, useContext, useMemo, useState } from 'react'
import type { HTMLAttributes, ReactElement } from 'react'
import { cn } from '../../lib/utils'

type DropdownContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}

const DropdownContext = createContext<DropdownContextValue | null>(null)

type DropdownMenuProps = {
  children: React.ReactNode
}

export function DropdownMenu({ children }: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const value = useMemo(() => ({ open, setOpen }), [open])
  return <DropdownContext.Provider value={value}>{children}</DropdownContext.Provider>
}

type TriggerProps = {
  asChild?: boolean
  children: ReactElement<{ onClick?: (event: React.MouseEvent) => void }>
}

export function DropdownMenuTrigger({ asChild, children }: TriggerProps) {
  const ctx = useContext(DropdownContext)
  if (!ctx) return children

  const onClick = (event: React.MouseEvent) => {
    children.props?.onClick?.(event)
    ctx.setOpen(!ctx.open)
  }

  return asChild ? React.cloneElement(children, { onClick }) : <button onClick={onClick}>{children}</button>
}

type DropdownMenuContentProps = HTMLAttributes<HTMLDivElement> & {
  align?: 'start' | 'center' | 'end'
}

export function DropdownMenuContent({
  className,
  align = 'start',
  children,
  ...props
}: DropdownMenuContentProps) {
  const ctx = useContext(DropdownContext)
  if (!ctx?.open) return null

  const alignment =
    align === 'end'
      ? 'right-0'
      : align === 'center'
        ? 'left-1/2 -translate-x-1/2'
        : 'left-0'

  return (
    <div className="relative">
      <div
        className={cn(
          'absolute z-50 mt-2 min-w-[160px] rounded-md border border-zinc-200 bg-white p-1 shadow-lg',
          alignment,
          className
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  )
}

export function DropdownMenuItem({ className, onClick, ...props }: HTMLAttributes<HTMLDivElement>) {
  const ctx = useContext(DropdownContext)
  return (
    <div
      className={cn(
        'flex cursor-pointer items-center rounded-md px-2 py-2 text-sm text-zinc-700 hover:bg-zinc-100',
        className
      )}
      onClick={(event) => {
        onClick?.(event)
        ctx?.setOpen(false)
      }}
      {...props}
    />
  )
}

export function DropdownMenuCheckboxItem({
  className,
  checked,
  onCheckedChange,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}) {
  return (
    <div
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-zinc-700 hover:bg-zinc-100',
        className
      )}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    >
      <input type="checkbox" checked={!!checked} readOnly />
      {children}
    </div>
  )
}

export function DropdownMenuLabel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-2 py-1 text-xs font-semibold text-zinc-500', className)} {...props} />
}

export function DropdownMenuSeparator() {
  return <div className="my-1 h-px bg-zinc-200" />
}
