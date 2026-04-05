export interface RetryOptions {
  maxRetries?: number;
  initialDelayMS?: number;
  maxDelayMS?: number;
  jitter?: number;
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

export async function retryWithBackoff<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxRetries = options.maxRetries ?? 7;
  const initialDelayMS = options.initialDelayMS ?? 1000;
  const maxDelayMS = options.maxDelayMS ?? 30_000;
  const jitter = options.jitter ?? 0.3;
  const shouldRetry = options.shouldRetry ?? (() => true);
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try { return await fn(); }
    catch (err: any) {
      lastError = err;
      if (attempt === maxRetries || !shouldRetry(err, attempt)) throw err;
      const delay = Math.min(initialDelayMS * 2 ** attempt, maxDelayMS);
      await new Promise(r => setTimeout(r, delay * (1 + (Math.random() * 2 - 1) * jitter)));
    }
  }
  throw lastError!;
}
