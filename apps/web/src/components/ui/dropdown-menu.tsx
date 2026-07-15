import React, { createContext, useContext, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { HTMLAttributes, ReactElement } from 'react'
import { useRef, useEffect } from 'react'
import { cn } from '../../lib/utils'

type DropdownContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLElement | null>
}

const DropdownContext = createContext<DropdownContextValue | null>(null)

type DropdownMenuProps = {
  children: React.ReactNode
}

export function DropdownMenu({ children }: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLElement | null>(null)
  const value = useMemo(() => ({ open, setOpen, triggerRef }), [open])
  return <DropdownContext.Provider value={value}>{children}</DropdownContext.Provider>
}

type TriggerProps = {
  asChild?: boolean
  children: ReactElement<{ onClick?: (event: React.MouseEvent) => void }>
}

export function DropdownMenuTrigger({ asChild, children }: TriggerProps) {
  const ctx = useContext(DropdownContext)
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (ctx && ref.current) {
      ctx.triggerRef.current = ref.current
    }
  })

  if (!ctx) return children

  const onClick = (event: React.MouseEvent) => {
    children.props?.onClick?.(event)
    ctx.setOpen(!ctx.open)
  }

  if (asChild) {
    return React.cloneElement(children, {
      onClick,
      ref,
    } as any)
  }

  return (
    <button ref={ref as React.RefObject<HTMLButtonElement>} onClick={onClick}>
      {children}
    </button>
  )
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
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!ctx?.open) return

    // Calculate position from trigger
    const trigger = ctx.triggerRef.current
    if (trigger) {
      const rect = trigger.getBoundingClientRect()
      setPos({
        top: rect.bottom + window.scrollY + 4,
        left: align === 'end'
          ? rect.right + window.scrollX
          : rect.left + window.scrollX,
      })
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        ref.current && !ref.current.contains(target) &&
        ctx.triggerRef.current && !ctx.triggerRef.current.contains(target)
      ) {
        ctx.setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [ctx, align])

  if (!ctx?.open || !pos) return null

  const translateX = align === 'end' ? '-100%' : '0'

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: pos.top - window.scrollY,
        left: pos.left,
        transform: `translateX(${translateX})`,
        zIndex: 9999,
      }}
      className={cn(
        'min-w-[160px] rounded-md border border-zinc-200 bg-white p-1 shadow-lg',
        className
      )}
      {...props}
    >
      {children}
    </div>,
    document.body
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
