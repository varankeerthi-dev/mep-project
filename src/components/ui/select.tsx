import React from 'react'
import type { SelectHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

type SelectItemOption = { value: string; label: string }

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> & {
  options?: SelectItemOption[]
  label?: string
  error?: string
  onValueChange?: (value: string) => void
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
}

type SelectItemProps = { children?: React.ReactNode; value?: string }

function extractTriggerClass(children: React.ReactNode) {
  let className: string | undefined
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    if ((child.type as any).displayName === 'SelectTrigger') {
      className = (child as React.ReactElement<any>).props?.className
    }
  })
  return className
}

function extractPlaceholder(children: React.ReactNode) {
  let placeholder: string | undefined
  const walk = (node: React.ReactNode) => {
    React.Children.forEach(node, (child) => {
      if (!React.isValidElement(child)) return
      if ((child.type as any).displayName === 'SelectValue') {
        placeholder = (child as React.ReactElement<any>).props?.placeholder
      }
      const childProps = (child as React.ReactElement<any>).props
      if (childProps?.children) walk(childProps.children)
    })
  }
  walk(children)
  return placeholder
}

function extractItems(children: React.ReactNode): SelectItemOption[] {
  const items: SelectItemOption[] = []
  const walk = (node: React.ReactNode) => {
    React.Children.forEach(node, (child) => {
      if (!React.isValidElement(child)) return
      if ((child.type as any).displayName === 'SelectItem') {
        const childProps = (child as React.ReactElement<any>).props
        const value = String(childProps?.value ?? '')
        const label =
          typeof childProps?.children === 'string'
            ? childProps.children
            : String(childProps?.children ?? value)
        if (value) items.push({ value, label })
      }
      const childProps = (child as React.ReactElement<any>).props
      if (childProps?.children) walk(childProps.children)
    })
  }
  walk(children)
  return items
}

export function Select({
  className,
  options,
  label,
  error,
  onValueChange,
  onChange,
  children,
  value,
  defaultValue,
  ...props
}: SelectProps) {
  const resolvedItems = options ?? extractItems(children)
  const triggerClass = extractTriggerClass(children)
  const placeholder = extractPlaceholder(children)

  return (
    <div style={{ width: '100%' }}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      )}
      <select
        className={cn(
          'h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-red-400 focus:ring-red-500',
          triggerClass,
          className
        )}
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        onChange={(event) => {
          onChange?.(event)
          onValueChange?.(event.target.value)
        }}
        {...props}
      >
        {placeholder && (
          <option value="" disabled={!!props.required}>
            {placeholder}
          </option>
        )}
        {resolvedItems.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

export function SelectTrigger({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <>{children}</>
}
SelectTrigger.displayName = 'SelectTrigger'

export function SelectValue({ children, placeholder }: { children?: React.ReactNode; placeholder?: string }) {
  return <>{children}</>
}
SelectValue.displayName = 'SelectValue'

export function SelectContent({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <>{children}</>
}
SelectContent.displayName = 'SelectContent'

export function SelectItem({ children, value, className }: SelectItemProps & { className?: string }) {
  return <></>
}
SelectItem.displayName = 'SelectItem'
