import { storage } from '../utils/queryPersister';
import { supabase } from '../utils/supabase';
import { callAdminApi } from './adminService';
import { trpcVanillaClient } from '../utils/trpc';

export const EXPENSES_CACHE_KEY = '@expenses_dashboard_cache';

export type PaymentSource = 'CASH' | 'BANK' | 'GCASH' | 'SPAY' | 'ATOME' | 'BDO' | 'MARIBANK';
export type ExpenseType = 'NEED' | 'WANT' | 'SUBSCRIPTION' | 'INFLOW';

export interface QuickShortcut {
  id: string;
  emoji: string;
  title: string;
  amount: number;
  category: string;
  paymentSource: PaymentSource;
  expenseType: 'NEED' | 'WANT' | 'SUBSCRIPTION';
}

export const DEFAULT_QUICK_SHORTCUTS: QuickShortcut[] = [
  { id: 'sc-1', emoji: '🚌', title: 'Jeep Fare', amount: 13, category: 'Transportation', paymentSource: 'CASH', expenseType: 'NEED' },
  { id: 'sc-2', emoji: '☕', title: 'Coffee', amount: 50, category: 'Food & Drinks', paymentSource: 'GCASH', expenseType: 'WANT' },
  { id: 'sc-3', emoji: '🍚', title: 'Lunch Meal', amount: 120, category: 'Food & Drinks', paymentSource: 'CASH', expenseType: 'NEED' },
  { id: 'sc-4', emoji: '🍞', title: 'Snacks', amount: 35, category: 'Food & Drinks', paymentSource: 'CASH', expenseType: 'NEED' },
  { id: 'sc-5', emoji: '🛺', title: 'Tricycle', amount: 25, category: 'Transportation', paymentSource: 'CASH', expenseType: 'NEED' },
];

export interface ExpenseInput {
  title: string;
  amount: number;
  category: string;
  paymentSource: PaymentSource;
  expenseType: ExpenseType;
  labels?: string;
  notes?: string;
  expenseDate?: string;
}

export interface AtomeOrderInput {
  merchantName: string;
  totalAmount: number;
  termType: 'PAY_LATER_40D' | 'INSTALLMENT_3M' | 'INSTALLMENT_6M' | 'INSTALLMENT_12M';
  purchaseDate?: string;
  notes?: string;
  markAllPaid?: boolean;
}

export interface SPayOrderInput {
  itemName: string;
  amount: number;
  installmentMonths: number;
  orderDate?: string;
  category?: string;
  remarks?: string;
}

export interface ExpenseItem {
  id: string;
  title: string;
  amount: number;
  category: string;
  paymentSource: PaymentSource;
  expenseType: ExpenseType;
  labels?: string;
  notes?: string;
  expenseDate: string;
  createdAt: string;
}

export interface CashBalances {
  cashOnHand: number;
  bdoBalance: number;
  maribankBalance: number;
  bankBalance: number;
  gcashBalance: number;
  totalLiquidCash: number;
  totalIponSavings: number;
  grandTotalCash: number;
  iponSavingsBySource: Record<string, number>;
  totalPhysicalCash: number;
  totalMariBank: number;
  totalBDO: number;
  totalGCash: number;
}

export interface PaydaySummary {
  nextPaydayIso: string;
  daysTilPayday: number;
  monthlyIncome: number;
  expectedPaydayIncome: number;
}

export interface BillCardConfigItem {
  id?: string;
  cardName: string;
  billingCutoffDay: number;
  paymentDueDay: number;
  creditLimit: number;
}

export interface MonthlyCashFlowItem {
  month: string;
  income: number;
  expense: number;
  spay: number;
  atome: number;
  bankCash: number;
  bdo: number;
  maribank: number;
  gcash: number;
  cash: number;
  other: number;
  net: number;
}

export interface DebtPayoffTrajectoryItem {
  month: string;
  spayDues: number;
  atomeDues: number;
  monthlyPayment: number;
  cumulativeDebtRemaining: number;
}

export interface DailySpendTrendItem {
  day: string;
  amount: number;
  spay: number;
  atome: number;
  bankCash: number;
}

export interface PaymentHistoryItem {
  id: string;
  title: string;
  category: string;
  source: string;
  platform: string;
  amount: number;
  type: 'PAYMENT' | 'EXPENSE' | 'INFLOW';
  date: string;
  status: 'PAID' | 'COMPLETED' | 'UNPAID';
  notes?: string;
}

export interface AdminExpensesDashboardData {
  userProfile?: {
    id: string;
    name: string;
    email: string;
    role: string;
    mobileNumber?: string;
  };
  balances: CashBalances;
  payday: PaydaySummary;
  billCardConfigs?: BillCardConfigItem[];
  shortcuts: QuickShortcut[];
  recentExpenses: ExpenseItem[];
  paymentHistory: PaymentHistoryItem[];
  monthlyCashFlow: MonthlyCashFlowItem[];
  debtPayoffTrajectory: DebtPayoffTrajectoryItem[];
  dailySpendTrend: DailySpendTrendItem[];
  categoryTotals: Record<string, number>;
  sourceTotals: Record<string, number>;
  totalPendingBills: number;
  creditUtilizationPct: number;
  spayCreditUtilizationPct: number;
  monthlyBurnRate: number;
  runwayMonths: number;
  needsTotal: number;
  wantsTotal: number;
  subsTotal: number;
  quickShortcuts?: QuickShortcut[];
  billsSummary?: any;
  upcomingPlannedPayments?: any[];
  unpaidBillsMonthlyBreakdown?: any[];
  atomeOrders?: any[];
  activeIponGoals?: any[];
  spayTotalUnpaid?: number;
  atomeTotalUnpaid?: number;
  spayCreditLimit?: number;
  spayUsedCredit?: number;
  spayAvailableCredit?: number;
  atomeCreditLimit?: number;
  atomeUsedCredit?: number;
  atomeAvailableCredit?: number;
  grandTotalCash?: number;
  [key: string]: any;
}

export type ExpensesDashboardData = AdminExpensesDashboardData;

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
 * Execute generic admin expenses actions with backend + REST fallback
 */
export async function postExpensesAction<T = any>(
  action: string,
  payload: Record<string, any> = {}
): Promise<{ success: boolean; data?: T; error?: string; [key: string]: any }> {
  try {
    const headers = await getAuthHeaders();
    const apiUrl = getApiUrl();
    const res = await fetch(`${apiUrl}/api/admin/expenses`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, ...payload }),
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    }

    return await callAdminApi(action, payload);
  } catch (err: any) {
    console.warn(`[expensesService] postExpensesAction error for action "${action}":`, err);
    return { success: false, error: err?.message || 'Network request failed' };
  }
}

/**
 * Normalizes and calculates liquid cash & runway figures
 */
export function calculateLiquidCash(balances: Partial<CashBalances>): number {
  const cashOnHand = Number(balances.cashOnHand || 0);
  const bdoBalance = Number(balances.bdoBalance || 0);
  const maribankBalance = Number(balances.maribankBalance || 0);
  const bankBalance = Number(balances.bankBalance || 0);
  const gcashBalance = Number(balances.gcashBalance || 0);
  return Math.round((cashOnHand + bdoBalance + maribankBalance + bankBalance + gcashBalance) * 100) / 100;
}

export function calculateRunwayMonths(liquidCash: number, monthlyBurnRate: number): number {
  if (monthlyBurnRate <= 0) return 999;
  return Math.round((liquidCash / monthlyBurnRate) * 10) / 10;
}

/**
 * Fetch full Expenses Dashboard dataset with MMKV caching + fallback
 */
export async function getExpensesDashboardData(forceRefresh = false): Promise<AdminExpensesDashboardData> {
  // 1. Read MMKV cache if available
  if (!forceRefresh) {
    try {
      const cached = storage.getString(EXPENSES_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as AdminExpensesDashboardData;
        if (parsed && parsed.balances) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[expensesService] Failed to read MMKV cache:', e);
    }
  }

  // 2. Fetch fresh data via direct GET /api/admin/expenses with callAdminApi fallback
  try {
    const headers = await getAuthHeaders();
    const apiUrl = getApiUrl();
    const res = await fetch(`${apiUrl}/api/admin/expenses`, {
      method: 'GET',
      headers,
    });

    if (res.ok) {
      const json = await res.json();
      const payload: AdminExpensesDashboardData = json.data || json;
      if (payload && payload.balances) {
        try {
          storage.set(EXPENSES_CACHE_KEY, JSON.stringify(payload));
        } catch (e) {
          console.warn('[expensesService] Failed to set MMKV cache:', e);
        }
        return payload;
      }
    }

    // Secondary fallback via callAdminApi action
    const actionRes = await callAdminApi('fetch-admin-expenses');
    if (actionRes && actionRes.success !== false && (actionRes.balances || actionRes.data?.balances)) {
      const data: AdminExpensesDashboardData = actionRes.balances ? actionRes : actionRes.data;
      try {
        storage.set(EXPENSES_CACHE_KEY, JSON.stringify(data));
      } catch (e) {
        console.warn('[expensesService] Failed to set MMKV cache:', e);
      }
      return data;
    }
  } catch (error) {
    console.error('[expensesService] Error fetching expenses dashboard data:', error);
  }

  // 3. Fallback to cached state even if expired
  try {
    const fallbackCached = storage.getString(EXPENSES_CACHE_KEY);
    if (fallbackCached) {
      const parsed = JSON.parse(fallbackCached);
      if (parsed && parsed.balances) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }

  // Default robust fallback mock
  const fallbackLiquid = 0;
  return {
    userProfile: {
      id: 'admin',
      name: 'Admin',
      email: 'admin@spay.ph',
      role: 'ADMIN',
      mobileNumber: '',
    },
    balances: {
      cashOnHand: 0,
      bdoBalance: 0,
      maribankBalance: 0,
      bankBalance: 0,
      gcashBalance: 0,
      totalLiquidCash: fallbackLiquid,
      totalIponSavings: 0,
      grandTotalCash: 0,
      iponSavingsBySource: { CASH: 0, MARIBANK: 0, BDO: 0, GCASH: 0 },
      totalPhysicalCash: 0,
      totalMariBank: 0,
      totalBDO: 0,
      totalGCash: 0,
    },
    payday: {
      nextPaydayIso: new Date().toISOString(),
      daysTilPayday: 0,
      monthlyIncome: 0,
      expectedPaydayIncome: 15000,
    },
    billsSummary: {
      spayTotalUnpaid: 0,
      atomeTotalUnpaid: 0,
      totalPendingBills: 0,
      spayCreditLimit: 50000,
      spayUsedCredit: 0,
      spayCreditUtilizationPct: 0,
      spayCutoffDay: 25,
      spayDueDay: 15,
      atomeCreditLimit: 30000,
      atomeUsedCredit: 0,
      creditUtilizationPct: 0,
      atomeCutoffDay: 25,
      atomeDueDay: 12,
      unpaidBillsMonthlyBreakdown: [],
    },
    shortcuts: DEFAULT_QUICK_SHORTCUTS,
    quickShortcuts: DEFAULT_QUICK_SHORTCUTS,
    recentExpenses: [],
    paymentHistory: [],
    monthlyCashFlow: [],
    debtPayoffTrajectory: [],
    dailySpendTrend: [],
    categoryTotals: {},
    sourceTotals: { BDO: 0, MARIBANK: 0, GCASH: 0, CASH: 0, SPAY: 0, ATOME: 0 },
    totalPendingBills: 0,
    creditUtilizationPct: 0,
    spayCreditUtilizationPct: 0,
    monthlyBurnRate: 0,
    runwayMonths: 999,
    needsTotal: 0,
    wantsTotal: 0,
    subsTotal: 0,
    insights: {
      dailyAverageSpend: 0,
      cashRunwayDays: 999,
      healthGauge: 'GREEN',
      needsTotal: 0,
      wantsTotal: 0,
      subsTotal: 0,
      categoryTotals: {},
      sourceTotals: { BDO: 0, MARIBANK: 0, GCASH: 0, CASH: 0, SPAY: 0, ATOME: 0 },
    },
    analytics: {
      monthlyCashFlow: [],
      debtPayoffTrajectory: [],
      dailySpendTrend: [],
    },
    upcomingPlannedPayments: [],
    atomeOrders: [],
    spayOrders: [],
    iponGoals: [],
    billCardConfigs: [],
  };
}

/**
 * Add a new Expense entry
 */
export async function addExpense(input: ExpenseInput): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await callAdminApi('add-admin-expense', input);
    if (res && res.success !== false) {
      return { success: true, data: res.data || res };
    }
    return { success: false, error: res?.error || 'Failed to add expense' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error adding expense' };
  }
}

/**
 * Update an existing Expense entry
 */
export async function updateExpense(
  id: string,
  input: Partial<ExpenseInput>
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await callAdminApi('update-expense', { id, ...input });
    if (res && res.success !== false) {
      return { success: true, data: res.data || res };
    }
    return { success: false, error: res?.error || 'Failed to update expense' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error updating expense' };
  }
}

/**
 * Delete an Expense entry
 */
export async function deleteExpense(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await callAdminApi('delete-expense', { id });
    if (res && res.success !== false) {
      return { success: true };
    }
    return { success: false, error: res?.error || 'Failed to delete expense' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error deleting expense' };
  }
}

/**
 * Update Liquid Cash on Hand balances
 */
export async function updateCashOnHand(
  cashOnHand: number,
  bankBalance: number,
  gcashBalance: number,
  bdoBalance = 0,
  maribankBalance = 0
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await callAdminApi('update-cash-on-hand', {
      cashOnHand,
      bankBalance,
      gcashBalance,
      bdoBalance,
      maribankBalance,
    });
    if (res && res.success !== false) {
      return { success: true };
    }
    return { success: false, error: res?.error || 'Failed to update cash on hand' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error updating cash balances' };
  }
}

/**
 * Transfer Cash to Ipon savings goal
 */
export async function transferCashToIpon(
  goalId: string,
  amount: number,
  note?: string,
  source?: 'CASH' | 'MARIBANK' | 'BDO' | 'GCASH'
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await callAdminApi('transfer-cash-to-ipon', {
      goalId,
      amount,
      note,
      source: source || 'CASH',
    });
    if (res && res.success !== false) {
      return { success: true };
    }
    return { success: false, error: res?.error || 'Failed to transfer cash to ipon' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error transferring cash to ipon' };
  }
}

/**
 * Create Atome Buy Now Pay Later order
 */
export async function createAtomeOrder(
  input: AtomeOrderInput
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await callAdminApi('create-atome-order', input);
    if (res && res.success !== false) {
      return { success: true, data: res.data || res };
    }
    return { success: false, error: res?.error || 'Failed to create Atome order' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error creating Atome order' };
  }
}

/**
 * Pay single Atome Card installment
 */
export async function payAtomeInstallment(
  paymentId: string,
  amount: number,
  paymentSource: 'CASH' | 'BANK' | 'GCASH' = 'CASH'
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await callAdminApi('pay-atome-installment', {
      paymentId,
      amount,
      paymentSource,
    });
    if (res && res.success !== false) {
      return { success: true };
    }
    return { success: false, error: res?.error || 'Failed to pay Atome installment' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error paying Atome installment' };
  }
}

/**
 * Bulk pay multiple Atome Card installments
 */
export async function bulkPayAtomeInstallments(
  paymentIds: string[],
  paymentSource: 'CASH' | 'BANK' | 'GCASH' = 'CASH'
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await callAdminApi('bulk-pay-atome-installments', {
      paymentIds,
      paymentSource,
    });
    if (res && res.success !== false) {
      return { success: true };
    }
    return { success: false, error: res?.error || 'Failed to bulk pay Atome installments' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error bulk paying Atome installments' };
  }
}

/**
 * Pay Shopee SPayLater Bill
 */
export async function paySPayBill(
  paymentId: string,
  amount: number,
  paymentSource: 'CASH' | 'BANK' | 'GCASH' = 'CASH'
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await callAdminApi('pay-spay-bill', {
      paymentId,
      amount,
      paymentSource,
    });
    if (res && res.success !== false) {
      return { success: true };
    }
    return { success: false, error: res?.error || 'Failed to pay SPay bill' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error paying SPay bill' };
  }
}

/**
 * Update Bill Card Configuration (cutoff, due date, limit)
 */
export async function updateBillCardConfig(
  cardName: string,
  billingCutoffDay: number,
  paymentDueDay: number,
  creditLimit: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await callAdminApi('update-bill-card-config', {
      cardName,
      billingCutoffDay,
      paymentDueDay,
      creditLimit,
    });
    if (res && res.success !== false) {
      return { success: true };
    }
    return { success: false, error: res?.error || 'Failed to update bill card configuration' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error updating bill card config' };
  }
}

/**
 * Save Quick Expense Shortcut presets
 */
export async function saveQuickExpenseShortcuts(
  shortcuts: QuickShortcut[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await callAdminApi('save-quick-shortcuts', { shortcuts });
    if (res && res.success !== false) {
      return { success: true };
    }
    return { success: false, error: res?.error || 'Failed to save quick shortcuts' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error saving quick shortcuts' };
  }
}

/**
 * Receive Salary Inflow into cash/bank accounts
 */
export async function receiveSalaryInflow(
  amount: number,
  destination: 'CASH' | 'BANK' | 'GCASH' | 'BDO' | 'MARIBANK',
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await callAdminApi('receive-salary-inflow', {
      amount,
      destination,
      notes,
    });
    if (res && res.success !== false) {
      return { success: true };
    }
    return { success: false, error: res?.error || 'Failed to receive salary inflow' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error receiving salary inflow' };
  }
}

/**
 * Reverse Salary Inflow from cash/bank accounts
 */
export async function reverseSalaryInflow(
  amount: number,
  destination: 'CASH' | 'BANK' | 'GCASH' | 'BDO' | 'MARIBANK'
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await callAdminApi('reverse-salary-inflow', {
      amount,
      destination,
    });
    if (res && res.success !== false) {
      return { success: true };
    }
    return { success: false, error: res?.error || 'Failed to reverse salary inflow' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error reversing salary inflow' };
  }
}

/**
 * Export Expenses Ledger CSV
 */
export async function exportExpensesCsv(): Promise<{
  success: boolean;
  csv?: string;
  filename?: string;
  error?: string;
}> {
  try {
    const res = await callAdminApi('export-expenses-csv');
    if (res && res.success !== false && (res.csv || res.data?.csv)) {
      return {
        success: true,
        csv: res.csv || res.data?.csv,
        filename: res.filename || `expenses_export_${new Date().toISOString().slice(0, 10)}.csv`,
      };
    }
    return { success: false, error: res?.error || 'Failed to export expenses CSV' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error exporting CSV' };
  }
}

/**
 * Clear cached MMKV expenses data
 */
export function clearExpensesCache(): void {
  try {
    storage.delete(EXPENSES_CACHE_KEY);
  } catch (e) {
    console.warn('[expensesService] Failed to delete MMKV cache:', e);
  }
}
