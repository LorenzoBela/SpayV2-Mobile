import { describe, expect, it } from 'vitest'
import { installmentShares, installmentPreview } from '../utils/installment-shares'
import { previewSplit } from '../utils/split-allocation'

describe('monthly shared order display', () => {
  it.each([
    ['EQUAL', ['1', '1'], [1500, 1500]],
    ['PERCENTAGE', ['30', '70'], [900, 2100]],
    ['EXACT', ['3000', '6000'], [1000, 2000]],
    ['RATIO', ['1', '3'], [750, 2250]],
  ])('uses stored %s monthly amounts and this month’s independent paid flags', (mode, values, expected) => {
    const allocation = previewSplit('9000', ['3000', '3000', '3000'], {
      version: 1, mode,
      participants: ['a', 'b'].map((userId, index) => ({ userId, value: values[index] })),
    }, ['a', 'b'])
    const people = ['a', 'b'].map((userId, index) => ({
      id: userId, userId, profile: { name: index ? 'Bernadette' : 'Lorenzo' },
      // A whole-order flag cannot establish a monthly flag.
      isPaid: index === 1,
      participantPayments: allocation.matrix.map((row, month) => ({
        paymentId: `month-${month}`, amountDue: row[index] / 100, isPaid: index === 0,
      })),
    }))
    const rows = installmentShares(people, 'month-0')
    expect(rows.map(row => row.amountDue)).toEqual(expected)
    expect(rows.map(row => row.status)).toEqual(['paid', 'unpaid'])
  })

  it('keeps a legitimate zero neutral and a missing liability unavailable', () => {
    const rows = installmentShares([
      { id: 'zero', participantPayments: [{ paymentId: 'm', amountDue: 0, isPaid: false }] },
      { id: 'missing', participantPayments: [] },
    ], 'm')
    expect(rows[0]).toMatchObject({ amountDue: 0, isPaid: false, status: 'no_payment_required' })
    expect(rows[1]).toMatchObject({ amountDue: null, isPaid: null, status: 'unavailable' })
  })

  it('does not label a missing monthly paid flag as unpaid', () => {
    expect(installmentShares([{ participantPayments: [{ paymentId: 'm', amountDue: 20 }] }], 'm')[0])
      .toMatchObject({ amountDue: 20, isPaid: null, status: 'unavailable' })
  })

  it('supports native snake-case records and preserves paid dates', () => {
    const rows = installmentShares([{ id: 'p', user_id: 'a', participant_payments: [
      { payment_id: 'm', amount_due: '23.47', is_paid: true, paid_at: '2026-11-03T00:00:00Z' },
    ] }], 'm')
    expect(rows[0]).toMatchObject({ userId: 'a', amountDue: 23.47, status: 'paid', paidAt: '2026-11-03T00:00:00.000Z' })
  })

  it('keeps the group month when the viewer has already paid', () => {
    const monthly = [1, 2].map(monthNumber => ({
      monthNumber, isPaid: monthNumber === 1, groupIsPaid: false,
      participantShares: installmentShares([
        { id: 'a', participantPayments: [{ paymentId: 'm', amountDue: 30, isPaid: monthNumber === 1 }] },
        { id: 'b', participantPayments: [{ paymentId: 'm', amountDue: 70, isPaid: false }] },
      ], 'm'),
    }))
    expect(installmentPreview(monthly)?.monthNumber).toBe(1)
    expect(installmentPreview([...monthly].reverse())?.monthNumber).toBe(1)
    expect(monthly.map(month => month.monthNumber)).toEqual([1, 2])
  })

  it('uses the final month for completed groups instead of inventing another installment', () => {
    expect(installmentPreview([{ monthNumber: 2, groupIsPaid: true }, { monthNumber: 1, groupIsPaid: true }])?.monthNumber).toBe(2)
    expect(installmentPreview([])).toBeUndefined()
  })

  it('does not skip an unknown cached group month because the viewer paid', () => {
    expect(installmentPreview([{ monthNumber: 1, isPaid: true }, { monthNumber: 2, isPaid: false }])?.monthNumber).toBe(1)
  })
})
