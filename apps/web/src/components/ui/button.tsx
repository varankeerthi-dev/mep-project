import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// ─── Spinner Component ───────────────────────────────────────────────────────

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

// ─── Button Variants (CVA) ───────────────────────────────────────────────────

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border bg-clip-padding text-sm font-medium whitespace-nowrap transition-all duration-150 outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Primary — strongest visual weight
        default:
          "bg-primary text-primary-foreground border-primary hover:bg-primary/90",
        // Secondary — white bg, light border, supporting action
        secondary:
          "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300",
        // Outline — utility actions
        outline:
          "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50 hover:border-zinc-400",
        // Ghost — inline/toolbar, subtle hover
        ghost:
          "bg-transparent text-zinc-600 border-transparent hover:bg-zinc-100 hover:text-zinc-900",
        // Destructive — danger actions
        destructive:
          "bg-red-600 text-white border-red-600 hover:bg-red-700",
        // Success — positive actions
        success:
          "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700",
        // Warning — attention (muted amber)
        warning:
          "bg-amber-500 text-white border-amber-500 hover:bg-amber-600",
        // Link — navigation
        link: "bg-transparent text-primary border-transparent underline-offset-4 hover:underline hover:text-primary/80",
      },
      size: {
        default: "h-9 gap-1.5",
        xs: "h-7 gap-1 text-xs",
        sm: "h-8 gap-1",
        lg: "h-10 gap-1.5",
        icon: "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

// ─── Size Padding Map ───────────────────────────────────────────────────────

const sizePaddingMap: Record<string, { horizontal: number; height: number }> = {
  xs: { horizontal: 12, height: 28 },
  sm: { horizontal: 16, height: 32 },
  default: { horizontal: 20, height: 36 },
  lg: { horizontal: 24, height: 40 },
  icon: { horizontal: 0, height: 36 },
  'icon-xs': { horizontal: 0, height: 24 },
  'icon-sm': { horizontal: 0, height: 32 },
  'icon-lg': { horizontal: 0, height: 40 },
}

// ─── Button Props ────────────────────────────────────────────────────────────

interface ButtonProps
  extends Omit<ButtonPrimitive.Props, 'children'>,
    VariantProps<typeof buttonVariants> {
  /** Show loading spinner and disable interaction */
  loading?: boolean
  /** Text to show during loading state (replaces children) */
  loadingText?: string
  /** Icon element to show before children */
  leftIcon?: React.ReactNode
  /** Icon element to show after children */
  rightIcon?: React.ReactNode
  /** Analytics identifier for tracking */
  analyticsId?: string
  /** Button content */
  children?: React.ReactNode
}

// ─── Button Component ────────────────────────────────────────────────────────

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      fullWidth,
      loading = false,
      loadingText,
      leftIcon,
      rightIcon,
      disabled,
      analyticsId,
      children,
      type = "button",
      style,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading
    return (
      <ButtonPrimitive
        ref={ref}
        data-slot="button"
        type={type}
        className={cn(
          buttonVariants({ variant, size, fullWidth, className }),
          loading && "cursor-wait"
        )}
        style={style}
        disabled={isDisabled}
        aria-disabled={isDisabled || undefined}
        aria-busy={loading || undefined}
        data-analytics-id={analyticsId || undefined}
        {...props}
      >
        {loading ? (
          <>
            <Spinner className="shrink-0" />
            {loadingText && <span>{loadingText}</span>}
          </>
        ) : (
          <>
            {leftIcon && <span className="shrink-0 [&_svg]:size-4">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0 [&_svg]:size-4">{rightIcon}</span>}
          </>
        )}
      </ButtonPrimitive>
    )
  }
)

Button.displayName = "Button"

// ─── IconButton Component ────────────────────────────────────────────────────

/**
 * @deprecated Use `<Button size="icon">` instead. This component will be removed in v3.
 */
function IconButton({
  icon,
  children,
  className,
  variant = "ghost",
  size = "icon",
  loading,
  analyticsId,
  ...props
}: ButtonProps & {
  icon?: React.ReactNode
}) {
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      loading={loading}
      analyticsId={analyticsId}
      {...props}
    >
      {icon}
      {children}
    </Button>
  )
}

IconButton.displayName = "IconButton"

// ─── Exports ─────────────────────────────────────────────────────────────────

export { Button, IconButton, buttonVariants, Spinner }
export type { ButtonProps }
