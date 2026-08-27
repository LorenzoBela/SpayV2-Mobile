import { describe, it, expect } from 'vitest';

describe('Admin Payments Bulk Selection & Breakdown Defensive Safety Suite', () => {
  // Simulates getUnpaidIdsForMonth logic
  const getUnpaidIdsForMonth = (monthData: any): string[] => {
    const ids: string[] = [];
    if (!monthData?.clients) return ids;
    Object.values(monthData.clients).forEach((client: any) => {
      if (!client?.payments) return;
      client.payments.forEach((payment: any) => {
        if (!payment?.is_paid && payment?.id) {
          ids.push(payment.id);
        }
      });
    });
    return ids;
  };

  // Simulates getUnpaidIdsForClient logic
  const getUnpaidIdsForClient = (clientData: any): string[] => {
    if (!clientData?.payments) return [];
    return clientData.payments.filter((p: any) => p && !p.is_paid).map((p: any) => p.id);
  };

  // Simulates selectedPaymentsSummary logic
  const computeSelectedPaymentsSummary = (selectedIdsSet: Set<string>, processedPayments: any[]) => {
    if (selectedIdsSet.size === 0) return { totalAmount: 0, clientString: '' };
    let total = 0;
    const clientSet = new Set<string>();

    (processedPayments || []).forEach((p: any) => {
      if (p && selectedIdsSet.has(p.id)) {
        total += Number(p.amount_due) || 0;
        if (p.clientName) {
          clientSet.add(p.clientName);
        }
      }
    });

    const clientsArray = Array.from(clientSet);
    let clientString = '';
    if (clientsArray.length === 1) {
      clientString = clientsArray[0];
    } else if (clientsArray.length === 2) {
      clientString = `${clientsArray[0]} and ${clientsArray[1]}`;
    } else if (clientsArray.length > 2) {
      clientString = `${clientsArray[0]}, ${clientsArray[1]}, and ${clientsArray.length - 2} others`;
    }

    return { totalAmount: total, clientString };
  };

  it('handles undefined or null monthData without throwing during query invalidation', () => {
    expect(() => getUnpaidIdsForMonth(undefined)).not.toThrow();
    expect(getUnpaidIdsForMonth(undefined)).toEqual([]);

    expect(() => getUnpaidIdsForMonth(null)).not.toThrow();
    expect(getUnpaidIdsForMonth(null)).toEqual([]);

    expect(() => getUnpaidIdsForMonth({})).not.toThrow();
    expect(getUnpaidIdsForMonth({})).toEqual([]);
  });

  it('handles undefined or null clientData without throwing during query invalidation', () => {
    expect(() => getUnpaidIdsForClient(undefined)).not.toThrow();
    expect(getUnpaidIdsForClient(undefined)).toEqual([]);

    expect(() => getUnpaidIdsForClient(null)).not.toThrow();
    expect(getUnpaidIdsForClient(null)).toEqual([]);

    expect(() => getUnpaidIdsForClient({})).not.toThrow();
    expect(getUnpaidIdsForClient({})).toEqual([]);
  });

  it('correctly extracts unpaid ids from populated monthData and clientData', () => {
    const mockMonthData = {
      monthName: 'August 2026',
      clients: {
        'client-1': {
          payments: [
            { id: 'pay-1', is_paid: false },
            { id: 'pay-2', is_paid: true },
          ],
        },
        'client-2': {
          payments: [
            { id: 'pay-3', is_paid: false },
          ],
        },
      },
    };

    expect(getUnpaidIdsForMonth(mockMonthData)).toEqual(['pay-1', 'pay-3']);
    expect(getUnpaidIdsForClient(mockMonthData.clients['client-1'])).toEqual(['pay-1']);
    expect(getUnpaidIdsForClient(mockMonthData.clients['client-2'])).toEqual(['pay-3']);
  });

  it('computes selectedPaymentsSummary safely with null/undefined entries in payments array', () => {
    const selectedSet = new Set(['pay-1', 'pay-2']);
    const payments = [
      null,
      undefined,
      { id: 'pay-1', amount_due: 1500, clientName: 'Alice' },
      { id: 'pay-2', amount_due: 2500, clientName: 'Bob' },
      { id: 'pay-3', amount_due: 500, clientName: 'Charlie' },
    ];

    const summary = computeSelectedPaymentsSummary(selectedSet, payments);
    expect(summary.totalAmount).toBe(4000);
    expect(summary.clientString).toBe('Alice and Bob');
  });
});
