import { DeviceEventEmitter } from 'react-native';
import { supabase } from '../utils/supabase';
import * as authProfileNamespace from '../utils/authProfile';
import { getTrpcHeaders, trpcVanillaClient } from '../utils/trpc';
import { SPLIT_READER_HEADERS } from '../utils/split-reader-contract';
import { withDeadline } from '../utils/networkResilience';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  clearNotification,
} from './notificationService';

const ADMIN_REST_TIMEOUT_MS = 8000;
const adminFailureCauses = new WeakMap<object, unknown>();

function createAbortError(message = 'Aborted'): Error {
  const err = new Error(message);
  err.name = 'AbortError';
  return err;
}

function shouldSkipRestFallback(err: unknown, externalSignal?: AbortSignal): boolean {
  if (externalSignal?.aborted) return true;
  if (!err || typeof err !== 'object') return false;
  const record = err as Record<string, any>;
  const cause = record.cause as Record<string, any> | undefined;
  const name = record.name;
  const causeName = cause?.name;
  if (
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    causeName === 'AbortError' ||
    causeName === 'TimeoutError'
  ) {
    return true;
  }
  const status =
    record.data?.httpStatus ??
    record.status ??
    record.statusCode ??
    record.response?.status ??
    cause?.status;
  if (status === 401 || status === 403 || status === 426) {
    return true;
  }
  const trpcCode = record.data?.code;
  if (trpcCode === 'UNAUTHORIZED' || trpcCode === 'FORBIDDEN') {
    return true;
  }
  const msg = typeof record.message === 'string' ? record.message : '';
  return msg.includes('SPLIT_READER_UPGRADE_REQUIRED');
}

function recordFailureCause<T extends { success: false; error: string; code?: string }>(
  payload: T,
  cause: unknown,
): T {
  if (cause !== undefined) {
    adminFailureCauses.set(payload, cause);
  }
  return payload;
}

const getApiUrl = () => {
  const url = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (url) return url.replace(/\/$/, '');
  return 'https://nootspaytracker.vercel.app';
};

export async function fetchOrderItemSuggestions(
  query: string, token: string, signal: AbortSignal,
): Promise<string[] | undefined> {
  const headers = await getTrpcHeaders();
  if (signal.aborted || headers.Authorization !== `Bearer ${token}`) return;

  const response = await fetch(`${getApiUrl()}/api/admin/orders/item-suggestions`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal,
  });
  if (!response.ok) return;
  const { names } = await response.json() as { names: string[] };
  return names;
}

export const ADMIN_QUERY_OPTIONS = {
  staleTime: 5 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
};

export const adminClientsQueryOptions = (
  filters: { page?: number; pageSize?: number; searchQuery?: string; status?: string } = {},
) => {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 6;
  const searchQuery = filters.searchQuery ?? '';
  const status = filters.status ?? 'all';
  return {
    queryKey: ['admin-clients', page, searchQuery, status] as const,
    queryFn: ({ signal }: { signal?: AbortSignal }) =>
      fetchAdminActionOrThrow<Record<string, any>>(
        'fetch-admin-clients',
        { page, pageSize, searchQuery, status },
        signal,
      ),
    ...ADMIN_QUERY_OPTIONS,
  };
};

export const adminOrdersQueryOptions = (
  filters: { page?: number; pageSize?: number; searchQuery?: string; status?: string; filterMonthKey?: string | null } = {},
) => {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 6;
  const searchQuery = filters.searchQuery ?? '';
  const status = filters.status ?? 'all';
  const filterMonthKey = filters.filterMonthKey ?? null;
  return {
    queryKey: ['admin-orders', 'monthly-shares-v1', page, searchQuery, status, filterMonthKey] as const,
    queryFn: ({ signal }: { signal?: AbortSignal }) =>
      fetchAdminActionOrThrow<Record<string, any>>(
        'fetch-admin-orders',
        { page, pageSize, searchQuery, status, filterMonthKey: filterMonthKey || undefined },
        signal,
      ),
    ...ADMIN_QUERY_OPTIONS,
  };
};

export const adminPaymentsQueryOptions = (
  filters: { page?: number; pageSize?: number; searchQuery?: string; ledgerFilter?: string } = {},
) => {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 8;
  const searchQuery = filters.searchQuery ?? '';
  const ledgerFilter = filters.ledgerFilter ?? 'all';
  return {
    queryKey: ['admin-payments', page, searchQuery, ledgerFilter] as const,
    queryFn: ({ signal }: { signal?: AbortSignal }) =>
      fetchAdminActionOrThrow<Record<string, any>>(
        'fetch-admin-payments',
        { page, pageSize, searchQuery, ledgerFilter },
        signal,
      ),
    ...ADMIN_QUERY_OPTIONS,
  };
};

export const callAdminApi = async (
  action: string,
  bodyData: any = {},
  opts?: { signal?: AbortSignal; timeoutMs?: number },
) => {
  const signal = opts?.signal;
  const restTimeoutMs = opts?.timeoutMs ?? ADMIN_REST_TIMEOUT_MS;
  if (signal?.aborted) {
    return recordFailureCause(
      { success: false, error: 'Request aborted.' },
      createAbortError(
        typeof signal.reason === 'string' ? signal.reason : undefined,
      ),
    );
  }

  DeviceEventEmitter.emit('progress-start', action);
  try {
    // dispatch is a mutation on the server, including its read-only actions.
    const input = { action, ...bodyData };
    const result = signal
      ? await (trpcVanillaClient.admin as any).dispatch.mutate(input, { signal })
      : await (trpcVanillaClient.admin as any).dispatch.mutate(input);
    return result;
  } catch (trpcError: any) {
    if (shouldSkipRestFallback(trpcError, signal)) {
      return recordFailureCause(
        { success: false, error: trpcError?.message || 'Network error executing request.' },
        signal?.aborted ? createAbortError() : trpcError,
      );
    }

    console.warn(`[adminService] tRPC failed for action ${action}, falling back to REST:`, trpcError);

    // 2. Fallback to original REST logic (bounded by 8s deadline + caller signal)
    try {
      return await withDeadline(
        async (attemptSignal) => {
          let token: string | null = null;
          try {
            const authMod = authProfileNamespace as Record<string, any>;
            if (typeof authMod.getCachedAccessToken === 'function') {
              token = authMod.getCachedAccessToken();
            }
            if (!token && typeof authMod.getSessionWithTimeout === 'function') {
              const session = await authMod.getSessionWithTimeout(3000, attemptSignal);
              token = session?.access_token ?? null;
            }
          } catch {
            // Partial Vitest mocks of authProfile may omit helpers.
          }
          if (!token) {
            const { data: { session } } = await supabase.auth.getSession();
            token = session?.access_token ?? null;
          }
          if (attemptSignal.aborted) {
            throw attemptSignal.reason ?? createAbortError();
          }
          const apiUrl = getApiUrl();

          const response = await fetch(`${apiUrl}/api/admin/actions`, {
            method: 'POST',
            headers: {
              ...SPLIT_READER_HEADERS,
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              action,
              ...bodyData,
            }),
            signal: attemptSignal,
          });

          if (!response.ok) {
            const errText = await response.text();
            let errMsg = 'Failed to execute admin action.';
            let errorCode: string | undefined;
            try {
              const parsed = JSON.parse(errText);
              errMsg = parsed.error || parsed.message || errMsg;
              errorCode = typeof parsed.code === 'string' ? parsed.code : undefined;
            } catch {
              if (errText && !/^\s*</.test(errText)) {
                errMsg = errText.slice(0, 100);
              }
            }
            return recordFailureCause(
              { success: false, error: errMsg, ...(errorCode ? { code: errorCode } : {}) },
              { status: response.status, code: errorCode },
            );
          }

          return await response.json();
        },
        restTimeoutMs,
        signal,
        `Admin action ${action}`,
      );
    } catch (error: any) {
      console.error(`[adminService] REST fallback error running action ${action}:`, error);
      return recordFailureCause(
        { success: false, error: error?.message || 'Network error executing request.' },
        error,
      );
    }
  } finally {
    DeviceEventEmitter.emit('progress-finish', action);
  }
};

export const getExportLedgerCsv = async (
  filters: {
    allTime: boolean;
    startYear?: number;
    startMonth?: number;
    endYear?: number;
    endMonth?: number;
  },
  signal?: AbortSignal,
) => {
  if (signal?.aborted) {
    return { success: false, error: 'Request aborted.' };
  }

  try {
    // 1. Try tRPC query
    const input = {
      allTime: filters.allTime,
      startYear: filters.startYear,
      startMonth: filters.startMonth,
      endYear: filters.endYear,
      endMonth: filters.endMonth,
    };
    const csvContent = signal
      ? await (trpcVanillaClient.admin as any).exportReport.query(input, { signal })
      : await (trpcVanillaClient.admin as any).exportReport.query(input);
    return { success: true, csv: csvContent };
  } catch (trpcError: any) {
    if (shouldSkipRestFallback(trpcError, signal)) {
      return { success: false, error: trpcError?.message || 'Failed to download report ledger CSV.' };
    }

    console.warn('[adminService] tRPC ledger export failed, falling back to REST:', trpcError);

    // 2. Fallback to REST (bounded by 8s deadline + caller signal)
    try {
      return await withDeadline(
        async (attemptSignal) => {
          let token: string | null = null;
          try {
            const authMod = authProfileNamespace as Record<string, any>;
            if (typeof authMod.getCachedAccessToken === 'function') {
              token = authMod.getCachedAccessToken();
            }
            if (!token && typeof authMod.getSessionWithTimeout === 'function') {
              const session = await authMod.getSessionWithTimeout(3000, attemptSignal);
              token = session?.access_token ?? null;
            }
          } catch {
            // Partial Vitest mocks of authProfile may omit helpers.
          }
          if (!token) {
            const { data: { session } } = await supabase.auth.getSession();
            token = session?.access_token ?? null;
          }
          if (attemptSignal.aborted) {
            throw attemptSignal.reason ?? createAbortError();
          }
          const apiUrl = getApiUrl();

          let queryParams = `?allTime=${filters.allTime}`;
          if (!filters.allTime && filters.startYear) {
            queryParams += `&startYear=${filters.startYear}&startMonth=${filters.startMonth}&endYear=${filters.endYear}&endMonth=${filters.endMonth}`;
          }

          const response = await fetch(`${apiUrl}/api/admin/reports/export${queryParams}`, {
            method: 'GET',
            headers: {
              ...SPLIT_READER_HEADERS,
              'Authorization': `Bearer ${token}`,
            },
            signal: attemptSignal,
          });

          if (!response.ok) {
            throw new Error(`Server returned status ${response.status}`);
          }

          const csvContent = await response.text();
          return { success: true, csv: csvContent };
        },
        ADMIN_REST_TIMEOUT_MS,
        signal,
        'Admin ledger export',
      );
    } catch (error: any) {
      console.error('[adminService] Error fetching ledger CSV:', error);
      return { success: false, error: error?.message || 'Failed to download report ledger CSV.' };
    }
  }
};


export const fetchAdminDashboardData = async (signal?: AbortSignal) => {
  try {
    const response = await callAdminApi('fetch-admin-dashboard', {}, signal ? { signal } : undefined);
    return response;
  } catch (error: any) {
    console.error('[adminService] Error in fetchAdminDashboardData:', error);
    return { success: false, error: error?.message || 'Network error.' };
  }
};

export async function fetchAdminActionOrThrow<T = any>(
  action: string,
  bodyData: Record<string, any> = {},
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) {
    throw createAbortError(typeof signal.reason === 'string' ? signal.reason : undefined);
  }
  const res = await callAdminApi(action, bodyData, signal ? { signal } : undefined);
  if (signal?.aborted) {
    throw createAbortError(typeof signal.reason === 'string' ? signal.reason : undefined);
  }
  if (!res || !res.success) {
    const cause = res && typeof res === 'object' ? adminFailureCauses.get(res) : undefined;
    if (cause instanceof Error && cause.name === 'AbortError') {
      throw cause;
    }
    const err = new Error(res?.error || `Failed to execute ${action}.`) as Error & {
      code?: string;
      status?: number;
      cause?: unknown;
    };
    if (res?.code) err.code = res.code;
    if (cause && typeof cause === 'object') {
      err.cause = cause;
      const causeRecord = cause as Record<string, any>;
      const status = causeRecord.data?.httpStatus ?? causeRecord.status ?? causeRecord.statusCode;
      if (typeof status === 'number') err.status = status;
    }
    throw err;
  }
  return res as T;
}

export const fetchAdminDashboardOrThrow = (signal?: AbortSignal) =>
  fetchAdminActionOrThrow('fetch-admin-dashboard', {}, signal);

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
