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
}

export interface OrdersData {
  orders: OrderItem[];
  analytics: {
    totalOrders: number;
    totalSpent: number;
    paymentStreak: number;
    onTimeRate: number;
  };
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
}

export function useClientOrdersQuery() {
  return useQuery<OrdersData, Error>({
    queryKey: ['client-orders'],
    queryFn: async () => {
      const { user, profileId } = await getLinkedProfileForCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Fetch Orders
      const { data: dbOrders, error: ordersErr } = await supabase
        .from('orders')
        .select('id, item_name, amount, installment_months, order_date, remarks, is_paid')
        .eq('user_id', profileId)
        .order('order_date', { ascending: false });

      if (ordersErr) throw ordersErr;

      if (!dbOrders || dbOrders.length === 0) {
        return {
          orders: [],
          analytics: { totalOrders: 0, totalSpent: 0, paymentStreak: 0, onTimeRate: 100 },
        };
      }

      // Fetch payments for those orders
      const orderIds = dbOrders.map((o) => o.id);
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

      // Calculate Streak & On-Time Rate
      const allPaidPayments = (paymentsData || [])
        .filter((p) => p.is_paid)
        .sort((a, b) => parseUtcDate(b.payment_date || b.due_date).getTime() - parseUtcDate(a.payment_date || a.due_date).getTime());

      let paymentStreak = 0;
      for (const p of allPaidPayments) {
        if (p.payment_date && parseUtcDate(p.payment_date) <= parseUtcDate(p.due_date)) {
          paymentStreak++;
        } else {
          break;
        }
      }

      const completedCount = allPaidPayments.length;
      const onTimeCount = allPaidPayments.filter(
        (p) => p.payment_date && parseUtcDate(p.payment_date) <= parseUtcDate(p.due_date)
      ).length;
      const onTimeRate = completedCount > 0 ? Math.round((onTimeCount / completedCount) * 100) : 100;

      const totalSpent = dbOrders.reduce((sum, o) => sum + parseFloat(o.amount), 0);

      const formattedOrders: OrderItem[] = dbOrders.map((o) => {
        const orderPayments = orderPaymentsMap.get(o.id) || [];
        const paidCount = orderPayments.filter((p) => p.is_paid).length;
        const progressPercent = o.installment_months > 0 ? (paidCount / o.installment_months) * 100 : 0;

        return {
          id: o.id,
          itemName: o.item_name,
          amount: parseFloat(o.amount),
          installmentMonths: parseInt(o.installment_months, 10),
          orderDate: o.order_date,
          remarks: o.remarks,
          isPaid: o.is_paid,
          paidInstallments: paidCount,
          progressPercent,
          payments: orderPayments.map((p) => ({
            id: p.id,
            monthNumber: p.month_number,
            amountDue: parseFloat(p.amount_due),
            dueDate: p.due_date,
            isPaid: p.is_paid,
            paymentDate: p.payment_date,
          })),
        };
      });

      return {
        orders: formattedOrders,
        analytics: {
          totalOrders: dbOrders.length,
          totalSpent,
          paymentStreak,
          onTimeRate,
        },
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
            installment_months
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
        };
      });

      return formatted;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
