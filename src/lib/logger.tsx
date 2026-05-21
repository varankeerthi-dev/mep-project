import { toast as sonnerToast, Toaster as SonnerToaster } from 'sonner';

type ToastOptions = { description?: string; duration?: number };

export const toast = {
  success: (message: string, opts?: ToastOptions) => sonnerToast.success(message, { description: opts?.description, duration: opts?.duration }),
  error: (message: string, opts?: ToastOptions) => sonnerToast.error(message, { description: opts?.description, duration: opts?.duration ?? 6000 }),
  warning: (message: string, opts?: ToastOptions) => sonnerToast.warning(message, { description: opts?.description }),
  info: (message: string, opts?: ToastOptions) => sonnerToast.info(message, { description: opts?.description }),
  message: (message: string) => sonnerToast(message),
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