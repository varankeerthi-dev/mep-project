import React, { createContext, useContext, useMemo, useState } from 'react'
import type { HTMLAttributes, ReactElement } from 'react'
import { cn } from '../../lib/utils'

type DialogContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
}

const DialogContext = createContext<DialogContextValue | null>(null)

type DialogProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const controlled = typeof open === 'boolean'
  const currentOpen = controlled ? open : internalOpen

  const setOpen = (next: boolean) => {
    if (!controlled) setInternalOpen(next)
    onOpenChange?.(next)
  }

  const value = useMemo(() => ({ open: currentOpen, setOpen }), [currentOpen])

  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>
}

type DialogTriggerProps = {
  asChild?: boolean
  children: ReactElement<{ onClick?: (event: React.MouseEvent) => void }>
}

export function DialogTrigger({ asChild, children }: DialogTriggerProps) {
  const ctx = useContext(DialogContext)
  if (!ctx) return children

  const triggerProps = {
    onClick: (event: React.MouseEvent) => {
      children.props?.onClick?.(event)
      ctx.setOpen(true)
    },
  }

  return asChild ? React.cloneElement(children, triggerProps) : <button {...triggerProps}>{children}</button>
}

type DialogContentProps = HTMLAttributes<HTMLDivElement>

export function DialogContent({ className, children, ...props }: DialogContentProps) {
  const ctx = useContext(DialogContext)
  if (!ctx?.open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => ctx.setOpen(false)}
    >
      <div
        className={cn('w-full max-w-lg rounded-lg bg-white p-6 shadow-xl', className)}
        onClick={(event) => event.stopPropagation()}
        {...props}
      >
        {children}
      </div>
    </div>
  )
}

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 space-y-1', className)} {...props} />
}

export function DialogTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-semibold', className)} {...props} />
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-4 flex justify-end gap-2', className)} {...props} />
}

export function DialogDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-zinc-500', className)} {...props} />
}
