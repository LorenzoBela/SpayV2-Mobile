import { describe, expect, it, vi } from 'vitest';
import {
  generateIdempotencyKey,
  isMutationMethod,
  getExistingIdempotencyKey,
  attachIdempotencyKey,
  idempotencyAxiosInterceptor,
  IDEMPOTENCY_HEADER,
} from '../idempotencyInterceptor';

describe('Idempotency Interceptor Module', () => {
  describe('generateIdempotencyKey', () => {
    it('generates a valid UUID v4 string format', () => {
      const key = generateIdempotencyKey();
      expect(typeof key).toBe('string');
      expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('generates distinct unique keys on subsequent calls', () => {
      const keys = new Set(Array.from({ length: 50 }, () => generateIdempotencyKey()));
      expect(keys.size).toBe(50);
    });
  });

  describe('isMutationMethod', () => {
    it('identifies POST, PUT, PATCH as mutation methods (case-insensitive)', () => {
      expect(isMutationMethod('POST')).toBe(true);
      expect(isMutationMethod('post')).toBe(true);
      expect(isMutationMethod('PUT')).toBe(true);
      expect(isMutationMethod('put')).toBe(true);
      expect(isMutationMethod('PATCH')).toBe(true);
      expect(isMutationMethod('patch')).toBe(true);
    });

    it('returns false for non-mutation or undefined methods', () => {
      expect(isMutationMethod('GET')).toBe(false);
      expect(isMutationMethod('get')).toBe(false);
      expect(isMutationMethod('DELETE')).toBe(false);
      expect(isMutationMethod('HEAD')).toBe(false);
      expect(isMutationMethod('OPTIONS')).toBe(false);
      expect(isMutationMethod(undefined)).toBe(false);
    });
  });

  describe('getExistingIdempotencyKey', () => {
    it('retrieves key case-insensitively from plain object headers', () => {
      const h1 = { 'X-Idempotency-Key': 'key-123' };
      expect(getExistingIdempotencyKey(h1)).toBe('key-123');

      const h2 = { 'x-idempotency-key': 'key-456' };
      expect(getExistingIdempotencyKey(h2)).toBe('key-456');

      const h3 = { Authorization: 'Bearer token' };
      expect(getExistingIdempotencyKey(h3)).toBeUndefined();
    });

    it('handles undefined or null headers safely', () => {
      expect(getExistingIdempotencyKey(undefined)).toBeUndefined();
      expect(getExistingIdempotencyKey(null)).toBeUndefined();
    });
  });

  describe('attachIdempotencyKey', () => {
    it('generates and attaches X-Idempotency-Key if not provided', () => {
      const { headers, idempotencyKey } = attachIdempotencyKey({ 'Content-Type': 'application/json' });
      expect(headers[IDEMPOTENCY_HEADER]).toBe(idempotencyKey);
      expect(headers['Content-Type']).toBe('application/json');
      expect(idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
    });

    it('preserves initial idempotency key when provided directly or in headers', () => {
      const initialKey = 'custom-offline-retry-uuid-101';

      // Passed directly
      const res1 = attachIdempotencyKey({}, initialKey);
      expect(res1.idempotencyKey).toBe(initialKey);
      expect(res1.headers[IDEMPOTENCY_HEADER]).toBe(initialKey);

      // Passed inside headers object
      const res2 = attachIdempotencyKey({ 'x-idempotency-key': initialKey });
      expect(res2.idempotencyKey).toBe(initialKey);
      expect(res2.headers[IDEMPOTENCY_HEADER]).toBe(initialKey);
    });
  });

  describe('idempotencyAxiosInterceptor', () => {
    it('attaches X-Idempotency-Key to POST request config', () => {
      const config: any = {
        method: 'post',
        url: '/api/v1/payments',
        headers: {},
      };

      const result = idempotencyAxiosInterceptor(config);
      expect(result.headers[IDEMPOTENCY_HEADER]).toBeDefined();
      expect((result as any).idempotencyKey).toBe(result.headers[IDEMPOTENCY_HEADER]);
    });

    it('preserves existing idempotency key on queued offline retries', () => {
      const retryKey = 'preserved-retry-key-999';
      const config: any = {
        method: 'PUT',
        url: '/api/v1/orders/123',
        headers: {
          'X-Idempotency-Key': retryKey,
        },
      };

      const result = idempotencyAxiosInterceptor(config);
      expect(result.headers[IDEMPOTENCY_HEADER]).toBe(retryKey);
      expect((result as any).idempotencyKey).toBe(retryKey);
    });

    it('leaves GET requests untouched', () => {
      const config: any = {
        method: 'GET',
        url: '/api/v1/profile',
        headers: {},
      };

      const result = idempotencyAxiosInterceptor(config);
      expect(result.headers[IDEMPOTENCY_HEADER]).toBeUndefined();
    });
  });
});
