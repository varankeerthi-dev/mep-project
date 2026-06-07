import { toast as sonnerToast, Toaster as SonnerToaster } from 'sonner';

type ToastAction = { label: string; onClick: () => void };
type ToastOptions = { description?: string; duration?: number; action?: ToastAction };

export const toast = {
  success: (message: string, opts?: ToastOptions) => sonnerToast.success(message, { description: opts?.description, duration: opts?.duration, action: opts?.action ? { label: opts.action.label, onClick: opts.action.onClick } : undefined }),
  error: (message: string, opts?: ToastOptions) => sonnerToast.error(message, { description: opts?.description, duration: opts?.duration ?? 6000, action: opts?.action ? { label: opts.action.label, onClick: opts.action.onClick } : undefined }),
  warning: (message: string, opts?: ToastOptions) => sonnerToast.warning(message, { description: opts?.description, action: opts?.action ? { label: opts.action.label, onClick: opts.action.onClick } : undefined }),
  info: (message: string, opts?: ToastOptions) => sonnerToast.info(message, { description: opts?.description, action: opts?.action ? { label: opts.action.label, onClick: opts.action.onClick } : undefined }),
  message: (message: string, opts?: ToastOptions) => sonnerToast(message, { description: opts?.description, action: opts?.action ? { label: opts.action.label, onClick: opts.action.onClick } : undefined }),
  dismiss: () => sonnerToast.dismiss(),
  promise: sonnerToast.promise,
  loading: (message: string) => sonnerToast.loading(message),
};

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        style: {
          fontFamily: 'Inter, sans-serif',
          fontSize: '14px',
        },
      }}
    />
  );
}