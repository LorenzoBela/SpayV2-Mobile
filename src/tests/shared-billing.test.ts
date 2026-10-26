import { describe, expect, it } from 'vitest';
import { unpaidBillingLiabilities } from '../utils/shared-billing';

describe('administrator shared billing countdown', () => {
  it('does not expand already-expanded participant rows a second time', () => {
    const participants = [{ id: 'a', amount_due: 30, is_paid: false, profile: { id: 'a' } }, { id: 'b', amount_due: 70, is_paid: false, profile: { id: 'b' } }];
    const rows = participants.map(p => ({ ...p, isParticipantSplit: true, order: { is_shared: true, profile: p.profile }, participantPayments: participants }));
    const output = unpaidBillingLiabilities(rows);
    expect(output).toHaveLength(2); expect(output.reduce((sum, p) => sum + p.amount_due, 0)).toBe(100);
    expect(unpaidBillingLiabilities([{ id: 'master', amount_due: 100, is_paid: false, order: { is_shared: true }, participantPayments: [{ ...participants[0], is_paid: true }, participants[1]] }]).map(p => p.amount_due)).toEqual([70]);
  });
});
