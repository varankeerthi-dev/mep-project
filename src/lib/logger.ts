export const toast = {
  success: (message: string) => console.log(`✅ ${message}`),
  error: (message: string) => console.error(`❌ ${message}`),
  message: (message: string) => console.log(`ℹ️ ${message}`),
  dismiss: () => {},
  promise: () => {},
  loading: (message: string) => console.log(`⏳ ${message}`),
}

export function Toaster() {
  return null
}
