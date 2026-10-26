import { describe, expect, it } from 'vitest';
import { personalOrder } from '../utils/personal-liability';

describe('personal responsibility for owned and participating orders', () => {
  it('uses the owner participant amount rather than charging the owner the entire group bill', () => {
    const order = { id: 'order', amount: 1000, is_paid: false };
    const owner = personalOrder(order, { id: 'owner', split_amount: 300, is_paid: true }, 'a');
    const other = personalOrder(order, { id: 'other', split_amount: 700, is_paid: false }, 'b');
    expect(owner.amount).toBe(300); expect(owner.is_paid).toBe(true);
    expect(other.amount).toBe(700); expect(other.is_paid).toBe(false);
    expect(personalOrder(owner, { id: 'owner', split_amount: 300, is_paid: true }, 'a').orderTotal).toBe(1000);
  });
  it('keeps zero shares and participant identifiers when projecting owned widget orders', () => {
    const owned = { id: 'order', amount: 1000, is_paid: false };
    const projected = personalOrder(owned, { id: 'owner-part', split_amount: 0, is_paid: true }, 'a');
    expect(projected).toMatchObject({ amount: 0, orderTotal: 1000, is_paid: true, is_participant: true, participant_id: 'owner-part' });
  });
});
