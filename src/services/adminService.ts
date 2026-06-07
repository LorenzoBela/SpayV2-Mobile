import { supabase } from '../utils/supabase';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  clearNotification,
} from './notificationService';

const getApiUrl = () => {
  const url = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (url) return url.replace(/\/$/, '');
  return 'https://nootspaytracker.vercel.app';
};

export const callAdminApi = async (action: string, bodyData: any = {}) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const apiUrl = getApiUrl();

    const response = await fetch(`${apiUrl}/api/admin/actions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        action,
        ...bodyData,
      }),
    });

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error(`[adminService] Error running action ${action}:`, error);
    return { success: false, error: error?.message || 'Network error executing request.' };
  }
};

export const getExportLedgerCsv = async (filters: {
  allTime: boolean;
  startYear?: number;
  startMonth?: number;
  endYear?: number;
  endMonth?: number;
}) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const apiUrl = getApiUrl();

    let queryParams = `?allTime=${filters.allTime}`;
    if (!filters.allTime && filters.startYear) {
      queryParams += `&startYear=${filters.startYear}&startMonth=${filters.startMonth}&endYear=${filters.endYear}&endMonth=${filters.endMonth}`;
    }

    const response = await fetch(`${apiUrl}/api/admin/reports/export${queryParams}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }

    const csvContent = await response.text();
    return { success: true, csv: csvContent };
  } catch (error: any) {
    console.error('[adminService] Error fetching ledger CSV:', error);
    return { success: false, error: error?.message || 'Failed to download report ledger CSV.' };
  }
};

// Database Query functions for high fidelity statistics rendering
export const fetchAllAdminData = async () => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const now = new Date();

    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);

    const today = new Date();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    const endOfNextWeek = new Date(endOfWeek);
    endOfNextWeek.setDate(endOfWeek.getDate() + 7);

    // Fetch from Supabase
    // 1. Profiles (role = CLIENT or ADMIN)
    const { data: profiles, error: pErr } = await supabase
      .from('admin_profiles_view')
      .select('id, name, email, mobile_number, created_at, role, avatar_url')
      .in('role', ['CLIENT', 'ADMIN']);

    if (pErr) throw pErr;

    // 2. Account Limits
    const { data: accountLimits, error: alErr } = await supabase
      .from('account_limits')
      .select('user_id, credit_limit');

    if (alErr) throw alErr;

    // 3. Orders
    const { data: orders, error: oErr } = await supabase
      .from('orders')
      .select('id, user_id, item_name, amount, installment_months, order_date, is_paid, remarks')
      .order('order_date', { ascending: false });

    if (oErr) throw oErr;

    // 4. Payments
    const { data: payments, error: payErr } = await supabase
      .from('payments')
      .select('id, order_id, due_date, amount_due, is_paid, payment_date, proof_of_payment, month_number')
      .order('due_date', { ascending: true });

    if (payErr) throw payErr;

    // 5. Reminder Logs
    const { data: reminderLogs, error: rErr } = await supabase
      .from('reminder_logs')
      .select('id, payment_id, sent_at, sent_by_id, days_before, automated')
      .order('sent_at', { ascending: false });

    if (rErr) throw rErr;

    // 6. Reschedule Requests
    const { data: reschedules, error: resErr } = await supabase
      .from('payment_reschedule_history')
      .select('id, payment_id, old_due_date, new_due_date, reason, updated_by_id, admin_approved, created_at')
      .order('created_at', { ascending: false });

    if (resErr) throw resErr;

    // 7. Payment Logs (web parity)
    const { data: paymentLogs, error: plErr } = await supabase
      .from('payment_logs')
      .select('id, payment_id, action_type, action_description, performed_by_id, performed_at, old_values, new_values, ip_address, user_agent')
      .order('performed_at', { ascending: false })
      .limit(50);

    if (plErr) throw plErr;

    return {
      success: true,
      profiles: profiles || [],
      accountLimits: accountLimits || [],
      orders: orders || [],
      payments: payments || [],
      reminderLogs: reminderLogs || [],
      reschedules: reschedules || [],
      paymentLogs: paymentLogs || [],
    };
  } catch (error: any) {
    console.error('[adminService] Error fetching all admin DB logs:', error);
    return { success: false, error: error?.message || 'Database query error.' };
  }
};

export const fetchAdminDashboardData = async () => {
  try {
    const response = await callAdminApi('fetch-admin-dashboard');
    return response;
  } catch (error: any) {
    console.error('[adminService] Error in fetchAdminDashboardData:', error);
    return { success: false, error: error?.message || 'Network error.' };
  }
};

export const fetchAdminPayments = async (filters: { page?: number; pageSize?: number; searchQuery?: string; ledgerFilter?: string }) => {
  try {
    const response = await callAdminApi('fetch-admin-payments', filters);
    return response;
  } catch (error: any) {
    console.error('[adminService] Error in fetchAdminPayments:', error);
    return { success: false, error: error?.message || 'Network error.' };
  }
};

export const fetchAdminOrders = async (filters: { page?: number; pageSize?: number; searchQuery?: string; status?: string; filterMonthKey?: string }) => {
  try {
    const response = await callAdminApi('fetch-admin-orders', filters);
    return response;
  } catch (error: any) {
    console.error('[adminService] Error in fetchAdminOrders:', error);
    return { success: false, error: error?.message || 'Network error.' };
  }
};

export const fetchAdminClients = async (filters: { page?: number; pageSize?: number; searchQuery?: string; status?: string }) => {
  try {
    const response = await callAdminApi('fetch-admin-clients', filters);
    return response;
  } catch (error: any) {
    console.error('[adminService] Error in fetchAdminClients:', error);
    return { success: false, error: error?.message || 'Network error.' };
  }
};

export const fetchAdminReports = async (filters: { startYear?: number; startMonth?: number; endYear?: number; endMonth?: number; allTime?: boolean }) => {
  try {
    const response = await callAdminApi('fetch-admin-reports', filters);
    return response;
  } catch (error: any) {
    console.error('[adminService] Error in fetchAdminReports:', error);
    return { success: false, error: error?.message || 'Network error.' };
  }
};

export const fetchAdminReminders = async () => {
  try {
    const response = await callAdminApi('fetch-admin-reminders');
    return response;
  } catch (error: any) {
    console.error('[adminService] Error in fetchAdminReminders:', error);
    return { success: false, error: error?.message || 'Network error.' };
  }
};

export const getNotifications = async (limit = 100) => {
  try {
    const notifications = await fetchNotifications(limit);
    return {
      notifications: notifications.map((notification) => ({
        id: notification.id,
        title: notification.title,
        body: notification.body,
        type: notification.type,
        category: notification.category,
        priority: notification.priority,
        data: notification.data,
        read: Boolean(notification.read_at),
        readAt: notification.read_at,
        createdAt: notification.created_at,
      })),
      unreadCount: notifications.filter((notification) => !notification.read_at).length,
    };
  } catch (error: any) {
    console.error('[adminService] Error fetching notifications:', error);
    return { success: false, error: error?.message || 'Failed to fetch notifications.' };
  }
};

export const markNotificationsRead = async (notificationId?: string, all = false) => {
  try {
    if (all) {
      await markAllNotificationsRead();
      return { success: true };
    }

    if (!notificationId) {
      throw new Error('notificationId is required');
    }

    await markNotificationRead(notificationId);
    return { success: true };
  } catch (error: any) {
    console.error('[adminService] Error marking notifications read:', error);
    return { success: false, error: error?.message || 'Failed to mark notifications read.' };
  }
};

export const clearNotifications = async (notificationId?: string, all = false) => {
  try {
    if (all) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: true, deletedCount: 0 };

      const { count, error } = await supabase
        .from('notifications')
        .delete({ count: 'exact' })
        .eq('user_id', user.id);

      if (error) throw error;
      return { success: true, deletedCount: count || 0 };
    }

    if (!notificationId) {
      throw new Error('notificationId is required');
    }

    await clearNotification(notificationId);
    return { success: true };
  } catch (error: any) {
    console.error('[adminService] Error clearing notifications:', error);
    return { success: false, error: error?.message || 'Failed to clear notifications.' };
  }
};

export const sendAdminAnnouncement = async (title: string, body: string, target: string, category: string) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const apiUrl = getApiUrl();

    const response = await fetch(`${apiUrl}/api/notifications/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        source: 'admin-announcement',
        idempotencyKey: `announcement:${Date.now()}`,
        eventType: category === 'ADS' ? 'AD_ANNOUNCEMENT' : 'CUSTOM_ANNOUNCEMENT',
        payload: {
          title,
          body,
          target,
        },
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result?.error || `Server returned status ${response.status}`);
    }

    return result;
  } catch (error: any) {
    console.error('[adminService] Error sending announcement:', error);
    return { success: false, error: error?.message || 'Failed to send announcement.' };
  }
};
