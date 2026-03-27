import React, { createContext, useContext, useMemo, useState } from 'react'
import type { HTMLAttributes, ReactElement } from 'react'
import { cn } from '@/lib/utils'

type TabsContextValue = {
  value: string
  setValue: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

type TabsProps = HTMLAttributes<HTMLDivElement> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}

export function Tabs({ value, defaultValue, onValueChange, className, ...props }: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? '')
  const controlled = value !== undefined
  const currentValue = controlled ? value : internalValue

  const setValue = (next: string) => {
    if (!controlled) setInternalValue(next)
    onValueChange?.(next)
  }

  const ctx = useMemo(() => ({ value: currentValue, setValue }), [currentValue])
  return (
    <TabsContext.Provider value={ctx}>
      <div className={cn('w-full', className)} {...props} />
    </TabsContext.Provider>
  )
}

export function TabsList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('inline-flex items-center gap-2', className)} {...props} />
}

type TabsTriggerProps = HTMLAttributes<HTMLButtonElement> & {
  value: string
}

export function TabsTrigger({ value, className, children, ...props }: TabsTriggerProps) {
  const ctx = useContext(TabsContext)
  const active = ctx?.value === value
  return (
    <button
      className={cn(
        'px-3 py-2 text-sm font-medium text-slate-600',
        active && 'text-slate-900',
        className
      )}
      data-state={active ? 'active' : 'inactive'}
      onClick={(event) => {
        props.onClick?.(event)
        ctx?.setValue(value)
      }}
      {...props}
    >
      {children}
    </button>
  )
}

type TabsContentProps = HTMLAttributes<HTMLDivElement> & {
  value: string
}

export function TabsContent({ value, className, ...props }: TabsContentProps) {
  const ctx = useContext(TabsContext)
  if (ctx?.value !== value) return null
  return <div className={cn('mt-4', className)} {...props} />
}
