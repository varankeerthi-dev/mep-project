import { toast as sonnerToast, Toaster as SonnerToaster } from 'sonner';

export const toast = {
  success: (message: string) => sonnerToast.success(message),
  error: (message: string) => sonnerToast.error(message),
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