import { memo } from 'react';

interface SkeletonLoaderProps {
  rows?: number;
  height?: string;
}

export const SkeletonLoader = memo(function SkeletonLoader({
  rows = 5,
  height = 'h-12',
}: SkeletonLoaderProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex gap-4">
          <div className="w-24 h-4 bg-slate-200 rounded animate-pulse" />
          <div className="flex-1 h-4 bg-slate-200 rounded animate-pulse" />
          <div className="w-32 h-4 bg-slate-200 rounded animate-pulse" />
          <div className="w-20 h-4 bg-slate-200 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
});

export const SkeletonText = memo(function SkeletonText({
  width = 'w-full',
  height = 'h-4',
}: { width?: string; height?: string }) {
  return <div className={`${width} ${height} bg-slate-200 rounded animate-pulse`} />;
});

export const SkeletonCard = memo(function SkeletonCard() {
  return (
    <div className="p-4 border border-slate-200 rounded-lg space-y-3">
      <SkeletonText width="w-1/3" />
      <SkeletonText width="w-full" />
      <SkeletonText width="w-2/3" />
    </div>
  );
});

export default SkeletonLoader;