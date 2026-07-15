import React, { useEffect } from 'react';
import { IconButton } from './button';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'po' | 'full';
  footer?: React.ReactNode;
  hideCloseButton?: boolean;
  hideHeader?: boolean;
}

const sizes = {
  sm: 'w-full sm:w-[400px]',
  md: 'w-full sm:w-[560px]',
  lg: 'w-full sm:w-[720px]',
  xl: 'w-full sm:w-[960px]',
  po: 'w-full sm:w-[650px]',
  full: 'w-full sm:w-[calc(100vw-48px)]',
};

export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  footer,
  hideCloseButton = false,
  hideHeader = false,
}: DrawerProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex justify-end font-sans">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      />

      {/* Drawer Panel */}
      <div
        className={cn(
          'relative bg-white border-l border-zinc-200 shadow-2xl flex flex-col h-full max-w-full animate-in slide-in-from-right duration-300',
          sizes[size]
        )}
      >
        {/* Header */}
        {!hideHeader && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 shrink-0">
            <h2 className="text-lg font-semibold text-zinc-900">
              {title}
            </h2>
            {!hideCloseButton && (
              <IconButton
                icon={<X size={20} />}
                variant="ghost"
                size="sm"
                onClick={onClose}
                aria-label="Close"
                className="text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
              />
            )}
          </div>
        )}

        {/* Body */}
        <div className={cn("flex-1 overflow-auto", hideHeader ? "" : "p-6")}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-200 shrink-0 bg-zinc-50/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
