import { cn } from '../../../lib/utils';

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

export function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 text-sm font-medium transition-all",
        active 
          ? "bg-white text-[#0C0A09] shadow-sm rounded-full" 
          : "bg-transparent text-[#0C0A0999] hover:text-[#0C0A09] rounded-[14px]"
      )}
    >
      {children}
    </button>
  );
}
