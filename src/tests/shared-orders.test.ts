import { describe, expect, it } from 'vitest';

interface Participant {
  userId: string;
  name: string;
  splitAmount: number;
  isPaid: boolean;
}

interface MobileSharedOrder {
  id: string;
  itemName: string;
  amount: number;
  isShared: boolean;
  participants: Participant[];
}

function parseMobileSharedOrder(order: any, currentUserId: string) {
  if (!order.isShared || !order.participants) {
    return {
      ...order,
      userShare: order.amount,
      sharedWithText: '',
      activeParticipants: [],
    };
  }

  const participants = order.participants as Participant[];
  const userParticipant = participants.find(p => p.userId === currentUserId);
  const userShare = userParticipant ? userParticipant.splitAmount : 0;

  const otherParticipants = participants.filter(p => p.userId !== currentUserId);
  const names = otherParticipants.map(p => p.name);
  const sharedWithText = names.length > 0 
    ? `Shared with ${names.join(', ')}`
    : '';

  return {
    ...order,
    userShare,
    sharedWithText,
    activeParticipants: participants,
  };
}

describe('Mobile Shared Order Parsing', () => {
  it('should parse non-shared order correctly', () => {
    const rawOrder = {
      id: 'ord-1',
      itemName: 'Phone',
      amount: 1000,
      isShared: false,
    };
    const parsed = parseMobileSharedOrder(rawOrder, 'user-1');
    expect(parsed.userShare).toBe(1000);
    expect(parsed.sharedWithText).toBe('');
  });

  it('should parse shared order and calculate user share', () => {
    const rawOrder: MobileSharedOrder = {
      id: 'ord-2',
      itemName: 'Laptop',
      amount: 1500,
      isShared: true,
      participants: [
        { userId: 'user-1', name: 'Lorenzo', splitAmount: 500, isPaid: false },
        { userId: 'user-2', name: 'John', splitAmount: 500, isPaid: true },
        { userId: 'user-3', name: 'Jane', splitAmount: 500, isPaid: false },
      ],
    };

    const parsed = parseMobileSharedOrder(rawOrder, 'user-1');
    expect(parsed.userShare).toBe(500);
    expect(parsed.sharedWithText).toBe('Shared with John, Jane');
    expect(parsed.activeParticipants.length).toBe(3);
  });

  it('should fallback gracefully if user is not a participant', () => {
    const rawOrder: MobileSharedOrder = {
      id: 'ord-2',
      itemName: 'Laptop',
      amount: 1500,
      isShared: true,
      participants: [
        { userId: 'user-2', name: 'John', splitAmount: 750, isPaid: true },
        { userId: 'user-3', name: 'Jane', splitAmount: 750, isPaid: false },
      ],
    };

    const parsed = parseMobileSharedOrder(rawOrder, 'user-1');
    expect(parsed.userShare).toBe(0);
  });
});
