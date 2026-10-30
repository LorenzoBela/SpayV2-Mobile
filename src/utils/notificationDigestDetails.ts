import { z } from 'zod'

const amount = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const digestSchema = z.object({
  schemaVersion: z.literal(2), recipientUserId: z.string().min(1), snapshotIsHistorical: z.literal(true),
  ownAmountMinor: amount, itemCount: z.number().int().positive().max(5000),
  digestItems: z.array(z.object({
    orderId: z.string().uuid(), paymentId: z.string().uuid(), itemName: z.string().min(1).max(2000),
    monthNumber: z.number().int().positive().max(120), amountMinor: amount,
    dueDate: z.string().max(64).refine(value => Number.isFinite(new Date(value).getTime())).nullable(),
  })).min(1).max(5000),
})

/** Saved personal liabilities only. This does not assert that a payment is still unpaid. */
export function parseNotificationDigestDetails(data: unknown, viewerId: string | null) {
  if (!viewerId) return null
  const parsed = digestSchema.safeParse(data)
  if (!parsed.success || parsed.data.recipientUserId !== viewerId) return null
  const value = parsed.data
  if (value.itemCount !== value.digestItems.length || new Set(value.digestItems.map(item => item.paymentId)).size !== value.itemCount) return null
  const total = value.digestItems.reduce((sum, item) => sum + item.amountMinor, 0)
  return Number.isSafeInteger(total) && total === value.ownAmountMinor ? value : null
}
