import { trpc } from '../utils/trpc';

// --- ORDERS HOOK INTERFACES ---
export interface OrderPaymentItem {
  id: string;
  monthNumber: number;
  amountDue: number;
  dueDate: string;
  isPaid: boolean;
  paymentDate: string | null;
  participantPaidCount?: number;
  participantTotalCount?: number;
}

export interface OrderItem {
  id: string;
  itemName: string;
  amount: number;
  installmentMonths: number;
  orderDate: string;
  remarks: string | null;
  isPaid: boolean;
  paidInstallments: number;
  progressPercent: number;
  payments: OrderPaymentItem[];
  isShared?: boolean;
  splitAmount?: number;
  participants?: {
    id: string;
    userId: string;
    name: string;
    email: string;
    splitAmount: number;
    isPaid: boolean;
  }[];
  userId?: string;
}

export interface OrdersData {
  orders: OrderItem[];
  analytics: {
    totalOrders: number;
    totalSpent: number;
    paymentStreak: number;
    onTimeRate: number;
  };
  profileId?: string;
}

// --- PAYMENTS HOOK INTERFACES ---
export interface PaymentReschedule {
  id: string;
  old_due_date: string;
  new_due_date: string;
  reason: string | null;
  admin_approved: boolean;
  created_at: string;
}

export interface ClientPaymentItem {
  id: string;
  orderId: string;
  itemName: string;
  installmentMonths: number;
  monthNumber: number;
  amountDue: number;
  dueDate: string;
  rawDueDate: string;
  isPaid: boolean;
  paymentDate: string | null;
  proofOfPayment: string | null;
  status: 'paid' | 'overdue' | 'pending';
  rescheduleHistory: PaymentReschedule[];
  isShared?: boolean;
  sharingProgress?: Array<{
    name: string;
    email: string;
    splitAmount?: number;
    amountDue: number;
    isPaid: boolean;
  }>;
}

export function useClientOrdersQuery() {
  // Query orders.list router
  return trpc.orders.list.useQuery();
}

export function useClientPaymentsQuery() {
  // Query payments.listClient and transform to ClientPaymentItem[] to maintain compatibility
  return trpc.payments.listClient.useQuery(undefined, {
    select: (data): ClientPaymentItem[] => {
      return (data?.payments || []).map((p: any) => ({
        id: p.id,
        orderId: p.orderId,
        itemName: p.itemName,
        installmentMonths: p.installmentMonths,
        monthNumber: p.monthNumber,
        amountDue: p.amountDue,
        dueDate: new Date(p.dueDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'Asia/Manila',
        }),
        rawDueDate: p.dueDate,
        isPaid: p.isPaid,
        paymentDate: p.paymentDate,
        proofOfPayment: p.proofOfPayment || null,
        status: p.status,
        rescheduleHistory: (p.rescheduleHistory || []).map((r: any) => ({
          id: r.id,
          old_due_date: r.oldDueDate,
          new_due_date: r.newDueDate,
          reason: r.reason,
          admin_approved: r.adminApproved,
          created_at: r.createdAt,
        })),
        isShared: p.isShared,
        sharingProgress: p.sharingProgress,
      }));
    },
  });
}
