import { describe, expect, it } from 'vitest';
import { notificationDetailMoney, parseFinancialNotificationDetails } from '../utils/financialNotificationDetails';

const orderId = '11111111-1111-4111-a111-111111111111';
const paymentId = '22222222-2222-4222-a222-222222222222';
function fixture(method = 'Ratio 1:2') {
  return {
    recipientUserId: 'lorenzo',
    sharedContext: {
      orderId, itemName: 'PANTHER Automatic Voltage Regulator with an intentionally long full item name', allocationRevision: 3, method,
      ownTotalMinor: 75800, groupTotalMinor: 227400,
      participants: [
        { userId: 'lorenzo', name: 'Lorenzo with a very long family name', own: true, allocationMinor: 75800, percentage: '33.33%' },
        { userId: 'bernadette', name: 'Bernadette Bela', own: false, allocationMinor: 151600, percentage: '66.67%' },
      ],
      installments: [{ paymentId, monthNumber: 1, dueDate: '2026-12-05T00:00:00.000Z', groupAmountMinor: 75800, ownAmountMinor: 25267,
        participants: [
          { userId: 'lorenzo', name: 'Lorenzo with a very long family name', own: true, amountMinor: 25267, status: 'paid' },
          { userId: 'bernadette', name: 'Bernadette Bela', own: false, amountMinor: 50533, status: 'unpaid' },
        ],
      }],
    },
  };
}
describe('authorized historical financial notification detail', () => {
  it.each(['Equal', 'Percentage', 'Exact amount', 'Ratio 1:2'])('retains saved %s amounts and full names without inferring monthly averages', method => {
    const parsed = parseFinancialNotificationDetails(fixture(method), 'lorenzo')!;
    expect(parsed.method).toBe(method);
    expect(parsed.installments[0].ownAmountMinor).toBe(25267);
    expect(parsed.installments[0].participants.map(p => p.status)).toEqual(['paid', 'unpaid']);
    expect(parsed.participants[0].name).toBe('Lorenzo with a very long family name');
    expect(notificationDetailMoney(parsed.installments[0].ownAmountMinor)).toContain('252.67');
  });
  it('fails closed without an actual signed-in recipient match', () => {
    expect(parseFinancialNotificationDetails(fixture(), null)).toBeNull();
    expect(parseFinancialNotificationDetails(fixture(), 'another-account')).toBeNull();
    const data = fixture(); data.recipientUserId = 'another-account';
    expect(parseFinancialNotificationDetails(data, 'lorenzo')).toBeNull();
  });
  it('accepts an individual order without inventing a sharing partner', () => {
    const data = fixture('Individual order'); const context = data.sharedContext;
    context.ownTotalMinor = context.groupTotalMinor;
    context.participants = [{ ...context.participants[0], allocationMinor: context.groupTotalMinor, percentage: '100%' }];
    context.installments[0].ownAmountMinor = context.installments[0].groupAmountMinor;
    context.installments[0].participants = [{ ...context.installments[0].participants[0], amountMinor: context.installments[0].groupAmountMinor }];
    const parsed = parseFinancialNotificationDetails(data, 'lorenzo')!;
    expect(parsed.method).toBe('Individual order'); expect(parsed.participants).toHaveLength(1);
    expect(parsed.installments[0].ownAmountMinor).toBe(75800);
  });
  it('refuses inconsistent own markers even if the outer recipient matches', () => {
    const data = fixture(); data.sharedContext.participants[0].own = false;
    expect(parseFinancialNotificationDetails(data, 'lorenzo')).toBeNull();
  });
  it('treats missing liability as unavailable, never zero', () => {
    const data: any = fixture();
    delete data.sharedContext.installments[0].ownAmountMinor;
    delete data.sharedContext.installments[0].participants[0].amountMinor;
    const parsed = parseFinancialNotificationDetails(data, 'lorenzo')!;
    expect(parsed.installments[0].ownAmountMinor).toBeNull();
    expect(parsed.installments[0].participants[0].status).toBe('unavailable');
    expect(notificationDetailMoney(null)).toBe('Unavailable');
  });
  it('labels an actual zero as no payment required despite an unpaid flag', () => {
    const data = fixture(); const month = data.sharedContext.installments[0];
    month.ownAmountMinor = 0; month.participants[0].amountMinor = 0; month.participants[0].status = 'unpaid'; month.participants[1].amountMinor = 75800;
    expect(parseFinancialNotificationDetails(data, 'lorenzo')!.installments[0].participants[0].status).toBe('no_payment_required');
  });
  it.each([-1, Infinity, NaN, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid minor-unit money %s', bad => {
    const data = fixture(); data.sharedContext.ownTotalMinor = bad;
    expect(parseFinancialNotificationDetails(data, 'lorenzo')).toBeNull();
  });
  it('rejects duplicate or foreign participant rows and false group totals', () => {
    const duplicate = fixture(); duplicate.sharedContext.participants[1].userId = 'lorenzo';
    expect(parseFinancialNotificationDetails(duplicate, 'lorenzo')).toBeNull();
    const foreign = fixture(); foreign.sharedContext.installments[0].participants[1].userId = 'stranger';
    expect(parseFinancialNotificationDetails(foreign, 'lorenzo')).toBeNull();
    const wrong = fixture(); wrong.sharedContext.installments[0].groupAmountMinor = 1;
    expect(parseFinancialNotificationDetails(wrong, 'lorenzo')).toBeNull();
  });
  it('strips unrelated private properties and rejects malformed dates/route identifiers', () => {
    const data: any = fixture(); data.sharedContext.participants[0].email = 'private@example.com'; data.sharedContext.proof = 'private-file';
    expect(JSON.stringify(parseFinancialNotificationDetails(data, 'lorenzo'))).not.toMatch(/private@example|private-file/);
    data.sharedContext.installments[0].dueDate = 'bad-date'; expect(parseFinancialNotificationDetails(data, 'lorenzo')).toBeNull();
    data.sharedContext.installments[0].dueDate = null; data.sharedContext.orderId = 'https://attacker.example';
    expect(parseFinancialNotificationDetails(data, 'lorenzo')).toBeNull();
  });
});
