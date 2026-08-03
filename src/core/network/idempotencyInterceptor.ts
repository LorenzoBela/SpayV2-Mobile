import type { InternalAxiosRequestConfig, AxiosRequestConfig } from 'axios';

/**
 * Standard header key for idempotency per RFC draft & industry standard.
 */
export const IDEMPOTENCY_HEADER = 'X-Idempotency-Key';

/**
 * Generates a unique UUID v4 string for idempotency keys.
 * Uses Web Crypto API when available, falling back to RFC4122 v4 generator.
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Fallback if crypto.randomUUID throws in restricted context
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Checks if an HTTP method is a mutation operation (POST, PUT, PATCH).
 */
export function isMutationMethod(method?: string): boolean {
  if (!method) return false;
  const upper = method.toUpperCase();
  return upper === 'POST' || upper === 'PUT' || upper === 'PATCH';
}

/**
 * Case-insensitively retrieves an existing idempotency key from headers.
 */
export function getExistingIdempotencyKey(headers?: Record<string, any> | any): string | undefined {
  if (!headers) return undefined;
  if (typeof headers.get === 'function') {
    return headers.get(IDEMPOTENCY_HEADER) || headers.get(IDEMPOTENCY_HEADER.toLowerCase());
  }
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === IDEMPOTENCY_HEADER.toLowerCase()) {
      return headers[key];
    }
  }
  return undefined;
}

/**
 * Helper to ensure headers object contains an idempotency key.
 * Preserves initial key if already set (vital for offline queue retries).
 */
export function attachIdempotencyKey(
  headers: Record<string, string> | Headers | any = {},
  existingKey?: string
): { headers: Record<string, string>; idempotencyKey: string } {
  const currentKey = existingKey || getExistingIdempotencyKey(headers);
  const keyToUse = currentKey || generateIdempotencyKey();

  const normalizedHeaders: Record<string, string> = {};
  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    headers.forEach((value, name) => {
      normalizedHeaders[name] = value;
    });
  } else if (headers && typeof headers === 'object') {
    Object.assign(normalizedHeaders, headers);
  }

  normalizedHeaders[IDEMPOTENCY_HEADER] = keyToUse;

  return {
    headers: normalizedHeaders,
    idempotencyKey: keyToUse,
  };
}

/**
 * Axios Request Interceptor helper.
 * Generates and sets X-Idempotency-Key for POST/PUT/PATCH requests,
 * while preserving existing keys on queued retries.
 */
export function idempotencyAxiosInterceptor<T extends InternalAxiosRequestConfig | AxiosRequestConfig>(
  config: T
): T {
  if (isMutationMethod(config.method)) {
    const existing = getExistingIdempotencyKey(config.headers) || (config as any).idempotencyKey;
    const key = existing || generateIdempotencyKey();

    if (!config.headers) {
      config.headers = {} as any;
    }

    if (typeof (config.headers as any).set === 'function') {
      (config.headers as any).set(IDEMPOTENCY_HEADER, key);
    } else {
      (config.headers as any)[IDEMPOTENCY_HEADER] = key;
    }

    (config as any).idempotencyKey = key;
  }
  return config;
}

/**
 * Fetch Interceptor wrapper helper.
 * Wrap global `fetch` or call directly to auto-attach idempotency keys.
 */
export async function idempotencyFetchInterceptor(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const method = init?.method || (typeof input === 'object' && 'method' in input ? (input as any).method : 'GET');

  if (isMutationMethod(method)) {
    const { headers } = attachIdempotencyKey(init?.headers);
    init = {
      ...init,
      headers,
    };
  }

  return fetch(input, init);
}
