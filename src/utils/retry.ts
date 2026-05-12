export type RetryOptions = {
  retries: number;
  onRetry?: (attempt: number, error: unknown) => void;
};

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const retry = async <T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= options.retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < options.retries) {
        options.onRetry?.(attempt + 1, error);
      }
    }
  }
  throw lastError;
};
