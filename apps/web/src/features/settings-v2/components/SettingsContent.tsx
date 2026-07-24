import { cn } from '@/lib/utils';

interface SettingsContentProps {
  children: React.ReactNode;
  className?: string;
}

export function SettingsContent({ children, className }: SettingsContentProps) {
  return (
    <div
      className={cn(
        'flex-1 overflow-y-auto px-12 py-8 bg-[#fafafa]',
        className
      )}
      data-slot="settings-content"
    >
      <div className="max-w-[1000px] mx-auto">{children}</div>
    </div>
  );
}
