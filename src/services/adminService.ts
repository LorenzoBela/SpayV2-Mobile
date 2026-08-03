import { DeviceEventEmitter } from 'react-native';
import { supabase } from '../utils/supabase';
import { trpcVanillaClient } from '../utils/trpc';
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

export const ADMIN_QUERY_OPTIONS = {
  staleTime: 5 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
};

export const callAdminApi = async (action: string, bodyData: any = {}) => {
  DeviceEventEmitter.emit('progress-start', action);
  try {
    const isQueryAction = action.startsWith('fetch-') || action.startsWith('get-');
    let result: any;
    if (isQueryAction && (trpcVanillaClient.admin as any).dispatch?.query) {
      result = await (trpcVanillaClient.admin as any).dispatch.query({
        action,
        ...bodyData,
      });
    } else {
      result = await (trpcVanillaClient.admin as any).dispatch.mutate({
        action,
        ...bodyData,
      });
    }
    return result;
  } catch (trpcError) {
    console.warn(`[adminService] tRPC failed for action ${action}, falling back to REST:`, trpcError);
    
    // 2. Fallback to original REST logic
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
      console.error(`[adminService] REST fallback error running action ${action}:`, error);
      return { success: false, error: error?.message || 'Network error executing request.' };
    }
  } finally {
    DeviceEventEmitter.emit('progress-finish', action);
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
    // 1. Try tRPC query
    const csvContent = await (trpcVanillaClient.admin as any).exportReport.query({
      allTime: filters.allTime,
      startYear: filters.startYear,
      startMonth: filters.startMonth,
      endYear: filters.endYear,
      endMonth: filters.endMonth,
    });
    return { success: true, csv: csvContent };
  } catch (trpcError) {
    console.warn('[adminService] tRPC ledger export failed, falling back to REST:', trpcError);
    
    // 2. Fallback to REST
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

export const triggerNotificationScheduler = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const apiUrl = getApiUrl();

    const response = await fetch(`${apiUrl}/api/notifications/scheduler`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result?.error || `Server returned status ${response.status}`);
    }
    return result;
  } catch (error: any) {
    console.error('[adminService] Error triggering notification scheduler:', error);
    return { success: false, error: error?.message || 'Failed to trigger scheduler.' };
  }
};
