/** Stored monthly liabilities only; whole-order balances never imply a month's status. */
export type InstallmentShare = {
  participantId: string
  userId: string
  name: string
  amountDue: number | null
  isPaid: boolean | null
  paidAt: string | null
  status: 'paid' | 'unpaid' | 'no_payment_required' | 'unavailable'
}

type ParticipantRecord = {
  id?: string
  userId?: string
  user_id?: string
  name?: string
  profile?: { name?: string | null } | null
  participantPayments?: LiabilityRecord[]
  participant_payments?: LiabilityRecord[]
}
type LiabilityRecord = {
  paymentId?: string
  payment_id?: string
  amountDue?: unknown
  amount_due?: unknown
  isPaid?: boolean
  is_paid?: boolean
  paidAt?: unknown
  paid_at?: unknown
}

export function installmentShares(participants: ParticipantRecord[], paymentId: string): InstallmentShare[] {
  return participants.map((person, index): InstallmentShare => {
    const liability = (person.participantPayments ?? person.participant_payments ?? [])
      .find(row => (row.paymentId ?? row.payment_id) === paymentId)
    const rawAmount = liability?.amountDue ?? liability?.amount_due
    const amount = rawAmount == null ? null : Number(rawAmount)
    const amountDue = amount !== null && Number.isFinite(amount) && amount >= 0 ? amount : null
    const rawPaid = liability?.isPaid ?? liability?.is_paid
    const isPaid = typeof rawPaid === 'boolean' ? rawPaid : null
    const rawDate = liability?.paidAt ?? liability?.paid_at
    const date = rawDate instanceof Date ? rawDate : rawDate == null ? null : new Date(rawDate as string | number)
    return {
      participantId: person.id ?? person.userId ?? person.user_id ?? String(index),
      userId: person.userId ?? person.user_id ?? '',
      name: person.name ?? person.profile?.name ?? 'Participant',
      amountDue,
      isPaid,
      paidAt: date && Number.isFinite(date.getTime()) ? date.toISOString() : null,
      status: amountDue === null ? 'unavailable' : amountDue === 0 ? 'no_payment_required'
        : isPaid === null ? 'unavailable' : isPaid ? 'paid' : 'unpaid',
    }
  })
}

/** Keep the group month visible when the viewer paid but a co-participant has not. */
export function installmentPreview<T extends { monthNumber?: number; month_number?: number; participantShares?: InstallmentShare[]; groupIsPaid?: boolean; isPaid?: boolean; is_paid?: boolean }>(payments: T[]): T | undefined {
  const ordered = [...payments].sort((a, b) => (a.monthNumber ?? a.month_number ?? 0) - (b.monthNumber ?? b.month_number ?? 0))
  return ordered.find(payment => payment.participantShares?.length
    ? payment.participantShares.some(share => share.status === 'unpaid' || share.status === 'unavailable')
    : payment.groupIsPaid !== true) ?? ordered.at(-1)
}
