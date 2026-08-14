import { storage } from '../utils/queryPersister';
import { supabase } from '../utils/supabase';
import { callAdminApi } from './adminService';

export const IPON_CACHE_KEY = '@ipon_overview_cache';

export interface AdminIponInput {
  goalType: string;
  targetAmount: number;
  targetDate: string | null;
  isRecurring: boolean;
  recurrenceInterval: string | null;
  recurringAmount: number | null;
  color: string;
  theme: string;
}

export interface AdminIponDeposit {
  id: string;
  goalId?: string;
  amount: number;
  note?: string;
  source?: string;
  holdingSource?: string;
  depositDate: string;
  createdAt?: string;
  goal?: {
    goalType: string;
    color: string;
    theme: string;
  };
}

export interface AdminIponGoal {
  id: string;
  userId?: string;
  goalType: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  category?: string;
  status: 'active' | 'completed' | 'archived';
  isRecurring: boolean;
  recurrenceInterval: string | null;
  recurringAmount: number | null;
  color: string;
  theme: string;
  progressPct: number;
  deposits: AdminIponDeposit[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminIponSummary {
  totalTarget: number;
  totalSaved: number;
  overallProgressPct: number;
  activeGoalsCount: number;
  completedGoalsCount: number;
}

export interface AdminIponOverviewData {
  summary: AdminIponSummary;
  goals: AdminIponGoal[];
  recentDeposits: AdminIponDeposit[];
}

const getApiUrl = () => {
  const url = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (url) return url.replace(/\/$/, '');
  return 'https://nootspaytracker.vercel.app';
};

const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
};

/**
 * Calculates percentage completion for a savings goal (0 - 100%)
 */
export function calculateGoalProgressPct(current: number, target: number): number {
  if (!target || target <= 0) return 0;
  if (!current || current <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

/**
 * Fetch full Ipon Savings Goal dataset with MMKV caching + fallback
 */
export async function getAdminIponData(forceRefresh = false): Promise<AdminIponOverviewData> {
  // 1. Read MMKV cache if available
  if (!forceRefresh) {
    try {
      const cached = storage.getString(IPON_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as AdminIponOverviewData;
        if (parsed && parsed.summary && Array.isArray(parsed.goals)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[iponService] Failed to read MMKV cache:', e);
    }
  }

  // 2. Fetch fresh data via tRPC / REST dispatch
  try {
    const res = await callAdminApi('fetch-admin-ipon');
    if (res && res.success !== false && (res.summary || res.data?.summary)) {
      const data: AdminIponOverviewData = res.summary ? res : res.data;
      try {
        storage.set(IPON_CACHE_KEY, JSON.stringify(data));
      } catch (e) {
        console.warn('[iponService] Failed to set MMKV cache:', e);
      }
      return data;
    }

    // Direct REST fallback if callAdminApi returned error
    const headers = await getAuthHeaders();
    const apiUrl = getApiUrl();
    const fallbackRes = await fetch(`${apiUrl}/api/admin/actions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'fetch-admin-ipon' }),
    });

    if (fallbackRes.ok) {
      const json = await fallbackRes.json();
      const payload: AdminIponOverviewData = json.data || json;
      try {
        storage.set(IPON_CACHE_KEY, JSON.stringify(payload));
      } catch (e) {
        console.warn('[iponService] Failed to set MMKV cache on REST fallback:', e);
      }
      return payload;
    }
  } catch (error) {
    console.error('[iponService] Error fetching ipon overview data:', error);
  }

  // 3. Fallback to cached state even if expired
  try {
    const fallbackCached = storage.getString(IPON_CACHE_KEY);
    if (fallbackCached) {
      return JSON.parse(fallbackCached);
    }
  } catch {
    // ignore
  }

  // Default fallback mock
  return {
    summary: {
      totalTarget: 0,
      totalSaved: 0,
      overallProgressPct: 0,
      activeGoalsCount: 0,
      completedGoalsCount: 0,
    },
    goals: [],
    recentDeposits: [],
  };
}

/**
 * Create a new Ipon Goal
 */
export async function createIponGoal(
  input: AdminIponInput
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await callAdminApi('create-ipon-goal', input);
    if (res && res.success !== false) {
      return { success: true, data: res.data || res };
    }
    return { success: false, error: res?.error || 'Failed to create ipon goal' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error creating ipon goal' };
  }
}

/**
 * Update an existing Ipon Goal
 */
export async function updateIponGoal(
  goalId: string,
  input: AdminIponInput
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await callAdminApi('update-ipon-goal', { goalId, ...input });
    if (res && res.success !== false) {
      return { success: true, data: res.data || res };
    }
    return { success: false, error: res?.error || 'Failed to update ipon goal' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error updating ipon goal' };
  }
}

/**
 * Delete an Ipon Goal
 */
export async function deleteIponGoal(goalId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await callAdminApi('delete-ipon-goal', { goalId });
    if (res && res.success !== false) {
      return { success: true };
    }
    return { success: false, error: res?.error || 'Failed to delete ipon goal' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error deleting ipon goal' };
  }
}

/**
 * Make a deposit to an Ipon Goal
 */
export async function depositToIponGoal(
  goalId: string,
  amount: number,
  note?: string,
  source?: 'CASH' | 'MARIBANK' | 'BDO' | 'GCASH'
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await callAdminApi('deposit-to-ipon-goal', {
      goalId,
      amount,
      note,
      source: source || 'CASH',
    });
    if (res && res.success !== false) {
      return { success: true, data: res.data || res };
    }
    return { success: false, error: res?.error || 'Failed to deposit to ipon goal' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error depositing to ipon goal' };
  }
}

/**
 * Update an existing Ipon deposit record
 */
export async function updateIponDeposit(
  depositId: string,
  goalId: string,
  newAmount: number,
  newMessage?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await callAdminApi('update-ipon-deposit', {
      depositId,
      goalId,
      newAmount,
      newMessage,
    });
    if (res && res.success !== false) {
      return { success: true };
    }
    return { success: false, error: res?.error || 'Failed to update ipon deposit' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error updating ipon deposit' };
  }
}

/**
 * Delete an Ipon deposit record
 */
export async function deleteIponDeposit(
  depositId: string,
  goalId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await callAdminApi('delete-ipon-deposit', {
      depositId,
      goalId,
    });
    if (res && res.success !== false) {
      return { success: true };
    }
    return { success: false, error: res?.error || 'Failed to delete ipon deposit' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error deleting ipon deposit' };
  }
}

/**
 * Clear cached MMKV ipon overview data
 */
export function clearIponCache(): void {
  try {
    storage.delete(IPON_CACHE_KEY);
  } catch (e) {
    console.warn('[iponService] Failed to delete MMKV cache:', e);
  }
}
