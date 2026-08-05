import { nanoid } from 'nanoid';

export function generatePaymentRef(prefix: string = 'tx_spay'): string {
  return `${prefix}_${nanoid(16)}`;
}

export function generateIdempotencyKey(): string {
  return `idemp_${nanoid(24)}`;
}
