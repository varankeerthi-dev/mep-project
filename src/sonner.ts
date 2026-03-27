export const toast = {
  success: (message: string) => {
    console.log(`SUCCESS: ${message}`)
  },
  error: (message: string) => {
    console.error(`ERROR: ${message}`)
  },
  message: (message: string) => {
    console.log(message)
  },
}

export function Toaster() {
  return null
}
