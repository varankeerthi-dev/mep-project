export const withTimeout = async <T,>(promise: Promise<T>, desc: string, ms = 8000): Promise<T> => {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timeout: ${desc} after ${ms}ms`));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

export const isTimeoutError = (err: any, desc: string) => {
  return err instanceof Error && err.message.includes(`Timeout: ${desc}`);
};
