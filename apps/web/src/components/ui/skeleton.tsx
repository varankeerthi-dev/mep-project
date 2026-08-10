import * as React from "react";
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-2xl bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };

type PageSkeletonVariant = "page" | "table" | "list" | "detail";

export interface PageSkeletonProps extends React.ComponentProps<"div"> {
  /** page = dashboard/overview, table = list/table, list = queue/activity, detail = detail/form */
  variant?: PageSkeletonVariant;
  /** number of placeholder rows for table/list variants */
  rows?: number;
}

/**
 * Single source of truth for full-page loading states.
 * - Initial load / lazy chunk -> PageSkeleton (via Suspense or isLoading)
 * - Background refetch -> do NOT use this; keep current UI + a small indicator
 * - Cached navigation -> renders immediately (no skeleton)
 * Style changes here propagate everywhere.
 */
export function PageSkeleton({
  variant = "page",
  rows = 6,
  className,
  ...props
}: PageSkeletonProps) {
  if (variant === "table") {
    return (
      <div
        data-slot="page-skeleton"
        className={cn("p-4 sm:p-6", className)}
        {...props}
      >
        <Skeleton className="h-7 w-56 rounded-lg" />
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-zinc-100 px-4 py-3 last:border-b-0"
            >
              <Skeleton className="h-4 flex-[2] rounded-md" />
              <Skeleton className="h-4 flex-1 rounded-md" />
              <Skeleton className="h-4 flex-1 rounded-md" />
              <Skeleton className="h-4 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div
        data-slot="page-skeleton"
        className={cn("p-4 sm:p-6 space-y-3", className)}
        {...props}
      >
        <Skeleton className="h-7 w-56 rounded-lg" />
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3"
          >
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-4 flex-1 rounded-md" />
            <Skeleton className="h-4 w-20 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div
        data-slot="page-skeleton"
        className={cn("p-4 sm:p-6 space-y-4", className)}
        {...props}
      >
        <Skeleton className="h-7 w-64 rounded-lg" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  // variant === "page" — dashboard / overview
  return (
    <div
      data-slot="page-skeleton"
      className={cn("p-4 sm:p-6 space-y-4", className)}
      {...props}
    >
      <Skeleton className="h-7 w-64 rounded-lg" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}
