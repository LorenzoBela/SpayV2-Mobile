type BillingRow = {
  id: string; amount_due: unknown; is_paid: boolean; isParticipantSplit?: boolean; splitPercentageLabel?: string; splitMode?: string;
  order?: { is_shared?: boolean; item_name?: string; installment_months?: number; profile?: { id?: string; name?: string; email?: string } };
  participantPayments?: { id: string; amount_due: unknown; is_paid: boolean; splitPercentageLabel?: string; splitMode?: string; profile?: { id?: string; name?: string; email?: string } }[];
};

/** The API may already return one row per participant. Never expand those again. */
export function unpaidBillingLiabilities(rows: BillingRow[]) {
  return rows.filter(p => !p.is_paid && Number(p.amount_due) > 0).flatMap(p => {
    const common = { ...p, isShared: Boolean(p.order?.is_shared), itemName: p.order?.item_name || 'Purchase Order', totalMonths: p.order?.installment_months || 0 };
    if (!p.isParticipantSplit && common.isShared && p.participantPayments?.length) {
      return p.participantPayments.filter(pp => !pp.is_paid && Number(pp.amount_due) > 0).map(pp => ({ ...common, id: pp.id, amount_due: Number(pp.amount_due), clientId: pp.profile?.id || '', clientName: pp.profile?.name || 'Participant', clientEmail: pp.profile?.email || '', splitPercentageLabel: pp.splitPercentageLabel, splitMode: pp.splitMode }));
    }
    return [{ ...common, amount_due: Number(p.amount_due), clientId: p.order?.profile?.id || '', clientName: p.order?.profile?.name || 'Participant', clientEmail: p.order?.profile?.email || '' }];
  });
}
