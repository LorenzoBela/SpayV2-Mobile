import { describe, expect, it } from 'vitest'
import { parseNotificationDigestDetails } from '../utils/notificationDigestDetails'

const item = { orderId: '11111111-1111-4111-a111-111111111111', paymentId: '22222222-2222-4222-a222-222222222222', itemName: 'Long shared order name', monthNumber: 2, amountMinor: 25267, dueDate: '2026-12-05T00:00:00.000Z' }
const fixture = () => ({ schemaVersion: 2, recipientUserId: 'recipient', snapshotIsHistorical: true, ownAmountMinor: 25267, itemCount: 1, digestItems: [{ ...item }] })
describe('recipient-bound saved payment summaries', () => {
  it('preserves actual saved cents and order targets without asserting a current paid status', () => {
    const parsed = parseNotificationDigestDetails(fixture(), 'recipient')!
    expect(parsed.digestItems[0]).toEqual(item)
    expect(parsed.ownAmountMinor).toBe(25267)
    expect(parsed.digestItems[0]).not.toHaveProperty('status')
  })
  it('rejects a missing or different signed-in recipient', () => {
    expect(parseNotificationDigestDetails(fixture(), null)).toBeNull()
    expect(parseNotificationDigestDetails(fixture(), 'someone-else')).toBeNull()
  })
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid personal amount %s', amount => {
    const data = fixture(); data.digestItems[0].amountMinor = amount; data.ownAmountMinor = amount
    expect(parseNotificationDigestDetails(data, 'recipient')).toBeNull()
  })
  it('rejects duplicate payments, mismatched counts and invented summary totals', () => {
    const data = fixture(); data.digestItems.push({ ...item }); data.itemCount = 2; data.ownAmountMinor *= 2
    expect(parseNotificationDigestDetails(data, 'recipient')).toBeNull()
    expect(parseNotificationDigestDetails({ ...fixture(), itemCount: 2 }, 'recipient')).toBeNull()
    expect(parseNotificationDigestDetails({ ...fixture(), ownAmountMinor: 1 }, 'recipient')).toBeNull()
  })
  it('rejects missing historical marker and unsafe navigation identifiers', () => {
    expect(parseNotificationDigestDetails({ ...fixture(), snapshotIsHistorical: false }, 'recipient')).toBeNull()
    const data = fixture(); data.digestItems[0].orderId = 'javascript:alert(1)'
    expect(parseNotificationDigestDetails(data, 'recipient')).toBeNull()
  })
})
