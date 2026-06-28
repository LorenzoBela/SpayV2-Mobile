import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { getLinkedProfileForCurrentUser } from '../utils/authProfile';
import { parseUtcDate } from '../utils/date';

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
}

export function useClientOrdersQuery() {
  return useQuery<OrdersData, Error>({
    queryKey: ['client-orders'],
    queryFn: async () => {
      const { user, profileId } = await getLinkedProfileForCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // 1. Fetch orders where user is owner or participant
      const [ownedResult, participantResult] = await Promise.all([
        supabase
          .from('orders')
          .select('id, item_name, amount, installment_months, order_date, remarks, is_paid, is_shared, user_id')
          .eq('user_id', profileId),
        supabase
          .from('order_participants')
          .select('order_id')
          .eq('user_id', profileId)
      ]);

      if (ownedResult.error) throw ownedResult.error;
      if (participantResult.error) throw participantResult.error;

      const ownedOrders = ownedResult.data || [];
      const participantOrderIds = (participantResult.data || []).map(p => p.order_id);

      // Fetch the actual orders for those participant IDs the user doesn't already own
      const missingOrderIds = participantOrderIds.filter(id => !ownedOrders.some(o => o.id === id));
      let participantOrders: any[] = [];
      if (missingOrderIds.length > 0) {
        const { data: partOrders, error: partOrdersErr } = await supabase
          .from('orders')
          .select('id, item_name, amount, installment_months, order_date, remarks, is_paid, is_shared, user_id')
          .in('id', missingOrderIds);
        if (partOrdersErr) throw partOrdersErr;
        participantOrders = partOrders || [];
      }

      const allOrders = [...ownedOrders, ...participantOrders].sort(
        (a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
      );

      if (allOrders.length === 0) {
        return {
          orders: [],
          analytics: { totalOrders: 0, totalSpent: 0, paymentStreak: 0, onTimeRate: 100 },
        };
      }

      const orderIds = allOrders.map((o) => o.id);

      // Fetch all payments for those orders
      const { data: paymentsData, error: paymentsErr } = await supabase
        .from('payments')
        .select('id, order_id, month_number, amount_due, due_date, is_paid, payment_date')
        .in('order_id', orderIds)
        .order('month_number', { ascending: true });

      if (paymentsErr) throw paymentsErr;

      const orderPaymentsMap = new Map<string, any[]>();
      (paymentsData || []).forEach((p) => {
        const list = orderPaymentsMap.get(p.order_id) || [];
        list.push(p);
        orderPaymentsMap.set(p.order_id, list);
      });

      // Fetch participants for these orders
      const { data: dbParticipants, error: participantsErr } = await supabase
        .from('order_participants')
        .select(`
          id,
          order_id,
          user_id,
          split_amount,
          is_paid,
          profile:profiles (
            id,
            name,
            email
          )
        `)
        .in('order_id', orderIds);

      if (participantsErr) throw participantsErr;

      // Fetch client's own split payments for shared orders
      const { data: myParticipantPayments, error: myPartPaymentsErr } = await supabase
        .from('order_participant_payments')
        .select(`
          id,
          payment_id,
          amount_due,
          is_paid,
          paid_at,
          participant:order_participants!inner (
            id,
            order_id,
            user_id
          )
        `)
        .eq('participant.user_id', profileId);

      if (myPartPaymentsErr) throw myPartPaymentsErr;

      // Fetch all participant payments for everyone on these orders (to show installment progress)
      const { data: allParticipantPayments, error: allPartPaymentsErr } = await supabase
        .from('order_participant_payments')
        .select(`
          id,
          payment_id,
          is_paid,
          participant:order_participants!inner (
            id,
            order_id,
            user_id
          )
        `)
        .in('participant.order_id', orderIds);

      if (allPartPaymentsErr) throw allPartPaymentsErr;

      const formattedOrders: OrderItem[] = allOrders.map((o) => {
        const orderPayments = orderPaymentsMap.get(o.id) || [];
        const isShared = o.is_shared === true;

        // Find my participant record
        const myPartRecord = dbParticipants?.find(part => part.order_id === o.id && part.user_id === profileId);
        const splitAmount = isShared && myPartRecord ? parseFloat(myPartRecord.split_amount) : parseFloat(o.amount);

        // Format participant list
        const participantsList = (dbParticipants || [])
          .filter(part => part.order_id === o.id)
          .map(part => ({
            id: part.id,
            userId: part.user_id,
            name: (part.profile as any)?.name || 'Unknown Participant',
            email: (part.profile as any)?.email || '',
            splitAmount: parseFloat(part.split_amount),
            isPaid: part.is_paid
          }));

        // Format payments
        const formattedPayments = orderPayments.map((p) => {
          let isPaid = p.is_paid;
          let amountDue = parseFloat(p.amount_due);
          let paymentDate = p.payment_date;

          if (isShared) {
            // Find my specific split payment
            const mySplitPay = myParticipantPayments?.find(mp => mp.payment_id === p.id);
            if (mySplitPay) {
              isPaid = mySplitPay.is_paid;
              amountDue = parseFloat(mySplitPay.amount_due);
              paymentDate = mySplitPay.paid_at;
            }
          }

          // Calculate installment progress
          const installmentSplits = allParticipantPayments?.filter(ap => ap.payment_id === p.id) || [];
          const participantPaidCount = installmentSplits.filter(ap => ap.is_paid).length;
          const participantTotalCount = installmentSplits.length;

          return {
            id: p.id,
            monthNumber: p.month_number,
            amountDue,
            dueDate: p.due_date,
            isPaid,
            paymentDate,
            participantPaidCount: isShared ? participantPaidCount : undefined,
            participantTotalCount: isShared ? participantTotalCount : undefined,
          };
        });

        const paidCount = formattedPayments.filter((p) => p.isPaid).length;
        const progressPercent = o.installment_months > 0 ? (paidCount / o.installment_months) * 100 : 0;
        const isOrderPaid = isShared ? (myPartRecord?.is_paid ?? false) : o.is_paid;

        return {
          id: o.id,
          itemName: o.item_name,
          amount: splitAmount, // Reflect split amount for shared, total amount for personal
          installmentMonths: parseInt(o.installment_months, 10),
          orderDate: o.order_date,
          remarks: o.remarks,
          isPaid: isOrderPaid,
          paidInstallments: paidCount,
          progressPercent,
          payments: formattedPayments,
          isShared,
          splitAmount: isShared ? splitAmount : undefined,
          participants: isShared ? participantsList : undefined,
          userId: o.user_id
        };
      });

      // Calculate total spent
      const totalSpent = formattedOrders.reduce((sum, o) => sum + o.amount, 0);

      // Calculate Streak & On-Time Rate
      const clientInstallments = formattedOrders.flatMap(o =>
        o.payments.map(p => ({
          isPaid: p.isPaid,
          dueDate: p.dueDate,
          paymentDate: p.paymentDate
        }))
      );

      const allPaidInstallments = clientInstallments
        .filter(p => p.isPaid)
        .sort((a, b) => parseUtcDate(b.paymentDate || b.dueDate).getTime() - parseUtcDate(a.paymentDate || a.dueDate).getTime());

      let paymentStreak = 0;
      for (const p of allPaidInstallments) {
        if (p.paymentDate && parseUtcDate(p.paymentDate) <= parseUtcDate(p.dueDate)) {
          paymentStreak++;
        } else {
          break;
        }
      }

      const completedCount = allPaidInstallments.length;
      const onTimeCount = allPaidInstallments.filter(
        p => p.paymentDate && parseUtcDate(p.paymentDate) <= parseUtcDate(p.dueDate)
      ).length;
      const onTimeRate = completedCount > 0 ? Math.round((onTimeCount / completedCount) * 100) : 100;

      return {
        orders: formattedOrders,
        analytics: {
          totalOrders: allOrders.length,
          totalSpent,
          paymentStreak,
          onTimeRate,
        },
        profileId,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useClientPaymentsQuery() {
  return useQuery<ClientPaymentItem[], Error>({
    queryKey: ['client-payments'],
    queryFn: async () => {
      const { user, profileId } = await getLinkedProfileForCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Fetch user orders first to filter payments
      const { data: userOrders, error: ordersErr } = await supabase
        .from('orders')
        .select('id')
        .eq('user_id', profileId);

      if (ordersErr) throw ordersErr;

      if (!userOrders || userOrders.length === 0) {
        return [];
      }

      const orderIds = userOrders.map((o) => o.id);

      // Fetch payments belonging only to those orders
      const { data, error } = await supabase
        .from('payments')
        .select(`
          id,
          due_date,
          amount_due,
          month_number,
          is_paid,
          payment_date,
          proof_of_payment,
          order:orders (
            id,
            item_name,
            installment_months,
            is_shared,
            split_amount
          ),
          payment_reschedule_history (
            id,
            old_due_date,
            new_due_date,
            reason,
            admin_approved,
            created_at
          )
        `)
        .in('order_id', orderIds)
        .order('due_date', { ascending: true });

      if (error) throw error;

      const nowMs = Date.now();

      const formatted: ClientPaymentItem[] = (data || []).map((p: any) => {
        const rescheduleArr: PaymentReschedule[] = (p.payment_reschedule_history || []).map((r: any) => ({
          id: r.id,
          old_due_date: r.old_due_date,
          new_due_date: r.new_due_date,
          reason: r.reason,
          admin_approved: r.admin_approved,
          created_at: r.created_at,
        }));

        const rawDueDate = p.due_date;
        const isPaid = p.is_paid;
        const isOverdue = !isPaid && parseUtcDate(rawDueDate).getTime() < nowMs;

        const isShared = p.order?.is_shared === true;
        const rawSplit = parseFloat(p.order?.split_amount) || 0;
        const finalAmountDue = isShared && rawSplit > 0
          ? rawSplit / (p.order?.installment_months || 1)
          : parseFloat(p.amount_due);

        return {
          id: p.id,
          orderId: p.order?.id || '',
          itemName: p.order?.item_name || 'Installment Order',
          amountDue: parseFloat(p.amount_due),
          monthNumber: p.month_number,
          installmentMonths: p.order?.installment_months || 12,
          dueDate: parseUtcDate(rawDueDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'Asia/Manila',
          }),
          rawDueDate,
          isPaid,
          paymentDate: p.payment_date,
          proofOfPayment: p.proof_of_payment,
          status: isPaid ? 'paid' : isOverdue ? 'overdue' : 'pending',
          rescheduleHistory: rescheduleArr,
          isShared,
        };
      });

      return formatted;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
