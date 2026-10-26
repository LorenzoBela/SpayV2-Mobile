import { participantPercentage, splitModeLabel, type SplitConfiguration } from './split-allocation';

export function personalOrder<T extends { amount: unknown; orderTotal?: unknown; is_paid?: boolean; split_config?: unknown }>(order: T, participation: { id: string; split_amount: unknown; is_paid: boolean } | undefined, userId: string) {
  if (!participation) return { ...order, orderTotal: Number(order.orderTotal ?? order.amount) };
  const total = Number(order.orderTotal ?? order.amount);
  const amount = Number(participation.split_amount ?? 0);
  const config = order.split_config as SplitConfiguration | null;
  return { ...order, orderTotal: total, amount, is_paid: participation.is_paid, is_participant: true, participant_id: participation.id,
    splitPercentageLabel: participantPercentage(config, userId, amount, total), splitMode: splitModeLabel(config) };
}
