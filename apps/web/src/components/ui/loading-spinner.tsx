import * as React from "react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div
        className={cn(
          "animate-spin rounded-full border-2 border-gray-300 border-t-blue-600",
          sizeClasses[size]
        )}
        style={{
          animationDuration: "0.6s",
        }}
      />
    </div>
  );
}

interface PageLoadingSpinnerProps {
  message?: string;
  className?: string;
}

export function PageLoadingSpinner({ message = "Loading...", className }: PageLoadingSpinnerProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center min-h-[200px] gap-4", className)}>
      <LoadingSpinner size="lg" />
      <p className="text-sm text-gray-500" style={{ animationDuration: "1s" }}>{message}</p>
    </div>
  );
}
