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
        "tab-button px-5 text-sm font-medium border-b-2 transition-all",
        active 
          ? "border-indigo-600 text-indigo-700 bg-indigo-50/50" 
          : "border-transparent text-zinc-500 hover:text-indigo-600 hover:bg-zinc-50 hover:border-zinc-300"
      )}
    >
      {children}
    </button>
  );
}
