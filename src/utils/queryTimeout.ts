type ErrorLike = {
  message?: string;
} | null | undefined;

type SupabaseResponse<T> = {
  data: T | null;
  error: ErrorLike;
};

export function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} request timed out after ${ms / 1000} seconds.`));
    }, ms);

    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function timedSupabaseQuery<T>(
  promise: PromiseLike<SupabaseResponse<T>>,
  label: string,
  ms = 30000, // Increased from 15s to 30s for complex queries
): Promise<T | null> {
  const result = await withTimeout(promise, ms, label);
  if (result.error) {
    throw new Error(`${label}: ${result.error.message || 'Unknown error'}`);
  }
  return result.data ?? null;
}
