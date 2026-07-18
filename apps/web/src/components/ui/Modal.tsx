import React, { useEffect } from 'react';
import { IconButton } from './button';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  footer?: React.ReactNode;
  hideCloseButton?: boolean;
  hideHeader?: boolean;
}

const sizes = {
  sm: 'max-w-[400px]',
  md: 'max-w-[560px]',
  lg: 'max-w-[720px]',
  xl: 'max-w-[960px]',
  full: 'max-w-[calc(100vw-48px)] max-h-[calc(100vh-48px)]',
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  footer,
  hideCloseButton = false,
  hideHeader = false,
}: ModalProps) {
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
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 font-[Inter]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" />

      {/* Modal */}
      <div
        className={cn(
          'relative w-full bg-white rounded-xl shadow-[0px_0px_0px_1px_oklch(0_0_0_/_0.06),0px_1px_2px_-1px_oklch(0_0_0_/_0.06),0px_2px_4px_0px_oklch(0_0_0_/_0.04)] flex flex-col animate-in zoom-in-95 duration-200',
          sizes[size],
          'max-h-[calc(100vh-48px)]'
        )}
      >
        {/* Header */}
        {!hideHeader && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 shrink-0">
            <h2 className="text-base font-semibold text-zinc-900">
              {title}
            </h2>
            {!hideCloseButton && (
              <IconButton
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                aria-label="Close"
                className="text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
              >
                <X size={18} />
              </IconButton>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-auto p-3.5">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-zinc-200 shrink-0 bg-zinc-50/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
