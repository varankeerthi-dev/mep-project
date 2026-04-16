import React, { useEffect } from 'react';
import { IconButton } from './Button';
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
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      />

      {/* Modal */}
      <div
        className={cn(
          'relative w-full bg-white rounded-lg border border-zinc-200 shadow-sm flex flex-col animate-in zoom-in-95 duration-200',
          sizes[size],
          'max-h-[calc(100vh-48px)]'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 shrink-0">
          <h2 className="text-base font-semibold text-zinc-900">
            {title}
          </h2>
          {!hideCloseButton && (
            <IconButton
              icon={<X size={18} />}
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Close"
              className="text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
            />
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5">
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
