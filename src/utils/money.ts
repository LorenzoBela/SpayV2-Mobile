import { dinero, toSnapshot, IDR, USD, MYR } from 'dinero.js';

type DineroCurrency = Parameters<typeof dinero>[0]['currency'];

export function createMoney(amountInCents: number, currency: DineroCurrency = IDR) {
  return dinero({ amount: Math.round(amountInCents), currency });
}

export function formatAmount(amountInCents: number, currencyCode: 'IDR' | 'USD' | 'MYR' = 'IDR'): string {
  const currencyObj: DineroCurrency = currencyCode === 'USD' ? USD : currencyCode === 'MYR' ? MYR : IDR;
  const d = createMoney(amountInCents, currencyObj);
  const snapshot = toSnapshot(d);
  const locale = snapshot.currency.code === 'IDR' ? 'id-ID' : snapshot.currency.code === 'MYR' ? 'ms-MY' : 'en-US';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: snapshot.currency.code,
    minimumFractionDigits: snapshot.currency.exponent,
    maximumFractionDigits: snapshot.currency.exponent,
  }).format(snapshot.amount / Math.pow(10, snapshot.currency.exponent));
}
