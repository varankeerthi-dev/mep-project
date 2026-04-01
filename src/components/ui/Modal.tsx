import React, { useEffect } from 'react';
import { colors, shadows, radii, transitions } from '../../design-system';
import { IconButton } from './Button';
import { X } from 'lucide-react';

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
  sm: { maxWidth: '400px' },
  md: { maxWidth: '560px' },
  lg: { maxWidth: '720px' },
  xl: { maxWidth: '960px' },
  full: { maxWidth: 'calc(100vw - 48px)', maxHeight: 'calc(100vh - 48px)' },
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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          animation: 'fadeIn 200ms ease-out',
        }}
      />
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: scale(0.96) translateY(-8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      {/* Modal */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          ...sizes[size],
          maxHeight: 'calc(100vh - 48px)',
          background: '#ffffff',
          borderRadius: radii.xl,
          boxShadow: shadows.xl,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideIn 200ms cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: `1px solid ${colors.gray[200]}`,
            flexShrink: 0,
          }}
        >
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: colors.gray[900],
              margin: 0,
            }}
          >
            {title}
          </h2>
          {!hideCloseButton && (
            <IconButton
              icon={<X size={18} />}
              variant="ghost"
              size="md"
              onClick={onClose}
              aria-label="Close"
            />
          )}
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '24px',
          }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              padding: '16px 24px',
              borderTop: `1px solid ${colors.gray[200]}`,
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
