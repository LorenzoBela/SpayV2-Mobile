import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../utils/supabase';

export type DynamicIslandNotificationType =
  | 'payment'
  | 'overdue_alert'
  | 'payment_success'
  | 'order_assigned'
  | 'sync'
  | 'cashback'
  | 'shared_payment'
  | 'payment_streak'
  | 'debt_free'
  | 'noot_savings'
  | 'limit_increase'
  | 'low_balance'
  | 'zero_interest'
  | 'biometric_auth'
  | 'offline_queue'
  | 'ota_update'
  | 'admin_impersonation'
  | 'admin_client_payment'
  | 'admin_risk_alert'
  | 'admin_reminder_sent'
  | 'promo_ad';

export interface DynamicIslandNotificationPayload {
  id: string;
  type: DynamicIslandNotificationType;
  title: string;
  subtitle?: string;
  amount?: string;
  compactText?: string;
  compactBadge?: string;
  detailLeft?: string;
  detailRight?: string;
  actionText?: string;
  onAction?: () => void;
  hasProgress?: boolean;
  progressPct?: number;
  durationMs?: number;
  isDualEvent?: boolean;
}

interface DynamicIslandContextType {
  activeNotification: DynamicIslandNotificationPayload | null;
  secondaryNotification: DynamicIslandNotificationPayload | null;
  isExpanded: boolean;
  triggerIsland: (payload: DynamicIslandNotificationPayload) => void;
  dismissIsland: () => void;
  toggleExpand: () => void;
  setSecondaryEvent: (payload: DynamicIslandNotificationPayload | null) => void;
}

const DynamicIslandContext = createContext<DynamicIslandContextType>({
  activeNotification: null,
  secondaryNotification: null,
  isExpanded: false,
  triggerIsland: () => {},
  dismissIsland: () => {},
  toggleExpand: () => {},
  setSecondaryEvent: () => {},
});

export const useDynamicIsland = () => useContext(DynamicIslandContext);

export const DynamicIslandProvider: React.FC<{ children: React.ReactNode; userId?: string; userRole?: string }> = ({
  children,
  userId,
  userRole,
}) => {
  // Start NULL so zero static pills block the dashboard when idle
  const [activeNotification, setActiveNotification] = useState<DynamicIslandNotificationPayload | null>(null);
  const [secondaryNotification, setSecondaryNotification] = useState<DynamicIslandNotificationPayload | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = () => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  };

  const dismissIsland = useCallback(() => {
    clearTimer();
    setIsExpanded(false);
    setActiveNotification(null); // Fully vanishes into notch
  }, []);

  const triggerIsland = useCallback(
    (payload: DynamicIslandNotificationPayload) => {
      clearTimer();
      setActiveNotification(payload);
      setIsExpanded(false);

      // Auto-dismiss lifecycle after durationMs (default 6500ms)
      const duration = payload.durationMs || 6500;
      dismissTimerRef.current = setTimeout(() => {
        dismissIsland();
      }, duration);
    },
    [dismissIsland]
  );

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Supabase Realtime Listener for raw DB mutations
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`realtime:dynamic_island:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'payments' },
        (payload: any) => {
          const row = payload.new;
          if (row) {
            triggerIsland({
              id: `pay_${row.id || Date.now()}`,
              type: 'payment_success',
              title: userRole === 'ADMIN' || userRole === 'admin' ? `Client Payment Received` : `Payment Successful!`,
              subtitle: `Ref: ${row.payment_reference || 'SPAY-PAY-X'}`,
              amount: row.amount_paid ? `₱${Number(row.amount_paid).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '₱0.00',
              compactText: userRole === 'ADMIN' || userRole === 'admin' ? `Client Payment` : `Payment Settled`,
              compactBadge: 'Settled ✓',
              detailLeft: 'Transaction Complete',
              detailRight: 'Receipt Saved ✓',
              actionText: 'View Receipt',
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'spay_billing_statements' },
        (payload: any) => {
          const row = payload.new;
          if (row && row.status === 'OVERDUE') {
            triggerIsland({
              id: `overdue_${row.id}`,
              type: 'overdue_alert',
              title: userRole === 'ADMIN' || userRole === 'admin' ? `HIGH RISK: Account Overdue` : `OVERDUE BILL ALERT`,
              subtitle: `Past Due by ${row.days_overdue || 1} Days`,
              amount: row.total_amount_due ? `₱${Number(row.total_amount_due).toLocaleString('en-PH')}` : '₱0.00',
              compactText: `OVERDUE Statement`,
              compactBadge: 'Urgent',
              detailLeft: 'Avoid Late Fees',
              detailRight: 'Action Req',
              actionText: 'Settle Bill Immediately',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, userRole, triggerIsland]);

  return (
    <DynamicIslandContext.Provider
      value={{
        activeNotification,
        secondaryNotification,
        isExpanded,
        triggerIsland,
        dismissIsland,
        toggleExpand,
        setSecondaryEvent: setSecondaryNotification,
      }}
    >
      {children}
    </DynamicIslandContext.Provider>
  );
};
