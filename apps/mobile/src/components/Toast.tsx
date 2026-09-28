// components/Toast.tsx — minimal mobile toast with framer-motion.
// Usage: const toast = useToast(); toast.success('Saved'); toast.error('Failed');

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

let pushFn: ((kind: ToastKind, message: string) => void) | null = null;
let counter = 0;

export function toast(kind: ToastKind, message: string) {
  pushFn?.(kind, message);
}
export const toastSuccess = (m: string) => toast('success', m);
export const toastError = (m: string) => toast('error', m);
export const toastInfo = (m: string) => toast('info', m);

const ICONS: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  error: <AlertCircle className="h-4 w-4 text-red-500" />,
  info: <Info className="h-4 w-4 text-blue-500" />,
};

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    pushFn = (kind, message) => {
      const id = ++counter;
      setItems((prev) => [...prev.slice(-2), { id, kind, message }]);
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, 2600);
    };
    return () => {
      pushFn = null;
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <div className="fixed top-3 inset-x-0 z-[200] flex flex-col items-center gap-2 px-4 pointer-events-none">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: -24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="pointer-events-auto w-full max-w-sm glass-card rounded-2xl border border-border/60 shadow-lg px-4 py-3 flex items-center gap-2.5"
          >
            {ICONS[t.kind]}
            <p className="flex-1 text-sm font-medium text-foreground leading-snug">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="text-muted-foreground/60 active:scale-90 transition-transform cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
