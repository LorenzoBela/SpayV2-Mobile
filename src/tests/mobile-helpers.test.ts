import { describe, it, expect } from 'vitest';
import { formatAmount, createMoney } from '../utils/money';
import { generatePaymentRef, generateIdempotencyKey } from '../utils/id';
import { executeBatchWithRetry } from '../utils/batch';

describe('Mobile Dinero.js Currency Helper', () => {
  it('formats IDR currency with correct locale formatting', () => {
    const formatted = formatAmount(15000000, 'IDR');
    expect(formatted).toContain('Rp');
    expect(formatted).toContain('150');
  });

  it('creates money instance without errors', () => {
    const dineroObj = createMoney(5000);
    expect(dineroObj).toBeDefined();
  });
});

describe('Mobile Nanoid Reference Helper', () => {
  it('generates payment references with tx_spay prefix', () => {
    const ref = generatePaymentRef();
    expect(ref).toMatch(/^tx_spay_[A-Za-z0-9_-]{16}$/);
  });

  it('generates idempotency keys with idemp_ prefix', () => {
    const key = generateIdempotencyKey();
    expect(key).toMatch(/^idemp_[A-Za-z0-9_-]{24}$/);
  });
});

describe('Mobile Batch Retry Runner', () => {
  it('runs batch tasks concurrently', async () => {
    const items = [100, 200, 300];
    const results = await executeBatchWithRetry(items, async (item) => item * 2, 2);
    expect(results).toEqual([200, 400, 600]);
  });
});
