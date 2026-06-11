import { NativeModules, Platform } from 'react-native';
import { supabase } from './supabase';
import NetInfo from '@react-native-community/netinfo';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { getLinkedProfileForCurrentUser } from './authProfile';
import { callAdminApi } from '../services/adminService';

dayjs.extend(relativeTime);

const { SpayWidgetModule } = NativeModules;

export async function syncWidgetData() {
  // Guard for platform and module existence
  if (Platform.OS !== 'android' || !SpayWidgetModule) {
    return;
  }

  try {
    const netState = await NetInfo.fetch();
    const isOffline = !netState.isConnected;

    // Check auth session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      SpayWidgetModule.updateWidgetData(JSON.stringify({
        isLoggedIn: false,
        isOffline
      }));
      return;
    }

    // Resolve profile details securely using Google SSO or email identity
    const { profile, profileId } = await getLinkedProfileForCurrentUser();
    if (!profileId) {
      SpayWidgetModule.updateWidgetData(JSON.stringify({
        isLoggedIn: false,
        isOffline
      }));
      return;
    }

    const firstName = profile?.name || session.user.user_metadata?.full_name || 'Premium Member';
    const role = (profile?.role || 'client').toLowerCase();

    // Fetch limits
    const { data: globalStats } = await supabase.rpc('get_global_shared_limits');
    const globalLimit = globalStats && globalStats[0] ? parseFloat(globalStats[0].credit_limit_total) : 250000.0;
    const globalUnpaid = globalStats && globalStats[0] ? parseFloat(globalStats[0].unpaid_amount_total) : 65000.0;
    const globalAvailable = Math.max(0, globalLimit - globalUnpaid);

    // Initial base payload structure
    let payload: any = {
      isLoggedIn: true,
      isOffline,
      firstName,
      role,
      availableCredit: globalAvailable,
      baselineLimit: globalLimit,
    };

    if (role === 'admin') {
      try {
        // Fetch Admin Dashboard & Reminders via Next.js backend API
        const dashboardRes = await callAdminApi('fetch-admin-dashboard');
        const remindersRes = await callAdminApi('fetch-admin-reminders');

        const outstandingCapital = dashboardRes?.stats?.outstandingBalance || 0.0;
        const collectionEfficiency = dashboardRes?.stats?.collectionEfficiency || 0.0;
        const totalExposureCap = dashboardRes?.stats?.activeLimitExposure || 0.0;
        const clientsCount = dashboardRes?.stats?.activeClientsCount || 0;

        // Get total orders count platform-wide
        const { count: ordersCount } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true });

        // Map Admin Countdown timelines
        const adminCycles = (dashboardRes?.unpaidBillingSchedules || []).map((g: any) => {
          const now = new Date();
          const target = g.earliestDueDate ? new Date(g.earliestDueDate) : now;
          const diffMs = target.getTime() - now.getTime();
          
          let days = 0;
          let hours = 0;
          let minutes = 0;
          let seconds = 0;

          if (diffMs > 0) {
            days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
          }

          let pendingReceipts = 0;
          let overdueAccounts = 0;

          if (g.clients) {
            g.clients.forEach((c: any) => {
              if (c.payments) {
                c.payments.forEach((p: any) => {
                  if (!p.isPaid) {
                    if (p.proofOfPayment) pendingReceipts++;
                    if (new Date(p.dueDate).getTime() < now.getTime()) overdueAccounts++;
                  }
                });
              }
            });
          }

          return {
            monthName: g.monthName,
            amountDue: parseFloat(g.totalDue),
            isOverdue: target.getTime() < now.getTime(),
            days,
            hours,
            minutes,
            seconds,
            pendingReceipts,
            pendingApprovals: remindersRes?.stats?.total || 0,
            overdueAccounts
          };
        });

        // Map Admin Critical Reminders
        const adminReminders: any[] = [];
        const overdueCount = remindersRes?.stats?.overdue || 0;
        const dueSoonCount = remindersRes?.stats?.dueSoon || 0;

        if (overdueCount > 0) {
          adminReminders.push({
            title: 'Overdue Collections',
            body: `${overdueCount} client payments are overdue.`,
            priority: 'high'
          });
        }
        if (dueSoonCount > 0) {
          adminReminders.push({
            title: 'Dues Approaching',
            body: `${dueSoonCount} client payments due within 7 days.`,
            priority: 'medium'
          });
        }
        adminReminders.push({
          title: 'System Inflows Info',
          body: `Platform collection efficiency is currently at ${collectionEfficiency}%.`,
          priority: 'low'
        });

        // Map Admin Audit Logs (recent system activities)
        const adminAuditLogs = (dashboardRes?.activities || []).slice(0, 3).map((act: any) => {
          const formattedAmount = `₱${parseFloat(act.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          return {
            message: act.type === 'order' 
              ? `${act.name} ordered ${act.detail} (${formattedAmount})`
              : `${act.name} paid ${formattedAmount} for ${act.detail.replace('Payment for Order: ', '')}`,
            time: dayjs(act.createdAt).fromNow()
          };
        });

        payload = {
          ...payload,
          outstandingCapital,
          collectionEfficiency,
          totalExposureCap,
          clientsCount,
          ordersCount: ordersCount || 0,
          globalCollectionRate: collectionEfficiency,
          adminCycles,
          adminReminders,
          adminAuditLogs
        };
      } catch (err) {
        console.error('[widgetSync] Error fetching admin dashboard details:', err);
      }
    } else {
      // Client specific queries
      try {
        const { data: dbOrders } = await supabase
          .from('orders')
          .select('id, item_name, amount, installment_months, order_date, is_paid')
          .eq('user_id', profileId);

        let billingCycles: any[] = [];
        let upcomingInstallments: any[] = [];
        let recentTransactions: any[] = [];
        let repaymentStreak = 0;
        let creditHealthScore = 85;
        let healthTier = 'Bronze';
        let hasOverdue = false;
        let nextDueDate: string | null = null;

        if (dbOrders && dbOrders.length > 0) {
          const orderIds = dbOrders.map(o => o.id);
          const { data: dbPayments } = await supabase
            .from('payments')
            .select('id, order_id, due_date, amount_due, is_paid, payment_date, month_number')
            .in('order_id', orderIds)
            .order('due_date', { ascending: true });

          if (dbPayments && dbPayments.length > 0) {
            const ordersMap = new Map();
            dbOrders.forEach(o => ordersMap.set(o.id, o));

            // Group unpaid payments by billing month
            const unpaidGroups = new Map<string, any>();
            
            dbPayments.forEach(p => {
              if (!p.is_paid) {
                const date = new Date(p.due_date);
                const monthKey = dayjs(date).format('MMMM YYYY');
                const order = ordersMap.get(p.order_id);
                
                if (!unpaidGroups.has(monthKey)) {
                  unpaidGroups.set(monthKey, {
                    monthName: monthKey,
                    amountDue: 0.0,
                    isOverdue: date.getTime() < Date.now(),
                    dueDate: p.due_date,
                    items: []
                  });
                }

                const group = unpaidGroups.get(monthKey);
                group.amountDue += parseFloat(p.amount_due);
                if (date.getTime() < Date.now()) {
                  group.isOverdue = true;
                  hasOverdue = true;
                }
                if (group.items.length < 3) {
                  group.items.push({
                    desc: order?.item_name || 'Installment Payment',
                    amount: parseFloat(p.amount_due)
                  });
                }
              }
            });

            const sortedGroups = Array.from(unpaidGroups.values()).sort((a, b) => {
              return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            });

            billingCycles = sortedGroups.map(g => {
              const now = new Date();
              const target = new Date(g.dueDate);
              const diffMs = target.getTime() - now.getTime();
              
              let days = 0;
              let hours = 0;
              let minutes = 0;
              let seconds = 0;

              if (diffMs > 0) {
                days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
              }

              if (!nextDueDate) {
                nextDueDate = g.monthName;
              }

              return {
                monthName: g.monthName,
                amountDue: g.amountDue,
                isOverdue: g.isOverdue,
                days,
                hours,
                minutes,
                seconds,
                items: g.items
              };
            });

            // Map Upcoming Installments (first 3 unpaid installments)
            const unpaidList = dbPayments.filter(p => !p.is_paid).slice(0, 3);
            upcomingInstallments = unpaidList.map(inst => {
              const order = ordersMap.get(inst.order_id);
              const dueDate = new Date(inst.due_date);
              const now = new Date();
              const isOverdue = dueDate.getTime() < now.getTime();
              const diffMs = Math.abs(dueDate.getTime() - now.getTime());
              const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
              const dueInfo = isOverdue 
                ? `Overdue by ${diffDays} day${diffDays > 1 ? 's' : ''}` 
                : `Due in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
              
              return {
                desc: order?.item_name || 'Installment Payment',
                dueInfo,
                amount: parseFloat(inst.amount_due),
                isOverdue
              };
            });

            // Map Recent Transactions (last 3 paid payments)
            const paidList = dbPayments
              .filter(p => p.is_paid)
              .sort((a, b) => new Date(b.payment_date || b.due_date).getTime() - new Date(a.payment_date || a.due_date).getTime())
              .slice(0, 3);

            recentTransactions = paidList.map(tx => {
              const order = ordersMap.get(tx.order_id);
              const dateText = tx.payment_date 
                ? dayjs(tx.payment_date).format('MMM DD') 
                : dayjs(tx.due_date).format('MMM DD');
              return {
                date: dateText,
                desc: order?.item_name || 'Repayment',
                amount: parseFloat(tx.amount_due),
                status: 'Verified'
              };
            });

            // Compute Streak & On-Time Rate
            const allPaidPayments = dbPayments
              .filter(p => p.is_paid)
              .sort((a, b) => new Date(b.payment_date || b.due_date).getTime() - new Date(a.payment_date || a.due_date).getTime());

            for (const p of allPaidPayments) {
              if (p.payment_date && new Date(p.payment_date) <= new Date(p.due_date)) {
                repaymentStreak++;
              } else {
                break;
              }
            }

            const completedCount = allPaidPayments.length;
            const onTimeCount = allPaidPayments.filter(
              p => p.payment_date && new Date(p.payment_date) <= new Date(p.due_date)
            ).length;
            const onTimeRate = completedCount > 0 ? (onTimeCount / completedCount) * 100 : 100;
            
            creditHealthScore = Math.min(100, Math.round(50 + (onTimeRate * 0.4) + Math.min(repaymentStreak, 10)));
            
            if (creditHealthScore >= 95) healthTier = 'Diamond';
            else if (creditHealthScore >= 88) healthTier = 'Platinum';
            else if (creditHealthScore >= 75) healthTier = 'Gold';
            else if (creditHealthScore >= 60) healthTier = 'Silver';
            else healthTier = 'Bronze';
          }
        }

        // Fetch unread notifications for the client
        const { data: dbNotifications } = await supabase
          .from('notifications')
          .select('title, body, created_at, read_at')
          .eq('user_id', profileId)
          .order('created_at', { ascending: false })
          .limit(3);

        const unreadCount = (dbNotifications || []).filter(n => !n.read_at).length;
        const notifications = (dbNotifications || []).map(n => ({
          title: n.title || 'Notification',
          body: n.body || '',
          time: dayjs(n.created_at).fromNow()
        }));

        // Mascot dynamic prompt recommendations
        let nootPrompt = 'All accounts caught up. Have an amazing day!';
        if (isOffline) {
          nootPrompt = 'Offline: Showing cached balances. Check internet connection.';
        } else if (hasOverdue) {
          nootPrompt = 'Overdue Alert! Settle your outstanding bills to avoid score drops.';
        } else if (globalAvailable < globalLimit * 0.15) {
          nootPrompt = 'Limit Alert: Available credit is low. Manage budgets to stay safe!';
        } else if (billingCycles.length > 0 && nextDueDate) {
          nootPrompt = `Reminder: Next bill is due in ${nextDueDate}. Tap here to pay now!`;
        }

        payload = {
          ...payload,
          nootPrompt,
          billingCycles,
          recentTransactions,
          creditHealthScore,
          repaymentStreak,
          healthTier,
          upcomingInstallments,
          unreadCount,
          notifications
        };
      } catch (err) {
        console.error('[widgetSync] Error fetching client database details:', err);
      }
    }

    // Push JSON payload into native android widget module
    SpayWidgetModule.updateWidgetData(JSON.stringify(payload));
  } catch (error) {
    console.error('[widgetSync] Error syncing widget data:', error);
  }
}
