import pLimit from 'p-limit';
import pRetry, { Options as PRetryOptions } from 'p-retry';

/**
 * Executes a batch of mobile async tasks with concurrency control and exponential backoff retry.
 */
export async function executeBatchWithRetry<T, R>(
  items: T[],
  taskFn: (item: T) => Promise<R>,
  concurrencyLimit: number = 5,
  retryOptions?: PRetryOptions
): Promise<R[]> {
  const limit = pLimit(concurrencyLimit);

  const promises = items.map((item) =>
    limit(() =>
      pRetry(() => taskFn(item), {
        retries: 3,
        minTimeout: 500,
        factor: 2,
        ...retryOptions,
      })
    )
  );

  return Promise.all(promises);
}
