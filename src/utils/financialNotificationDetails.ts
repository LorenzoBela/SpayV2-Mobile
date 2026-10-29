import { z } from 'zod';

const minor = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullish().transform(value => value ?? null);
const userId = z.string().min(1).max(128);
const name = z.string().min(1).max(500);
const allocation = z.object({ userId, name, own: z.boolean(), allocationMinor: minor, percentage: z.string().max(128) });
const liability = z.object({ userId, name, own: z.boolean(), amountMinor: minor, status: z.enum(['paid', 'unpaid', 'no_payment_required', 'unavailable']).optional() });
const installment = z.object({
  paymentId: z.string().uuid(), monthNumber: z.number().int().min(1).max(120),
  dueDate: z.string().max(64).refine(value => Number.isFinite(new Date(value).getTime())).nullable(),
  groupAmountMinor: minor, ownAmountMinor: minor,
  participants: z.array(liability).min(1).max(50),
});
const contextSchema = z.object({
  orderId: z.string().uuid(), itemName: z.string().min(1).max(2000), allocationRevision: z.number().int().min(0),
  method: z.string().min(1).max(1024), ownTotalMinor: minor, groupTotalMinor: minor,
  participants: z.array(allocation).min(1).max(50), installments: z.array(installment).max(120),
});
// Structural validation for separately authorized admin API responses. Inbox rendering must still use the recipient-bound parser below.
export { contextSchema as financialNotificationContextSchema };

export type FinancialNotificationDetail = z.infer<typeof contextSchema>;
export function parseFinancialNotificationDetails(data: unknown, actualViewerId: string | null): FinancialNotificationDetail | null {
  if (!actualViewerId || !data || typeof data !== 'object' || Array.isArray(data)) return null;
  const payload = data as Record<string, unknown>;
  // A historical context is recipient-specific. Never show it to an impersonated or newly signed-in account.
  if (payload.recipientUserId !== actualViewerId) return null;
  const parsed = contextSchema.safeParse(payload.sharedContext);
  if (!parsed.success) return null;
  const context = parsed.data;
  const ids = new Set(context.participants.map(person => person.userId));
  if (ids.size !== context.participants.length || context.participants.some(person => person.own !== (person.userId === actualViewerId))) return null;
  const own = context.participants.find(person => person.own);
  if (!own || own.allocationMinor !== context.ownTotalMinor) return null;
  if (context.groupTotalMinor !== null && context.participants.every(person => person.allocationMinor !== null)
    && context.participants.reduce((sum, person) => sum + person.allocationMinor!, 0) !== context.groupTotalMinor) return null;
  if (new Set(context.installments.map(month => month.paymentId)).size !== context.installments.length
    || new Set(context.installments.map(month => month.monthNumber)).size !== context.installments.length) return null;
  for (const month of context.installments) {
    const monthlyIds = new Set(month.participants.map(person => person.userId));
    if (monthlyIds.size !== ids.size || month.participants.length !== ids.size || [...monthlyIds].some(id => !ids.has(id))) return null;
    if (month.participants.some(person => person.own !== (person.userId === actualViewerId))) return null;
    if (month.participants.find(person => person.own)?.amountMinor !== month.ownAmountMinor) return null;
    if (month.groupAmountMinor !== null && month.participants.every(person => person.amountMinor !== null)
      && month.participants.reduce((sum, person) => sum + person.amountMinor!, 0) !== month.groupAmountMinor) return null;
    for (const person of month.participants) {
      person.status = person.amountMinor === null ? 'unavailable' : person.amountMinor === 0 ? 'no_payment_required'
        : person.status === 'paid' || person.status === 'unpaid' ? person.status : 'unavailable';
    }
  }
  context.installments.sort((a, b) => a.monthNumber - b.monthNumber);
  return context;
}

export function notificationDetailMoney(amountMinor: number | null): string {
  return amountMinor === null ? 'Unavailable' : new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amountMinor / 100);
}
